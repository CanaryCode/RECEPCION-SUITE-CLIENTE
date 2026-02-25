/**
 * GESTOR DE ALMACENAMIENTO LOCAL (LocalStorage)
 * --------------------------------------------
 * Este módulo es un "envoltorio" (wrapper) seguro para guardar datos en el navegador.
 * Se encarga de convertir automáticamente los objetos en texto (JSON) y viceversa.
 */
export const LocalStorage = {
    /**
     * LEER DATOS
     * @param {string} key - El nombre de la variable guardada.
     * @param {any} defaultValue - Qué devolver si no existe (por defecto null).
     */
    get: (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            
            // SELF-HEALING: Detectar corrupción de datos
            if (item === "[object Object]") {
                console.warn(`LocalStorage: Corrupt data detected for '${key}'. Resetting.`);
                localStorage.removeItem(key);
                return defaultValue;
            }

            // Si el dato existe, lo convertimos de texto a objeto/lista
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error(`Error leyendo '${key}' del almacenamiento local:`, e);
            // Si hay error de sintaxis, borrar para evitar bucle infinito
            try { localStorage.removeItem(key); } catch(ex) {}
            return defaultValue;
        }
    },

    /**
     * GUARDAR DATOS
     * Convierte cualquier objeto o lista en texto para poder guardarlo en el navegador.
     */
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error(`Error guardando '${key}' en el almacenamiento local:`, e);
        }
    },

    /**
     * BORRAR DATOS
     */
    remove: (key) => {
        localStorage.removeItem(key);
    }
};
