const express = require('express'); // Force restart 6
const path = require('path');
const cors = require('cors');
const fs = require('fs'); // Changed from fsSync to fs
const https = require('https');
const crypto = require('crypto');
const WebSocket = require('ws');

const STORAGE_DIR = path.resolve(__dirname, '../storage');
const LOG_FILE = path.join(STORAGE_DIR, 'server_debug.log');

// Visitor Activity Tracking Storage
global.visitorHistory = new Map(); // sessionId -> Array of { path, method, time }

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
const ttsRoutes = require('./routes/tts');

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
    // Incluimos 'tts' porque HTML5 Audio no envía cabeceras custom
    const isPublic = /health|heartbeat|admin|\/chat\/|storage|system|guia|updates|tts/.test(req.originalUrl);
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

        // Track visitor activity (excluding static assets and admin calls themselves to avoid loops)
        const isStatic = req.originalUrl.includes('.') || req.originalUrl.startsWith('/assets');
        const isAdmin = req.originalUrl.startsWith('/api/admin');
        if (!isStatic && !isAdmin) {
            const sessionId = req.headers['x-session-id'] || ip; // Fallback to IP if no session ID
            if (!global.visitorHistory.has(sessionId)) {
                global.visitorHistory.set(sessionId, []);
            }
            const history = global.visitorHistory.get(sessionId);
            history.unshift({
                path: req.originalUrl,
                method: req.method,
                time: new Date().toISOString(),
                status: res.statusCode
            });
            // Limit to last 30 requests
            if (history.length > 30) history.pop();
        }
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

function isLocalRequest(req) {
    const ip = req.ip || req.socket.remoteAddress || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.includes('localhost');
}

// --- CAPA DE SEGURIDAD ADMIN (GATE) ---
const adminAuthGate = (req, res, next) => {
    if (isLocalRequest(req)) return next();
    if (req.method === 'OPTIONS') return next();

    // Bypass gate for login and public agent-proxy routes
    if (req.originalUrl.includes('/api/admin/login') || 
        req.originalUrl.includes('/api/admin/agent-proxy/auth/id') || 
        req.originalUrl.includes('/api/admin/agent-proxy/register')) {
        return next();
    }

    // Pass-through for requests already containing the admin password
    if (req.headers['x-admin-password']) {
        const providedPass = req.headers['x-admin-password'];
        const PASS_HASH = '9e3953e9fea7ab3622aed509723766bff8e7500da19fba8e091d13504913af40';
        const hash = crypto.createHash('sha256').update(providedPass).digest('hex');
        if (hash === PASS_HASH || providedPass === 'gravina82') return next();
    }

    // Basic Auth fallback
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        if (req.originalUrl.includes('/api/')) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Admin Login Required' });
        }
        return res.status(401).send('Acceso no autorizado (Admin Login Required)');
    }

    try {
        const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
        const user = auth[0];
        const pass = auth[1];
        const PASS_HASH = '9e3953e9fea7ab3622aed509723766bff8e7500da19fba8e091d13504913af40';
        const hash = crypto.createHash('sha256').update(pass).digest('hex');
        if (user === 'admin' && hash === PASS_HASH) return next();
    } catch (e) { }

    return res.status(401).send('Credenciales incorrectas');
};

// Aplicar gate ANTES de montar las rutas admin
app.use('/api/admin', adminAuthGate);

logToFile('Mounting Admin Routes (behind gate)...');
app.use('/api/admin', adminRoutes);
logToFile('Mounting Chat Routes...');
app.use('/api/chat', chatRoutes);
logToFile('Mounting Guia Routes...');
app.use('/api/guia', guiaRoutes);
logToFile('Mounting Updates Routes...');
app.use('/api/updates', updatesRoutes);
logToFile('Mounting TTS Routes...');
app.use('/api/tts', ttsRoutes);
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

