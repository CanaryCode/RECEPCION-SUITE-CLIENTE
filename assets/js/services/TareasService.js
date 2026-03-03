import { BaseService } from './BaseService.js';

/**
 * SERVICIO DE TAREAS (TareasService)
 * ---------------------------------------
 * Gestiona el listado de tareas pendientes o programadas.
 */
class TareasService extends BaseService {
    constructor() {
        super('riu_tareas');
        
        // Esquema para validación de tareas
        this.schema = {
            id: 'number',
            titulo: 'string',
            descripcion: 'string',
            prioridad: 'string',
            fecha: 'string', // Formato YYYY-MM-DD
            hora: 'string',
            estado: 'string', // Pendiente, En Proceso, Terminada
            autor: 'string'
        };
    }

    /**
     * OBTENER TAREAS
     */
    getTareas() {
        return this.getAll();
    }

    /**
     * REGISTRAR/ACTUALIZAR TAREA
     */
    async saveTarea(tarea) {
        return this.update(tarea.id, tarea);
    }

    /**
     * ELIMINAR REGISTRO
     */
    async removeTarea(id) {
        return this.delete(id);
    }

    /**
     * BUSCAR POR ID
     */
    getById(id) {
        return this.getByKey(id);
    }
}

export const tareasService = new TareasService();
