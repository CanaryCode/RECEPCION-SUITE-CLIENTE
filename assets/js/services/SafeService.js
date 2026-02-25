import { BaseService } from './BaseService.js';

/**
 * SERVICIO DE CAJAS FUERTES (SafeService)
 * --------------------------------------
 * Gestiona el alquiler de las cajas de seguridad de las habitaciones.
 */
class SafeService extends BaseService {
    constructor() {
        super('riu_safe_rentals');
        
        // Esquema para validación de alquileres de cajas fuertes
        this.schema = {
            habitacion: 'any',
            fechaInicio: 'string'
        };
    }

    /**
     * OBTENER ALQUILERES ACTIVOS
     */
    getRentals() {
        const data = this.getAll();
        
        // MIGRACIÓN: Antiguamente se guardaba como un objeto { "Hab": {...} }.
        if (data && !Array.isArray(data) && typeof data === 'object') {
            const asArray = Object.keys(data).map(hab => ({
                habitacion: hab,
                ...data[hab]
            }));
            this.save(asArray);
            return asArray;
        }
        return data;
    }

    async saveRental(item) {
        return this.update(item.habitacion, item, 'habitacion');
    }

    async removeRental(habNum) {
        return this.delete(habNum, 'habitacion');
    }

    getByHab(habNum) {
        const all = this.getRentals();
        return all.find(x => x.habitacion == habNum);
    }
}

export const safeService = new SafeService();
