import { BaseService } from './BaseService.js';

/**
 * SERVICIO DE CAJA (CajaService)
 * ----------------------------
 * Gestiona la persistencia del arqueo de caja diario.
 */
class CajaService extends BaseService {
    constructor() {
        super('arqueo_caja', {
            vales: [],
            desembolsos: [],
            fecha: null,
            turno: null,
            comentarios: ""
        });

        // Definición del esquema para validación automática
        this.schema = {
            vales: 'any',
            desembolsos: 'any',
            comentarios: 'any'
        };
    }

    /**
     * OBTENER DATOS DE LA SESIÓN ACTUAL
     */
    getSessionData() {
        return this.getAll();
    }

    /**
     * Helper para garantizar que todos los campos requeridos existen.
     */
    _getMergedData() {
        const currentData = this.getAll();
        // Si currentData es un array vacío (por problema previo), ignorarlo
        const dataToMerge = Array.isArray(currentData) ? {} : (currentData || {});
        return { ...this.defaultValue, ...dataToMerge };
    }

    /**
     * GUARDAR VALES
     */
    async saveVales(vales) {
        const data = this._getMergedData();
        data.vales = vales;
        return this.save(data);
    }

    /**
     * GUARDAR DESEMBOLSOS
     */
    async saveDesembolsos(desembolsos) {
        const data = this._getMergedData();
        data.desembolsos = desembolsos;
        return this.save(data);
    }

    /**
     * GUARDAR COMENTARIOS Y METADATOS
     */
    async saveMetadata(metadata) {
        const data = this._getMergedData();
        Object.assign(data, metadata);
        return this.save(data);
    }

    /**
     * RESETEAR CAJA PARA NUEVO TURNO
     */
    reset() {
        return this.save(this.defaultValue);
    }
}

export const cajaService = new CajaService();
