const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const os = require('os');
const WebSocket = require('ws');

const app = express();
app.set('trust proxy', true);

const LOG_FILE = path.join(__dirname, '../logs/agent.log');

// Asegurar que el directorio de logs existe
if (!fs.existsSync(path.dirname(LOG_FILE))) {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

function logToFile(msg) {
    const time = new Date().toISOString();
    const formatted = `[AGENT] ${time} - ${msg} \n`;
    try {
        fs.appendFileSync(LOG_FILE, formatted);
    } catch (e) {
        console.error('Error writing to log file:', e.message);
    }
}

// Middleware de CORS 100% personalizado para soportar Private Network Access (PNA)
// Middleware de CORS 100% personalizado para soportar Private Network Access (PNA)
app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    // Echo origin if present, otherwise fallback to *
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Station-Key, x-admin-password, Accept, Origin, Authorization, Access-Control-Request-Private-Network, Cache-Control, cache-control, X-Fingerprint');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 horas

    if (req.method === 'OPTIONS') {
        // Para PNA preflights, Chrome requiere un 200 o 204 con los headers correctos
        return res.status(204).end();
    }
    next();
});

// --- SEGURIDAD: Token de Handshake Local ---
// Persistir el token ayuda a mantener la sesión sincronizada ante reinicios rápidos.
const TOKEN_FILE = path.join(__dirname, '../.agent_token');
let localToken = '';

try {
    if (fs.existsSync(TOKEN_FILE)) {
        localToken = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
        console.log(`[AGENT] Local Token recovered: ${localToken}`);
    }
} catch (e) {
    console.warn(`[AGENT] Could not recover token: ${e.message}`);
}

if (!localToken || localToken.length !== 32) {
    localToken = crypto.randomBytes(16).toString('hex');
    try {
        fs.writeFileSync(TOKEN_FILE, localToken);
    } catch (e) {
        console.error(`[AGENT] Error saving token: ${e.message}`);
    }
    console.log(`[AGENT] New Local Token generated: ${localToken}`);
}

// Endpoint público para que el navegador obtenga su token local y fingerprint
app.get('/local-token', (req, res) => {
    const { fingerprint } = getMachineFingerprint();
    res.json({ token: localToken, fingerprint: fingerprint });
});

app.use(express.json());

// RUTA DE PRUEBA ABSOLUTA (Para verificar si el agente corre esta versión)
app.get('/debug-agent', (req, res) => {
    res.json({ 
        status: 'online', 
        version: 'DEBUG-V1', 
        time: new Date().toISOString(),
        config_key: config.STATION_KEY ? 'DEFINED' : 'MISSING'
    });
});

// Logging básico para depuración
app.use((req, res, next) => {
    const remoteIp = req.ip || req.socket.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'none';
    const msg = `[CONN] ${req.method} ${req.url} from ${remoteIp} - UA: ${ua}`;
    console.log(`[AGENT] ${new Date().toISOString()} - ${msg} `);
    logToFile(msg);
    next();
});

// Cargar configuración desde la nueva carpeta config
const configPath = path.join(__dirname, '../config/agent_config.json');
let config = {};
try {
    config = require(configPath);
} catch (e) {
    console.error(`[AGENT] FATAL: Could not load config from ${configPath}`);
    process.exit(1);
}

// Middleware de Estación (Seguridad AJPD)
app.use('/api', (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const stationKey = req.headers['x-station-key'];

    // Log ultra-detallado para cazar ese 403/404
    const msg = `[API-REQ] ${req.method} ${req.originalUrl} | IP: ${ip} | Key: ${stationKey || 'MISSING'}`;
    console.log(`[AGENT] ${msg}`);
    logToFile(msg);

    // 1. Endpoints públicos
    if (req.path === '/auth/id' || req.path === '/auth/id/') return next();

    // 2. Admin endpoints use their own authentication (x-admin-password)
    if (req.path.startsWith('/admin')) return next();

    // 3. Bypass para peticiones LOCALES a /system/ y /agent/updates/
    const isLocal = isLocalRequest(req);
    const isSystem = req.originalUrl.includes('/api/system/');
    const isUpdates = req.originalUrl.includes('/api/agent/updates/');

    if (isLocal && (isSystem || isUpdates)) {
        console.log(`[AGENT] ✅ Bypass LOCAL concedido para: ${req.originalUrl} (IP detectada: ${ip})`);
        return next();
    }

    if (stationKey === config.STATION_KEY) {
        return next();
    }

    res.status(403).json({
        error: 'Acceso No Autorizado',
        message: 'Esta estación no ha sido validada por el Agente Local.'
    });
});

