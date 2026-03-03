import { BaseService } from './BaseService.js';

/**
 * SERVICIO DE CONTROL DE ESTANCIA (EstanciaService)
 * ------------------------------------------------
 * Registra diariamente cuántas habitaciones están ocupadas y cuántas vacías.
 */
class EstanciaService extends BaseService {
    constructor() {
        super('riu_estancia_diaria');
        
        // Esquema para validación de registros de estancia (ocupación)
        // Esquema para validación de registros de estancia (ocupación)
        this.schema = {
            fecha: 'string'
        };
    }

    /**
     * OBTENER TODOS LOS REGISTROS
     */
    getRegistros() {
        const data = this.getAll();

        // MIGRACIÓN: Antiguamente los datos se guardaban anidados. 
        if (data && !Array.isArray(data) && typeof data === 'object') {
            const flatList = [];
            Object.keys(data).forEach(year => {
                Object.keys(data[year]).forEach(month => {
                    Object.keys(data[year][month]).forEach(day => {
                        const record = data[year][month][day];
                        const m = (parseInt(month) + 1).toString().padStart(2, '0');
                        const d = day.toString().padStart(2, '0');
                        const fecha = `${year}-${m}-${d}`;
                        flatList.push({ fecha, ...record });
                    });
                });
            });
            this.save(flatList); 
            return flatList;
        }

        // NORMALIZACIÓN: Asegurar que totalHab siempre esté disponible
        if (Array.isArray(data) && data.length > 0) {
            let fixed = false;
            data.forEach(r => {
                if (r.totalHab === undefined && r.total_hab !== undefined) {
                    r.totalHab = r.total_hab;
                    fixed = true;
                }
            });
            if (fixed) this.save(data);
        }

        return data;
    }

    /**
     * GUARDAR O ACTUALIZAR DÍA
     */
    async saveRegistro(registro) {
        return this.update(registro.fecha, registro, 'fecha');
    }

    /**
     * ELIMINAR REGISTRO
     */
    async removeRegistro(fecha) {
        return this.delete(fecha, 'fecha');
    }

    /**
     * FILTRAR POR AÑO
     */
    getByYear(year) {
        const prefix = `${year}-`;
        return this.getRegistros().filter(r => r.fecha.startsWith(prefix));
    }

    /**
     * FILTRAR POR MES
     */
    getByMonth(year, month) {
        const m = (parseInt(month) + 1).toString().padStart(2, '0');
        const prefix = `${year}-${m}`; 
        return this.getRegistros().filter(r => r.fecha.startsWith(prefix));
    }
}

export const estanciaService = new EstanciaService();
