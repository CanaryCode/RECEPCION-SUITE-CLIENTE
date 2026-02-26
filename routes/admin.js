const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const https = require('https');

const isWin = process.platform === 'win32';
const ROOT_DIR = path.resolve(__dirname, '../../');
const SERVER_LOG = path.join(ROOT_DIR, 'server.log');
const AGENT_LOG = path.join(ROOT_DIR, 'agent.log');

const crypto = require('crypto');
const PASS_HASH = '9e3953e9fea7ab3622aed509723766bff8e7500da19fba8e091d13504913af40'; // sha256 de gravina82

/**
 * Helper para verificar contraseña
 */
function verifyPassword(provided) {
    if (!provided) return false;
    const hash = crypto.createHash('sha256').update(provided).digest('hex');
    return hash === PASS_HASH;
}

/**
 * Middleware de Autenticación
 */
function authMiddleware(req, res, next) {
    const providedPass = req.headers['x-admin-password'];

    // El Login es público para permitir la UI inicial, pero /status requiere clave
    if (req.path === '/login' || req.path === '/login/') {
        return next();
    }

    if (!providedPass) {
        return res.status(401).json({ error: 'No autorizado. Se requiere contraseña.' });
    }

    // El Agente mantiene una validación rápida del hash para no saturar al servidor central en cada poll
    const hash = crypto.createHash('sha256').update(providedPass).digest('hex');
    if (hash === PASS_HASH) {
        return next();
    }

    res.status(401).json({ error: 'Sesión inválida o contraseña incorrecta.' });
}

router.use(authMiddleware);

/**
 * Helper para contactar al Agente Remoto (Tenerife) con fallback.
 * Intenta primero el puerto 3001 directo. Si falla, intenta a través del proxy del puerto 3000.
 */
async function fetchRemoteAgent(endpoint, method = 'GET', payload = null, adminPass = null) {
    let directError;
    // 1. Intento directo al agente (puerto 3001) - Timeout corto para fallar rápido si hay firewall
    try {
        if (method === 'GET') {
            return await fetchUrl(`https://www.desdetenerife.com:3001${endpoint}`, adminPass, 4000);
        } else {
            return await fetchUrlPost(`https://www.desdetenerife.com:3001${endpoint}`, payload, adminPass);
        }
    } catch (e) {
        directError = e.message;
        console.warn(`[AGENT PROXY] Directo falló: ${e.message}. Probando proxy...`);
    }

    try {
        return await fetchUrlPost('https://www.desdetenerife.com:3000/api/admin/agent-proxy', {
            endpoint,
            method,
            payload
        }, adminPass);
    } catch (e) {
        throw new Error(`Tenerife Inaccesible (Directo: ${directError} | Proxy: ${e.message})`);
    }
}

/**
 * POST /api/admin/login
 * Proxy para validar contra la base de datos del servidor central
 */
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // 1. Intentar validación centralizada en el servidor (puerto 3000)
        const response = await fetchUrlPost('https://localhost:3000/api/admin/login', { username, password });
        res.json(response);
    } catch (e) {
        // 2. Fallback: Si el servidor local está apagado, permitir login con la clave local
        console.warn('[AGENT AUTH] Servidor central no responde, usando validación local.');
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        if (hash === PASS_HASH) {
            return res.json({
                success: true,
                message: 'Login correcto (Modo de Rescate - Servidor Local Offline)',
                rescue: true
            });
        }
        res.status(401).json({ success: false, message: 'Credenciales inválidas o servidor central inaccesible.' });
    }
});

/**
 * GET /api/admin/status
 * Check local and remote server status, plus remote DB (via Tenerife health)
 */
router.get('/status', async (req, res) => {
    const status = {
        local: { status: 'offline', port: 3000 },
        remote: { status: 'offline', url: 'https://www.desdetenerife.com:3000' },
        os: {
            freeMem: Math.round(os.freemem() / 1024 / 1024),
            totalMem: Math.round(os.totalmem() / 1024 / 1024),
            platform: os.platform(),
            uptime: os.uptime()
        },
        database: { local: 'unknown', remote: 'unknown' }
    };

    // Check Local Server
    try {
        // Try HTTPS first
        try {
            const localHealth = await fetchUrl('https://localhost:3000/api/health', null, 1500);
            status.local.status = 'online';
            status.database.local = localHealth.database || 'online';
        } catch (httpsErr) {
            // Fallback to HTTP
            const localHealthHttp = await fetchUrl('http://localhost:3000/api/health', null, 1500);
            status.local.status = 'online';
            status.local.notes = 'Srv en modo HTTP';
            status.database.local = localHealthHttp.database || 'online';
        }
    } catch (e) {
        status.local.status = 'offline';
        console.warn(`[AGENT STATUS] Local Server Offline: ${e.message}`);
    }

    // Check Remote Server & DB (using their health endpoint)
    try {
        // Primero intentamos con el Servidor (3000)
        const remoteHealth = await fetchUrl('https://www.desdetenerife.com:3000/api/health', null, 2500);
        status.remote.status = 'online';
        status.remote.agent = 'online';
        status.database.remote = remoteHealth.database || 'online';
    } catch (e) {
        // Si el 3000 falla, intentamos ver si el Agente responde directo o por proxy
        try {
            const agentHealth = await fetchRemoteAgent('/health', 'GET');
            status.remote.status = 'offline'; // El server está offline
            status.remote.agent = 'online';  // Pero el agente está online
            status.database.remote = 'offline';
        } catch (e2) {
            status.remote.status = 'offline';
            status.remote.agent = 'offline';
        }
    }

    res.json(status);
});

