import { BaseService } from "./BaseService.js";
import { realTimeSync } from "../core/RealTimeSync.js";
import { localConfigService } from "./LocalConfigService.js";

/**
 * SERVICIO DE CALENDARIO (CalendarioService)
 * -----------------------------------------
 * Gestiona los eventos del calendario con persistencia y sincronización.
 *
 * CONFIGURACIÓN LOCAL:
 * - Las carpetas se guardan en la configuración local del PC (agent_local_config.json)
 * - Cada ordenador puede tener carpetas diferentes
 * - Persiste al borrado de caché del navegador
 */
class CalendarioService extends BaseService {
    constructor() {
        super('calendario_eventos');

        // Esquema de validación para eventos
        this.schema = {
            titulo: 'string',
            fecha: 'date', // Formato YYYY-MM-DD
            hora: 'string',  // Formato HH:mm
            priority: 'string',  // Normal, Urgente
            color: 'string'      // Hex color
        };

        // Registrar en el servicio de tiempo real
        realTimeSync.registerService(this.endpoint, this);
    }

    /**
     * OBTENER carpetas configuradas para este módulo (desde config local)
     */
    async getFolders() {
        return localConfigService.getFolders('calendario');
    }

    /**
     * ESTABLECER carpetas para este módulo (en config local)
     */
    async setFolders(folders) {
        return localConfigService.setFolders('calendario', folders);
    }

    /**
     * AÑADIR carpeta (en config local)
     */
    async addFolder(folderPath) {
        return localConfigService.addFolder('calendario', folderPath);
    }

    /**
     * ELIMINAR carpeta (en config local)
     */
    async removeFolder(folderPath) {
        return localConfigService.removeFolder('calendario', folderPath);
    }

    /**
     * Obtiene festivos de España para un año específico (con caché)
     */
    async fetchFestivosES(year) {
        const cacheKey = `festivos_es_${year}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) return JSON.parse(cached);

        try {
            // Usamos Nager.Date API (Pública y gratuita)
            const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ES`);
            if (!response.ok) throw new Error('Error al obtener festivos');
            const data = await response.json();
            
            // Mapeamos al formato de nuestro calendario
            const festivos = data.map(f => ({
                id: `festivo_${f.date}_${f.name}`,
                titulo: f.localName || f.name,
                fecha: f.date,
                hora: '00:00',
                readonly: true
            }));

            localStorage.setItem(cacheKey, JSON.stringify(festivos));
            return festivos;
        } catch (e) {
            console.error("Error cargando festivos:", e);
            return [];
        }
    }

    /**
     * Obtiene eventos en un rango de fechas incluyendo festivos
     * @param {string} fechaInicio - YYYY-MM-DD
     * @param {string} fechaFin - YYYY-MM-DD
     */
    async getEventosRango(fechaInicio, fechaFin) {
        const all = await this.init();
        const personalEvents = all.filter(e => e.fecha >= fechaInicio && e.fecha <= fechaFin);
        
        // Cargar festivos para los años implicados
        const yearInicio = parseInt(fechaInicio.split('-')[0]);
        const yearFin = parseInt(fechaFin.split('-')[0]);
        
        let holidays = await this.fetchFestivosES(yearInicio);
        if (yearFin !== yearInicio) {
            const nextYearHolidays = await this.fetchFestivosES(yearFin);
            holidays = [...holidays, ...nextYearHolidays];
        }

        const filteredHolidays = holidays.filter(h => h.fecha >= fechaInicio && h.fecha <= fechaFin);
        
        return [...personalEvents, ...filteredHolidays];
    }

    /**
     * Obtiene eventos de un día específico incluyendo festivos
     * @param {string} fecha - YYYY-MM-DD
     */
    async getEventosDia(fecha) {
        const year = fecha.split('-')[0];
        const holidays = await this.fetchFestivosES(year);
        const dayHoliday = holidays.filter(h => h.fecha === fecha);
        
        const all = await this.init();
        const personal = all.filter(e => e.fecha === fecha);
        
        return [...dayHoliday, ...personal];
    }

    /**
     * Guarda o actualiza un evento
     */
    async saveEvento(evento) {
        if (!evento.id) {
            evento.id = Date.now();
        }
        return this.update(evento.id, evento);
    }

    /**
     * Elimina un evento
     */
    async deleteEvento(id) {
        return this.delete(id);
    }
}

export const calendarioService = new CalendarioService();
