const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { exec } = require('child_process');
const http = require('http');
const https = require('https');
const zlib = require('zlib');

const STORAGE_DIR = path.resolve(__dirname, '../../storage');
const LOG_FILE = path.join(STORAGE_DIR, 'server_debug.log');

const logToFile = (msg) => {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [SYSTEM] ${msg}\n`;
    try {
        if (!fsSync.existsSync(STORAGE_DIR)) {
            fsSync.mkdirSync(STORAGE_DIR, { recursive: true });
        }
        fsSync.appendFileSync(LOG_FILE, entry);
    } catch (e) {
        console.error('CRITICAL: Could not write to log file from system.js', e);
    }
};

/**
 * POST /api/system/launch
 * Opens an executable or path on the Windows system.
 */
const isWin = process.platform === 'win32';

/**
 * GET /api/system/local-config
 * Proxies the request to the Local Agent (3001) to get PC-specific config.
 */
router.get('/local-config', async (req, res) => {
    const ports = [3001, 3002];
    const protocols = ['https', 'http'];
    let lastError = null;

    for (const port of ports) {
        for (const protocol of protocols) {
            try {
                const agentUrl = `${protocol}://127.0.0.1:${port}/api/system/local-config`;
                const adminPass = req.headers['x-admin-password'];

                console.log(`[SYSTEM PROXY] Trying local-config on ${agentUrl}...`);
                const response = await fetch(agentUrl, {
                    headers: { 'x-admin-password': adminPass },
                    dispatcher: protocol === 'https' ? new (require('undici').Agent)({ connect: { rejectUnauthorized: false } }) : undefined,
                    signal: AbortSignal.timeout(2000)
                });

                if (response.ok) {
                    const data = await response.json();
                    return res.json(data);
                }
            } catch (err) {
                lastError = err;
            }
        }
    }

    console.error('[SYSTEM PROXY] All attempts failed for local-config:', lastError?.message);
    res.status(502).json({ error: 'No se pudo obtener la configuración local del agente.', details: lastError?.message });
});

/**
 * POST /api/system/launch
 * Proxies to local agent to open an executable or path.
 */
