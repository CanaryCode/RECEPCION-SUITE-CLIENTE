const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const os = require('os');
const WebSocket = require('ws');

const app = express();
// const PORT = 3001; // Usamos un puerto diferente al servidor principal para evitar conflictos - REMOVED as it's redefined later

const fs_sync = require('fs');
const LOG_FILE = path.join(__dirname, '../agent.log');

function logToFile(msg) {
    const time = new Date().toISOString();
    const formatted = `[AGENT] ${time} - ${msg} \n`;
    try {
        fs_sync.appendFileSync(LOG_FILE, formatted);
    } catch (e) {
        console.error('Error writing to log file:', e.message);
    }
}

// Middleware de CORS 100% personalizado para soportar Private Network Access (PNA)
// Reemplazamos el módulo 'cors' porque interfiere con las respuestas OPTIONS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Station-Key, x-admin-password, Accept, Origin, Authorization');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    next();
});

// --- SEGURIDAD: Token de Handshake Local ---
// Este token se genera al arrancar y permite al navegador demostrar que tiene
// acceso físico/local a este agente, evitando que otras máquinas en la misma red
// usen la IP autorizada.
const localToken = crypto.randomBytes(16).toString('hex');
console.log(`[AGENT] Local Token generated: ${localToken}`);

// Endpoint público para que el navegador obtenga su token local
app.get('/local-token', (req, res) => {
    res.json({ token: localToken });
});

app.use(express.json());

// Logging básico para depuración de polling
app.use((req, res, next) => {
    const remoteIp = req.ip || req.socket.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'none';
    const msg = `[CONN] ${req.method} ${req.url} from ${remoteIp} - UA: ${ua}`;
    console.log(`[AGENT] ${new Date().toISOString()} - ${msg} `);
    logToFile(msg);
    next();
});

const config = require('./agent_config.json');

// Middleware de Estación (Seguridad AJPD)
app.use('/api', (req, res, next) => {
    // Permitir obtener la identidad de la estación siempre
    if (req.path === '/auth/id' || req.path === '/auth/id/') return next();

    // El resto de la API requiere autenticación de estación (x-station-key)
    const stationKey = req.headers['x-station-key'];
    if (stationKey === config.STATION_KEY) {
        return next();
    }

    // Nota: Las rutas de admin (login fallback) se manejan dentro de adminRoutes 
    // pero aquí aplicamos la primera capa de filtro de estación.
    if (req.path.startsWith('/admin')) return next();

    res.status(403).json({
        error: 'Acceso No Autorizado',
        message: 'Esta estación no ha sido validada por el Agente Local.'
    });
});

// --- CAPA DE SEGURIDAD (GATE) ---

// Función auxiliar para detectar si la petición es local
function isLocalRequest(req) {
    const ip = req.ip || req.socket.remoteAddress || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.includes('localhost');
}

