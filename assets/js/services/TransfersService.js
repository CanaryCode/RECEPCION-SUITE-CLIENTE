import { BaseService } from './BaseService.js';

/**
 * SERVICIO DE TRASLADOS (TransfersService)
 * ---------------------------------------
 * Gestiona la agenda de llegadas y salidas de clientes que requieren transfer.
 */
class TransfersService extends BaseService {
    constructor() {
        super('riu_transfers');
        
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
