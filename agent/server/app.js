const express = require('express'); // Force restart 2
const path = require('path');
const cors = require('cors');
const fs = require('fs'); // Changed from fsSync to fs
const https = require('https'); // Added https
const crypto = require('crypto'); // Added crypto

const STORAGE_DIR = path.resolve(__dirname, '../storage');
const LOG_FILE = path.join(STORAGE_DIR, 'server_debug.log');

const logToFile = (msg) => {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [SERVER] ${msg}\n`;
    try {
        if (!fs.existsSync(STORAGE_DIR)) { // Changed fsSync to fs
            fs.mkdirSync(STORAGE_DIR, { recursive: true }); // Changed fsSync to fs
        }
        fs.appendFileSync(LOG_FILE, entry); // Changed fsSync to fs
    } catch (e) {
        console.error('CRITICAL: Could not write to log file from app.js', e);
    }
};

logToFile('Starting Server Lifecycle');

// Import modular routes
const storageRoutes = require('./routes/storage');
const systemRoutes = require('./routes/system');
const heartbeatRoutes = require('./routes/heartbeat');
const adminRoutes = require('./routes/admin');

const app = express();
// const PORT = 3000; // PORT moved to server start block

// --- MIDDLEWARE ---
app.use(cors()); // Permite peticiones desde cualquier origen
app.use(express.json({ limit: '50mb' })); // Middleware para parsear JSON (con límite aumentado para backups)
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// SEGURIDAD: Validación de Estación Autorizada (AJPD)
const AUTHORIZED_STATIONS = ['RS-SECRET-8291-AJPD'];

app.use('/api', (req, res, next) => {
    // Excluir endpoints públicos y de autenticación de la validación de estación
    // Incluimos 'storage' porque el App Guest necesita leer configuración y datos
    const isPublic = /health|heartbeat|admin\/login|admin\/agent-proxy|admin\/connections|storage/.test(req.originalUrl);
    if (isPublic) return next();

    const stationKey = req.headers['x-station-key'];
    if (!stationKey || !AUTHORIZED_STATIONS.includes(stationKey)) {
        logToFile(`BLOCKED: Unauthorized station attempt from ${req.ip} to ${req.originalUrl} - Key: ${stationKey}`);
        return res.status(403).json({
            error: 'Unauthorized Station',
            message: 'Esta estación no tiene permiso para conectar con el servidor central.'
        });
    }
    next();
});

// Logging middleware (opcional, para depuración)
app.use((req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'none';

    // Capturar el final de la respuesta para loggear el status
    const oldEnd = res.end;
    res.end = function (chunk, encoding) {
        res.end = oldEnd;
        res.end(chunk, encoding);
        logToFile(`[CONN] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - IP: ${ip} - UA: ${ua}`);
    };
    next();
});

// --- API ROUTES ---
app.get('/api/health', async (req, res) => {
    let dbStatus = 'online';
    try {
        const db = require('./db');
        await db.query('SELECT 1');
    } catch (e) {
        dbStatus = 'offline';
    }

    res.json({
        status: 'ok',
        database: dbStatus,
        message: 'Modular Express Server Running',
        version: '5.0 [EXPRESS REFIT]'
    });
});

logToFile('Mounting Storage Routes...');
app.use('/api/storage', storageRoutes);
logToFile('Mounting System Routes...');
try {
    app.use('/api/system', systemRoutes);
    logToFile('SUCCESS: System Routes mounted at /api/system');
} catch (e) {
    logToFile(`CRITICAL FAIL: Could not mount System Routes: ${e.message}`);
}
logToFile('Mounting Heartbeat Routes...');
app.use('/api/heartbeat', heartbeatRoutes);
logToFile('Mounting Admin Routes...');
app.use('/api/admin', adminRoutes);

// --- CAPA DE SEGURIDAD ADMIN (GATE) ---

function isLocalRequest(req) {
    const ip = req.ip || req.socket.remoteAddress || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.includes('localhost');
}

const adminAuthGate = (req, res, next) => {
    if (isLocalRequest(req)) return next();

    // Permitir preflight OPTIONS siempre para evitar bloqueos de CORS ocultos
    if (req.method === 'OPTIONS') return next();

    // Permitir login, proxy de auth/registro y recursos estáticos sin autenticación previa
    if (req.originalUrl.includes('/api/admin/login') || req.originalUrl.includes('/api/admin/agent-proxy/auth/id') || req.originalUrl.includes('/api/admin/agent-proxy/register') || req.originalUrl.includes('/assets/admin')) {
        return next();
    }
    // Mejora UX: Bypass del gate para peticiones API que ya traen clave
    if (req.originalUrl.includes('/api/admin') && req.headers['x-admin-password']) { // Changed startsWith to includes
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.warn(`[AUTH-GATE] Blocking remote request from ${req.ip} to ${req.originalUrl}`);
        if (req.originalUrl.includes('/api/')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Acceso denegado (Admin Login Required)'
            });
        }
        return res.status(401).send('Acceso no autorizado (Admin Login Required)');
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    const PASS_HASH = '9e3953e9fea7ab3622aed509723766bff8e7500da19fba8e091d13504913af40';
    // const cryptoAuth = require('crypto'); // Moved crypto import to top
    const hash = crypto.createHash('sha256').update(pass).digest('hex'); // Changed cryptoAuth to crypto

    if (user === 'admin' && hash === PASS_HASH) {
        return next();
    } else {
        return res.status(401).send('Credenciales incorrectas');
    }
};

// Aplicar gate solo a API
app.use('/api/admin', adminAuthGate);
// app.use('/assets/admin', adminAuthGate); // ELIMINADO para permitir Password-Only Overlay

// --- STATIC FILES ---
// Servidor de archivos estáticos para el frontend
const frontendPath = path.resolve(__dirname, '..');
app.use(express.static(frontendPath));

// FIX: Servir explícitamente la carpeta storage para que las imágenes sean accesibles
const storagePath = path.resolve(__dirname, '../storage');
app.use('/storage', express.static(storagePath));

// Fallback para SPA (aunque el index.html está en la raíz, express.static ya lo sirve si safePath era '/')
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// --- ERROR HANDLING ---
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// --- INICIO DE SERVIDOR ---
const PORT = 3000;
const certPath = '/etc/letsencrypt/live/www.desdetenerife.com/fullchain.pem';
const keyPath = '/etc/letsencrypt/live/www.desdetenerife.com/privkey.pem';

try {
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        const options = {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath)
        };
        https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
            console.log(`[SERVER] HTTPS iniciado en puerto ${PORT} (SSL ACTIVO)`);
            console.log(`========================================`);
            console.log(`  HOTEL MANAGER SERVER v5.0 [EXPRESS]`);
            console.log(`  Running at https://localhost:${PORT}`);
            console.log(`========================================`);
        });
    } else {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`[SERVER] HTTP iniciado en puerto ${PORT} (AVISO: SSL No encontrado en ${certPath})`);
            console.log(`========================================`);
            console.log(`  HOTEL MANAGER SERVER v5.0 [EXPRESS]`);
            console.log(`  Running at http://localhost:${PORT}`);
            console.log(`========================================`);
        });
    }
} catch (err) {
    console.error(`[SERVER] Fallo al iniciar HTTPS: ${err.message}`);
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[SERVER] HTTP iniciado como fallback en puerto ${PORT}`);
        console.log(`========================================`);
        console.log(`  HOTEL MANAGER SERVER v5.0 [EXPRESS]`);
        console.log(`  Running at http://localhost:${PORT}`);
        console.log(`========================================`);
    });
}
