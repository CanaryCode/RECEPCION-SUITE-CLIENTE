import { BaseService } from './BaseService.js';

/**
 * SERVICIO DE TRASLADOS (TransfersService)
 * ---------------------------------------
 * Gestiona la agenda de llegadas y salidas de clientes que requieren transfer.
 *
 * IMPORTANTE: Este servicio guarda DIRECTAMENTE en la base de datos,
 * NO usa caché local como otros servicios.
 */
class TransfersService extends BaseService {
    constructor() {
        super('riu_transfers');

        // DESACTIVAR sincronización automática (vamos directo a DB)
        this.syncEnabled = false;

        // Esquema para validación de servicios de traslados (taxis/bus)
        this.schema = {
            habitacion: 'any',
            pax: 'number',
            fecha: 'string',
            hora: 'string',
            destino: 'string'
        };
    }

    async init() {
        await this.syncWithServer();
        return this.getAll();
    }

    /**
     * OBTENER TODOS LOS TRASLADOS
     */
    getTransfers() {
        const data = this.getAll();
        const items = data ? (Array.isArray(data) ? data : Object.values(data)) : [];

        return items.sort((a, b) => {
            const dateA = new Date(`${a.fecha}T${a.hora}`);
            const dateB = new Date(`${b.fecha}T${b.hora}`);
            return dateA - dateB;
        });
    }

    /**
     * SOBRESCRIBIR save() para ir DIRECTO a la base de datos
     */
    async save(data) {
        // Validar
        try {
            this.validate(data);
        } catch (err) {
            console.error(`[TransfersService] Error de validación:`, err.message);
            throw err;
        }

        // Actualizar caché local
        this.cache = data;

        // Guardar DIRECTAMENTE en la base de datos (sin pasar por SyncManager)
        try {
            const response = await fetch(`/api/storage/${this.endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Station-Key': sessionStorage.getItem('RS_STATION_KEY') || ''
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log(`[TransfersService] ✓ Guardado en DB: ${Array.isArray(data) ? data.length : 0} transfers`);

            // Disparar evento para que otros componentes se actualicen
            window.dispatchEvent(new CustomEvent('service-synced', {
                detail: { endpoint: this.endpoint }
            }));

            return data;
        } catch (error) {
            console.error(`[TransfersService] ✗ Error guardando en DB:`, error);
            throw error;
        }
    }

    /**
     * GUARDAR O ACTUALIZAR TRASLADO
     */
    async saveTransfer(item) {
        if (!item.transfer_id) item.transfer_id = Date.now();
        return this.update(item.transfer_id, item, 'transfer_id');
    }

    /**
     * ELIMINAR TRASLADO
     */
    async deleteTransfer(id) {
        return this.delete(id, 'transfer_id');
    }
    
    /**
     * LIMPIEZA DE HISTORIAL
     */
    async cleanupOld(daysToKeep = 7) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysToKeep);
        
        const current = this.getTransfers();
        const initialLen = current.length;
        
        const filtered = current.filter(i => {
            const itemDate = new Date(`${i.fecha}T${i.hora}`);
            return itemDate >= cutoff;
        });
        
        if (filtered.length !== initialLen) {
            return this.save(filtered);
        }
    }
}

export const transfersService = new TransfersService();
