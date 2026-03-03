import { BaseService } from "./BaseService.js";

/**
 * SERVICIO DE OBJETOS PERDIDOS (LostFoundService)
 * ----------------------------------------------
 * Gestiona el almacenamiento y persistencia de objetos encontrados en el hotel.
 */
class LostFoundService extends BaseService {
    constructor() {
        super('riu_lost_found', []);
        
        /**
         * ESQUEMA DE DATOS
         * El ID ahora es alfanumérico (Ej: LF-20240520-X8J)
         */
        this.schema = {
            id: 'string',
            fecha: 'date',
            objeto: 'string',
            lugar: 'string',
            quien: 'string',
            estado: 'string',
            comments: 'string',
            imagenes: 'any'
        };
    }

    /**
     * GENERAR ID PERSONALIZADO
     * Formato: LF-YYYYMMDD-RANDOM(4)
     */
    generateCustomId() {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `LF-${date}-${random}`;
    }

    /**
     * OBTENER TODOS LOS OBJETOS
     */
    getItems() {
        return this.getAll();
    }

    /**
     * GUARDAR O ACTUALIZAR OBJETO
     * Centraliza la lógica de generación de ID y limpieza de datos.
     */
    async saveItem(item) {
        if (!item.id || item.id === '') {
            item.id = this.generateCustomId();
        }
        
        // Asegurar campos opcionales
        item.comments = item.comments || '';
        if (!Array.isArray(item.imagenes)) {
            item.imagenes = item.imagenes ? [item.imagenes] : [];
        }

        console.log("[LostFoundService] Saving item:", item);
        return this.update(item.id, item);
    }

    /**
     * ELIMINAR OBJETO
     */
    async removeItem(id) {
        return this.delete(id);
    }

    /**
     * ALIAS PARA COMPATIBILIDAD CON Ui.handleFormSubmission
     */
    async setByKey(key, value, idField = 'id') {
        return this.saveItem(value);
    }

    async removeByKey(key, idField = 'id') {
        return this.delete(key, idField);
    }
}

export const lostFoundService = new LostFoundService();
