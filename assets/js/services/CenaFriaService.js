import { BaseService } from './BaseService.js';

/**
 * SERVICIO DE CENAS FRÍAS (CenaFriaService)
 * ----------------------------------------
 * Gestiona las solicitudes de cenas frías por habitación.
 */
class CenaFriaService extends BaseService {
    constructor() {
        super('riu_cenas_frias', {}); // Estructura: { "Hab": { pax: 2, obs: "..." } }
        
        // Esquema para validación de cenas frías
        this.schema = {
            pax: 'number',
            obs: 'string'
        };
    }

    /**
     * AÑADIR O ACTUALIZAR CENA
     */
    async addCena(hab, data) {
        return this.setByKey(hab, data);
    }

    /**
     * ELIMINAR CENA
     */
    async removeCena(hab) {
        return this.removeByKey(hab);
    }

    // Alias para compatibilidad
    getCenas() {
        return this.getAll();
    }
}

export const cenaFriaService = new CenaFriaService();
