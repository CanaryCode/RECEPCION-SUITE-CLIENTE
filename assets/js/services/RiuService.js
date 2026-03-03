import { BaseService } from './BaseService.js';

/**
 * SERVICIO RIU CLASS (RiuService)
 * ------------------------------
 * Gestiona el registro de clientes que son miembros del programa de fidelización.
 */
class RiuService extends BaseService {
    constructor() {
        super('riu_clientes');
        
        // Esquema para validación automática
        this.schema = {
            id: 'number',
            nombre: 'string',
            habitacion: 'string',
            tipo_tarjeta: 'string',
            fecha_salida: 'date'
        };
    }

    /**
     * OBTENER CLIENTES
     */
    getClientes() {
        return this.getAll() || [];
    }

    /**
     * OBTENER HUÉSPED POR HABITACIÓN
     */
    getHab(num) {
        const clientes = this.getClientes();
        return clientes.find(c => c.habitacion === num) || null;
    }

    /**
     * GUARDAR CLIENTE (Insertar o Actualizar)
     */
    async saveCliente(cliente) {
        return this.update(cliente.id, cliente);
    }

    /**
     * ELIMINAR CLIENTE
     */
    async removeCliente(id) {
        return this.delete(id);
    }

    /**
     * LIMPIEZA AUTOMÁTICA DE SALIDAS
     */
    /**
     * LIMPIEZA AUTOMÁTICA DE SALIDAS
     */
    async limpiarSalidas() {
        const hoy = new Date().toISOString().split('T')[0];
        const actuales = this.getClientes();
        
        // RESILIENCIA: Filtrar registros que no tengan nombre (evita error de esquema)
        // y filtrar también los que ya han salido.
        const filtrados = actuales.filter(c => c.nombre && c.fecha_salida >= hoy);
        
        if (filtrados.length !== actuales.length) {
            await this.save(filtrados);
            console.log(`[RiuService] Limpieza automática realizada: Salidas pasadas o registros inválidos eliminados.`);
        }
    }
}

export const riuService = new RiuService();
