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
     * Registrar listeners para eventos de actualización
     */
    on(event, callback) {
        this.listeners.push({ event, callback });
    }

    emit(event, data) {
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
        try {
            this.status.downloading = true;
            this.status.progress = 0;
            this.emit('download_start', {});

            // 1. Obtener manifiesto de archivos
            const manifest = await this.getManifest();
            console.log(`[UPDATER] Archivos a actualizar: ${manifest.files.length}`);

            // 2. Crear backup
            await this.createBackup();

            // 3. Crear directorio temporal
            this.ensureDir(this.tempDir);

            // 4. Descargar archivos
            const filesToUpdate = await this.compareAndDownloadFiles(manifest.files);

            if (filesToUpdate.length === 0) {
                console.log('[UPDATER] No hay archivos que actualizar');
                this.status.downloading = false;
                return { success: true, filesUpdated: 0 };
            }

            // 5. Instalar archivos
            this.status.downloading = false;
            this.status.installing = true;
            this.emit('install_start', {});

            await this.installFiles(filesToUpdate);

            // 6. Actualizar versión en package.json
            await this.updateVersion(manifest.version);

            // 7. Recompilar launcher si es necesario
            const needsRecompile = filesToUpdate.some(f => f.path.includes('launcher/'));
            if (needsRecompile) {
                await this.recompileLauncher();
            }

            // 8. Limpiar
            this.cleanup();

            this.status.installing = false;
            this.status.progress = 100;
            this.emit('complete', { filesUpdated: filesToUpdate.length });

            return {
                success: true,
                filesUpdated: filesToUpdate.length,
                needsRestart: true,
                needsRecompile: needsRecompile
            };

        } catch (error) {
            console.error('[UPDATER] Error durante actualización:', error);
            this.status.error = error.message;
            this.emit('error', { message: error.message });

            // Intentar rollback
            try {
                await this.rollback();
            } catch (rollbackError) {
                console.error('[UPDATER] Error en rollback:', rollbackError);
            }

            throw error;
        }
    }

    /**
     * Obtiene el manifiesto de archivos del servidor
     */
    async getManifest() {
        const url = `${this.serverUrl}/api/updates/manifest`;
        return await this.httpRequest(url);
    }

    /**
     * Compara archivos y descarga solo los modificados
     */
    async compareAndDownloadFiles(serverFiles) {
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
                }
            }

            if (needsUpdate) {
                console.log(`[UPDATER] Descargando: ${fileInfo.path}`);
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
        return new Promise((resolve, reject) => {
            const url = `${this.serverUrl}/api/updates/download/${filePath}`;

            // Crear directorio si no existe
            const dir = path.dirname(destPath);
            this.ensureDir(dir);

            const protocol = this.serverUrl.startsWith('https') ? https : http;

            protocol.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Error descargando ${filePath}: ${response.statusCode}`));
                    return;
                }

                const fileStream = fs.createWriteStream(destPath);
                response.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve();
                });

                fileStream.on('error', (err) => {
                    fs.unlinkSync(destPath);
                    reject(err);
                });
            }).on('error', reject);
        });
    }

    /**
     * Instala los archivos descargados
     */
    async installFiles(files) {
        const total = files.length;
        let current = 0;

        for (const file of files) {
            current++;
            this.status.progress = 50 + Math.floor((current / total) * 40); // 50-90%
            this.emit('progress', {
                progress: this.status.progress,
                file: file.path
            });

            console.log(`[UPDATER] Instalando: ${file.path}`);

            // Crear directorio si no existe
            const dir = path.dirname(file.localPath);
            this.ensureDir(dir);

            // Copiar archivo
            fs.copyFileSync(file.tempPath, file.localPath);

            // Verificar hash
            const installedHash = this.calculateFileHash(file.localPath);
            if (installedHash !== file.hash) {
                throw new Error(`Hash no coincide después de instalar: ${file.path}`);
            }
        }
    }

    /**
     * Crea un backup de los archivos actuales
     */
    async createBackup() {
        console.log('[UPDATER] Creando backup...');
        this.emit('backup_start', {});

        // Limpiar backup anterior
        if (fs.existsSync(this.backupDir)) {
            fs.rmSync(this.backupDir, { recursive: true, force: true });
        }

        this.ensureDir(this.backupDir);

        // Copiar archivos importantes
        const filesToBackup = ['src', 'launcher', 'package.json'];

        for (const item of filesToBackup) {
            const sourcePath = path.join(this.agentRoot, item);
            const destPath = path.join(this.backupDir, item);

            if (fs.existsSync(sourcePath)) {
                this.copyRecursive(sourcePath, destPath);
            }
        }

        console.log('[UPDATER] Backup creado exitosamente');
    }

    /**
     * Restaura desde backup en caso de error
     */
    async rollback() {
        console.log('[UPDATER] Iniciando rollback...');
        this.emit('rollback_start', {});

        if (!fs.existsSync(this.backupDir)) {
            throw new Error('No existe backup para restaurar');
        }

        // Restaurar archivos
        const items = fs.readdirSync(this.backupDir);
        for (const item of items) {
            const sourcePath = path.join(this.backupDir, item);
            const destPath = path.join(this.agentRoot, item);

            // Eliminar actual
            if (fs.existsSync(destPath)) {
                fs.rmSync(destPath, { recursive: true, force: true });
            }

            // Restaurar backup
            this.copyRecursive(sourcePath, destPath);
        }

        console.log('[UPDATER] Rollback completado');
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

            protocol.get(url, (response) => {
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
