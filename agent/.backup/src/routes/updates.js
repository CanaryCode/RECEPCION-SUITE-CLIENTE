/**
 * Rutas de actualización para el Agent
 */

const express = require('express');
const router = express.Router();
const Updater = require('../updater');

// Instancia global del updater
let updaterInstance = null;

function getUpdater() {
    if (!updaterInstance) {
        updaterInstance = new Updater({
            serverUrl: 'https://www.desdetenerife.com:3000'
        });
    }
    return updaterInstance;
}

/**
 * GET /api/agent/updates/check
 * Verifica si hay actualizaciones disponibles
 */
router.get('/check', async (req, res) => {
    try {
        const updater = getUpdater();
        const result = await updater.checkForUpdates();
        res.json(result);
    } catch (error) {
        console.error('[AGENT] Error verificando actualizaciones:', error);
        res.status(500).json({
            error: 'Error al verificar actualizaciones',
            details: error.message
        });
    }
});

/**
 * POST /api/agent/updates/install
 * Descarga e instala la actualización
 *
 * MODO TESTING: Usa el parámetro ?mode=test para simular sin cambiar archivos
 */
router.post('/install', async (req, res) => {
    try {
        const updater = getUpdater();
        const isTestMode = req.query.mode === 'test';

        // Verificar que no hay otra actualización en progreso
        const status = updater.getStatus();
        if (status.downloading || status.installing) {
            return res.status(409).json({
                error: 'Ya hay una actualización en progreso'
            });
        }

        // Si está en modo test, simular actualización
        if (isTestMode) {
            console.log('[AGENT] Simulando actualización en modo TEST');

            // Simular proceso de actualización
            setTimeout(() => {
                updater.status.downloading = true;
                updater.status.progress = 25;
            }, 500);

            setTimeout(() => {
                updater.status.progress = 50;
            }, 1500);

            setTimeout(() => {
                updater.status.downloading = false;
                updater.status.installing = true;
                updater.status.progress = 75;
            }, 2500);

            setTimeout(() => {
                updater.status.installing = false;
                updater.status.progress = 100;

                // Actualizar versión en memoria (no en disco)
                const pkg = require(updater.versionFile);
                pkg.version = '1.0.1';

                console.log('[AGENT] Simulación completada - Versión actualizada a 1.0.1 (solo en memoria)');
            }, 3500);

            res.json({
                success: true,
                message: 'Actualización de prueba iniciada',
                testMode: true
            });
        } else {
            // Iniciar actualización real en segundo plano
            updater.downloadAndInstall()
                .then(result => {
                    console.log('[AGENT] Actualización completada:', result);
                })
                .catch(error => {
                    console.error('[AGENT] Error en actualización:', error);
                });

            // Responder inmediatamente
            res.json({
                success: true,
                message: 'Actualización iniciada'
            });
        }

    } catch (error) {
        console.error('[AGENT] Error iniciando actualización:', error);
        res.status(500).json({
            error: 'Error al iniciar actualización',
            details: error.message
        });
    }
});

/**
 * GET /api/agent/updates/status
 * Obtiene el estado de la actualización en progreso
 */
router.get('/status', (req, res) => {
    try {
        const updater = getUpdater();
        const status = updater.getStatus();
        res.json(status);
    } catch (error) {
        console.error('[AGENT] Error obteniendo estado:', error);
        res.status(500).json({
            error: 'Error al obtener estado',
            details: error.message
        });
    }
});

/**
 * GET /api/agent/updates/version
 * Obtiene la versión actual del agent
 */
router.get('/version', (req, res) => {
    try {
        const updater = getUpdater();
        const version = updater.getCurrentVersion();
        res.json({ version });
    } catch (error) {
        console.error('[AGENT] Error obteniendo versión:', error);
        res.status(500).json({
            error: 'Error al obtener versión',
            details: error.message
        });
    }
});

/**
 * POST /api/agent/updates/reset
 * Resetea el estado del updater (útil si se quedó atascado)
 */
router.post('/reset', (req, res) => {
    try {
        const updater = getUpdater();

        // Resetear estado manualmente
        updater.status.checking = false;
        updater.status.downloading = false;
        updater.status.installing = false;
        updater.status.error = null;
        updater.status.progress = 0;
        updater.status.currentFile = null;

        console.log('[AGENT] Estado del updater reseteado');

        res.json({
            success: true,
            message: 'Estado del updater reseteado correctamente'
        });
    } catch (error) {
        console.error('[AGENT] Error reseteando updater:', error);
        res.status(500).json({
            error: 'Error al resetear updater',
            details: error.message
        });
    }
});

module.exports = router;
