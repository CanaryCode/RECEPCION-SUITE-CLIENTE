/**
 * Módulo de Auto-Actualización para Recepción Suite Agent
 * Gestiona la descarga, verificación e instalación de actualizaciones
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

class Updater {
    constructor(config = {}) {
        this.serverUrl = config.serverUrl || 'https://www.desdetenerife.com:3000';
        this.agentRoot = path.resolve(__dirname, '..');
        this.backupDir = path.join(this.agentRoot, '.backup');
        this.tempDir = path.join(this.agentRoot, '.update_temp');
        this.versionFile = path.join(this.agentRoot, 'package.json');
        this.logFile = path.join(this.agentRoot, 'logs', 'agent.log');

        this.status = {
            checking: false,
            downloading: false,
            installing: false,
            error: null,
            progress: 0,
            currentFile: null
        };

        this.listeners = [];
    }

    /**
     * Escribe logs en el archivo agent.log
     */
    logToFile(msg) {
        try {
            const time = new Date().toISOString();
            fs.appendFileSync(this.logFile, `[UPDATER-CORE] ${time} - ${msg}\n`);
            console.log(`[UPDATER-CORE] ${msg}`);
        } catch (e) {
            console.error('Error escribiendo en agent.log:', e);
        }
    }

    /**
     * Registrar listeners para eventos de actualización
     */
    on(event, callback) {
        this.listeners.push({ event, callback });
    }

    emit(event, data) {
        this.logToFile(`Emitting event: ${event} ${JSON.stringify(data || {})}`);
        this.listeners
            .filter(l => l.event === event)
            .forEach(l => l.callback(data));
    }

    /**
     * Obtiene la versión actual del agent
     */
    getCurrentVersion() {
        try {
            const pkg = JSON.parse(fs.readFileSync(this.versionFile, 'utf8'));
            return pkg.version || '1.0.0';
        } catch (error) {
            console.error('Error leyendo versión actual:', error);
            return '1.0.0';
        }
    }

    /**
     * Verifica si hay actualizaciones disponibles
     */
    async checkForUpdates() {
        this.status.checking = true;
        this.status.error = null;
        this.emit('checking', {});

        try {
            const currentVersion = this.getCurrentVersion();
            const url = `${this.serverUrl}/api/updates/check?version=${currentVersion}`;

            const result = await this.httpRequest(url);

            this.status.checking = false;
            this.emit('checked', result);

            return result;
        } catch (error) {
            this.status.checking = false;
            this.status.error = error.message;
            this.emit('error', { message: error.message });
            throw error;
        }
    }

    /**
     * Descarga e instala la actualización
     */
    async downloadAndInstall() {
        this.logToFile('Iniciando proceso downloadAndInstall...');
        try {
            this.status.downloading = true;
            this.status.progress = 0;
            this.emit('download_start', {});

            // 1. Obtener manifiesto de archivos
            this.logToFile('Obteniendo manifiesto del servidor...');
            const manifest = await this.getManifest();
            this.logToFile(`Manifiesto recibido. Versión servidor: ${manifest.version}. Archivos: ${manifest.files.length}`);

            // 2. Crear backup
            await this.createBackup();

            // 3. Crear directorio temporal
            this.logToFile(`Asegurando directorio temporal: ${this.tempDir}`);
            this.ensureDir(this.tempDir);

            // 4. Descargar archivos
            this.logToFile('Comparando y descargando archivos...');
            const filesToUpdate = await this.compareAndDownloadFiles(manifest.files);
            this.logToFile(`Comparación finalizada. Archivos que requieren actualización: ${filesToUpdate.length}`);

            if (filesToUpdate.length === 0) {
                this.logToFile('No hay archivos que actualizar, actualizando package.json...');
                
                // Actualizar versión en package.json de todas formas si no hay archivos modificados
                await this.updateVersion(manifest.version);
                
                this.status.downloading = false;
                this.status.installing = false;
                this.status.progress = 100;
                this.emit('complete', { filesUpdated: 0 });
                this.logToFile('Actualización completada (sin cambios en archivos)');
                return { success: true, filesUpdated: 0, needsRestart: true };
            }

            // 5. Instalar archivos
            this.logToFile(`Iniciando instalación de ${filesToUpdate.length} archivos...`);
            this.status.downloading = false;
            this.status.installing = true;
            this.emit('install_start', {});

            await this.installFiles(filesToUpdate);
            this.logToFile('Archivos instalados correctamente.');

            // 6. Actualizar versión en package.json
            await this.updateVersion(manifest.version);

            // 7. Recompilar launcher si es necesario
            const needsRecompile = filesToUpdate.some(f => f.path.includes('launcher/'));
            if (needsRecompile) {
                this.logToFile('Se detectaron cambios en el launcher. Recompilando...');
                await this.recompileLauncher();
            }

            // 8. Limpiar
            this.cleanup();

            this.status.installing = false;
            this.status.progress = 100;
            this.emit('complete', { filesUpdated: filesToUpdate.length });
            this.logToFile('PROCESO DE ACTUALIZACIÓN FINALIZADO CON ÉXITO');

            return {
                success: true,
                filesUpdated: filesToUpdate.length,
                needsRestart: true,
                needsRecompile: needsRecompile
            };

        } catch (error) {
            this.logToFile(`FATAL ERROR EN ACTUALIZACIÓN: ${error.message}`);
            if (error.stack) this.logToFile(`Stack: ${error.stack}`);
            this.status.error = error.message;
            this.status.downloading = false;
            this.status.installing = false;
            this.emit('error', { message: error.message });

            // Intentar rollback
            try {
                this.logToFile('Iniciando ROLLBACK automático por error...');
                await this.rollback();
            } catch (rollbackError) {
                this.logToFile(`Error CRÍTICO en rollback: ${rollbackError.message}`);
            }

            throw error;
        }
    }

    /**
     * Obtiene el manifiesto de archivos del servidor
     */
    async getManifest() {
        const url = `${this.serverUrl}/api/updates/manifest`;
        this.logToFile(`Solicitando manifiesto a: ${url}`);
        const manifest = await this.httpRequest(url);
        return manifest;
    }

    /**
     * Compara archivos y descarga solo los modificados
     */
    async compareAndDownloadFiles(serverFiles) {
        this.logToFile(`Iniciando comparación de ${serverFiles.length} archivos.`);
        const filesToUpdate = [];
        const total = serverFiles.length;
        let current = 0;

        for (const fileInfo of serverFiles) {
            current++;
            this.status.progress = Math.floor((current / total) * 50); // 50% para descarga
            this.status.currentFile = fileInfo.path;
            this.emit('progress', {
                progress: this.status.progress,
                file: fileInfo.path
            });

            const localPath = path.join(this.agentRoot, fileInfo.path);
            let needsUpdate = true;

            // Verificar si el archivo existe y tiene el mismo hash
            if (fs.existsSync(localPath)) {
                const localHash = this.calculateFileHash(localPath);
                if (localHash === fileInfo.hash) {
                    needsUpdate = false;
                } else {
                    this.logToFile(`Hash mismatch en ${fileInfo.path}: Local=${localHash}, Server=${fileInfo.hash}`);
                }
            } else {
                this.logToFile(`Archivo local no existe: ${fileInfo.path}`);
            }

            if (needsUpdate) {
                this.logToFile(`[UPDATER] Descargando: ${fileInfo.path}`);
                const tempPath = path.join(this.tempDir, fileInfo.path);
                await this.downloadFile(fileInfo.path, tempPath);
                filesToUpdate.push({ ...fileInfo, tempPath, localPath });
            }
        }

        return filesToUpdate;
    }

    /**
     * Descarga un archivo del servidor
     */
    async downloadFile(filePath, destPath) {
        this.logToFile(`Descargando archivo: ${filePath} -> ${destPath}`);
        return new Promise((resolve, reject) => {
            const url = `${this.serverUrl}/api/updates/download/${filePath}`;

            // Crear directorio si no existe
            const dir = path.dirname(destPath);
            this.ensureDir(dir);

            const protocol = this.serverUrl.startsWith('https') ? https : http;
            
            const options = {
                rejectUnauthorized: false // Allow self-signed certs for testing
            };

            const startTime = Date.now();
            protocol.get(url, options, (response) => {
                if (response.statusCode !== 200) {
                    const err = new Error(`Error descargando ${filePath}: ${response.statusCode}`);
                    this.logToFile(err.message);
                    reject(err);
                    return;
                }

                const fileStream = fs.createWriteStream(destPath);
                response.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    const duration = Date.now() - startTime;
                    this.logToFile(`Descarga completa: ${filePath} (${duration}ms)`);
                    resolve();
                });

                fileStream.on('error', (err) => {
                    this.logToFile(`Error escribiendo archivo temporal ${destPath}: ${err.message}`);
                    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
                    reject(err);
                });
            }).on('error', (err) => {
                this.logToFile(`Error de red descargando ${filePath}: ${err.message}`);
                reject(err);
            });
        });
    }

    /**
     * Instala los archivos descargados
     */
    async installFiles(files) {
        this.logToFile(`Instalando ${files.length} archivos.`);
        const total = files.length;
        let current = 0;

        for (const file of files) {
            current++;
            this.status.progress = 50 + Math.floor((current / total) * 40); // 50-90%
            this.emit('progress', {
                progress: this.status.progress,
                file: file.path
            });

            this.logToFile(`[UPDATER] Instalando: ${file.path}`);

            // Crear directorio si no existe
            const dir = path.dirname(file.localPath);
            this.ensureDir(dir);

            // Copiar archivo
            try {
                fs.copyFileSync(file.tempPath, file.localPath);
            } catch (err) {
                this.logToFile(`Error copiando ${file.tempPath} a ${file.localPath}: ${err.message}`);
                throw err;
            }

            // Verificar hash (omitir para archivos .backup ya que son copias de seguridad)
            const isBackupFile = file.path.includes('.backup/') || file.path.includes('.update_temp/');
            if (!isBackupFile) {
                const installedHash = this.calculateFileHash(file.localPath);
                if (installedHash !== file.hash) {
                    const err = new Error(`Hash no coincide después de instalar: ${file.path}. Esperado: ${file.hash}, Instalado: ${installedHash}`);
                    this.logToFile(err.message);
                    throw err;
                }
            } else {
                this.logToFile(`Omitiendo verificación de hash para archivo de backup: ${file.path}`);
            }
        }
    }

    /**
     * Crea un backup de los archivos actuales
     */
    async createBackup() {
        this.logToFile('Creando backup de seguridad...');
        this.emit('backup_start', {});

        // Limpiar backup anterior
        if (fs.existsSync(this.backupDir)) {
            this.logToFile(`Eliminando backup antiguo en ${this.backupDir}`);
            fs.rmSync(this.backupDir, { recursive: true, force: true });
        }

        this.ensureDir(this.backupDir);

        // Copiar archivos importantes
        const filesToBackup = ['src', 'launcher', 'package.json'];
        this.logToFile(`Items a respaldar: ${filesToBackup.join(', ')}`);

        for (const item of filesToBackup) {
            const sourcePath = path.join(this.agentRoot, item);
            const destPath = path.join(this.backupDir, item);

            if (fs.existsSync(sourcePath)) {
                this.logToFile(`Respaldando ${item}...`);
                this.copyRecursive(sourcePath, destPath);
            } else {
                this.logToFile(`Aviso: Item ${item} no existe, saltando backup.`);
            }
        }

        this.logToFile('Backup creado exitosamente.');
    }

    /**
     * Restaura desde backup en caso de error
     */
    async rollback() {
        this.logToFile('!!! INICIANDO ROLLBACK !!!');
        this.emit('rollback_start', {});

        if (!fs.existsSync(this.backupDir)) {
            const err = new Error('No existe backup para restaurar');
            this.logToFile(err.message);
            throw err;
        }

        // Restaurar archivos
        const items = fs.readdirSync(this.backupDir);
        this.logToFile(`Restaurando items: ${items.join(', ')}`);
        for (const item of items) {
            const sourcePath = path.join(this.backupDir, item);
            const destPath = path.join(this.agentRoot, item);

            // Eliminar actual
            if (fs.existsSync(destPath)) {
                this.logToFile(`Eliminando ${destPath} antes de restaurar...`);
                fs.rmSync(destPath, { recursive: true, force: true });
            }

            // Restaurar backup
            this.logToFile(`Copiando desde backup: ${item}`);
            this.copyRecursive(sourcePath, destPath);
        }

        this.logToFile('Rollback completado satisfactoriamente.');
        this.emit('rollback_complete', {});
    }

    /**
     * Actualiza el número de versión en package.json
     */
    async updateVersion(newVersion) {
        console.log(`[UPDATER] Actualizando versión a ${newVersion}`);

        const pkg = JSON.parse(fs.readFileSync(this.versionFile, 'utf8'));
        pkg.version = newVersion;
        fs.writeFileSync(this.versionFile, JSON.stringify(pkg, null, 4));
    }

    /**
     * Recompila el launcher después de actualizar
     */
    async recompileLauncher() {
        console.log('[UPDATER] Recompilando launcher...');
        this.emit('recompile_start', {});

        const launcherScript = path.join(this.agentRoot, 'launcher', 'build_launcher.bat');

        if (!fs.existsSync(launcherScript)) {
            console.warn('[UPDATER] Script de compilación no encontrado');
            return;
        }

        try {
            // En Linux, necesitamos wine o similar para ejecutar .bat
            // Por ahora solo preparamos el script, la compilación se hará en Windows
            console.log('[UPDATER] Script de recompilación listo para ejecutar en Windows');

            this.status.progress = 95;
            this.emit('progress', { progress: 95 });
        } catch (error) {
            console.error('[UPDATER] Error recompilando launcher:', error);
            // No es crítico, continuar
        }
    }

    /**
     * Limpia archivos temporales
     */
    cleanup() {
        if (fs.existsSync(this.tempDir)) {
            fs.rmSync(this.tempDir, { recursive: true, force: true });
        }
    }

    /**
     * Calcula el hash SHA256 de un archivo
     */
    calculateFileHash(filePath) {
        try {
            const fileBuffer = fs.readFileSync(filePath);
            const hashSum = crypto.createHash('sha256');
            hashSum.update(fileBuffer);
            return hashSum.digest('hex');
        } catch (error) {
            return null;
        }
    }

    /**
     * Copia archivos/directorios recursivamente
     */
    copyRecursive(src, dest) {
        const stat = fs.statSync(src);

        if (stat.isDirectory()) {
            this.ensureDir(dest);
            const files = fs.readdirSync(src);
            for (const file of files) {
                this.copyRecursive(path.join(src, file), path.join(dest, file));
            }
        } else {
            fs.copyFileSync(src, dest);
        }
    }

    /**
     * Asegura que un directorio existe
     */
    ensureDir(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * Realiza una petición HTTP y devuelve JSON
     */
    httpRequest(url) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            
            const options = {
                rejectUnauthorized: false // Allow self-signed certs for testing
            };

            protocol.get(url, options, (response) => {
                let data = '';

                response.on('data', (chunk) => {
                    data += chunk;
                });

                response.on('end', () => {
                    if (response.statusCode === 200) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (error) {
                            reject(new Error('Respuesta inválida del servidor'));
                        }
                    } else {
                        reject(new Error(`Error HTTP: ${response.statusCode}`));
                    }
                });
            }).on('error', reject);
        });
    }

    /**
     * Obtiene el estado actual de la actualización
     */
    getStatus() {
        return { ...this.status };
    }
}

module.exports = Updater;