/**
 * GET /api/admin/logs
 */
router.get('/logs', async (req, res) => {
    const { target } = req.query;

    if (target === 'remote') {
        const adminPass = req.headers['x-admin-password'];
        try {
            const remoteLogs = await fetchRemoteAgent('/api/admin/logs', 'GET', null, adminPass);
            return res.json(remoteLogs);
        } catch (e) {
            console.error(`[REMOTE LOGS ERROR] ${e.message}`);
            return res.json({ lines: [`[ERROR TENERIFE] No se pudo obtener logs del agente remoto: ${e.message}`] });
        }
    }

    try {
        const getTail = (file) => {
            return new Promise((resolve) => {
                exec(`tail -n 100 "${file}" 2>/dev/null`, (err, stdout) => {
                    if (err) console.error(`[AGENT LOG DEBUG] Fail tailing ${file}:`, err.message);
                    resolve(err ? "" : stdout);
                });
            });
        };

        const [serverLogs, agentLogs] = await Promise.all([
            getTail(SERVER_LOG),
            getTail(AGENT_LOG)
        ]);

        const combined = (serverLogs + "\n" + agentLogs)
            .split('\n')
            .filter(line => line.trim() !== '')
            .slice(-80);

        res.json({ lines: combined });
    } catch (err) {
        console.error(`[AGENT LOG ERROR] ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /connections
 * Returns recent connection details parsed from agent.log.
 */
router.get('/connections', async (req, res) => {
    try {
        const data = await fs.readFile(AGENT_LOG, 'utf8');
        const lines = data.split('\n');
        const connections = lines
            .filter(l => l.includes('[CONN]'))
            .slice(-30)
            .reverse()
            .map(l => {
                // Format: [AGENT] 2026-02-25T00:52:13.250Z - [CONN] GET /api/health from ::1 - UA: curl/7.81.0
                const timestamp = l.substring(8, 32);
                const content = l.split('- [CONN] ')[1] || '';

                // Content: GET /api/health from ::1 - UA: curl/7.81.0
                const metaParts = content.split(' - ');
                const methodUrlWithIp = metaParts[0] || '';
                const methodUrl = methodUrlWithIp.split(' from ')[0];
                const ip = methodUrlWithIp.split(' from ')[1] || 'unknown';
                const ua = (metaParts[1] || '').replace('UA: ', '');

                return { timestamp, methodUrl, ip, ua };
            });

        res.json({ connections });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch connections', message: err.message });
    }
});

/**
 * GET /api/admin/db-check
 */
router.get('/db-check', async (req, res) => {
    const { target } = req.query; // 'local' or 'remote'

    // El resto de la API requiere target 'remote' para DB
    if (target !== 'remote') {
        return res.json({ status: 'error', message: 'No hay base de datos configurada en local.' });
    }

    const adminPass = req.headers['x-admin-password'];
    try {
        const data = await fetchRemoteAgent('/api/admin/db-check?target=local', 'GET', null, adminPass);
        return res.json(data);
    } catch (e) {
        return res.json({
            status: 'error',
            message: `No se puede contactar con Tenerife: ${e.message}`
        });
    }
});

/**
 * POST /api/admin/run-tests
 */
router.post('/run-tests', (req, res) => {
    const testCmd = 'node tests/integration/test_architecture.js';
    exec(testCmd, { cwd: ROOT_DIR }, (err, stdout, stderr) => {
        res.json({
            success: !err,
            output: stdout + (stderr ? "\nERRORS:\n" + stderr : ""),
            error: err ? err.message : null
        });
    });
});

/**
 * POST /api/admin/execute
 */
router.post('/execute', async (req, res) => {
    const { action, target } = req.body; // target: 'local' (default) or 'remote'
    let command = "";

    if (target === 'remote') {
        const adminPass = req.headers['x-admin-password'];
        try {
            const remoteResult = await fetchRemoteAgent('/api/admin/execute', 'POST', { action, target: 'local' }, adminPass);
            return res.json(remoteResult);
        } catch (e) {
            console.error(`[REMOTE EXEC ERROR] ${e.message}`);
            return res.status(502).json({
                success: false,
                error: `No se pudo contactar con el agente remoto en Tenerife: ${e.message}`
            });
        }
    }

    switch (action) {
        case 'start-server':
            // Comando robusto: Matar si existe, luego arrancar SIEMPRE desvinculado
            if (isWin) {
                // start "" /b ejecuta en background en windows
                command = `(for /f "tokens=5" %a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %a) & cd server && start "" /b node app.js > ../server.log 2>&1`;
            } else {
                // En Linux lsof es más común para matar puertos específicos. 
                // nohup ... & asegura el background, pero debemos redirigir stdin/out/err para que no enganche
                command = 'fuser -k 3000/tcp 2>/dev/null || true; cd server && nohup node app.js > ../server.log 2>&1 </dev/null &';
            }
            break;
        case 'stop-server':
            if (isWin) {
                command = 'for /f "tokens=5" %a in (\'netstat -aon ^| findstr :3000\') do taskkill /F /PID %a';
            } else {
                command = 'fuser -k 3000/tcp 2>/dev/null || true';
            }
            break;
        case 'restart-server':
            // El reinicio es simplemente stop + start (lo manejamos cliente-side o secuencial)
            res.json({ success: true, message: "Restarting server..." });
            return;
        case 'sync':
            command = 'node scripts/admin/sync_db.js';
            break;
        case 'run-tests':
            command = 'node tests/integration/test_architecture.js';
            break;
        default:
            return res.status(400).json({ error: 'Acción no válida' });
    }

    console.log(`[ADMIN] Executing: ${command}`);

    // Si es start-server, no esperamos al callback porque el proceso se queda vivo
    if (action === 'start-server') {
        const { spawn } = require('child_process');
        try {
            if (isWin) {
                exec(command, { cwd: ROOT_DIR }); // En windows start /b ya lo independiza
            } else {
                // Usamos spawn detach mode para linux para asegurar que NodeJS no espere
                const child = spawn('bash', ['-c', command], {
                    detached: true,
                    stdio: 'ignore', // Crucial para que no espere pipes
                    cwd: ROOT_DIR
                });
                child.unref();
            }
            return res.json({ success: true, message: `Acción ${action} lanzada en background.` });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    // Comandos normales que sí terminan (sync, tests, stop)
    exec(command, { cwd: ROOT_DIR }, (err, stdout, stderr) => {
        if (err && action !== 'stop-server') {
            console.error(`[ADMIN ERROR] ${err.message}`);
            return res.status(500).json({
                success: false,
                error: err.message,
                stderr: stderr
            });
        }
        res.json({ success: true, message: `Acción ${action} ejecutada`, output: stdout, stderr: stderr });
    });
});

/**
 * Helper para peticiones GET (Incluye x-station-key y opcionalmente x-admin-password)
 */
async function fetchUrl(url, adminPass = null, timeout = 5000) {
    const config = JSON.parse(await fs.readFile(path.join(__dirname, '../agent_config.json'), 'utf8'));
    const protocol = url.startsWith('https') ? https : require('http');

    return new Promise((resolve, reject) => {
        const headers = {
            'x-station-key': config.STATION_KEY
        };
        if (adminPass) {
            headers['x-admin-password'] = adminPass;
        }

        const options = {
            headers: headers,
            timeout: timeout,
            rejectUnauthorized: false
        };

        const req = protocol.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    if (data.length === 0) {
                        return reject(new Error(`Respuesta vacía (Status ${res.statusCode})`));
                    }
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
                    else reject(new Error(parsed.message || ('Error ' + res.statusCode)));
                } catch (e) {
                    reject(new Error(`Error parseando JSON (Status ${res.statusCode}): ${data.substring(0, 50)}...`));
                }
            });
        });
        req.on('error', (err) => {
            const msg = err.code === 'ECONNREFUSED' ? `Conexión rechazada` : err.message;
            reject(new Error(msg));
        });
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Timeout tras ${timeout}ms`));
        });
    });
}

