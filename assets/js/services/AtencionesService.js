import { BaseService } from './BaseService.js';

/**
 * SERVICIO DE ATENCIONES (AtencionesService)
 * -----------------------------------------
 * Gestiona los detalles especiales que requieren las habitaciones.
 */
class AtencionesService extends BaseService {
    constructor() {
        super('riu_atenciones_v2', {}); // Usamos un objeto { "101": {...}, "102": {...} }
        
        // Esquema para validación de atenciones por habitación
        this.schema = {
            tipos: 'object',
            comentario: 'string',
            autor: 'string'
        };
    }

    /**
     * AÑADIR O ACTUALIZAR ATENCIÓN
     * @param {string} habitacion - Número de la habitación
     * @param {Array} tipos - Lista de tipos (Flores, Vino, etc.)
     * @param {string} comentario - Notas adicionales
     * @param {string} autor - Quién anotó la atención
     */
    /**
     * AÑADIR O ACTUALIZAR ATENCIÓN
     */
    async saveAtencion(habitacion, data) {
        return this.setByKey(habitacion, data);
    }

    /**
     * ELIMINAR ATENCIÓN
     */
    async removeAtencion(habitacion) {
        return this.removeByKey(habitacion);
    }

    /**
     * LIMPIAR TODO
     */
    async clearAll() {
        return this.clear();
    }
    
    // Alias para compatibilidad con la UI si fuera necesario
    getAtenciones() {
        return this.getAll();
    }
}

export const atencionesService = new AtencionesService();
