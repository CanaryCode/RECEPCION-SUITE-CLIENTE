import { BaseService } from './BaseService.js';
import { LocalStorage } from '../core/LocalStorage.js';

/**
 * SERVICIO DE GUÍAS DE TRABAJO (AyudaService)
 * -------------------------------------------
 * Gestiona la lista de pasos que debe seguir el recepcionista en cada turno
 * (Mañana, Tarde, Noche). Incluye lógica para migrar versiones antiguas.
 */
class AyudaService extends BaseService {
    constructor() {
        super('guia_operativa', { mañana: [], tarde: [], noche: [] });
        
        // Esquema para validación de la guía operativa por turnos
        this.schema = {
            mañana: 'object',
            tarde: 'object',
            noche: 'object'
        };
    }

    /**
     * INICIALIZACIÓN ASÍNCRONA
     * Carga el JSON del servidor (storage/guia_operativa.json) como autoridad.
     */
    async init() {
        await this.syncWithServer();
        return this.getAll();
    }

    /**
     * OBTENER GUÍA DEL TURNO
     * @param {string} turno - 'mañana', 'tarde' o 'noche'
     * @param {Array} defaultData - Pasos por defecto si no hay nada guardado
     * @returns {Array} Lista de tareas para ese turno
     */
    getGuia(turno, defaultData = []) {
        const allData = this.getAll();

        // 1. Intentar cargar desde la estructura moderna
        if (allData && allData[turno] && allData[turno].length > 0) {
            return allData[turno];
        }

        // 2. MIGRACIÓN: Si no hay datos, buscar si existen en la versión antigua del programa
        const oldKey = `riu_guia_${turno}`;
        const oldData = LocalStorage.get(oldKey);
        if (oldData) {
            try {
                const parsed = JSON.parse(oldData);
                // Si encontramos datos viejos, los traemos a la nueva estructura unificada
                this.saveGuia(turno, parsed);
                return parsed;
            } catch (e) {
                console.error("Error migrando guía antigua del turno " + turno, e);
            }
        }

        return defaultData;
    }

    /**
     * GUARDAR CAMBIOS EN LA GUÍA
     */
    saveGuia(turno, listaPasos) {
        const allData = this.getAll() || { mañana: [], tarde: [], noche: [] };
        allData[turno] = listaPasos;
        this.save(allData);
    }
}

export const ayudaService = new AyudaService();
