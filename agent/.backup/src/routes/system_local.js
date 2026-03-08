const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');

const isWin = process.platform === 'win32';

/**
 * GET /api/system/ping
 */
router.get('/ping', (req, res) => {
    res.json({ pong: true, time: new Date().toISOString() });
});

/**
 * POST /api/system/launch
 * Abre un ejecutable o ruta en el PC local.
 */
router.post('/launch', (req, res) => {
    const { command, type } = req.body;
    if (!command) return res.status(400).json({ error: 'No command provided' });

    let launchCmd;

    // Para carpetas, usar explorer en Windows o xdg-open en Linux
    if (type === 'folder') {
        launchCmd = isWin ? `explorer "${command}"` : `xdg-open "${command}"`;
    } else {
        // Para aplicaciones y archivos, usar start en Windows o xdg-open en Linux
        launchCmd = isWin ? `start "" "${command}"` : `xdg-open "${command}"`;
    }

    console.log(`[AGENT] Executing (${type || 'app'}): ${launchCmd}`);

    exec(launchCmd, (err) => {
        if (err) {
            console.error(`[AGENT] Launch error:`, err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

/**
 * GET /api/system/image-proxy
 * Sirve una imagen local de forma segura.
 */
router.get('/image-proxy', async (req, res) => {
    const { path: filePath } = req.query;
    if (!filePath) return res.status(400).send('No path provided');

    try {
        const absolutePath = path.resolve(filePath);
        await fs.access(absolutePath);
        res.sendFile(absolutePath);
    } catch (err) {
        res.status(404).send('File not found local');
    }
});

/**
 * POST /api/system/list-images
 * Lista archivos multimedia en carpetas locales.
 */
router.post('/list-images', async (req, res) => {
    try {
        let { folderPaths } = req.body;
        if (!folderPaths || !Array.isArray(folderPaths)) folderPaths = [];

        const allMedia = [];
        for (let targetPath of folderPaths) {
            try {
                const fsPath = path.resolve(targetPath);
                await fs.access(fsPath);
                const dirents = await fs.readdir(fsPath, { withFileTypes: true });

                const fileEntries = dirents.filter(d => {
                    const ext = path.extname(d.name).toLowerCase();
                    return d.isFile() && ['.jpg', '.jpeg', '.png', '.gif', '.pdf'].includes(ext);
                });

                const mediaPromises = fileEntries.map(async (d) => {
                    const fullPath = path.join(fsPath, d.name);
                    let mtime = new Date().toISOString(); // Default fallback
                    
                    try {
                        const stats = await fs.stat(fullPath);
                        mtime = stats.mtime.toISOString();
                    } catch (e) {
                        console.warn(`[AGENT] No se pudo leer mtime de ${fullPath}`);
                    }

                    return {
                        name: d.name,
                        path: fullPath.replace(/\\/g, '/'),
                        folder: targetPath.replace(/\\/g, '/'),
                        url: `/api/system/image-proxy?path=${encodeURIComponent(fullPath)}`,
                        type: path.extname(d.name).toLowerCase() === '.pdf' ? 'pdf' : 'image',
                        mtime: mtime
                    };
                });

                const mediaItems = await Promise.all(mediaPromises);
                allMedia.push(...mediaItems);
            } catch (e) {
                console.warn(`[AGENT] Skip folder: ${targetPath}`);
            }
        }
        res.json({ images: allMedia });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/system/local-config
 * Retrieves local configuration elements (Launchers, Gallery) from local_config.json.
 *
 * RUTA: Se guarda en agent/config/local_config.json (relativa al agente)
 * Esto permite que funcione en cualquier instalación (Windows/Linux)
 */
router.get('/local-config', async (req, res) => {
    try {
        // Ruta relativa a la raíz del agente: agent/config/local_config.json
        const configPath = path.join(__dirname, '../../config/local_config.json');
        console.log(`[AGENT] Reading config from: ${configPath}`);

        try {
            const data = await fs.readFile(configPath, 'utf8');
            res.json(JSON.parse(data));
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.log('[AGENT] Config file not found, returning empty config');
                return res.json({}); // Default empty config
            }
            throw err;
        }
    } catch (e) {
        console.error('[AGENT] Error reading local config:', e);
        res.status(500).json({ error: 'Could not read local config' });
    }
});

/**
 * POST /api/system/local-config
 * Saves local configuration elements to local_config.json.
 *
 * RUTA: Se guarda en agent/config/local_config.json (relativa al agente)
 * Esto permite que funcione en cualquier instalación (Windows/Linux)
 */
router.post('/local-config', async (req, res) => {
    try {
        // Ruta relativa a la raíz del agente: agent/config/local_config.json
        const configPath = path.join(__dirname, '../../config/local_config.json');
        console.log(`[AGENT] Writing config to: ${configPath}`);

        let existingConfig = {};
        try {
            const data = await fs.readFile(configPath, 'utf8');
            existingConfig = JSON.parse(data);
        } catch (err) {
            // Error ENOENT is fine, means file doesn't exist yet
            if (err.code === 'ENOENT') {
                console.log('[AGENT] Creating new config file');
            }
        }

        // Merge existing with new payload
        const updatedConfig = { ...existingConfig, ...req.body };

        await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2), 'utf8');
        console.log('[AGENT] ✓ Config saved successfully');
        res.json({ success: true });
    } catch (e) {
        console.error('[AGENT] Error saving local config:', e);
        res.status(500).json({ error: 'Could not save local config' });
    }
});

/**
 * POST /api/system/list-docs
 * Lista archivos de documentos en carpetas locales.
 */
router.post('/list-docs', async (req, res) => {
    try {
        let { folderPaths } = req.body;
        if (!folderPaths || !Array.isArray(folderPaths)) folderPaths = [];

        const allDocs = [];
        const docExtensions = ['.pdf', '.doc', '.docx', '.txt', '.xlsx', '.xls', '.odt', '.rtf'];

        for (let targetPath of folderPaths) {
            try {
                const fsPath = path.resolve(targetPath);
                await fs.access(fsPath);
                const dirents = await fs.readdir(fsPath, { withFileTypes: true });

                const docItems = dirents
                    .filter(d => {
                        const ext = path.extname(d.name).toLowerCase();
                        return d.isFile() && docExtensions.includes(ext);
                    })
                    .map(async (d) => {
                        const fullPath = path.join(fsPath, d.name);
                        const stats = await fs.stat(fullPath);
                        return {
                            label: d.name,
                            path: fullPath.replace(/\\/g, '/'),
                            type: 'documentos',
                            mtime: stats.mtime,
                            size: stats.size
                        };
                    });

                const resolvedDocs = await Promise.all(docItems);
                allDocs.push(...resolvedDocs);
            } catch (e) {
                console.warn(`[AGENT] Skip folder: ${targetPath} - ${e.message}`);
            }
        }
        res.json({ documents: allDocs });
    } catch (err) {
        console.error('[AGENT] Error listing docs:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/system/list-files
 * Lista archivos y carpetas del sistema de archivos del cliente local.
 */
router.post('/list-files', async (req, res) => {
    try {
        const { currentPath } = req.body;
        if (!currentPath) return res.status(400).json({ error: 'No path provided' });

        const fsPath = path.resolve(currentPath);
        console.log(`[AGENT] Listing files for path: ${fsPath} (Raw: ${currentPath})`);

        try {
            await fs.access(fsPath);
        } catch (err) {
            console.warn(`[AGENT] Path not found or not accessible: ${fsPath}`);
            return res.status(404).json({ error: 'Path not found or not accessible', path: fsPath });
        }

        const dirents = await fs.readdir(fsPath, { withFileTypes: true });

        const items = await Promise.all(dirents.map(async (dirent) => {
            const itemPath = path.join(fsPath, dirent.name);
            let size = 0;

            try {
                if (dirent.isFile()) {
                    const stats = await fs.stat(itemPath);
                    size = stats.size;
                }
            } catch (err) {
                // Ignore items we can't stat
            }

            return {
                name: dirent.name,
                path: itemPath.replace(/\\/g, '/'),
                isDirectory: dirent.isDirectory(),
                size: size
            };
        }));

        res.json({ items });
    } catch (err) {
        console.error('[AGENT] Error listing files:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/system/restart
 * Reinicia los procesos pm2 de la aplicación
 */
router.post('/restart', (req, res) => {
    console.log('[AGENT] Restart request received');

    // Responder inmediatamente antes de reiniciar
    res.json({ success: true, message: 'Reiniciando aplicación...' });

    // Reiniciar procesos después de un pequeño delay
    setTimeout(() => {
        console.log('[AGENT] Executing pm2 restart...');

        // Reiniciar el servidor central primero
        exec('pm2 restart recepcion-central', (err, stdout, stderr) => {
            if (err) {
                console.error('[AGENT] Error restarting recepcion-central:', err);
                console.error('[AGENT] stderr:', stderr);
            } else {
                console.log('[AGENT] Process recepcion-central restarted successfully');
            }

            // Reiniciar el agente después (con un delay adicional)
            setTimeout(() => {
                console.log('[AGENT] Restarting agent process...');
                exec('pm2 restart agent', (agentErr, agentStdout, agentStderr) => {
                    if (agentErr) {
                        console.error('[AGENT] Error restarting agent:', agentErr);
                    } else {
                        console.log('[AGENT] Agent process restarted successfully');
                    }
                });
            }, 1000);
        });
    }, 500);
});

/**
 * POST /api/system/web-proxy
 * Proxy para cargar páginas web externas evitando bloqueos CSP/X-Frame
 */
router.get('/web-proxy', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).send('URL is required');

        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url);
        const html = await response.text();

        // Añadir headers para permitir la carga en iframe
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.send(html);
    } catch (err) {
        console.error('[AGENT] Web proxy error:', err);
        res.status(500).send('Error loading external page');
    }
});

module.exports = router;
