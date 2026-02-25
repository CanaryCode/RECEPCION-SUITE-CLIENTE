import { BaseService } from './BaseService.js';

/**
 * SERVICIO DE DESPERTADORES (DespertadorService)
 * --------------------------------------------
 * Gestiona el listado de llamadas de despertador solicitadas por los clientes.
 */
class DespertadorService extends BaseService {
    constructor() {
        super('riu_despertadores');
        
        // Esquema para validación de llamadas de despertador
        this.schema = {
            habitacion: 'any', // Puede ser string o number
            hora: 'string'
            // comentarios: opcional
        };
    }

    /**
     * OBTENER TODOS LOS DESPERTADORES
     */
    getDespertadores() {
        const data = this.getAll();
        
        // MIGRACIÓN: Si los datos vienen como objeto { "101": {...} }, los pasamos a lista.
        if (data && !Array.isArray(data) && typeof data === 'object') {
            const asArray = Object.keys(data).map(hab => ({
                habitacion: hab,
                ...data[hab]
            }));
            this.save(asArray);
            return asArray;
        }
        return data || [];
    }

    /**
     * GUARDAR O ACTUALIZAR DESPERTADOR
     */
    async saveDespertador(item) {
        return this.update(item.habitacion, item, 'habitacion');
    }

    /**
     * ELIMINAR DESPERTADOR
     */
    async removeDespertador(habNum) {
        return this.delete(habNum, 'habitacion');
    }

    /**
     * BUSCAR POR HABITACIÓN
     */
    getByHab(habNum) {
        const all = this.getDespertadores();
        return all.find(x => x.habitacion == habNum);
    }
}

export const despertadorService = new DespertadorService();
