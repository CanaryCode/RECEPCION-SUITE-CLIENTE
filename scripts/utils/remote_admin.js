const express = require('express');
const router = express.Router();
const os = require('os');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const db = require('../db');

const STORAGE_DIR = path.resolve(__dirname, '../../storage');
const LOG_FILE = path.join(STORAGE_DIR, 'server_debug.log');

/**
 * GET /status
 * Returns system and database health.
 */
router.get('/status', async (req, res) => {
    const stats = {
        os: {
            platform: os.platform(),
            release: os.release(),
            uptime: os.uptime(),
            totalMem: Math.round(os.totalmem() / 1024 / 1024),
            freeMem: Math.round(os.freemem() / 1024 / 1024),
            cpuLoad: os.loadavg()
        },
        database: {
            status: 'unknown',
            message: ''
        },
        pm2: {
            status: 'unknown',
            uptime: 0,
            instances: 0
        }
    };

    // Check MySQL
    try {
        const conn = await db.pool.getConnection();
        stats.database.status = 'connected';
        conn.release();
    } catch (err) {
        console.error('Admin Status DB Error:', err.message);
        const timestamp = new Date().toISOString();
        require('fs').appendFileSync(LOG_FILE, `[${timestamp}] [ADMIN] DB Status Check Error: ${err.message}\n`);
        stats.database.status = 'error';
        stats.database.message = err.message;
    }

    // Check PM2
    exec('pm2 jlist', (error, stdout) => {
        if (!error && stdout) {
            try {
                const processes = JSON.parse(stdout);
                stats.pm2.status = 'active';
                stats.pm2.instances = processes.length;
                const hotelProc = processes.find(p => p.name === 'hotel-manager');
                if (hotelProc) {
                    stats.pm2.uptime = hotelProc.pm2_env.pm_uptime;
                    stats.pm2.status = hotelProc.pm2_env.status;
                }
            } catch (e) {
                stats.pm2.status = 'error parsing';
            }
        } else {
            stats.pm2.status = 'missing';
        }
        res.json(stats);
    });
});

/**
 * GET /logs
 * Returns snippets from the server debug log.
 */
router.get('/logs', async (req, res) => {
    try {
        const data = await fs.readFile(LOG_FILE, 'utf8');
        const lines = data.split('\n');
        // Return latest 100 lines
        res.json({
            lines: lines.slice(-100).reverse()
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not read logs', message: err.message });
    }
});

/**
 * POST /execute
 * Runs system maintenance scripts.
 */
router.post('/execute', (req, res) => {
    const { script } = req.body;
    let command = '';
    let scriptPath = '';

    switch (script) {
        case 'sync':
            scriptPath = path.resolve(__dirname, '../scripts/sync_json_to_db.js');
            break;
        case 'test':
            scriptPath = path.resolve(__dirname, '../../tests/integration/storage.test.js');
            break;
        default:
            return res.status(400).json({ error: 'Invalid script name' });
    }

    command = `node "${scriptPath}"`;

    res.json({ message: `Executing ${script}... Check logs for progress.`, command });

    // Execute in background
    exec(command, (error, stdout, stderr) => {
        const logMsg = `[ADMIN EXEC] ${script} finished. Err: ${error ? error.message : 'none'}`;
        const timestamp = new Date().toISOString();
        require('fs').appendFileSync(LOG_FILE, `[${timestamp}] ${logMsg}\n`);
        if (stdout) require('fs').appendFileSync(LOG_FILE, stdout + '\n');
        if (stderr) require('fs').appendFileSync(LOG_FILE, stderr + '\n');
    });
});

module.exports = router;