// --- CAPA DE SEGURIDAD (GATE) ---
function isLocalRequest(req) {
    const ip = req.ip || req.socket.remoteAddress || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || 
           ip === 'localhost' || ip.includes('127.0.0.1') || ip === '::';
}

const adminAuthGate = (req, res, next) => {
    if (isLocalRequest(req)) return next();

    if (req.originalUrl.includes('/api/admin/login') || req.originalUrl.includes('/assets/admin') || req.originalUrl.includes('/api/admin/connections')) {
        return next();
    }

    if (req.originalUrl.includes('/api/admin') && req.headers['x-admin-password']) {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        if (req.originalUrl.includes('/api/')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Se requiere autenticación de administrador para acceso remoto.'
            });
        }
        return res.status(401).send('Acceso no autorizado (Requiere Login de Administrador)');
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    const PASS_HASH = '9e3953e9fea7ab3622aed509723766bff8e7500da19fba8e091d13504913af40';
    const hash = crypto.createHash('sha256').update(pass).digest('hex');

    if (user === 'admin' && hash === PASS_HASH) {
        return next();
    } else {
        return res.status(401).send('Credenciales incorrectas');
    }
};

app.use('/api/admin', adminAuthGate);

// --- MONTAJE DE RUTAS ---
const systemLocalRoutes = require('./routes/system_local');
const adminRoutes = require('./routes/admin');

app.get('/api/auth/id', (req, res) => {
    res.json({
        stationId: config.STATION_ID,
        stationKey: config.STATION_KEY,
        description: config.DESCRIPTION
    });
});

app.use('/api/system', (req, res, next) => {
    console.log(`[AGENT] Request moving into system routes: ${req.method} ${req.url}`);
    next();
}, systemLocalRoutes);

app.use('/api/admin', adminRoutes);

// Rutas de actualización del agent
const updatesRoutes = require('./routes/updates');
app.use('/api/agent/updates', updatesRoutes);

