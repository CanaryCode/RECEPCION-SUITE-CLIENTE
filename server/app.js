const express = require('express'); // Force restart 6
const path = require('path');
const cors = require('cors');
const fs = require('fs'); // Changed from fsSync to fs
const https = require('https');
const crypto = require('crypto');
const WebSocket = require('ws');

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
const chatRoutes = require('./routes/chat');
const guiaRoutes = require('./routes/guia');
const updatesRoutes = require('./routes/updates');

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
    // Incluimos 'system/launch' porque se valida internamente vía túnel o localhost
    // Incluimos todos los endpoints 'admin' porque tienen su propio middleware de autenticación
    // Incluimos 'updates' para permitir actualizaciones desde cualquier cliente
    const isPublic = /health|heartbeat|admin|\/chat\/|storage|system|guia|updates/.test(req.originalUrl);
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
logToFile('Mounting Chat Routes...');
app.use('/api/chat', chatRoutes);
logToFile('Mounting Guia Routes...');
app.use('/api/guia', guiaRoutes);
logToFile('Mounting Updates Routes...');
app.use('/api/updates', updatesRoutes);

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

// --- BROADCAST SYSTEM (WebSockets) ---
let wss;
const broadcast = (data) => {
    if (!wss) return;
    const msg = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
};

// Export broadcast for routes to use
app.set('broadcast', broadcast);

// --- INICIO DE SERVIDOR ---
const PORT = 3000;
const HTTP_PORT = 8080; // Puerto para redirecciones HTTP
const certPath = '/etc/letsencrypt/live/www.desdetenerife.com/fullchain.pem';
const keyPath = '/etc/letsencrypt/live/www.desdetenerife.com/privkey.pem';

try {
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        const options = {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath)
        };

        // Servidor HTTPS principal
        const server = https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
            console.log(`[SERVER] HTTPS iniciado en puerto ${PORT} (SSL ACTIVO)`);
            console.log(`========================================`);
            console.log(`  HOTEL MANAGER SERVER v5.0 [EXPRESS]`);
            console.log(`  Running at https://localhost:${PORT}`);
            console.log(`========================================`);
        });

        // Servidor HTTP para redireccionar a HTTPS
        const http = require('http');
        const httpApp = express();
        httpApp.use((req, res) => {
            const host = req.headers.host.split(':')[0]; // Obtener host sin puerto
            res.redirect(301, `https://${host}:${PORT}${req.url}`);
        });
        http.createServer(httpApp).listen(HTTP_PORT, '0.0.0.0', () => {
            console.log(`[SERVER] HTTP redirect server running on port ${HTTP_PORT} -> redirects to HTTPS:${PORT}`);
        });
        wss = new WebSocket.Server({ server });
        
        // --- AGENT TUNNEL TRACKING ---
        global.agentTunnels = new Map();
        global.chatUsers = new Map(); // username -> ws

        wss.on('connection', (ws) => {
            console.log('[WSS] Nuevo cliente conectado');
            ws.isAlive = true;
            ws.on('pong', () => { ws.isAlive = true; });
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    if (data.type === 'auth') {
                        const { stationKey, fingerprint } = data.payload;
                        if (stationKey && fingerprint) {
                            const tunnelKey = `${stationKey}::${fingerprint}`;
                            console.log(`[WSS] Agente autenticado para túnel: ${tunnelKey}`);
                            global.agentTunnels.set(tunnelKey, ws);
                            ws.tunnelKey = tunnelKey;
                            ws.stationKey = stationKey;
                            ws.fingerprint = fingerprint;
                            ws.send(JSON.stringify({ type: 'auth_success' }));
                        } else {
                            ws.send(JSON.stringify({ type: 'auth_fail', reason: 'Missing credentials' }));
                        }
                    } else if (data.type === 'chat_login') {
                        const { username } = data.payload;
                        if (username) {
                            ws.username = username;
                            global.chatUsers.set(username, ws);
                            console.log(`[WSS] Usuario chat logueado: ${username}`);
                            broadcast({ type: 'user_connected', payload: { username, online: true } });
                            
                            // Enviar lista de usuarios ya conectados a este usuario
                            const users = Array.from(global.chatUsers.keys());
                            ws.send(JSON.stringify({ 
                                type: 'online_users', 
                                payload: { users } 
                            }));
                        }
                    } else if (data.type === 'chat_message') {
                        const { sender, recipient, message, is_system } = data.payload;
                        const db = require('./db');
                        db.query(
                            'INSERT INTO chat_messages (sender, recipient, message, is_system) VALUES (?, ?, ?, ?)',
                            [sender, recipient || null, message, is_system || false]
                        ).then(([result]) => {
                            const chatPayload = {
                                type: 'chat_message',
                                payload: {
                                    id: result.insertId,
                                    sender,
                                    recipient: recipient || null,
                                    message,
                                    is_system: is_system || false,
                                    created_at: new Date()
                                }
                            };
                            if (recipient) {
                                const targetWs = global.chatUsers.get(recipient);
                                if (targetWs && targetWs.readyState === WebSocket.OPEN) targetWs.send(JSON.stringify(chatPayload));
                                if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(chatPayload));
                            } else {
                                broadcast(chatPayload);
                            }
                        }).catch(err => console.error('[WS CHAT ERROR]', err));
                    } else if (data.type === 'pong') {
                        ws.isAlive = true;
                    }
                } catch (e) {
                    console.error('[WSS ERROR]', e);
                }
            });

            ws.on('close', () => {
                if (ws.tunnelKey) {
                    console.log(`[WSS] Agente desconectado: ${ws.tunnelKey}`);
                    global.agentTunnels.delete(ws.tunnelKey);
                }
                if (ws.username) {
                    global.chatUsers.delete(ws.username);
                    broadcast({ type: 'user_connected', payload: { username: ws.username, online: false } });
                }
                console.log('[WSS] Cliente desconectado');
            });
        });

        // Keep-alive para los túneles
        const interval = setInterval(() => {
            wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    if (ws.tunnelKey) global.agentTunnels.delete(ws.tunnelKey);
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.send(JSON.stringify({ type: 'ping' }));
            });
        }, 30000);

        wss.on('close', () => clearInterval(interval));
    } else {
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`[SERVER] HTTP iniciado en puerto ${PORT} (AVISO: SSL No encontrado en ${certPath})`);
            console.log(`========================================`);
            console.log(`  HOTEL MANAGER SERVER v5.0 [EXPRESS]`);
            console.log(`  Running at http://localhost:${PORT}`);
            console.log(`========================================`);
        });
        wss = new WebSocket.Server({ server });
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

// --- CHAT MESSAGE CLEANUP (30 MINUTE EXPIRATION) ---
// Ejecutar cada 5 minutos para eliminar mensajes de más de 30 min
setInterval(async () => {
    try {
        const db = require('./db');
        const [result] = await db.query(
            'DELETE FROM chat_messages WHERE created_at < NOW() - INTERVAL 30 MINUTE'
        );
        if (result.affectedRows > 0) {
            console.log(`[CLEANUP] Borrados ${result.affectedRows} mensajes de chat expirados.`);
        }
    } catch (err) {
        // Silencioso para no ensuciar logs de arranque si la DB no está lista
    }
}, 5 * 60 * 1000);
