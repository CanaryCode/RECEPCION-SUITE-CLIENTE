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
            this.cache = this.cache.map(v => {
                let repaired = { ...v };

                // 1. Validar ID (Debe ser número)
                if (typeof repaired.id !== 'number') {
                    const numericId = parseInt(repaired.id);
                    if (!isNaN(numericId)) {
                        repaired.id = numericId;
                    } else {
                        repaired.id = Date.now() + Math.floor(Math.random() * 1000);
                    }
                    needsRepair = true;
                }

                // 2. Validar Importe (Debe ser número)
                if (typeof repaired.importe !== 'number') {
                    const val = parseFloat(repaired.importe);
                    repaired.importe = isNaN(val) ? 0 : val;
                    if (typeof v.importe !== 'number') needsRepair = true;
                }

                // 3. Otros campos obligatorios
                if (!repaired.fecha_creacion) {
                    repaired.fecha_creacion = repaired.created_at || new Date().toISOString();
                    needsRepair = true;
                }
                if (!repaired.usuario) { repaired.usuario = repaired.autor || 'Anónimo'; needsRepair = true; }
                if (repaired.firmado === undefined || repaired.firmado === null) { repaired.firmado = true; needsRepair = true; }
                if (repaired.comentario === undefined || repaired.comentario === null) { repaired.comentario = ''; needsRepair = true; }
                if (repaired.estado === undefined || repaired.estado === null) { repaired.estado = 'Pendiente'; needsRepair = true; }
                if (repaired.receptor === undefined || repaired.receptor === null) {
                    repaired.receptor = repaired.habitacion || 'No especificado';
                    needsRepair = true;
                }
                if (repaired.concepto === undefined || repaired.concepto === null) { repaired.concepto = 'Varios'; needsRepair = true; }

                return repaired;
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
