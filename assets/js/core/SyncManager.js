import { APP_CONFIG } from './Config.js?v=V145_VAL_FIX';
import { LocalStorage } from './LocalStorage.js?v=V145_VAL_FIX';
import { Api } from './Api.js?v=V145_VAL_FIX';

/**
 * GESTOR DE SINCRONIZACIÓN (SyncManager)
 * -------------------------------------
 * Este módulo se encarga de que los datos guardados en el navegador se suban
 * automáticamente al servidor cuando hay internet. Si falla la conexión, 
 * guarda los cambios en una "cola" y reintenta más tarde.
 */
class SyncManager {
    constructor() {
        this.queueKey = 'sync_queue'; // Clave para guardar la cola de pendientes en el navegador
        this.queue = LocalStorage.get(this.queueKey, []);
        this.isSyncing = false; // Bandera para evitar que se pisen dos procesos de subida
        this.intervalId = null;

        // Si el sistema está configurado para usar servidor, activamos el auto-guardado
        if (APP_CONFIG.SYSTEM.USE_SYNC_SERVER) {
            this.startAutoSync();
        }
    }

    /**
     * ¿Tiene cambios pendientes de subir?
     */
    hasPending(key) {
        return this.queue.some(item => item.key === key);
    }

    /**
     * ENVIAR CAMBIOS
     * @param {string} key - El nombre del archivo (ej: 'agenda_contactos')
     * @param {any} data - Los datos completos que queremos guardar
     */
    async push(key, data) {
        // 1. Añadimos el cambio a la cola de pendientes
        const timestamp = new Date().toISOString();
        const existingIndex = this.queue.findIndex(item => item.key === key);
        
        const queueItem = {
            key,
            data,
            timestamp,
            status: 'pending'
        };

        // Si ya había un cambio pendiente para este archivo, lo actualizamos por el nuevo
        if (existingIndex >= 0) {
            this.queue[existingIndex] = queueItem;
        } else {
            this.queue.push(queueItem);
        }

        this.saveQueue(); // Guardamos la cola en LocalStorage por si se cierra la pestaña
        
        // 2. Intentamos subirlo inmediatamente
        this.processQueue();
    }

    /**
     * DESCARGAR CAMBIOS
     * Pide al servidor la última versión de un archivo.
     */
    async pull(key) {
        if (!APP_CONFIG.SYSTEM.USE_SYNC_SERVER) return null;

        try {
            const remoteData = await Api.get(`storage/${key}`);
            if (!remoteData) return null;
            return remoteData;
        } catch (error) {
            console.warn(`[Sync] No se pudo descargar '${key}':`, error);
            return null;
        }
    }

    // Guarda el estado actual de la cola de pendientes
    saveQueue() {
        LocalStorage.set(this.queueKey, this.queue);
    }

    /**
     * INICIAR AUTO-SINCRONIZACIÓN
     * Comprueba cada X segundos si hay algo pendiente de subir.
     */
    startAutoSync() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = setInterval(() => this.processQueue(), APP_CONFIG.SYSTEM.SYNC_INTERVAL);
        
        // También intentamos sincronizar en cuanto el navegador detecte que vuelve internet
        window.addEventListener('online', () => this.processQueue());
    }

    /**
     * PROCESAR COLA
     * Recorre todos los archivos pendientes y los intenta subir uno a uno.
     */
    async processQueue() {
        if (this.isSyncing || this.queue.length === 0) return;
        if (!navigator.onLine) return; // Si no hay internet, ni lo intentamos

        this.isSyncing = true;
        
        // Limpiar de la cola cualquier archivo viejo que ahora sea solo local
        const localKeys = ['riu_system_alarms', 'config'];
        this.queue = this.queue.filter(q => !localKeys.includes(q.key));
        
        const queueCopy = [...this.queue]; // Trabajamos sobre una copia por seguridad

        for (const item of queueCopy) {
            try {
                // Intentamos la subida a través de la API
                await Api.post(`storage/${item.key}`, item.data);
                
                // Si tiene éxito, lo borramos de la cola definitiva
                this.queue = this.queue.filter(q => q.key !== item.key);
                this.saveQueue();
            } catch (error) {
                console.error(`[Sync] Error al subir ${item.key}. Se reintentará luego.`, error);
            }
        }

        this.isSyncing = false;
        
        // Si han llegado nuevos cambios mientras estábamos subiendo, volvemos a ejecutar en 2 segundos
        if (this.queue.length > 0) {
            setTimeout(() => this.processQueue(), 2000); 
        }
    }
}

// Exportamos una única instancia para toda la aplicación
export const syncManager = new SyncManager();
