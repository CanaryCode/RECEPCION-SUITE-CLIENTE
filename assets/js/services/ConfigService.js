import { BaseService } from './BaseService.js?v=V145_VAL_FIX';
import { Api } from '../core/Api.js?v=V145_VAL_FIX';
import { APP_CONFIG } from '../core/Config.js?v=V153_DB_CONFIG';

/**
 * SERVICIO DE CONFIGURACIÓN (ConfigService)
 * ---------------------------------------
 * Maneja el guardado y actualización de la configuración global del sistema.
 */
class ConfigService extends BaseService {
    constructor() {
        super('config', {}, false);
    }

    /**
     * GUARDAR CONFIGURACIÓN EN EL SERVIDOR
     */
    async saveConfig(newConfig) {
        try {
            await Api.post('storage/config', newConfig);
            // Actualizar el objeto global en memoria
            Object.assign(APP_CONFIG, newConfig);
            return true;
        } catch (error) {
            console.error('[ConfigService] Error al guardar configuración:', error);
            throw error;
        }
    }
}

export const configService = new ConfigService();
