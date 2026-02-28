/**
 * LAZY MODULE LOADER
 * ------------------
 * Sistema de carga bajo demanda de módulos operativos.
 * Solo carga los módulos cuando el usuario navega a ellos por primera vez.
 */

export class ModuleLoader {
    static _loadedModules = new Set();
    static _pendingLoads = new Map();

    /**
     * Registro de módulos con su configuración de carga
     * - selector: ID del panel HTML (#agenda-content, etc.)
     * - importPath: Ruta del módulo JS
     * - initFunction: Nombre de la función de inicialización
     * - critical: Si es true, se carga al arranque
     */
    static MODULE_REGISTRY = {
        // MÓDULOS CRÍTICOS (se cargan al inicio)
        'despertadores': {
            selector: '#despertadores-content',
            importPath: './modules/despertadores.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarDespertadores',
            critical: true
        },
        'novedades': {
            selector: '#novedades-content',
            importPath: './modules/novedades.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarNovedades',
            critical: true
        },
        'cena-fria': {
            selector: '#cena-fria-content',
            importPath: './modules/cena_fria.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarCenaFria',
            critical: true
        },
        'desayuno': {
            selector: '#desayuno-content',
            importPath: './modules/desayuno.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarDesayuno',
            critical: true
        },
        'transfers': {
            selector: '#transfers-content',
            importPath: './modules/transfers.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarTransfers',
            critical: true
        },
        'alarms': {
            selector: '#system-alarms-content',
            importPath: './modules/alarms.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarSystemAlarms',
            critical: true
        },
        'alarms-ui': {
            selector: '#system-alarms-content',
            importPath: './modules/system_alarms_ui.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarSystemAlarmsUI',
            critical: true
        },
        'configuracion': {
            selector: '#configuracion-content',
            importPath: './modules/configuracion.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarConfiguracion',
            critical: true
        },

        // MÓDULOS LAZY (se cargan bajo demanda)
        'agenda': {
            selector: '#agenda-content',
            importPath: './modules/agenda.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarAgenda',
            critical: false
        },
        'caja': {
            selector: '#caja-content',
            importPath: './modules/caja.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarCaja',
            critical: false
        },
        'cobro': {
            selector: '#cobro-content',
            importPath: './modules/cobro.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarCobro',
            critical: false
        },
        'safe': {
            selector: '#safe-content',
            importPath: './modules/safe.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarSafe',
            critical: false
        },
        'atenciones': {
            selector: '#atenciones-content',
            importPath: './modules/atenciones.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarAtenciones',
            critical: false
        },
        'estancia': {
            selector: '#estancia-content',
            importPath: './modules/estancia.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarEstancia',
            critical: false
        },
        'riu': {
            selector: '#riu-content',
            importPath: './modules/riu.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarRiu',
            critical: false
        },
        'ayuda': {
            selector: '#ayuda-content',
            importPath: './modules/ayuda.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarAyuda',
            critical: false
        },
        'notas-permanentes': {
            selector: '#notas-content',
            importPath: './modules/notas_permanentes.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarNotasPermanentes',
            critical: false
        },
        'precios': {
            selector: '#precios-content',
            importPath: './modules/precios.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarPrecios',
            critical: false
        },
        'lost-found': {
            selector: '#lost-found-content',
            importPath: './modules/lost_found.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarLostFound',
            critical: false
        },
        'rack': {
            selector: '#rack-content',
            importPath: './modules/rack.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarRack',
            critical: false
        },
        'excursiones': {
            selector: '#excursiones-content',
            importPath: './modules/excursiones.js?v=V147_PROXY_FIX',
            initFunction: 'init',
            className: 'Excursiones',
            critical: false
        },
        'reservas-instalaciones': {
            selector: '#reservas-instalaciones-content',
            importPath: './modules/reservas_instalaciones.js?v=V147_PROXY_FIX',
            initFunction: 'init',
            className: 'ReservasInstalaciones',
            critical: false
        },
        'valoracion': {
            selector: '#valoracion-content',
            importPath: './modules/valoracion.js?v=V147_PROXY_FIX',
            initFunction: 'inicializarValoracion',
            critical: false
        },
        'gallery': {
            selector: '#gallery-content',
            importPath: './modules/gallery.js?v=V147_PROXY_FIX',
            initFunction: 'inicializar',
            className: 'Gallery',
            critical: false
        },
        'tiempo': {
            selector: '#tiempo-content',
            importPath: './modules/tiempo.js?v=V1_TIEMPO',
            initFunction: 'inicializarTiempo',
            critical: false
        },
        'ocr': {
            selector: '#ocr-datafonos-content',
            importPath: './modules/ocr_datafonos.js?v=V1_OCR',
            initFunction: 'inicializarOCR',
            critical: false
        }
    };

