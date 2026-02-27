import { BaseService } from './BaseService.js';

/**
 * SERVICIO DE RESERVAS DE INSTALACIONES (ReservasInstalacionesService)
 * ------------------------------------------------------------------
 * Gestiona las reservas de pistas de tenis, gimnasio, etc.
 */
class ReservasInstalacionesService extends BaseService {
    constructor() {
        super('reservas_instalaciones', []);
        
        this.schema = {
            id: 'string',
            instalacion: 'string',
            fecha: 'string',
            hora_inicio: 'string',
            hora_fin: 'string',
        };
    }

    /**
     * Obtiene las reservas para una fecha específica
     */
    getByFecha(fecha) {
        const all = this.getAll();
        return all.filter(r => r.fecha === fecha);
    }

    /**
     * Obtiene las reservas para una instalación y fecha específicas
     */
    getByInstalacionYFecha(instalacion, fecha) {
        const all = this.getAll();
        return all.filter(r => r.instalacion === instalacion && r.fecha === fecha);
    }
}

export const reservasInstalacionesService = new ReservasInstalacionesService();
