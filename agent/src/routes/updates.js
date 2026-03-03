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
 */
router.post('/install', async (req, res) => {
    try {
        const updater = getUpdater();

        // Verificar que no hay otra actualización en progreso
        const status = updater.getStatus();
        if (status.downloading || status.installing) {
            return res.status(409).json({
                error: 'Ya hay una actualización en progreso'
            });
        }

        // Iniciar actualización en segundo plano
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

module.exports = router;
