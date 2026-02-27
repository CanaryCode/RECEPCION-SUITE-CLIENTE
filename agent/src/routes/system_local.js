const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');

const isWin = process.platform === 'win32';

/**
 * POST /api/system/launch
 * Abre un ejecutable o ruta en el PC local.
 */
router.post('/launch', (req, res) => {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: 'No command provided' });

    const launchCmd = isWin ? `start "" "${command}"` : `xdg-open "${command}"`;

    console.log(`[AGENT] Executing: ${launchCmd}`);

    exec(launchCmd, (err) => {
        if (err) return res.status(500).json({ error: err.message });
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

                const mediaItems = dirents
                    .filter(d => {
                        const ext = path.extname(d.name).toLowerCase();
                        return d.isFile() && ['.jpg', '.jpeg', '.png', '.gif', '.pdf'].includes(ext);
                    })
                    .map(d => ({
                        name: d.name,
                        path: path.join(fsPath, d.name).replace(/\\/g, '/'),
                        url: `/api/system/image-proxy?path=${encodeURIComponent(path.join(fsPath, d.name))}`,
                        type: path.extname(d.name).toLowerCase() === '.pdf' ? 'pdf' : 'image'
                    }));
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
 * Retrieves local configuration elements (Launchers, Gallery) from agent_local_config.json.
 */
router.get('/local-config', async (req, res) => {
    try {
        const configPath = path.resolve(__dirname, '../agent_local_config.json');
        try {
            const data = await fs.readFile(configPath, 'utf8');
            res.json(JSON.parse(data));
        } catch (err) {
            if (err.code === 'ENOENT') {
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
 * Saves local configuration elements to agent_local_config.json.
 */
router.post('/local-config', async (req, res) => {
    try {
        const configPath = path.resolve(__dirname, '../agent_local_config.json');

        let existingConfig = {};
        try {
            const data = await fs.readFile(configPath, 'utf8');
            existingConfig = JSON.parse(data);
        } catch (err) {
            // Error ENOENT is fine, means file doesn't exist yet
        }

        // Merge existing with new payload
        const updatedConfig = { ...existingConfig, ...req.body };

        await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2), 'utf8');
        res.json({ success: true });
    } catch (e) {
        console.error('[AGENT] Error saving local config:', e);
        res.status(500).json({ error: 'Could not save local config' });
    }
});

module.exports = router;
