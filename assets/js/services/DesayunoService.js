import { BaseService } from './BaseService.js';

/**
 * SERVICIO DE DESAYUNOS (DesayunoService)
 * --------------------------------------
 * Gestiona las peticiones de desayunos tempranos.
 */
class DesayunoService extends BaseService {
    constructor() {
        super('riu_desayunos', {}); // Estructura: { "Hab": { pax: 1, hora: "06:30" } }
        
        // Esquema para validación de desayunos tempranos
        this.schema = {
            pax: 'number',
            hora: 'string'
        };
    }

    /**
     * AÑADIR O ACTUALIZAR PEDIDO
     */
    async addDesayuno(hab, data) {
        return this.setByKey(hab, data);
    }

    /**
     * ELIMINAR PEDIDO
     */
    async removeDesayuno(hab) {
        return this.removeByKey(hab);
    }
}

export const desayunoService = new DesayunoService();
