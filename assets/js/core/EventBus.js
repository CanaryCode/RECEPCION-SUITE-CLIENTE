/**
 * SISTEMA GLOBAL DE EVENTOS (Pub/Sub)
 * Utilizado para la comunicación desacoplada entre módulos.
 */
export const EventBus = {
    events: {},

    /**
     * Suscribirse a un evento
     * @param {string} event - Nombre del evento (ej: 'alarms:updated')
     * @param {Function} callback - Función a ejecutar
     */
    on(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
    },

    /**
     * Cancelar suscripción
     * @param {string} event 
     * @param {Function} callback 
     */
    off(event, callback) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    },

    /**
     * Emitir evento
     * @param {string} event 
     * @param {*} data - Datos a enviar a los suscriptores
     */
    emit(event, data) {
        if (!this.events[event]) return;
        this.events[event].forEach(callback => callback(data));
    }
};
