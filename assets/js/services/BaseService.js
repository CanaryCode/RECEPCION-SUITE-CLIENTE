import { APP_CONFIG } from '../core/Config.js';
import { Api } from '../core/Api.js';
import { realTimeSync } from '../core/RealTimeSync.js';
import { LocalStorage } from '../core/LocalStorage.js';
import { Utils } from '../core/Utils.js';

/**
 * CLASE BASE DE SERVICIOS (BaseService)
 * ------------------------------------
 * CLASE BASE DE SERVICIO (BaseService)
 * -----------------------------------
 * Proporciona métodos estandarizados para la persistencia de datos (LocalStorage + Servidor),
 * operaciones CRUD y validación de esquemas.
 */
export class BaseService {
    /**
     * @param {string} endpoint - Nombre de la clave/archivo de almacenamiento
     * @param {any} defaultValue - Valor por defecto si no existen datos
     */
    constructor(endpoint, defaultValue = [], syncEnabled = true) {
        this.endpoint = endpoint;
        this.defaultValue = defaultValue;
        this.syncEnabled = syncEnabled;
        /** @type {any | null} */
        this.cache = null;
        /** @type {boolean} */
        this._initialized = false;
        /** @type {Object<string, string> | null} */
        // Opcional: Definido en clases hijas
        this.schema = null; 

        // Cache depends on hotel
        this.getStorageKey = () => {
            const hotelId = localStorage.getItem('current_hotel_id') || '1';
            return `${this.endpoint}_h${hotelId}`;
        };

        // Registrar para refresco automático si la sincronización está activa
        if (this.syncEnabled) {
            realTimeSync.registerService(this.endpoint, this);
        }
    }

    /**
     * VALIDACIÓN DE DATOS
     * Valida los datos contra el esquema definido en `this.schema`.
     * @param {any} data - Los datos a validar. Puede ser un objeto o un array de objetos.
     * @returns {boolean} - `true` si los datos son válidos.
     * @throws {Error} - Lanza un error descriptivo si la validación falla.
     */
    validate(data) {
        if (!this.schema) return true;

        let items = [];
        if (Array.isArray(this.defaultValue)) {
            // Si es un array, validamos cada elemento
            items = Array.isArray(data) ? data : [data];
        } else {
            // Check if Singleton (all schema keys present in default value)
            // e.g. CajaService has defaults for all schema keys.
            // Map services (Desayuno) usually have empty default {}.
            const isSingleton = this.schema && Object.keys(this.schema).every(k => k in this.defaultValue);

            if (isSingleton) {
                items = [data];
            } else {
                // Si es un objeto (Map), validamos los valores
                // (Asumimos que data es el contenedor completo { key: item })
                items = data ? Object.values(data) : [];
            }
        }

        for (const item of items) {
            for (const [key, type] of Object.entries(this.schema)) {
                if (!(key in item)) {
                    // Si el campo es opcional en la práctica pero el esquema lo exige,
                    // aquí es donde fallaba.
                    // Permitimos undefined si el tipo es 'any' o si decidimos relajarlo.
                    // Pero la regla de negocio dice "Obligatorio".
                    throw new Error(`Campo requerido faltante: ${key}`);
                }
                const actualType = typeof item[key];
                if (type === 'number') {
                    // Validación numérica estricta para strings numéricos
                    if (typeof item[key] === 'string' && item[key].trim() !== '' && !isNaN(Number(item[key]))) {
                        // Es un número válido en string
                    } else if (typeof item[key] !== 'number' || isNaN(item[key])) {
                        throw new Error(`El campo '${key}' debe ser un número válido.`);
                    }
                } else if (type === 'date') {
                    // ESTANDARIZACIÓN GENÉRICA DE FECHAS (Síncrona)
                    const parsed = Utils.parseDate(item[key]);
                    if (parsed) {
                        item[key] = parsed;
                    } else if (item[key] !== null && item[key] !== undefined && item[key] !== '') {
                        console.warn(`[BaseService] No se pudo estandarizar fecha para '${key}':`, item[key]);
                    }
                } else if (type === 'boolean') {
                    // Soporte para 0/1 de la base de datos MariaDB
                    if (typeof item[key] === 'number') {
                        item[key] = item[key] === 1;
                    } else if (typeof item[key] === 'string') {
                        const val = item[key].toLowerCase();
                        if (val === '1' || val === 'true') item[key] = true;
                        else if (val === '0' || val === 'false') item[key] = false;
                    }
                    
                    if (typeof item[key] !== 'boolean') {
                        throw new Error(`El campo '${key}' debe ser booleano (recibido ${typeof item[key]})`);
                    }
                } else if (item[key] === null) {
                    // Permitir nulls (común cuando la DB no tiene valor)
                    continue;
                } else if (actualType !== type && type !== 'any') {
                    throw new Error(`Tipo de dato inválido para '${key}': esperado ${type}, recibido ${actualType}`);
                }
            }
        }
        return true;
    }