router.post('/launch', async (req, res) => {
    try {
        const agentUrl = 'http://127.0.0.1:3001/api/system/launch';
        const response = await fetch(agentUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-station-key': req.headers['x-station-key'] || ''
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (err) {
        // Fallback or error if agent is down
        res.status(502).json({ error: 'El Agente Local no responde a la petición de lanzamiento.' });
    }
});

/**
 * POST /api/system/list-files
 * Explorer-like functionality to browse the PC files.
 */
router.post('/list-files', async (req, res) => {
    try {
        const { currentPath } = req.body;
        let targetPath = currentPath;

        // Default path if empty or Windows path on Linux
        if (!targetPath || (targetPath.includes(':\\') && !isWin)) {
            targetPath = isWin ? 'C:\\' : '/';
        }

        const dirents = await fs.readdir(targetPath, { withFileTypes: true });

        const items = dirents.map(dirent => {
            const fullPath = path.join(targetPath, dirent.name);
            return {
                name: dirent.name,
                isDirectory: dirent.isDirectory(),
                path: isWin ? fullPath : fullPath.replace(/\\/g, '/')
            };
        });

        // Sort: Folders first, then alphabetically
        items.sort((a, b) => {
            if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
            return a.isDirectory ? -1 : 1;
        });

        res.json({
            path: targetPath,
            items: items
        });
    } catch (err) {
        console.error('File browser error:', err);
        res.status(500).json({ error: err.message });
    }
});

console.log('[System Routes] Module Loaded');

/**
 * El servidor central ya no gestiona proxy de imágenes locales del cliente.
 */

/**
 * El servidor central solo lista archivos de su propio almacenamiento central.
 */
router.post('/list-images', async (req, res) => {
    res.json({ images: [], message: 'Use Local Agent for client-side images' });
});

/**
 * POST /api/system/copy-to-clipboard
 * Copies one or more files to the Windows clipboard using PowerShell.
 */
router.post('/copy-to-clipboard', async (req, res) => {
    try {
        const { paths: filePaths } = req.body;
        if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
            return res.status(400).json({ error: 'No paths provided' });
        }

        // Normalizamos y escapamos las rutas para PowerShell
        const normalizedPaths = filePaths.map(p => {
            // Aseguramos que sea una ruta de Windows absoluta y escapamos comillas
            let winPath = path.normalize(p).replace(/\//g, '\\');
            return `"${winPath}"`;
        }).join(',');

        // Comando PowerShell para copiar archivos al portapapeles
        // Set-Clipboard -Path requiere un array de strings en PS
        const command = `powershell -Command "Set-Clipboard -Path ${normalizedPaths}"`;

        console.log(`[System Routes] Executing clipboard copy: ${command}`);

        exec(command, (err) => {
            if (err) {
                console.error('[System Routes] Clipboard copy error:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        });
    } catch (err) {
        console.error('Clipboard copy route error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Helper: Escanea una carpeta recursivamente buscando documentos.
 */
async function scanDirectoryRecursive(dirPath, extensions, maxDepth = 5, currentDepth = 0) {
    if (currentDepth > maxDepth) return [];

    let results = [];
    try {
        const dirents = await fs.readdir(dirPath, { withFileTypes: true });

        for (const dirent of dirents) {
            const fullPath = path.join(dirPath, dirent.name);

            if (dirent.isDirectory()) {
                // Recursión
                const subResults = await scanDirectoryRecursive(fullPath, extensions, maxDepth, currentDepth + 1);
                results = results.concat(subResults);
            } else if (dirent.isFile() || dirent.isSymbolicLink()) {
                const ext = path.extname(dirent.name).toLowerCase();
                if (extensions.includes(ext)) {
                    let mtime = new Date(0);
                    try {
                        const stats = await fs.stat(fullPath);
                        mtime = stats.mtime;
                    } catch (e) { }

                    results.push({
                        label: dirent.name,
                        path: fullPath,
                        type: 'documentos',
                        icon: 'file-earmark-text',
                        mtime: mtime.toISOString()
                    });
                }
            }
        }
    } catch (err) {
        // Ignorar errores de acceso a carpetas específicas
        logToFile(`[System Routes] Skip recursive folder ${dirPath}: ${err.message}`);
    }
    return results;
}

/**
 * POST /api/system/list-docs
 * Lists document files in specific directories (Recursively).
 */
router.post('/list-docs', async (req, res) => {
    try {
        const { folderPaths } = req.body;
        logToFile(`[System Routes] list-docs (recursive) received for: ${JSON.stringify(folderPaths)}`);

        if (!folderPaths || !Array.isArray(folderPaths)) {
            return res.status(400).json({ error: 'No folderPaths provided' });
        }

        const allDocs = [];
        const extensions = [
            '.pdf',
            '.doc', '.docx', '.odt', '.rtf',
            '.xls', '.xlsx', '.ods', '.csv',
            '.ppt', '.pptx', '.pps', '.odp',
            '.zip', '.rar', '.7z', '.txt'
        ];

        for (let targetPath of folderPaths) {
            try {
                let absolutePath = targetPath;
                const isWindowsAbsolute = /^[a-zA-Z]:[\\/]/.test(targetPath);

                if (isWindowsAbsolute) {
                    absolutePath = path.resolve(targetPath);
                } else if (path.isAbsolute(targetPath)) {
                    // Ya es absoluta
                } else {
                    absolutePath = path.join(__dirname, '../../', targetPath);
                }

                const fsPath = path.normalize(absolutePath);
                logToFile(`[System Routes] Scanning recursive folder: ${fsPath}`);

                await fs.access(fsPath);
                const docItems = await scanDirectoryRecursive(fsPath, extensions);

                logToFile(`[System Routes] Found ${docItems.length} documents recursively in ${fsPath}`);
                allDocs.push(...docItems);
            } catch (err) {
                logToFile(`[System Routes] ERROR scanning folder ${targetPath}: ${err.message}`);
            }
        }

        res.json({ documents: allDocs });
    } catch (error) {
        logToFile(`[System Routes] CRITICAL ERROR in list-docs: ${error.message}`);
        res.status(500).json({ error: 'Error listing documents', details: error.message });
    }
});

/**
 * GET /api/system/web-proxy
 * Fetches an external webpage and strips CSP/X-Frame headers to allow embedding.
 */
router.get('/web-proxy', (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('No URL provided');

    logToFile(`Web Proxy (AGGRESSIVE) Request: ${targetUrl}`);

    try {
        const urlObj = new URL(targetUrl);
        const protocol = urlObj.protocol === 'https:' ? https : http;

        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3'
            }
        };

        const proxyReq = protocol.get(targetUrl, options, (proxyRes) => {
            // Check for redirects
            if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
                let redirUrl = proxyRes.headers.location;
                if (!redirUrl.startsWith('http')) {
                    redirUrl = new URL(redirUrl, targetUrl).href;
                }
                logToFile(`Redirecting proxy to: ${redirUrl}`);
                return res.redirect(`/api/system/web-proxy?url=${encodeURIComponent(redirUrl)}`);
            }

            // Manejo de Descompresión
            let stream = proxyRes;
            const contentEncoding = proxyRes.headers['content-encoding'];

            if (contentEncoding === 'gzip') {
                stream = proxyRes.pipe(zlib.createGunzip());
            } else if (contentEncoding === 'deflate') {
                stream = proxyRes.pipe(zlib.createInflate());
            } else if (contentEncoding === 'br') {
                stream = proxyRes.pipe(zlib.createBrotliDecompress());
            }

            // Copiar código de estado
            res.status(proxyRes.statusCode);

            // Copiar cabeceras quitando las de seguridad y las de tamaño/compresión
            Object.keys(proxyRes.headers).forEach(key => {
                const lowerKey = key.toLowerCase();
                const restricted = ['content-security-policy', 'x-frame-options', 'frame-options', 'content-length', 'content-encoding'];
                if (!restricted.includes(lowerKey)) {
                    res.setHeader(key, proxyRes.headers[key]);
                }
            });

            // Si es HTML, reescribimos
            const isHtml = (proxyRes.headers['content-type'] || '').includes('text/html');

            if (isHtml) {
                let bodyChunks = [];
                stream.on('data', chunk => bodyChunks.push(chunk));
                stream.on('end', () => {
                    let body = Buffer.concat(bodyChunks).toString();
                    const origin = urlObj.origin;

                    // 1. Inyectar <base> tag
                    const baseTag = `<base href="${origin}${urlObj.pathname}">`;
                    if (body.includes('<head>')) {
                        body = body.replace('<head>', `<head>\n    ${baseTag}`);
                    } else if (body.includes('<html>')) {
                        body = body.replace('<html>', `<html>\n<head>${baseTag}</head>`);
                    }

                    // 2. REESCRITURA AGRESIVA (Regex mejorada)
                    // Maneja: attr="path", attr='path', attr=path, attr  =  "path"
                    const attrs = ['src', 'href', 'action', 'srcset', 'data-src', 'data-href', 'module-preload'];
                    attrs.forEach(attr => {
                        // Regex que busca el atributo, opcionalmente espacios, signo igual, opcionalmente espacios, 
                        // y luego captura el valor (con o sin comillas)
                        const regex = new RegExp(`(${attr})\\s*=\\s*(?:"|')?(?!http|https|data:|#|\\/\\/)([^"'>\\s]+)(?:"|'|\\s|>)`, 'ig');
                        body = body.replace(regex, (match, p1, path) => {
                            try {
                                const resolved = new URL(path, targetUrl).href;
                                return `${p1}="${resolved}"`;
                            } catch (e) {
                                return match;
                            }
                        });
                    });

                    // 3. REESCRITURA CSS url()
                    body = body.replace(/url\(['"]?(\/[^'"]+)['"]?\)/g, (match, path) => {
                        try {
                            const resolved = new URL(path, targetUrl).href;
                            return `url("${resolved}")`;
                        } catch (e) {
                            return match;
                        }
                    });

                    res.send(body);
                });
            } else {
                // Para binarios (imágenes, etc.), pipear el stream descompreso (o el original si no estaba compreso)
                stream.pipe(res);
            }
        });

        proxyReq.on('error', (err) => {
            logToFile(`Web Proxy Error: ${err.message}`);
            res.status(500).send(`Proxy Error: ${err.message}`);
        });

    } catch (err) {
        logToFile(`Web Proxy Fatal Error: ${err.message}`);
        res.status(500).send(`Invalid URL: ${err.message}`);
    }
});

module.exports = router;