/**
 * Helper para peticiones POST (Incluye x-station-key y x-admin-password)
 */
function fetchUrlPost(url, body, adminPass = null) {
    return new Promise(async (resolve, reject) => {
        try {
            const config = JSON.parse(await fs.readFile(path.join(__dirname, '../agent_config.json'), 'utf8'));
            const postData = JSON.stringify(body);
            const headers = {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'x-station-key': config.STATION_KEY
            };
            if (adminPass) {
                headers['x-admin-password'] = adminPass;
            }

            const options = {
                method: 'POST',
                headers: headers,
                timeout: 5000,
                rejectUnauthorized: false // Permitir certificados de localhost o dominios cruzados
            };

            const req = https.request(url, options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        if (data.length === 0) {
                            return reject(new Error(`Respuesta vacía (Status ${res.statusCode})`));
                        }
                        const parsed = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
                        else reject(new Error(parsed.message || ('Error ' + res.statusCode)));
                    } catch (e) {
                        reject(new Error('Respuesta del servidor no es JSON válido'));
                    }
                });
            });

            req.on('error', (err) => {
                const msg = err.code === 'ECONNREFUSED' ? `Conexión rechazada (Tenerife offline)` : err.message;
                reject(new Error(msg));
            });
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Tiempo de espera agotado (Inaccesible)'));
            });
            req.write(postData);
            req.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = router;
