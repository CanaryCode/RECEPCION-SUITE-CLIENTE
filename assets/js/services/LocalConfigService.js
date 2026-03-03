/**
 * SERVICIO DE CONFIGURACIÓN LOCAL (LocalConfigService)
 * ----------------------------------------------------
 * Maneja configuraciones específicas de cada PC que NO deben guardarse
 * en la base de datos central, sino en el agente local del ordenador.
 *
 * IMPORTANTE:
 * - Cada PC tiene su propia configuración (rutas personalizadas, carpetas, etc.)
 * - Persiste al borrado de caché del navegador (se guarda en el agente)
 * - Ideal para rutas de archivos, configuración de launchers, carpetas de galería, etc.
 *
 * ESTRUCTURA DEL ARCHIVO (agent_local_config.json):
 * {
 *   "transfers": {
 *     "folders": ["C:\\Transfers\\Llegadas", "C:\\Transfers\\Salidas"]
 *   },
 *   "calendario": {
 *     "folders": ["C:\\Calendario\\Eventos"]
 *   },
 *   "launchers": [
 *     { "label": "Outlook", "path": "C:\\Program Files\\Microsoft Office\\...", "type": "app" },
 *     { "label": "Documentos", "path": "C:\\Users\\Admin\\Documents", "type": "folder" }
 *   ]
 * }
 */
class LocalConfigService {
    constructor() {
        this.cache = null;
        this.configLoaded = false;
        this.agentBaseUrl = null;
    }

    /**
     * DETECTAR URL del agente local (puerto 3001)
     * IMPORTANTE: Probamos HTTP primero para evitar errores SSL en consola
     */
    async _detectAgentUrl() {
        if (this.agentBaseUrl) return this.agentBaseUrl;

        const testUrls = [
            `http://127.0.0.1:3001`,
            `http://localhost:3001`,
            `https://127.0.0.1:3001`,
            `https://localhost:3001`
        ];

        for (const url of testUrls) {
            try {
                const response = await fetch(`${url}/api/system/ping?_t=${Date.now()}`, {
                    method: 'GET'
                });

                if (response.ok) {
                    this.agentBaseUrl = url;
                    console.log(`[LocalConfig] ✓ Agente local detectado en: ${url}`);
                    return url;
                }
            } catch (e) {
                // Intentar siguiente URL (silenciar errores CORS/SSL)
                console.debug(`[LocalConfig] × Intento fallido: ${url}`, e.message);
            }
        }

        throw new Error('No se pudo conectar al agente local en puerto 3001');
    }

    /**
     * INICIALIZAR: Cargar configuración desde el agente local
     */
    async init() {
        if (this.configLoaded) return this.cache;

        try {
            const baseUrl = await this._detectAgentUrl();
            const response = await fetch(`${baseUrl}/api/system/local-config?_t=${Date.now()}`, {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            this.cache = await response.json() || {};
            this.configLoaded = true;
            console.log('[LocalConfig] ✓ Configuración cargada del agente local:', this.cache);
            return this.cache;
        } catch (err) {
            console.error('[LocalConfig] Error cargando configuración:', err);
            this.cache = {};
            this.configLoaded = true;
            return this.cache;
        }
    }

    /**
     * OBTENER configuración de un módulo específico
     * @param {string} moduleKey - Clave del módulo (ej: 'transfers', 'calendario')
     * @param {*} defaultValue - Valor por defecto si no existe
     */
    async get(moduleKey, defaultValue = null) {
        await this.init();
        return this.cache[moduleKey] || defaultValue;
    }

    /**
     * ESTABLECER configuración de un módulo específico
     * @param {string} moduleKey - Clave del módulo (ej: 'transfers', 'calendario')
     * @param {*} value - Valor a guardar
     */
    async set(moduleKey, value) {
        await this.init();

        // Actualizar caché local
        this.cache[moduleKey] = value;

        // Guardar en el agente local
        try {
            const baseUrl = await this._detectAgentUrl();
            const response = await fetch(`${baseUrl}/api/system/local-config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ [moduleKey]: value })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            console.log(`[LocalConfig] ✓ Configuración guardada para '${moduleKey}':`, value);

            // Disparar evento para que los módulos se actualicen
            window.dispatchEvent(new CustomEvent('local-config-updated', {
                detail: { moduleKey, value }
            }));

            return true;
        } catch (err) {
            console.error(`[LocalConfig] Error guardando configuración para '${moduleKey}':`, err);
            throw err;
        }
    }

    /**
     * ACTUALIZAR parcialmente la configuración de un módulo
     * @param {string} moduleKey - Clave del módulo
     * @param {object} updates - Propiedades a actualizar
     */
    async update(moduleKey, updates) {
        const current = await this.get(moduleKey, {});
        const merged = { ...current, ...updates };
        return this.set(moduleKey, merged);
    }

    /**
     * ELIMINAR configuración de un módulo
     * @param {string} moduleKey - Clave del módulo
     */
    async remove(moduleKey) {
        await this.init();
        delete this.cache[moduleKey];

        // Guardar sin ese módulo
        const baseUrl = await this._detectAgentUrl();
        const response = await fetch(`${baseUrl}/api/system/local-config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.cache)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        console.log(`[LocalConfig] ✓ Configuración eliminada para '${moduleKey}'`);
    }

    /**
     * OBTENER carpetas configuradas para un módulo
     * @param {string} moduleKey - Clave del módulo
     */
    async getFolders(moduleKey) {
        const config = await this.get(moduleKey, {});
        return config.folders || [];
    }

    /**
     * ESTABLECER carpetas para un módulo
     * @param {string} moduleKey - Clave del módulo
     * @param {string[]} folders - Array de rutas de carpetas
     */
    async setFolders(moduleKey, folders) {
        return this.update(moduleKey, { folders });
    }

    /**
     * AÑADIR carpeta a un módulo
     * @param {string} moduleKey - Clave del módulo
     * @param {string} folderPath - Ruta de la carpeta
     */
    async addFolder(moduleKey, folderPath) {
        const folders = await this.getFolders(moduleKey);
        if (!folders.includes(folderPath)) {
            folders.push(folderPath);
            await this.setFolders(moduleKey, folders);
        }
    }

    /**
     * ELIMINAR carpeta de un módulo
     * @param {string} moduleKey - Clave del módulo
     * @param {string} folderPath - Ruta de la carpeta
     */
    async removeFolder(moduleKey, folderPath) {
        const folders = await this.getFolders(moduleKey);
        const filtered = folders.filter(f => f !== folderPath);
        await this.setFolders(moduleKey, filtered);
    }

    /**
     * OBTENER launchers configurados
     */
    async getLaunchers() {
        return await this.get('launchers', []);
    }

    /**
     * ESTABLECER launchers
     * @param {Array} launchers - Array de objetos launcher
     */
    async setLaunchers(launchers) {
        return this.set('launchers', launchers);
    }

    /**
     * AÑADIR launcher
     * @param {object} launcher - { label, path, type }
     */
    async addLauncher(launcher) {
        const launchers = await this.getLaunchers();
        launchers.push(launcher);
        await this.setLaunchers(launchers);
    }

    /**
     * ELIMINAR launcher por índice
     * @param {number} index - Índice del launcher
     */
    async removeLauncher(index) {
        const launchers = await this.getLaunchers();
        launchers.splice(index, 1);
        await this.setLaunchers(launchers);
    }
}

export const localConfigService = new LocalConfigService();
