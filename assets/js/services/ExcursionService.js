import { BaseService } from "./BaseService.js";

/**
 * SERVICIO DE EXCURSIONES Y TICKETS (ExcursionService)
 * --------------------------------------------------
 * Gestiona las ventas de excursiones y entradas.
 * El catálogo de productos se gestiona desde APP_CONFIG.
 */
class ExcursionService extends BaseService {
    constructor() {
        super('riu_excursiones', []);
        
        /**
         * Esquema de Venta:
         * id: auto-generado
         * tipoId: ID de la excursión en el catálogo
         * huesped: nombre del cliente
         * habitacion: número de habitación
         * fechaVenta: ISO String
         * fechaExcursion: ISO String (cuando se realiza la excursión)
         * adultos: cantidad
         * niños: cantidad
         * total: importe calculado
         * estado: 'Cobrado', 'Pendiente'
         * localizador: String (opcional)
         * vendedor: nombre del recepcionista
         * comments: notas adicionales
         */
        this.schema = {
            id: 'string',
            huesped: 'string',
            habitacion: 'string',
            fechaExcursion: 'string',
            total: 'number',
            estado: 'string',
            vendedor: 'string',
            fechaVenta: 'string',
            comments: 'string'
        };
    }

    /**
     * OBTENER LISTADO DE VENTAS + MIGRACIÓN AL VUELO
     */
    async getVentas() {
        const data = await this.getAll();
        let changed = false;

        const migrated = data.map(v => {
            let item = { ...v };
            let itemChanged = false;

            // 1. Corregir ID vacío
            if (!item.id || item.id === "") {
                const ts = item.actualizadoEn ? new Date(item.actualizadoEn).getTime() : Date.now();
                item.id = `EXC-${ts}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
                itemChanged = true;
            }

            // 2. Corregir fechaVenta faltante
            if (!item.fechaVenta) {
                item.fechaVenta = item.actualizadoEn || new Date().toISOString();
                itemChanged = true;
            }

            // 3. Asegurar campo comments
            if (item.comments === undefined) {
                item.comments = "";
            }

            if (itemChanged) changed = true;
            return item;
        });

        if (changed) {
            console.log("[ExcursionService] Realizando migración de datos antiguos...");
            await this.save(migrated);
        }

        return migrated;
    }

    /**
     * Sobrescribir update para asegurar campos automáticos
     */
    async update(id, data, idField = 'id') {
        const item = { ...data };
        
        // Si es una venta nueva (ID provisional del cliente o vacío)
        if (!item.fechaVenta) {
            item.fechaVenta = new Date().toISOString();
        }

        // Asegurar ID profesional si viene de un timestamp o es nuevo
        if (!item.id || !isNaN(item.id) || item.id == id) {
            if (!item.id || !item.id.startsWith('EXC-')) {
                item.id = `EXC-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
            }
        }

        return super.update(id, item, idField);
    }

    /**
     * Guardar una nueva venta (Mantenido por compatibilidad si se usa directamente)
     */
    async registrarVenta(venta) {
        return await this.update(venta.id || Date.now(), venta);
    }

    /**
     * Eliminar una venta
     */
    async eliminarVenta(id) {
        return await this.delete(id);
    }
}

export const excursionService = new ExcursionService();
