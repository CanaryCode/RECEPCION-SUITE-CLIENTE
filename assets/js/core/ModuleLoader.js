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
            importPath: 'assets/js/modules/despertadores.js',
            initFunction: 'inicializarDespertadores',
            critical: true
        },
        'novedades': {
            selector: '#novedades-content',
            importPath: 'assets/js/modules/novedades.js',
            initFunction: 'inicializarNovedades',
            critical: true
        },
        'cena-fria': {
            selector: '#cena-fria-content',
            importPath: 'assets/js/modules/cena_fria.js',
            initFunction: 'inicializarCenaFria',
            critical: true
        },
        'desayuno': {
            selector: '#desayuno-content',
            importPath: 'assets/js/modules/desayuno.js',
            initFunction: 'inicializarDesayuno',
            critical: true
        },
        'transfers': {
            selector: '#transfers-content',
            importPath: 'assets/js/modules/transfers.js',
            initFunction: 'inicializarTransfers',
            critical: true
        },
        'alarms': {
            selector: '#system-alarms-content',
            importPath: 'assets/js/modules/alarms.js',
            initFunction: 'inicializarSystemAlarms',
            critical: true
        },
        'alarms-ui': {
            selector: '#system-alarms-content',
            importPath: 'assets/js/modules/system_alarms_ui.js',
            initFunction: 'inicializarSystemAlarmsUI',
            critical: true
        },
        'tareas': {
            selector: '#tareas-content',
            importPath: 'assets/js/modules/tareas.js',
            initFunction: 'inicializarTareas',
            critical: true
        },
        'configuracion': {
            selector: '#configuracion-content',
            importPath: 'assets/js/modules/configuracion.js',
            initFunction: 'inicializarConfiguracion',
            critical: false  // Cambiado a lazy loading - se carga cuando se navega
        },
        'idle': {
            selector: null,
            importPath: 'assets/js/modules/idle.js',
            initFunction: 'inicializarIdle',
            critical: true
        },

        // MÓDULOS LAZY (se cargan bajo demanda)
        'agenda': {
            selector: '#agenda-content',
            importPath: 'assets/js/modules/agenda.js',
            initFunction: 'inicializarAgenda',
            critical: false
        },
        'caja': {
            selector: '#caja-content',
            importPath: 'assets/js/modules/caja.js',
            initFunction: 'inicializarCaja',
            critical: false
        },
        'cobro': {
            selector: '#cobro-content',
            importPath: 'assets/js/modules/cobro.js',
            initFunction: 'inicializarCobro',
            critical: false
        },
        'safe': {
            selector: '#safe-content',
            importPath: 'assets/js/modules/safe.js',
            initFunction: 'inicializarSafe',
            critical: false
        },
        'calculadora': {
            selector: '#calculadora-flotante',
            importPath: 'assets/js/modules/calculadora.js',
            initFunction: 'init',
            critical: false
        },
        'atenciones': {
            selector: '#atenciones-content',
            importPath: 'assets/js/modules/atenciones.js',
            initFunction: 'inicializarAtenciones',
            critical: false
        },
        'impresion': {
            selector: '#impresion-content',
            importPath: 'assets/js/modules/Impresion.js',
            initFunction: 'inicializarImpresion',
            critical: false
        },
        'estancia': {
            selector: '#estancia-content',
            importPath: 'assets/js/modules/estancia.js',
            initFunction: 'inicializarEstancia',
            critical: false
        },
        'riu': {
            selector: '#riu-content',
            importPath: 'assets/js/modules/riu.js',
            initFunction: 'inicializarRiu',
            critical: false
        },
        'ayuda': {
            selector: '#ayuda-content',
            importPath: 'assets/js/modules/ayuda.js',
            initFunction: 'inicializarAyuda',
            critical: false
        },
        'notas-permanentes': {
            selector: '#notas-content',
            importPath: 'assets/js/modules/notas_permanentes.js',
            initFunction: 'inicializarNotasPermanentes',
            critical: false
        },
        'precios': {
            selector: '#precios-content',
            importPath: 'assets/js/modules/precios.js',
            initFunction: 'inicializarPrecios',
            critical: false
        },
        'lost-found': {
            selector: '#lost-found-content',
            importPath: 'assets/js/modules/lost_found.js',
            initFunction: 'inicializarLostFound',
            critical: false
        },
        'rack': {
            selector: '#rack-content',
            importPath: 'assets/js/modules/rack.js',
            initFunction: 'inicializarRack',
            critical: false
        },
        'excursiones': {
            selector: '#excursiones-content',
            importPath: 'assets/js/modules/excursiones.js',
            initFunction: 'init',
            className: 'Excursiones',
            critical: false
        },
        'reservas-instalaciones': {
            selector: '#reservas-instalaciones-content',
            importPath: 'assets/js/modules/reservas_instalaciones.js',
            initFunction: 'init',
            className: 'ReservasInstalaciones',
            critical: false
        },
        'valoracion': {
            selector: '#valoracion-content',
            importPath: 'assets/js/modules/valoracion.js',
            initFunction: 'inicializarValoracion',
            critical: false
        },
        'gallery': {
            selector: '#gallery-content',
            importPath: 'assets/js/modules/gallery.js',
            initFunction: 'inicializar',
            className: 'Gallery',
            critical: false
        },
        'tiempo': {
            selector: '#tiempo-content',
            importPath: 'assets/js/modules/tiempo.js',
            initFunction: 'inicializarTiempo',
            critical: false
        },
        'ocr': {
            selector: '#ocr-datafonos-content',
            importPath: 'assets/js/modules/ocr_datafonos.js',
            initFunction: 'inicializarOCR',
            critical: false
        },
        'calendario': {
            selector: '#calendario-content',
            importPath: 'assets/js/modules/calendario.js',
            initFunction: 'inicializarCalendario',
            critical: false
        },
        'vales': {
            selector: '#vales-content',
            importPath: 'assets/js/modules/vales.js',
            initFunction: 'initVales',
            critical: false
        },
        'aplicaciones': {
            selector: '#aplicaciones-content',
            // El launcher está integrado en main.js por ahora, pero lo registramos para que Router no falle
            // Si en el futuro se mueve a un módulo separado, se pondrá aquí la ruta.
            // Por ahora, usamos un hack inofensivo para marcarlo como "cargado" cuando se pida.
            importPath: 'assets/js/main.js', 
            initFunction: null,
            critical: false
        }
    };

    /**
     * Carga todos los módulos críticos al arranque
     */
    static async loadCriticalModules() {
        // 1. Inicializar configuración local PRIMERO (necesaria para otros módulos)
        try {
            console.log('[ModuleLoader] Inicializando configuración local...');
            const version = APP_CONFIG.SYSTEM.VERSION || Date.now();
            const { localConfigService } = await import(`../services/LocalConfigService.js?v=${version}`);
            await localConfigService.init();
            console.log('[ModuleLoader] ✓ Configuración local inicializada.');
        } catch (e) {
            console.error('[ModuleLoader] Error inicializando configuración local:', e);
        }

        // 2. Cargar módulos críticos
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
                // Caso especial: módulos ya integrados (como aplicaciones en main.js)
                if (!config.importPath || !config.initFunction) {
                    this._loadedModules.add(moduleKey);
                    return true;
                }

                const version = APP_CONFIG.SYSTEM.VERSION || Date.now();
                // Normalización de ruta: Si es abs, quitar / inicial. Si es rel, asegurar ../ si estamos en core? 
                // Mejor usar rutas relativas al root siempre en el registry y resolverlas aquí.
                // Dado que ModuleLoader está en assets/js/core/, para llegar a assets/js/modules usamos ../modules/
                const finalPath = config.importPath.replace('assets/js/', '../');
                const pathWithVersion = finalPath.includes('?') ? `${finalPath}&v=${version}` : `${finalPath}?v=${version}`;
                
                const module = await import(pathWithVersion);

                // Inicializar el módulo
                if (config.className) {
                    // Módulo de clase (Gallery, Excursiones, etc.)
                    const ModuleClass = module[config.className];
                    if (ModuleClass && typeof ModuleClass[config.initFunction] === 'function') {
                        await ModuleClass[config.initFunction]();
                    }
                } else {
                    // Módulo de función (mayoría)
                    const initFn = module[config.initFunction];
                    if (typeof initFn === 'function') {
                        await initFn();
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
        // Ignorar selectores de la UI core que no tienen módulos lazy
        if (selector === '#dashboard-content' || selector === '#inicio') return true;

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