// Fallback para rutas no encontradas bajo /api
app.use('/api', (req, res) => {
    console.warn(`[AGENT] 404 on API: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'API route not found on Agent', path: req.url });
});

// Servir estáticos (ajustado para la nueva estructura)
app.use('/assets', express.static(path.join(__dirname, '../../assets'), {
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

app.get('/health', (req, res) => {
    res.json({ status: 'ok', component: 'local-agent', version: '2.0.0-PRO' });
});

// --- RUTA DEBUG PARA VER LOGS DEL NAVEGADOR ---
app.post('/debug-log', (req, res) => {
    console.log('[BROWSER-LOG]', req.body);
    res.status(200).send();
});

// --- INICIO DE SERVIDOR ---
const PORT = 3001;
const BIND_ADDRESS = config.LOCAL_ONLY ? '127.0.0.1' : '0.0.0.0';
const certPath = '/etc/letsencrypt/live/www.desdetenerife.com/fullchain.pem';
const keyPath = '/etc/letsencrypt/live/www.desdetenerife.com/privkey.pem';

try {
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        // Servidor HTTPS para conexiones externas
        const options = { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
        https.createServer(options, app).listen(PORT, BIND_ADDRESS, () => {
            console.log(`[AGENT] Servidor HTTPS iniciado en ${BIND_ADDRESS}:${PORT} (SSL ACTIVO)`);
        });

        // Servidor HTTP adicional SOLO para localhost (sin problemas SSL)
        const http = require('http');
        const HTTP_PORT = 3002;
        http.createServer(app).listen(HTTP_PORT, '127.0.0.1', () => {
            console.log(`[AGENT] Servidor HTTP local iniciado en 127.0.0.1:${HTTP_PORT} (solo localhost)`);
        });
    } else {
        app.listen(PORT, BIND_ADDRESS, () => {
            console.log(`[AGENT] Servidor HTTP iniciado en ${BIND_ADDRESS}:${PORT} (AVISO: SSL No encontrado)`);
        });
    }
} catch (err) {
    console.error(`[AGENT] Fallo al iniciar servidor: ${err.message} `);
    app.listen(PORT, BIND_ADDRESS, () => {
        console.log(`[AGENT] Servidor HTTP iniciado como fallback en ${BIND_ADDRESS}:${PORT}`);
    });
}

// --- REGISTRO DE AGENTE CONTINUO (Anti-PNA) ---
let mainServerUrl = 'https://www.desdetenerife.com:3000';
try {
    const storageConfigPath = path.join(__dirname, '../../storage/config.json');
    if (fs.existsSync(storageConfigPath)) {
        const mainConfig = JSON.parse(fs.readFileSync(storageConfigPath, 'utf8'));
        if (mainConfig.SYSTEM) {
            if (mainConfig.SYSTEM.REMOTE_API_URL && mainConfig.SYSTEM.REMOTE_API_URL.startsWith('http')) {
                mainServerUrl = mainConfig.SYSTEM.REMOTE_API_URL;
            } else if (mainConfig.SYSTEM.API_URL && mainConfig.SYSTEM.API_URL.startsWith('http')) {
                mainServerUrl = mainConfig.SYSTEM.API_URL;
            }
        }
    }
} catch (e) {
    console.error(`[AGENT] Error loading main server config: ${e.message}`);
}
mainServerUrl = mainServerUrl.replace(/\/api$/, '').replace(/\/api\/$/, '');

async function sendAgentHeartbeat() {
    const payload = {
        stationId: config.STATION_ID,
        stationKey: config.STATION_KEY,
        localToken: localToken,
        port: PORT
    };
    let dispatcher;
    try { dispatcher = new (require('undici').Agent)({ connect: { rejectUnauthorized: false } }); } catch (e) { }

    // Si el agente corre en el mismo servidor (LOCAL_ONLY), registrar vía localhost
    // para que el servidor nos vea como 127.0.0.1 → activa el localhost-fallback en admin.js
    const localUrl = `https://127.0.0.1:${3000}/api/admin/agent-proxy/register`;

    const tryUrls = config.LOCAL_ONLY
        ? [localUrl, `${mainServerUrl}/api/admin/agent-proxy/register`]
        : [`${mainServerUrl}/api/admin/agent-proxy/register`];

    for (const registerUrl of tryUrls) {
        try {
            const response = await fetch(registerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                dispatcher
            });
            if (response.ok) {
                const data = await response.json();
                console.log(`[AGENT] Heartbeat OK via ${registerUrl} - IP: ${data.ip}`);
                return; // éxito, no seguir con el siguiente
            } else {
                console.warn(`[AGENT] Heartbeat Failed (${response.status}) on ${registerUrl}`);
            }
        } catch (err) {
            console.error(`[AGENT] Heartbeat Error on ${registerUrl}: ${err.message}`);
        }
    }
}

// Explosive heartbeat (Startup optimization)
const initialDelays = [0, 2000, 5000, 10000];
initialDelays.forEach(delay => setTimeout(sendAgentHeartbeat, delay));
setInterval(sendAgentHeartbeat, 15000);

// ==========================================
// TÚNEL WEBSOCKET INVERSO (v4)
// ==========================================

function getMachineFingerprint() {
    const interfaces = os.networkInterfaces();
    let mac = '';
    let allMacs = [];

    // Recolectar TODAS las MACs (no solo la primera)
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
                allMacs.push(iface.mac);
                if (!mac) mac = iface.mac;
            }
        }
    }

    // Ordenar MACs para consistencia
    allMacs.sort();
    const macString = allMacs.join('-');

    // Incluir más datos únicos: MACs, hostname, platform, CPUs, memoria total
    const cpuModel = os.cpus()[0]?.model || 'unknown';
    const totalMem = os.totalmem();
    const seed = `${macString}-${os.hostname()}-${os.platform()}-${cpuModel}-${totalMem}`;

    const fingerprint = crypto.createHash('sha256').update(seed).digest('hex');

    console.log(`[AGENT] Fingerprint generado con seed: ${mac}-${os.hostname()}-${os.platform()}`);

    return { fingerprint, mac, hostname: os.hostname() };
}