    /**
     * INICIALIZAR SERVICIO
     * Carga los datos desde LocalStorage y activa la sincronización con el servidor.
     * @returns {Promise<boolean>} - Resuelve a `true` una vez inicializado.
     */
    async init() {
        if (this._initialized) return this.getAll();

        // Cargar desde LocalStorage (Caché Rápida) aislada por hotel
        const localData = LocalStorage.get(this.getStorageKey());
        if (localData) {
            this.cache = localData;
        } else {
            this.cache = this.defaultValue;
        }

        // Intentar sincronizar con el servidor (CON TIMEOUT DE SEGURIDAD 2s)
        // Si el servidor tarda más de 2s, seguimos con lo que hay en caché para no congelar la UI.
        try {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Sync Timeout")), 2000));
            await Promise.race([this.syncWithServer(), timeout]);
        } catch (e) {
            console.warn(`[BaseService] ${this.endpoint} inició con datos locales (Sync: ${e.message})`);
        }

        this._initialized = true;
        return this.getAll();
    }

    /**
     * RECARGAR DATOS FORZOSAMENTE
     * Ignora la caché y vuelve a leer del almacenamiento/servidor.
     * @returns {Promise<any>}
     */
    async reload() {
        this._initialized = false;
        this.cache = null;
        return this.init();
    }

    /**
     * OBTENER TODOS LOS DATOS
     * Retorna los datos actualmente en caché. Si la caché está vacía, los carga desde
     * LocalStorage y activa una sincronización con el servidor.
     * @returns {any} - Los datos almacenados.
     */
    getAll() {
        if (!this.cache) {
            this.cache = LocalStorage.get(this.getStorageKey(), this.defaultValue);
            this.syncWithServer();
        }
        return this.cache;
    }

    /**
     * GUARDAR LISTA COMPLETA
     */
    save(data) {
        // ENFORCE ARRAY: Si el servicio es de tipo lista, forzamos que sea un array plano
        if (Array.isArray(this.defaultValue)) {
            data = this._ensureArray(data);
        }

        // Validar antes de guardar
        try {
            this.validate(data);
        } catch (err) {
            console.error(`[BaseService] Error de validación en '${this.endpoint}':`, err.message);
            if (window.showAlert) window.showAlert(`Error de datos: ${err.message}`, "error");
            throw err;
        }

        this.cache = data;
        LocalStorage.set(this.getStorageKey(), data);

        // Push a la cola de sincronización (SyncManager)
        if (this.syncEnabled) {
            import('../core/SyncManager.js').then(({ syncManager }) => {
                syncManager.push(this.endpoint, data);
            });
        }

        return data;
    }

    /**
     * AYUDANTE DE RESILIENCIA: Asegura que los datos sean un array de objetos plano.
     * @private
     */
    _ensureArray(data) {
        if (Array.isArray(data)) return data;

        if (data && typeof data === 'object') {
            // Si el objeto tiene campos que parecen de esquema (ej: habitacion, texto...), es un solo item.
            const isSingleItem = this.schema && Object.keys(this.schema).some(k => k in data);
            if (isSingleItem) {
                return [data];
            }
            // Si no, asumimos que es un diccionario { id: item } y extraemos los valores
            return Object.values(data);
        }

        return [];
    }

