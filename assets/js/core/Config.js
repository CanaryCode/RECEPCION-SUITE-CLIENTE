/**
 * OBJETO GLOBAL DE CONFIGURACIÓN
 * Contiene todos los ajustes del sistema. Se exporta para que cualquier módulo pueda leer los ajustes.
 */
export const APP_CONFIG = {
    SYSTEM: { API_URL: '/api', MODE: 'local', VERSION: '1.0.10' },
    HOTEL: {
        RECEPCIONISTAS: [],
        HABITACIONES: [], // Default empty, populated via loadConfig or override
        SPOTIFY_PLAYLISTS: [],
        STATS_CONFIG: { RANGOS: [] }
    },
    AGENDA: { PAISES: [] },
    NOVEDADES: { DEPARTAMENTOS: [] },
    CAJA: { BILLETES: [], MONEDAS: [] },
    COBRO: {
        VALORES: [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10, 0.05, 0.02, 0.01]
    },
    SAFE: { RANGOS: [] },
    TRANSFERS: { DESTINOS: [] }
};

export const Config = {
    /**
     * CARGA DE CONFIGURACIÓN
     * Intenta obtener el archivo config.json desde la API del servidor.
     * También gestiona las "sobrescrituras" locales (LocalStorage) si existen.
     */
    loadConfig: async () => {
        try {
            console.log("Config.loadConfig: Iniciando carga de configuración...");

            let data = null;

            // INTENTO 1: Base de Datos / API (PRIORIDAD: La nueva fuente de verdad)
            try {
                console.log("Attempting to load config from Database/API...");
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout de API")), 5000));
                const response = await Promise.race([
                    fetch('/api/storage/config?v=' + Date.now()),
                    timeout
                ]);
                if (response.ok) {
                    data = await response.json();
                    console.log("Config loaded via API/DB. Keys:", Object.keys(data));
                } else {
                    console.warn("API config fetch failed:", response.status);
                }
            } catch (e) {
                console.warn("API config fetch error:", e);
            }

            // INTENTO 2: Archivo Estático (Fallback si falla la base de datos)
            if (!data) {
                try {
                    console.log("API load failed, trying static storage/config.json directly...");
                    const response = await fetch('storage/config.json?v=' + Date.now());
                    if (response.ok) {
                        data = await response.json();
                        console.log("Config loaded via static file fallback. Keys:", Object.keys(data));
                    } else {
                        console.warn("Static config fetch failed.", response.status);
                    }
                } catch (e) {
                    console.warn("Static config fetch error:", e);
                }
            }

            if (!data) throw new Error("No se pudo cargar la configuración de ninguna fuente.");

            // Actualizamos la variable global SIN SOBRESCRIBIR LA REFERENCIA (evita nulos)
            Object.assign(APP_CONFIG, data || {});

            // Estructuras base
            if (!APP_CONFIG.HOTEL) APP_CONFIG.HOTEL = {};
            if (!APP_CONFIG.SYSTEM) APP_CONFIG.SYSTEM = { API_URL: '/api', MODE: 'local' };

            // CONFIGURACIÓN DE API SEGÚN MODO
            if (APP_CONFIG.SYSTEM) {
                // Si el modo es local, forzamos /api (relativo)
                if (APP_CONFIG.SYSTEM.MODE === 'local' || !APP_CONFIG.SYSTEM.API_URL) {
                    APP_CONFIG.SYSTEM.API_URL = '/api';
                }

                // Sanitizar path si existe
                const apiUrl = APP_CONFIG.SYSTEM.API_URL;
                if (apiUrl && apiUrl.endsWith('/')) {
                    APP_CONFIG.SYSTEM.API_URL = apiUrl.slice(0, -1);
                }

                // Sanitizar paths de galería si existen
                if (APP_CONFIG.SYSTEM.GALLERY_PATH) {
                    APP_CONFIG.SYSTEM.GALLERY_PATH = APP_CONFIG.SYSTEM.GALLERY_PATH.replace(/\\/g, '/');
                }
            } else {
                // Si la config no tiene bloque SYSTEM, algo anda mal, usamos defaults
                APP_CONFIG.SYSTEM = { API_URL: '/api' };
                console.warn("Configuración cargada incompleta o corrupta, usando defaults.");
            }

            // Asegurar que las secciones críticas existen tras el merge
            const seccionesCriticas = ['SYSTEM', 'HOTEL', 'AGENDA', 'NOVEDADES', 'CAJA', 'COBRO', 'SAFE', 'TRANSFERS'];
            seccionesCriticas.forEach(sec => {
                if (!APP_CONFIG[sec]) APP_CONFIG[sec] = {};
            });

            // Asegurar sub-estructuras vitales tras el merge
            if (!APP_CONFIG.HOTEL.STATS_CONFIG) APP_CONFIG.HOTEL.STATS_CONFIG = { RANGOS: [], FILTROS: {} };
            if (!APP_CONFIG.HOTEL.STATS_CONFIG.FILTROS) APP_CONFIG.HOTEL.STATS_CONFIG.FILTROS = { TIPOS: [], VISTAS: [], CARACTERISTICAS: [] };
            if (!APP_CONFIG.HOTEL.TO_LISTS) APP_CONFIG.HOTEL.TO_LISTS = { ES: [], DE: [], FR: [], UK: [] };
            if (!APP_CONFIG.HOTEL.SPOTIFY_PLAYLISTS) APP_CONFIG.HOTEL.SPOTIFY_PLAYLISTS = [];
            if (!APP_CONFIG.HOTEL.RECEPCIONISTAS) APP_CONFIG.HOTEL.RECEPCIONISTAS = [];
            if (!APP_CONFIG.SYSTEM.LAUNCHERS) APP_CONFIG.SYSTEM.LAUNCHERS = [];
            if (!APP_CONFIG.HOTEL.COCKTAIL_LUGARES) APP_CONFIG.HOTEL.COCKTAIL_LUGARES = [];

            if (!APP_CONFIG.HOTEL.RECEPCIONISTAS) APP_CONFIG.HOTEL.RECEPCIONISTAS = [];
            if (!APP_CONFIG.SYSTEM.LAUNCHERS) APP_CONFIG.SYSTEM.LAUNCHERS = [];
            if (!APP_CONFIG.HOTEL.COCKTAIL_LUGARES) APP_CONFIG.HOTEL.COCKTAIL_LUGARES = [];

            // FIX: Asegurar valores de Cobro si vienen vacíos
            if (!APP_CONFIG.COBRO.VALORES || APP_CONFIG.COBRO.VALORES.length === 0) {
                APP_CONFIG.COBRO.VALORES = [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10, 0.05, 0.02, 0.01];
            }

            // Verificamos si hay "sobrescrituras" en el navegador
            try {
                // DEBUG: Force clear to ensure we load from file
                // console.log("DEBUG: Clearing app_config_override to ensure file load.");
                // localStorage.removeItem('app_config_override');

                const localOverride = localStorage.getItem('app_config_override');
                if (localOverride) {
                    console.log("Found local override (length):", localOverride.length);
                    // Sanitización PRE-PARSE: Escapar backslashes si vienen sin escapar (común en copiado manual)
                    let safeOverride = localOverride;
                    if (safeOverride.includes('\\') && !safeOverride.includes('\\\\')) {
                        safeOverride = safeOverride.replace(/\\/g, '/');
                    }

                    const localConfig = JSON.parse(safeOverride);

                    // SEGURIDAD: Si el override es muy viejo o parcial (le faltan secciones), lo ignoramos/limpiamos
                    if (localConfig && (!localConfig.NOVEDADES || !localConfig.AGENDA || !localConfig.SYSTEM?.LAUNCHERS)) {
                        console.warn("Se detectó un override de configuración antiguo o incompleto. Limpiando para recuperar datos del servidor.");
                        localStorage.removeItem('app_config_override');
                    } else {
                        // DEBUG: Log what we are overriding
                        console.log("Applying local override. HOTEL keys:", Object.keys(localConfig.HOTEL || {}));
                        Object.assign(APP_CONFIG, localConfig);
                        console.log("Configuración local (LocalStorage) aplicada con éxito.");
                    }
                } else {
                    console.log("No local override found. Using config.json data.");
                }
            } catch (e) {
                console.warn("Error cargando sobrescritura de configuración local:", e);
                // Limpiar si está corrupto para evitar bucles de error
                localStorage.removeItem('app_config_override');
            }

            // POST-MERGE: Asegurar que los campos del Cocktail existen aunque el override sea viejo
            if (!APP_CONFIG.HOTEL) APP_CONFIG.HOTEL = {};
            if (!APP_CONFIG.HOTEL.COCKTAIL_LUGARES || APP_CONFIG.HOTEL.COCKTAIL_LUGARES.length === 0) {
                APP_CONFIG.HOTEL.COCKTAIL_LUGARES = [
                    { es: 'Terraza del restaurante', en: 'Restaurant Terrace', de: 'Restaurantterrasse', fr: 'Terrasse du restaurant', default: true },
                    { es: 'Salón la paz', en: 'Paz Lounge', de: 'Paz Lounge', fr: 'Salon la paix', default: false },
                    { es: 'Jardín del restaurante', en: 'Restaurant Garden', de: 'Restaurantgarten', fr: 'Jardin du restaurant', default: false },
                    { es: 'Piscina', en: 'Pool area', de: 'Poolbereich', fr: 'Piscine', default: false }
                ];
            }

            // FIX: Asegurar Habitaciones si vienen vacías
            if (!APP_CONFIG.HOTEL.HABITACIONES || APP_CONFIG.HOTEL.HABITACIONES.length === 0) {
                // Generar habitaciones básicas (101-110, 201-210...)
                const rooms = [];
                const floors = [1, 2, 3];
                floors.forEach(f => {
                    for (let i = 1; i <= 10; i++) {
                        const num = f * 100 + i;
                        rooms.push({ numero: `${num}`, tipo: 'Estándar', estado: 'Limpia', vista: 'Jardín' });
                    }
                });
                APP_CONFIG.HOTEL.HABITACIONES = rooms;
            }

            // FIX: Asegurar Rangos para RackView
            if (!APP_CONFIG.HOTEL.STATS_CONFIG.RANGOS || APP_CONFIG.HOTEL.STATS_CONFIG.RANGOS.length === 0) {
                APP_CONFIG.HOTEL.STATS_CONFIG.RANGOS = [
                    { planta: 1, min: 101, max: 110 },
                    { planta: 2, min: 201, max: 210 },
                    { planta: 3, min: 301, max: 310 }
                ];
            }

            if (!APP_CONFIG.HOTEL.COCKTAIL_CONFIG) {
                APP_CONFIG.HOTEL.COCKTAIL_CONFIG = { DIA: 5, HORA: "19:00" };
            } else {
                if (APP_CONFIG.HOTEL.COCKTAIL_CONFIG.DIA === undefined) APP_CONFIG.HOTEL.COCKTAIL_CONFIG.DIA = 5;
                if (!APP_CONFIG.HOTEL.COCKTAIL_CONFIG.HORA) APP_CONFIG.HOTEL.COCKTAIL_CONFIG.HORA = "19:00";
            }

            // Migración: Si existe SPOTIFY_URL (antiguo) but no SPOTIFY_PLAYLISTS (nuevo), convertimos
            if (APP_CONFIG.HOTEL && APP_CONFIG.HOTEL.SPOTIFY_URL && (!APP_CONFIG.HOTEL.SPOTIFY_PLAYLISTS || APP_CONFIG.HOTEL.SPOTIFY_PLAYLISTS.length === 0)) {
                APP_CONFIG.HOTEL.SPOTIFY_PLAYLISTS = [{
                    label: "Playlist Principal",
                    url: APP_CONFIG.HOTEL.SPOTIFY_URL
                }];
                // Limpiamos el antiguo para evitar confusiones
                delete APP_CONFIG.HOTEL.SPOTIFY_URL;
            }

            // --- CARGA DE CONFIGURACIÓN LOCAL (AGENTE) ---
            // Intentar HTTP primero (PCs sin SSL), luego HTTPS (servidores con SSL)
            const agentUrls = [
                'http://localhost:3001/api/system/local-config',
                'https://localhost:3001/api/system/local-config'
            ];

            for (const url of agentUrls) {
                try {
                    console.log(`Attempting to load local config from ${url}...`);
                    const localRes = await fetch(url, {
                        headers: {
                            'X-Station-Key': sessionStorage.getItem('RS_STATION_KEY') || ''
                        }
                    });
                    if (localRes.ok) {
                        const localData = await localRes.json();
                        if (localData && Object.keys(localData).length > 0) {
                            console.log(`✓ Config loaded from ${url}. Applied overrides:`, Object.keys(localData));
                            if (!APP_CONFIG.SYSTEM) APP_CONFIG.SYSTEM = {};
                            if (localData.LAUNCHERS !== undefined) APP_CONFIG.SYSTEM.LAUNCHERS = localData.LAUNCHERS;
                            if (localData.GALLERY_FOLDERS !== undefined) APP_CONFIG.SYSTEM.GALLERY_FOLDERS = localData.GALLERY_FOLDERS;
                            if (localData.GALLERY_PATH !== undefined) APP_CONFIG.SYSTEM.GALLERY_PATH = localData.GALLERY_PATH;
                            break; // Éxito, salir del loop
                        }
                    }
                } catch (e) {
                    console.warn(`Could not fetch from ${url}:`, e.message);
                }
            }

            return true;
        } catch (error) {
            console.error("Crítico: No se pudo cargar config.json", error);
            // Mostrar mensaje real del error para depuración
            // alert(`Error cargando config.json: ${error.message}`);
            return false;
        }
    },

    /**
     * ACTUALIZAR EN MEMORIA
     * Permite cambiar la configuración actual sin recargar la página (uso interno).
     */
    updateMemory: (newConfig) => {
        // Al ser APP_CONFIG una constante, no podemos reasignarla.
        // Usamos Object.assign para actualizar sus propiedades.
        Object.assign(APP_CONFIG, newConfig);
    }
};
