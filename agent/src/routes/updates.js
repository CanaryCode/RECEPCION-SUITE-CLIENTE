/**
 * Rutas de actualización para el Agent
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const logToFile = (msg) => {
    try {
        const LOG_FILE = path.join(__dirname, '../../logs/agent.log');
        const time = new Date().toISOString();
        fs.appendFileSync(LOG_FILE, `[UPDATER-ROUTE] ${time} - ${msg} \n`);
    } catch (e) {}
};
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
        
        // Use provided serverUrl if available
        if (req.query && req.query.serverUrl) {
            updater.serverUrl = req.query.serverUrl;
            console.log(`[AGENT] Usando serverUrl (check): ${updater.serverUrl}`);
        }

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
    logToFile(`Petición /install recibida. Payload: ${JSON.stringify(req.body)}`);
    try {
        const updater = getUpdater();
        const isTestMode = req.query.mode === 'test';
        
        // Use provided serverUrl if available
        if (req.body && req.body.serverUrl) {
            updater.serverUrl = req.body.serverUrl;
            console.log(`[AGENT] Usando serverUrl: ${updater.serverUrl}`);
        }

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

            // Resetear estado
            updater.status.checking = false;
            updater.status.downloading = false;
            updater.status.installing = false;
            updater.status.error = null;
            updater.status.progress = 0;
            updater.status.currentFile = null;

            // Simular proceso de actualización de forma gradual
            setTimeout(() => {
                updater.status.downloading = true;
                updater.status.progress = 25;
                updater.status.currentFile = 'package.json';
                console.log('[AGENT TEST] Progreso: 25% - Descargando...');
            }, 500);

            setTimeout(() => {
                updater.status.progress = 50;
                updater.status.currentFile = 'src/index.js';
                console.log('[AGENT TEST] Progreso: 50%');
            }, 1500);

            setTimeout(() => {
                updater.status.downloading = false;
                updater.status.installing = true;
                updater.status.progress = 75;
                updater.status.currentFile = 'src/updater.js';
                console.log('[AGENT TEST] Progreso: 75% - Instalando...');
            }, 2500);

            setTimeout(() => {
                updater.status.installing = false;
                updater.status.progress = 100;
                updater.status.currentFile = null;

                console.log('[AGENT TEST] Simulación completada (100%)');
            }, 3500);

            res.json({
                success: true,
                message: 'Actualización de prueba iniciada',
                testMode: true
            });
        } else {
            logToFile(`Iniciada descarga e instalación real en segundo plano.`);
            // Iniciar actualización real en segundo plano
            updater.downloadAndInstall()
                .then(result => {
                    console.log('[AGENT] Actualización completada:', result);
                    logToFile(`Actualización completada: ${JSON.stringify(result)}`);
                })
                .catch(error => {
                    console.error('[AGENT] Error en actualización:', error);
                    logToFile(`Error en actualización: ${error.message}`);
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