    /**
     * OPERACIONES CRUD SEMÁNTICAS (Para Arrays)
     */

    /**
     * Añadir un nuevo elemento (asumiendo que es un Array)
     */
    async add(item) {
        const all = await this.init();
        const array = this._ensureArray(all);
        return this.save([...array, item]);
    }

    /**
     * Actualiza un elemento existente
     */
    async update(id, data, idField = 'id') {
        const all = await this.init();
        const array = this._ensureArray(all);

        const index = array.findIndex(x => x[idField] == id);
        if (index === -1) return this.add(data);

        const newAll = [...array];
        newAll[index] = { ...newAll[index], ...data };
        return this.save(newAll);
    }

    /**
     * Elimina un elemento
     */
    async delete(id, idField = 'id') {
        const all = await this.init();
        const array = this._ensureArray(all);

        const newAll = array.filter(x => x[idField] != id);
        return this.save(newAll);
    }

    /**
     * OPERACIONES POR CLAVE (Para Diccionarios/Objetos)
     */

    getByKey(key, idField = 'id') {
        const all = this.getAll();
        if (Array.isArray(all)) {
            return all.find(x => x[idField] == key);
        }
        return (all && typeof all === 'object') ? all[key] : null;
    }

    /**
     * ALIAS PARA getByKey
     */
    getById(id, idField = 'id') {
        return this.getByKey(id, idField);
    }

    /**
     * Guarda o actualiza un elemento por su clave/ID.
     * Soporta tanto estructuras de objeto { key: value } como arrays [ { id: key, ... } ]
     */
    async setByKey(key, value, idField = 'id') {
        const all = this.getAll();
        if (Array.isArray(all)) {
            return this.update(key, value, idField);
        } else {
            const newAll = (all && typeof all === 'object') ? { ...all } : {};
            newAll[key] = value;
            return this.save(newAll);
        }
    }

    /**
     * Elimina un elemento por su clave/ID.
     * Soporta tanto estructuras de objeto { key: value } como arrays [ { id: key, ... } ]
     */
    async removeByKey(key, idField = 'id') {
        const all = this.getAll();
        if (Array.isArray(all)) {
            return this.delete(key, idField);
        } else if (all && typeof all === 'object') {
            const newAll = { ...all };
            delete newAll[key];
            return this.save(newAll);
        }
        return all;
    }

    /**
     * UTILIDADES
     */

    clear() {
        this.cache = Array.isArray(this.defaultValue) ? [] : {};
        LocalStorage.remove(this.getStorageKey());
        return this.save(this.cache); // Sincroniza el borrado al servidor
    }

    async syncWithServer() {
        if (!this.syncEnabled || !APP_CONFIG.SYSTEM.USE_SYNC_SERVER) return;
        try {
            const { syncManager } = await import('../core/SyncManager.js');

            // CRITICO: No descargar si tenemos cambios locales pendientes de subir
            // para evitar sobrescribir con datos antiguos del servidor (Race Condition)
            if (syncManager.hasPending(this.endpoint)) {
                // console.debug(`[BaseService] Saltando pull para '${this.endpoint}' (Cambios pendientes)`);
                return;
            }

            const remoteData = await syncManager.pull(this.endpoint);

            if (remoteData) {
                // Validación rápida: Solo actualizar si hay cambios reales
                const remoteStr = JSON.stringify(remoteData);
                const localStr = JSON.stringify(this.cache);

                if (localStr !== remoteStr) {
                    console.log(`[BaseService] ${this.endpoint} actualizado desde servidor`);
                    this.cache = remoteData;
                    LocalStorage.set(this.getStorageKey(), remoteData);
                    // Emitir evento global por si el UI necesita refrescarse
                    window.dispatchEvent(new CustomEvent('service-synced', { detail: { endpoint: this.endpoint } }));
                }
            }
        } catch (err) {
            console.warn(`[BaseService] No se pudo sincronizar '${this.endpoint}'`, err);
        }
    }
}
