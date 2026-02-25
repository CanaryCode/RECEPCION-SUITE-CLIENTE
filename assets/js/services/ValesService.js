import { BaseService } from './BaseService.js';

/**
 * SERVICIO DE VALES (ValesService)
 * --------------------------------
 * Gestiona la persistencia de los vales de caja.
 * Permite crear, firmar y consultar el histórico de vales.
 */
class ValesService extends BaseService {
    constructor() {
        super('vales_data', []);

        // Definición del esquema para validación automática
        this.schema = {
            id: 'number',             // Timestamp
            fecha_creacion: 'string', // ISO String
            receptor: 'string',       // Persona que recibe el dinero
            concepto: 'string',       // Razón del vale
            estado: 'string',         // "Pendiente", "Liquidado", etc.
            importe: 'number',        // Cantidad
            comentario: 'string',     // Detalles adicionales
            firmado: 'boolean',       // Estado de firma (Autorización)
            usuario: 'string'         // Recepcionista que creó el vale
        };
    }

    /**
     * CREAR UN NUEVO VALE
     * @param {Object} data - Datos del vale
     * @returns {Promise<Object>} - El vale creado
     */
    async createVale(data) {
        const nuevoVale = {
            id: Date.now(),
            fecha_creacion: new Date().toISOString(),
            estado: data.estado || 'Pendiente',
            firmado: data.firmado !== undefined ? data.firmado : true,
            receptor: data.receptor || 'Sin Receptor',
            concepto: data.concepto || 'Varios',
            importe: parseFloat(data.importe) || 0,
            comentario: data.comentario || '',
            usuario: data.usuario || 'Anónimo'
        };

        return this.add(nuevoVale);
    }

    /**
     * FIRMAR / DESFIRMAR VALE
     * @param {number} id - ID del vale
     * @returns {Promise<Object>} - El vale actualizado
     */
    async toggleFirma(id) {
        const vale = this.getById(id);
        if (!vale) throw new Error("Vale no encontrado");

        return this.update(id, { firmado: !vale.firmado });
    }

    /**
     * CAMBIAR ESTADO
     * @param {number} id 
     * @param {string} nuevoEstado 
     */
    async updateEstado(id, nuevoEstado) {
        return this.update(id, { estado: nuevoEstado });
    }

    /**
     * OBTENER HISTÓRICO POR RANGO DE FECHAS
     * @param {Date} inicio - Objeto Date de inicio (00:00:00)
     * @param {Date} fin - Objeto Date de fin (23:59:59)
     */
    /**
     * OBTENER HISTÓRICO POR RANGO DE FECHAS
     * @param {Date} inicio - Objeto Date de inicio (00:00:00)
     * @param {Date} fin - Objeto Date de fin (23:59:59)
     */
    getValesByDateRange(inicio, fin) {
        const todos = this.getAll();
        if (!Array.isArray(todos)) return [];

        return todos.filter(v => {
            const fechaVale = new Date(v.fecha_creacion);
            return fechaVale >= inicio && fechaVale <= fin;
        });
    }

    async init() {
        await super.init();
        
        // MIGRACIÓN: Asegurar que todos los registros antiguos cumplan con el nuevo esquema
        // Si no hacemos esto, BaseService.validate fallará al intentar añadir un nuevo vale
        if (Array.isArray(this.cache) && this.cache.length > 0) {
            let needsRepair = false;
            this.cache.forEach(v => {
                // Campos que han sido añadidos progresivamente
                if (v.usuario === undefined) { v.usuario = 'Anónimo'; needsRepair = true; }
                if (v.firmado === undefined) { v.firmado = false; needsRepair = true; }
                if (v.comentario === undefined) { v.comentario = ''; needsRepair = true; }
                if (v.estado === undefined) { v.estado = 'Pendiente'; needsRepair = true; }
                if (v.receptor === undefined && v.nombre) { v.receptor = v.nombre; needsRepair = true; }
                if (v.concepto === undefined) { v.concepto = 'Varios'; needsRepair = true; }
            });

            if (needsRepair) {
                console.log("[ValesService] Reparando datos antiguos para cumplir con el esquema...");
                this.save(this.cache);
            }
        }
        
        return this.cache;
    }
}

export const valesService = new ValesService();
