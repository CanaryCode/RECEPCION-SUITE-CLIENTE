/**
 * API de Actualizaciones para Recepción Suite
 * Gestiona la distribución de actualizaciones a los clientes
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Ruta base del proyecto
const PROJECT_ROOT = path.join(__dirname, '../..');
const AGENT_PATH = path.join(PROJECT_ROOT, 'agent');
const VERSION_FILE = path.join(PROJECT_ROOT, 'version.json');

/**
 * Calcula el hash SHA256 de un archivo
 */
function calculateFileHash(filePath) {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        return hashSum.digest('hex');
    } catch (error) {
        console.error(`Error calculando hash de ${filePath}:`, error);
        return null;
    }
}

/**
 * Obtiene la lista de archivos del agent que deben actualizarse
 */
function getUpdateableFiles() {
    const files = [];

    // Archivos y carpetas a incluir
    const includePatterns = [
        'src/**/*.js',
        'package.json',
        'README_AGENT.md'
    ];

    // Archivos a excluir (preservar configuración local)
    const excludePatterns = [
        'config/agent_config.json', // Proteger credenciales y Station ID
        'config/local_config.json',
        'logs/**/*',
        'node_modules/**/*',
        '*.log',
        '.agent_token',
        'RecepcionSuite.exe', // Se recompila después
        '.backup/**/*', // No incluir backups en actualizaciones
        '.update_temp/**/*' // No incluir archivos temporales
    ];

    function scanDirectory(dir, baseDir = dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(baseDir, fullPath);

            // Verificar si debe excluirse
            const shouldExclude = excludePatterns.some(pattern => {
                const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
                return regex.test(relativePath);
            }) || relativePath.startsWith('.backup') || relativePath.startsWith('.update_temp');

            if (shouldExclude) continue;

            if (entry.isDirectory()) {
                scanDirectory(fullPath, baseDir);
            } else {
                const hash = calculateFileHash(fullPath);
                if (hash) {
                    files.push({
                        path: relativePath.replace(/\\/g, '/'),
                        hash: hash,
                        size: fs.statSync(fullPath).size
                    });
                }
            }
        }
    }

    scanDirectory(AGENT_PATH);
    return files;
}

/**
 * GET /api/updates/check
 * Verifica si hay una actualización disponible
 */
router.get('/check', (req, res) => {
    try {
        const clientVersion = req.query.version || '0.0.0';

        if (!fs.existsSync(VERSION_FILE)) {
            return res.status(404).json({
                error: 'Archivo de versión no encontrado'
            });
        }

        const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
        const serverVersion = versionData.version;

        // Comparar versiones (simple)
        const isUpdateAvailable = serverVersion !== clientVersion;

        res.json({
            updateAvailable: isUpdateAvailable,
            currentVersion: clientVersion,
            latestVersion: serverVersion,
            buildDate: versionData.buildDate,
            changelog: versionData.changelog[serverVersion] || []
        });

    } catch (error) {
        console.error('Error verificando actualizaciones:', error);
        res.status(500).json({
            error: 'Error al verificar actualizaciones',
            details: error.message
        });
    }
});

/**
 * GET /api/updates/manifest
 * Obtiene el manifiesto completo de archivos con hashes
 */
router.get('/manifest', (req, res) => {
    try {
        const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
        const files = getUpdateableFiles();

        res.json({
            version: versionData.version,
            buildDate: versionData.buildDate,
            files: files,
            totalSize: files.reduce((sum, f) => sum + f.size, 0)
        });

    } catch (error) {
        console.error('Error generando manifiesto:', error);
        res.status(500).json({
            error: 'Error al generar manifiesto',
            details: error.message
        });
    }
});

/**
 * GET /api/updates/download/:filePath
 * Descarga un archivo específico
 */
router.get('/download/*', (req, res) => {
    try {
        // El path viene después de /download/
        const requestedPath = req.params[0];
        const fullPath = path.join(AGENT_PATH, requestedPath);

        // Verificar que el archivo existe y está dentro del agent
        if (!fullPath.startsWith(AGENT_PATH)) {
            return res.status(403).json({
                error: 'Acceso denegado'
            });
        }

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({
                error: 'Archivo no encontrado'
            });
        }

        // Enviar el archivo
        res.sendFile(fullPath);

    } catch (error) {
        console.error('Error descargando archivo:', error);
        res.status(500).json({
            error: 'Error al descargar archivo',
            details: error.message
        });
    }
});

/**
 * GET /api/updates/version
 * Obtiene solo la información de versión actual
 */
router.get('/version', (req, res) => {
    try {
        const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
        res.json(versionData);
    } catch (error) {
        console.error('Error obteniendo versión:', error);
        res.status(500).json({
            error: 'Error al obtener versión',
            details: error.message
        });
    }
});

module.exports = router;