// --- GLOBAL STATE ---
global.agentTunnels = new Map();
global.chatUsers = new Map(); // username -> ws
global.activeSessions = new Map(); // ws -> sessionData

// --- WEBSOCKET LOGIC ---
function setupWebSocketServer(server) {
    const wss = new WebSocket.Server({ server });
    
    wss.on('connection', (ws, req) => {
        console.log('[WSS] Nuevo cliente conectado');
        ws.isAlive = true;

        // Identificar sesión (Usar un ID compatible con versiones antiguas de Node)
        const ip = req.socket.remoteAddress;
        const ua = req.headers['user-agent'] || 'Borrador/Unknown';
        const sessionId = crypto.randomBytes(16).toString('hex');
        
        const sessionData = {
            id: sessionId,
            timestamp: Date.now(), // Usar timestamp numérico
            ip: ip,
            ua: ua,
            username: 'Invitado', // Estandarizado
            isAgent: false
        };
        
        global.activeSessions.set(ws, sessionData);
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
                        
                        // Mark as agent in session data
                        const sData = global.activeSessions.get(ws);
                        if (sData) {
                            sData.isAgent = true;
                            sData.username = `Agente: ${stationKey.substring(0, 8)}`;
                        }
                        
                        ws.send(JSON.stringify({ type: 'auth_success' }));
                    } else {
                        ws.send(JSON.stringify({ type: 'auth_fail', reason: 'Missing credentials' }));
                    }
                } else if (data.type === 'chat_login') {
                    const { username } = data.payload;
                    if (username) {
                        ws.username = username;
                        const sData = global.activeSessions.get(ws);
                        if (sData) sData.username = username;
                        global.chatUsers.set(username, ws);
                        console.log(`[WSS] Usuario chat logueado: ${username}`);
                        broadcast({ type: 'user_connected', payload: { username, online: true } });
                        const users = Array.from(global.chatUsers.keys());
                        ws.send(JSON.stringify({ type: 'online_users', payload: { users } }));
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
                            payload: { id: result.insertId, sender, recipient: recipient || null, message, is_system: is_system || false, created_at: new Date() }
                        };
                        if (recipient) {
                            const targetWs = global.chatUsers.get(recipient);
                            if (targetWs && targetWs.readyState === WebSocket.OPEN) targetWs.send(JSON.stringify(chatPayload));
                            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(chatPayload));
                        } else {
                            broadcast(chatPayload);
                        }
                    }).catch(err => console.error('[WS CHAT ERROR]', err));
                } else if (data.type === 'shell_input') {
                    const { command, target } = data.payload;
                    const sData = global.activeSessions.get(ws);
                    if (!sData) return;

                    if (target === 'remote') {
                        // Forward to the first available agent tunnel
                        const tunnels = Array.from(global.agentTunnels.values());
                        if (tunnels.length > 0) {
                            const tunnel = tunnels[0];
                            tunnel.send(JSON.stringify({ 
                                type: 'shell_input', 
                                payload: { command, sessionId: sData.id } 
                            }));
                        } else {
                            ws.send(JSON.stringify({ type: 'shell_output', payload: { output: '[ERROR] No hay agentes conectados para consola remota.\n', target } }));
                        }
                        return;
                    }

                    // Shell Manager (Interactive Local)
                    if (!ws.shells) ws.shells = new Map();
                    
                    if (!ws.shells.has(target)) {
                        const { spawn } = require('child_process');
                        const shell = spawn('bash', ['-i'], {
                            cwd: path.resolve(__dirname, '..'),
                            env: { ...process.env, TERM: 'xterm-256color' },
                            shell: true
                        });

                        shell.stdout.on('data', (d) => ws.send(JSON.stringify({ type: 'shell_output', payload: { output: d.toString(), target } })));
                        shell.stderr.on('data', (d) => ws.send(JSON.stringify({ type: 'shell_output', payload: { output: d.toString(), target, isError: true } })));
                        
                        shell.on('close', () => {
                            ws.send(JSON.stringify({ type: 'shell_output', payload: { output: `\n[SISTEMA] Shell ${target} cerrada.\n`, target } }));
                            ws.shells.delete(target);
                        });

                        ws.shells.set(target, shell);
                    }

                    const shell = ws.shells.get(target);
                    if (command === 'SIGINT') {
                        shell.kill('SIGINT');
                    } else {
                        shell.stdin.write(command + '\n');
                    }
                } else if (data.type === 'pong') {
                    ws.isAlive = true;
                } else if (data.type === 'shell_output') {
                    // Forward agent shell output to all admin consoles
                    const adminPayload = JSON.stringify({
                        type: 'shell_output',
                        payload: { 
                            output: data.payload.output, 
                            target: 'remote', 
                            isError: data.payload.isError 
                        }
                    });
                    global.activeSessions.forEach((session, socket) => {
                        if (session.id === data.payload.sessionId) {
                            socket.send(adminPayload);
                        }
                    });
                }
            } catch (e) {
                console.error('[WSS ERROR]', e);
            }
        });

        ws.on('close', () => {
            if (ws.shells) {
                ws.shells.forEach(shell => shell.kill());
                ws.shells.clear();
            }
            if (ws.tunnelKey) {
                console.log(`[WSS] Agente desconectado: ${ws.tunnelKey}`);
                global.agentTunnels.delete(ws.tunnelKey);
            }
            if (ws.username) {
                global.chatUsers.delete(ws.username);
                broadcast({ type: 'user_connected', payload: { username: ws.username, online: false } });
            }
            global.activeSessions.delete(ws);
            console.log('[WSS] Cliente desconectado');
        });
    });

    // Keep-alive
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
    return wss;
}

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

        const server = https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
            console.log(`[SERVER] HTTPS iniciado en puerto ${PORT} (SSL ACTIVO)`);
        });

        const http = require('http');
        const httpApp = express();
        httpApp.use((req, res) => {
            const host = req.headers.host.split(':')[0];
            res.redirect(301, `https://${host}:${PORT}${req.url}`);
        });
        http.createServer(httpApp).listen(HTTP_PORT, '0.0.0.0');

        wss = setupWebSocketServer(server);
    } else {
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`[SERVER] HTTP iniciado en puerto ${PORT} (AVISO: SSL No encontrado)`);
        });
        wss = setupWebSocketServer(server);
    }
} catch (err) {
    console.error(`[SERVER] Fallo al iniciar HTTPS: ${err.message}`);
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`[SERVER] HTTP iniciado como fallback en puerto ${PORT}`);
    });
    wss = setupWebSocketServer(server);
}

// --- CHAT MESSAGE CLEANUP (30 MINUTE EXPIRATION) ---
// Ejecutar cada minuto para eliminar mensajes de más de 30 min
setInterval(async () => {
    try {
        const db = require('./db');
        // Fetch IDs to be deleted to broadcast to clients
        const [rows] = await db.query(
            'SELECT id FROM chat_messages WHERE created_at < NOW() - INTERVAL 30 MINUTE'
        );
        
        if (rows.length > 0) {
            const ids = rows.map(r => r.id);
            const [result] = await db.query(
                'DELETE FROM chat_messages WHERE id IN (?)',
                [ids]
            );
            
             if (result.affectedRows > 0) {
                console.log(`[CLEANUP] Borrados ${result.affectedRows} mensajes de chat expirados.`);
                
                const broadcastFn = app.get('broadcast');
                if (broadcastFn) {
                    broadcastFn({
                        type: 'chat_delete_multiple',
                        payload: { ids }
                    });
                }
            }
        }
    } catch (err) {
        // Silencioso para no ensuciar logs de arranque si la DB no está lista
    }
}, 1 * 60 * 1000); // Revisión cada minuto como solicitó el usuario
