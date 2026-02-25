const express = require('express');
const router = express.Router();
const os = require('os');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const db = require('../db');

/**
 * POST /api/admin/login
 * Verifies admin credentials against the database.
 */
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos' });
    }

    try {
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        const [rows] = await db.query(
            'SELECT * FROM admin_users WHERE username = ? AND password_hash = ?',
            [username, hash]
        );

        if (rows.length > 0) {
            res.json({ success: true, message: 'Login exitoso', user: { id: rows[0].id, username: rows[0].username } });
        } else {
            res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
    } catch (err) {
        console.error('[AUTH ERROR]', err);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

const STORAGE_DIR = path.resolve(__dirname, '../../storage');
const LOG_FILE = path.join(STORAGE_DIR, 'server_debug.log');

const PASS_HASH = '9e3953e9fea7ab3622aed509723766bff8e7500da19fba8e091d13504913af40'; // sha256 de gravina82

// REGISTRO DE AGENTES ACTIVOS (Anti-PNA)
// Guarda los latidos (heartbeats) de los Agentes Locales para vincular IP pública con Station Key
const activeAgents = new Map();

/**
 * Middleware de Autenticación Admin
 */
function authMiddleware(req, res, next) {
    if (req.path === '/login' || req.path === '/login/' || req.path === '/agent-proxy/auth/id' || req.path === '/agent-proxy/auth/id/' || req.path === '/agent-proxy/register' || req.path === '/agent-proxy/register/') return next();

    const providedPass = req.headers['x-admin-password'];
    if (!providedPass) {
        return res.status(401).json({ error: 'No autorizado. Se requiere contraseña.' });
    }

    const hash = crypto.createHash('sha256').update(providedPass).digest('hex');
    if (hash === PASS_HASH) {
        return next();
    }

    res.status(401).json({ error: 'Sesión inválida o contraseña incorrecta.' });
}

router.use(authMiddleware);

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
 * GET /connections
 * Returns recent connection details parsed from log file.
 */
router.get('/connections', async (req, res) => {
    try {
        const target = req.query.target;
        if (target === 'remote') {
            const adminPass = req.headers['x-admin-password'];
            const agentUrl = `https://127.0.0.1:3001/api/admin/connections`;
            const response = await fetch(agentUrl, {
                headers: { 'x-admin-password': adminPass },
                dispatcher: new (require('undici').Agent)({ connect: { rejectUnauthorized: false } })
            });
            return res.json(await response.json());
        }

        const data = await fs.readFile(LOG_FILE, 'utf8');
        const lines = data.split('\n');
        const connections = lines
            .filter(l => l.includes('[CONN]'))
            .slice(-30)
            .reverse()
            .map(l => {
                // Format: [2026-02-25T00:52:13.250Z] [SERVER] [CONN] GET /api/health - IP: ::1 - UA: curl/7.81.0
                const parts = l.split('] ');
                const timestamp = parts[0].replace('[', '');
                const content = parts.slice(2).join('] ').replace('[CONN] ', '');

                // Content: GET /api/health - IP: ::1 - UA: curl/7.81.0
                const metaParts = content.split(' - ');
                const methodUrl = metaParts[0] || '';
                const ip = (metaParts[1] || '').replace('IP: ', '');
                const ua = (metaParts[2] || '').replace('UA: ', '');

                return { timestamp, methodUrl, ip, ua };
            });

        res.json({ connections });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch connections', message: err.message });
    }
});

/**
 * POST /execute
 * Runs system maintenance scripts AND server control actions.
 * Server control actions are forwarded to the internal Agent (3001).
 */
router.post('/execute', async (req, res) => {
    const { script, action, target } = req.body;

    // 1. Handle Server Control Actions (Forward to Agent)
    if (action === 'start-server' || action === 'stop-server' || action === 'restart-server') {
        const adminPass = req.headers['x-admin-password'];
        const agentUrl = `https://127.0.0.1:3001/api/admin/execute`;

        try {
            const configData = await fs.readFile(path.join(__dirname, '../../agent/agent_config.json'), 'utf8');
            const config = JSON.parse(configData);

            // FIX: Prevent indefinite hang when the agent is restarting a server and detaches poorly
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 6000);

            const response = await fetch(agentUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-password': adminPass,
                    'x-station-key': config.STATION_KEY
                },
                body: JSON.stringify({ action, target: target || 'local' }),
                dispatcher: new (require('undici').Agent)({ connect: { rejectUnauthorized: false } }),
                signal: controller.signal
            });
            clearTimeout(timeout);

            const data = await response.json();
            return res.status(response.status).json(data);
        } catch (err) {
            console.error('[EXECUTE PROXY ERROR]', err);
            // Si es un timeout o error de conexión, el Agente puede estar reiniciándose
            return res.status(502).json({
                success: false,
                error: err.name === 'AbortError' ? 'El Agente tardó demasiado en responder, acción enviada.' : 'Fallo al contactar con el Agente',
                details: err.message
            });
        }
    }

    // 2. Handle Maintenance Scripts (Legacy Switch)
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
            return res.status(400).json({ error: 'Acción o script inválido' });
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
/**
 * Helper para obtener IP real saltando el reverse proxy o Cloudflare
 */
function getClientIp(req) {
    const cfIp = req.headers['cf-connecting-ip'];
    const xff = req.headers['x-forwarded-for'];
    const remoteAddr = req.ip || req.connection.remoteAddress;

    let finalIp = remoteAddr;
    if (cfIp) finalIp = cfIp.split(',')[0].trim();
    else if (xff) finalIp = xff.split(',')[0].trim();

    // Log diagnostic only for important admin checks to not swamp the disk
    if (req.originalUrl.includes('agent-proxy')) {
        console.log(`[IP DEBUG] Route: ${req.originalUrl} - Final IP: ${finalIp} | CF: ${cfIp} | XFF: ${xff} | ReqIP: ${req.ip}`);
    }

    return finalIp;
}

/**
 * GET /agent-proxy/auth/id
 * Resuelve la validación de seguridad del cliente web validando si su IP 
 * coincide con algún Agente Local registrado mediante heartbeat reciente.
 * hard-logic: El cliente debe proveer el localToken de su agente para demostrar cercanía.
 */
router.get('/agent-proxy/auth/id', (req, res) => {
    const ip = getClientIp(req);
    const agent = activeAgents.get(ip);
    const clientToken = req.query.token;

    // Validar si la red tiene un agente que ha dado señales en los últimos 45s
    // Y si el token del cliente coincide con el registrado para esa IP
    const isIpActive = agent && (Date.now() - agent.lastSeen < 45000);
    const isTokenValid = agent && agent.localToken === clientToken;

    const isValid = isIpActive && isTokenValid;

    console.log(`[AUTH PROXY] IP: ${ip} - TokenValid: ${isTokenValid} | ActiveAgents Count: ${activeAgents.size}`);

    if (isValid) {
        res.json({
            stationId: agent.stationId,
            stationKey: agent.stationKey,
            proxyMethod: 'IP_WHITELIST_STRICT'
        });
    } else {
        const msg = !isIpActive ? 'No hay agente activo en esta red.' : 'Token local inválido o caducado.';
        res.status(401).json({ error: 'No autorizado', message: msg });
    }
});

/**
 * POST /agent-proxy/register
 * Recibe latidos (heartbeats) de Agentes Locales legítimos para registrar su IP de red.
 */
router.post('/agent-proxy/register', (req, res) => {
    const ip = getClientIp(req);
    const { stationId, stationKey, port, localToken } = req.body;

    console.log(`[AGENT REGISTRY] Heartbeat from IP: ${ip} | Token: ${localToken ? 'Present' : 'MISSING'}`);

    if (stationId && stationKey && localToken) {
        activeAgents.set(ip, { stationId, stationKey, localToken, port: port || 3001, lastSeen: Date.now() });
        res.json({ success: true, ip });
    } else {
        res.status(400).json({ error: 'Faltan credenciales o token del Agente' });
    }
});

/**
 * POST /agent-proxy
 * INTERNAL PROXY: Forwards requests from external clients (via port 3000)
 * to the local agent running on port 3001. This bypasses firewall blocks on 3001.
 */
router.post('/agent-proxy', async (req, res) => {
    const { endpoint, method, payload } = req.body;
    const adminPass = req.headers['x-admin-password'];
    // We get the server's station key to authorize with the local agent
    let stationKey = req.headers['x-station-key'];

    if (!stationKey) {
        try {
            const configData = await fs.readFile(path.join(__dirname, '../../agent/agent_config.json'), 'utf8');
            const config = JSON.parse(configData);
            stationKey = config.STATION_KEY;
        } catch (e) {
            console.error('[PROXY] Error leyendo agent_config.json:', e);
        }
    }

    if (!endpoint) {
        return res.status(400).json({ error: 'Endpoint proxy no especificado' });
    }

    // Usar 127.0.0.1 en lugar de localhost para evitar problemas de IPv6 con el fetch nativo de Node.js
    const agentUrl = `https://127.0.0.1:3001${endpoint}`;

    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (adminPass) headers['x-admin-password'] = adminPass;
        if (stationKey) headers['x-station-key'] = stationKey;

        const options = {
            method: method || 'GET',
            headers: headers,
            // Importante: Permitir localhost sin verificar certificado (ya que el cert es de dominio)
            dispatcher: new (require('undici').Agent)({ connect: { rejectUnauthorized: false } })
        };

        if (payload && method !== 'GET' && method !== 'HEAD') {
            options.body = JSON.stringify(payload);
        }

        // Use Node.js >= 18 native fetch
        const response = await fetch(agentUrl, options);
        const data = await response.text();

        try {
            res.status(response.status).json(data ? JSON.parse(data) : { success: true });
        } catch (e) {
            // Fallback for plain text responses
            res.status(response.status).json({ output: data });
        }
    } catch (err) {
        console.error('[PROXY ERROR]', err);
        res.status(502).json({
            error: 'Fallo al contactar con el Agente Local interno',
            details: err.message,
            targetUrl: agentUrl
        });
    }
});

module.exports = router;