    /**
     * Carga todos los módulos críticos al arranque
     */
    static async loadCriticalModules() {
        const criticalModules = Object.entries(this.MODULE_REGISTRY)
            .filter(([_, config]) => config.critical);

        console.log(`[ModuleLoader] Cargando ${criticalModules.length} módulos críticos...`);

        for (const [key, config] of criticalModules) {
            try {
                await this.loadModule(key);
            } catch (e) {
                console.error(`[ModuleLoader] Error cargando módulo crítico '${key}':`, e);
            }
        }

        console.log('[ModuleLoader] Módulos críticos cargados.');
    }

    /**
     * Carga un módulo bajo demanda
     * @param {string} moduleKey - Clave del módulo en MODULE_REGISTRY
     * @returns {Promise<boolean>} - true si se cargó correctamente
     */
    static async loadModule(moduleKey) {
        // Si ya está cargado, no hacer nada
        if (this._loadedModules.has(moduleKey)) {
            return true;
        }

        // Si ya está cargándose, esperar a que termine
        if (this._pendingLoads.has(moduleKey)) {
            return await this._pendingLoads.get(moduleKey);
        }

        const config = this.MODULE_REGISTRY[moduleKey];
        if (!config) {
            console.warn(`[ModuleLoader] Módulo '${moduleKey}' no encontrado en registry.`);
            return false;
        }

        console.log(`[ModuleLoader] Cargando módulo '${moduleKey}'...`);

        const loadPromise = (async () => {
            try {
                const module = await import(config.importPath);

                // Inicializar el módulo
                if (config.className) {
                    // Módulo de clase (Gallery, Excursiones, etc.)
                    const ModuleClass = module[config.className];
                    if (ModuleClass && typeof ModuleClass[config.initFunction] === 'function') {
                        ModuleClass[config.initFunction]();
                    }
                } else {
                    // Módulo de función (mayoría)
                    const initFn = module[config.initFunction];
                    if (typeof initFn === 'function') {
                        initFn();
                    }
                }

                this._loadedModules.add(moduleKey);
                console.log(`[ModuleLoader] ✓ Módulo '${moduleKey}' cargado.`);
                return true;
            } catch (error) {
                console.error(`[ModuleLoader] ✗ Error cargando '${moduleKey}':`, error);
                return false;
            } finally {
                this._pendingLoads.delete(moduleKey);
            }
        })();

        this._pendingLoads.set(moduleKey, loadPromise);
        return await loadPromise;
    }

    /**
     * Carga un módulo por su selector (#agenda-content)
     * @param {string} selector - Selector CSS del panel
     */
    static async loadBySelector(selector) {
        const moduleKey = Object.entries(this.MODULE_REGISTRY)
            .find(([_, config]) => config.selector === selector)?.[0];

        if (!moduleKey) {
            console.warn(`[ModuleLoader] No se encontró módulo para selector '${selector}'.`);
            return false;
        }

        return await this.loadModule(moduleKey);
    }

    /**
     * Verifica si un módulo ya está cargado
     * @param {string} moduleKey - Clave del módulo
     */
    static isLoaded(moduleKey) {
        return this._loadedModules.has(moduleKey);
    }

    /**
     * Obtiene estadísticas de carga
     */
    static getStats() {
        const total = Object.keys(this.MODULE_REGISTRY).length;
        const loaded = this._loadedModules.size;
        const pending = this._pendingLoads.size;

        return { total, loaded, pending };
    }
}

// Exponer globalmente para debug
window.ModuleLoader = ModuleLoader;