// Determinar URL del túnel basada en el servidor principal detectado
const wsBaseUrl = mainServerUrl.replace(/^http/, 'ws');
const CENTRAL_SERVER_URL = process.env.CENTRAL_URL || `${wsBaseUrl}/agent-tunnel`;
let wsTunnel = null;

function connectToCentral() {
    const { fingerprint } = getMachineFingerprint();
    console.log(`[AGENT] Conectando Túnel Central WSS: ${CENTRAL_SERVER_URL}`);

    wsTunnel = new WebSocket(CENTRAL_SERVER_URL, { rejectUnauthorized: false });

    wsTunnel.on('open', () => {
        console.log('[AGENT] Túnel WS Abierto. Autenticando huella...');
        wsTunnel.send(JSON.stringify({
            type: 'auth',
            payload: { stationKey: config.STATION_KEY, fingerprint: fingerprint }
        }));
    });

    wsTunnel.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'auth_success') {
                console.log(`[AGENT] ✅ SECURE TUNNEL ESTABLISHED.`);
            } else if (data.type === 'auth_fail') {
                console.error(`[AGENT] ❌ CONEXIÓN WS RECHAZADA.`);
                wsTunnel.close();
            } else if (data.type === 'ping') {
                wsTunnel.send(JSON.stringify({ type: 'pong' }));
            } else if (data.type === 'command') {
                console.log('[AGENT] Comando Remoto Recibido:', data.payload);
                executeRemoteCommand(data.payload);
            }
        } catch (e) {
            console.error('[AGENT] Error parseando WS:', e.message);
        }
    });

    wsTunnel.on('close', () => { setTimeout(connectToCentral, 5000); });
    wsTunnel.on('error', (err) => { wsTunnel.close(); });
}

function executeRemoteCommand(payload) {
    const { action, command, type } = payload;

    // Detectar OS del agente (donde corre este código)
    const isWin = process.platform === 'win32';

    if (action === 'launch') {
        let launchCmd;

        // Para carpetas, usar explorer en Windows o xdg-open en Linux
        if (type === 'folder') {
            launchCmd = isWin ? `explorer "${command}"` : `xdg-open "${command}"`;
        } else {
            // Para aplicaciones y archivos, usar start en Windows o xdg-open en Linux
            launchCmd = isWin ? `start "" "${command}"` : `xdg-open "${command}"`;
        }

        console.log(`[AGENT] Executing Remote Launch (Platform: ${process.platform}, Type: ${type || 'app'}): ${launchCmd}`);
        require('child_process').exec(launchCmd, (err, stdout, stderr) => {
            if (err) {
                console.error(`[AGENT] Launch error: ${err.message}`);
                console.error(`[AGENT] stderr: ${stderr}`);
            } else {
                console.log(`[AGENT] Launch success for: ${command}`);
            }
        });
    } else if (action === 'start-server') {
        require('child_process').exec('pm2 start server_v4.js --name "recepcion-central"', { cwd: path.join(__dirname, '../..') });
    } else if (action === 'stop-server') {
        require('child_process').exec('pm2 stop recepcion-central');
    }
}

setTimeout(connectToCentral, 3000);
