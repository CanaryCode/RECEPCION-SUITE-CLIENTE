import { BaseService } from './BaseService.js';
import { APP_CONFIG } from '../core/Config.js';

/**
 * SERVICIO DE ALARMAS DEL SISTEMA (SystemAlarmsService)
 * ----------------------------------------------------
 * Gestiona los recordatorios internos y alarmas automáticas.
 */
class SystemAlarmsService extends BaseService {
    constructor() {
        super('riu_system_alarms', [], false);
        
        // Esquema para validación de alarmas del sistema
        this.schema = {
            id: 'string',
            titulo: 'string',
            hora: 'string',
            active: 'boolean',
            usuario: 'any',
            type: 'string',
            date: 'any',
            days: 'any',
            day: 'any'
        };
    }

    async init() {
        let data = await super.init();
        
        // RECOVERY: If data is corrupted (Object instead of Array), force a reset
        if (data && !Array.isArray(data)) {
            console.warn("[SystemAlarms] Data corruption detected (Object instead of Array). Resetting database.");
            this.clear(); // Wipes LocalStorage and Cache
            return this.initializeDefaults();
        }

        // SANITIZATION: Ensure all items have the required fields for the new schema
        if (Array.isArray(data)) {
            let changed = false;
            data.forEach(item => {
                const schemaKeys = Object.keys(this.schema);
                schemaKeys.forEach(key => {
                    if (!(key in item)) {
                        item[key] = (key === 'active') ? true : (key === 'type' ? 'daily' : null);
                        changed = true;
                    }
                });
            });
            if (changed) {
                console.log("[SystemAlarms] Migrated legacy alarms to new schema.");
                this.save(data);
            }
        }

        // Only initialize defaults if the key doesn't exist at all (null)
        // This allows the user to have an empty list of alarms.
        const rawLocal = localStorage.getItem(this.endpoint);
        if (rawLocal === null && (!data || data.length === 0)) {
            return this.initializeDefaults();
        }
        
        return data;
    }

    /**
     * CARGA INICIAL POR DEFECTO
     */
    async initializeDefaults() {
        if (APP_CONFIG.HOTEL && Array.isArray(APP_CONFIG.HOTEL.ALARMAS_SISTEMA)) {
            const defaults = APP_CONFIG.HOTEL.ALARMAS_SISTEMA.map((a, i) => ({
                id: `sys_default_${i}`,
                ...a,
                titulo: a.titulo || a.mensaje || 'Alarma Sistema',
                active: true,
                usuario: null,
                type: a.type || 'daily',
                date: a.date || null,
                days: a.days || null,
                day: a.day || null
            }));
            return this.save(defaults);
        }
    }

    getAlarms() {
        const data = this.getAll();
        const alarms = Array.isArray(data) ? data : [];
        
        // Filter by user: Global (no usuario) OR matches current session user
        import('./SessionService.js').then(({ sessionService }) => {
            const currentUser = sessionService.getUser();
            // This filtering might be better done by callers if we want to be reactive,
            // but for now we follow the existing pattern.
        });

        return alarms;
    }

    /**
     * Retorna las alarmas visibles para un usuario específico (Global + Personales)
     */
    getVisibleAlarms(username) {
        const alarms = this.getAlarms();
        return alarms.filter(a => !a.usuario || a.usuario === username);
    }

    /**
     * GUARDAR O ACTUALIZAR ALARMA
     */
    async saveAlarm(alarm) {
        if (!alarm.id) alarm.id = `sys_${Date.now()}`;
        return this.update(alarm.id, alarm);
    }

    /**
     * ELIMINAR ALARMA
     */
    async deleteAlarm(id) {
        return this.delete(id);
    }

    /**
     * ACTIVAR/DESACTIVAR
     */
    async toggleActive(id) {
        const item = this.getByKey(id);
        if (item) {
            item.active = !item.active;
            return this.saveAlarm(item);
        }
    }

    /**
     * ¿DEBE SONAR AHORA?
     */
    isTriggerDue(alarm, dateObj) {
        if (!alarm.active) return false;

        const currentHour = dateObj.getHours().toString().padStart(2, '0');
        const currentMinute = dateObj.getMinutes().toString().padStart(2, '0');
        const currentTime = `${currentHour}:${currentMinute}`;

        if (alarm.hora !== currentTime) return false;

        const weekDay = dateObj.getDay(); 
        const dateStr = dateObj.toISOString().split('T')[0];

        if (alarm.type === 'date') return alarm.date === dateStr;

        if (alarm.type === 'monthly') {
            const currentDay = dateObj.getDate();
            return alarm.day === currentDay;
        }

        if (alarm.type === 'weekly') {
            if (Array.isArray(alarm.days)) return alarm.days.includes(weekDay);
            return false;
        }

        if (alarm.dias === 'todos' || !alarm.dias) return true;
        if (alarm.dias === 'laborables') return (weekDay >= 1 && weekDay <= 5);
        if (alarm.dias === 'finde') return (weekDay === 0 || weekDay === 6);
        if (Array.isArray(alarm.dias)) return alarm.dias.includes(weekDay);

        return true;
    }
}

export const systemAlarmsService = new SystemAlarmsService();