// Middleware de Puerta de Enlace (Gate) - Protege tanto estáticos como API para accesos externos
const adminAuthGate = (req, res, next) => {
    if (isLocalRequest(req)) {
        return next();
    }

    // Permitir login y recursos estáticos sin autenticación previa
    if (req.originalUrl.includes('/api/admin/login') || req.originalUrl.includes('/assets/admin') || req.originalUrl.includes('/api/admin/connections')) {
        return next();
    }

    // Mejora UX: Si es una petición de API y ya trae la clave de admin, saltamos el Basic Auth
    // para dejar que el authMiddleware de la ruta lo valide (evita doble login)
    // Usamos originalUrl porque 'path' puede ser relativo al montaje (ej: /logs)
    if (req.originalUrl.includes('/api/admin') && req.headers['x-admin-password']) {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.warn(`[AUTH-GATE] Blocking remote request from ${req.ip} to ${req.originalUrl} (No Auth)`);

        // Si es API, devolvemos JSON rico en vez de texto plano para evitar errores de parseo en el front
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
    // const crypto = require('crypto'); // MOVED to top-level imports
    const hash = crypto.createHash('sha256').update(pass).digest('hex');

    if (user === 'admin' && hash === PASS_HASH) {
        return next();
    } else {
        return res.status(401).send('Credenciales incorrectas');
    }
};

// Aplicar el Gate SOLO a las rutas de API. 
// Dejamos /assets libre para que cargue la UI y el overlay de login propio haga su trabajo.
app.use('/api/admin', adminAuthGate);
// app.use('/assets/admin', adminAuthGate); // ELIMINADO para permitir Password-Only Overlay

// --- MONTAJE DE RUTAS ---

// Importar rutas locales
const systemLocalRoutes = require('./routes/system_local');
const adminRoutes = require('./routes/admin');

/**
 * GET /api/auth/id
 * Devuelve la identidad de la estación (Station Key)
 */
app.get('/api/auth/id', (req, res) => {
    try {
        const config = require('./agent_config.json');
        res.json({
            stationId: config.STATION_ID,
            stationKey: config.STATION_KEY,
            description: config.DESCRIPTION
        });
    } catch (e) {
        res.status(500).json({ error: 'Config file not found' });
    }
});

// Montar rutas
app.use('/api/system', systemLocalRoutes);
app.use('/api/admin', adminRoutes);

// Servir estáticos de la consola de administración sin caché
app.use('/assets', express.static(path.join(__dirname, '../assets'), {
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// Health check para el Agente (Público)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', component: 'local-agent' });
});

// --- INICIO DE SERVIDOR ---

const PORT = 3001;
const certPath = '/etc/letsencrypt/live/www.desdetenerife.com/fullchain.pem';
const keyPath = '/etc/letsencrypt/live/www.desdetenerife.com/privkey.pem';

try {
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        const options = {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath)
        };
        https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
            console.log(`[AGENT] Servidor HTTPS iniciado en puerto ${PORT} (SSL ACTIVO)`);
        });
    } else {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`[AGENT] Servidor HTTP iniciado en puerto ${PORT} (AVISO: SSL No encontrado en ${certPath})`);
        });
    }
} catch (err) {
    console.error(`[AGENT] Fallo al iniciar servidor HTTPS: ${err.message} `);
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[AGENT] Servidor HTTP iniciado como fallback en puerto ${PORT} `);
    });
}
console.log(`========================================`);

// --- REGISTRO DE AGENTE CONTINUO (Anti-PNA) ---
// Para evitar bloqueos de PNA en los navegadores (HTTPS -> HTTP Localhost), el Agente se registra 
// continuamente con el servidor principal. El servidor principal luego autorizará a cualquier navegador 
// que comparta la misma IP pública que este Agente.
let mainServerUrl = 'https://www.desdetenerife.com:3000';
try {
    const storageConfigPath = path.join(__dirname, '../storage/config.json');
    if (fs.existsSync(storageConfigPath)) {
        const mainConfig = JSON.parse(fs.readFileSync(storageConfigPath, 'utf8'));
        // Prioridad: 1. REMOTE_API_URL, 2. API_URL (si es absoluta), 3. Fallback default
        if (mainConfig.SYSTEM) {
            if (mainConfig.SYSTEM.REMOTE_API_URL && mainConfig.SYSTEM.REMOTE_API_URL.startsWith('http')) {
                mainServerUrl = mainConfig.SYSTEM.REMOTE_API_URL;
            } else if (mainConfig.SYSTEM.API_URL && mainConfig.SYSTEM.API_URL.startsWith('http')) {
                mainServerUrl = mainConfig.SYSTEM.API_URL;
            }
        }
    }
} catch (e) {
    console.error(`[AGENT] Error loading main server config for heartbeat: ${e.message}`);
}

// Limpiar la URL de /api si existe, ya que el endpoint se añade luego
mainServerUrl = mainServerUrl.replace(/\/api$/, '').replace(/\/api\/$/, '');

console.log(`[AGENT] Heartbeat target set to: ${mainServerUrl}`);

async function sendAgentHeartbeat() {
    try {
        const payload = {
            stationId: config.STATION_ID,
            stationKey: config.STATION_KEY,
            localToken: localToken,
            port: PORT
        };
        // Use global fetch (Node 18+) with undici to ignore self-signed certs if needed
        let dispatcher;
        try { dispatcher = new (require('undici').Agent)({ connect: { rejectUnauthorized: false } }); } catch (e) { }

        const registerUrl = `${mainServerUrl}/api/admin/agent-proxy/register`;
        const response = await fetch(registerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            dispatcher
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`[AGENT] Heartbeat OK - Registered as IP: ${data.ip}`);
        } else {
            console.warn(`[AGENT] Heartbeat Failed (${response.status}): ${response.statusText}`);
        }
    } catch (err) {
        console.error(`[AGENT] Heartbeat Error connecting to ${mainServerUrl}: ${err.message}`);
    }
}
// Enviar primer latido y luego cada 15 segundos
setTimeout(sendAgentHeartbeat, 2000);
setInterval(sendAgentHeartbeat, 15000);

// ==========================================
// TÚNEL WEBSOCKET INVERSO (v4)
// ==========================================

function getMachineFingerprint() {
    const interfaces = os.networkInterfaces();
    let mac = '';
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
                mac = iface.mac; break;
            }
        }
        if (mac) break;
    }
    const seed = mac || os.hostname();
    const fingerprint = crypto.createHash('sha256').update(`${seed}-${os.platform()}-${os.hostname()}`).digest('hex');
    return { fingerprint, mac, hostname: os.hostname() };
}

const CENTRAL_SERVER_URL = process.env.CENTRAL_URL || 'wss://localhost:3000/agent-tunnel';
let wsTunnel = null;
let reconnectTimeout = null;

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
                console.error(`[AGENT] ❌ CONEXIÓN WS RECHAZADA: Huella incorrecta.`);
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
    const { action } = payload;
    let result = { action, status: 'success', output: 'Ejecutado localmente.' };

    if (action === 'start-server') {
        console.log('[AGENT] Orden de Arranque Local del Servidor.');
        require('child_process').exec('pm2 start server_v4.js --name "recepcion-central"', { cwd: path.join(__dirname, '..') });
    } else if (action === 'stop-server') {
        console.log('[AGENT] Orden de Apagado Local del Servidor.');
        require('child_process').exec('pm2 stop recepcion-central');
    }

    if (wsTunnel && wsTunnel.readyState === WebSocket.OPEN) {
        wsTunnel.send(JSON.stringify({ type: 'command_response', payload: result }));
    }
}

// Iniciar conexión del túnel
setTimeout(connectToCentral, 3000);
