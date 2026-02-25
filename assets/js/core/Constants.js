/**
 * CONSTANTES GLOBALES DEL SISTEMA
 * Centraliza strings mágicos para evitar errores y facilitar refactorización.
 */
export const CONSTANTS = {
    // Tipos de Alarmas
    ALARM_TYPES: {
        WEEKLY: 'weekly',
        DAILY: 'daily',
        DATE: 'date'
    },
    
    // Estados de UI
    UI_STATES: {
        WORK_VIEW: 'work-view',
        LIST_VIEW: 'list-view',
        RACK_VIEW: 'rack-view'
    },
    
    // Nombres de Módulos (para IDs de LocalStorage o Claves)
    MODULES: {
        AGENDA: 'agenda',
        ALARMS: 'system_alarms',
        CAJA: 'arqueo_caja',
        RIU: 'riu_class'
    },

    // Eventos Globales (para EventBus)
    EVENTS: {
        APP_INIT: 'app:init',
        DATA_UPDATED: 'data:updated', // { module: 'agenda', count: 10 }
        SEARCH_GLOBAL: 'search:global',
        LOGOUT: 'auth:logout'
    }
};
