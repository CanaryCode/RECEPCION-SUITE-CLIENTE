import { BaseService } from './BaseService.js';

/**
 * SERVICIO DE NOVEDADES (NovedadesService)
 * ---------------------------------------
 * Gestiona el libro de relevos o bitácora diaria.
 */
class NovedadesService extends BaseService {
    constructor() {
        super('riu_novedades');
        
        // Esquema para validación de novedades del libro de relevos
        this.schema = {
            id: 'number',
            texto: 'string',
            autor: 'string',
            fecha: 'string'
        };
    }

    /**
     * OBTENER NOVEDADES
     */
    getNovedades() {
        return this.getAll();
    }

    /**
     * REGISTRAR/ACTUALIZAR NOVEDAD
     */
    async saveNovedad(novedad) {
        return this.update(novedad.id, novedad);
    }

    /**
     * ELIMINAR REGISTRO
     */
    async removeNovedad(id) {
        return this.delete(id);
    }

    /**
     * BUSCAR POR ID
     */
    getById(id) {
        return this.getByKey(id);
    }
}

export const novedadesService = new NovedadesService();
