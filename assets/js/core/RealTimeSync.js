import { APP_CONFIG } from './Config.js';

/**
 * SERVICIO DE TIEMPO REAL (RealTimeSync)
 * -------------------------------------
 * Mantiene una conexión WebSocket con el servidor central para recibir
 * notificaciones instantáneas cuando cambian los datos.
 */
class RealTimeSync {
    constructor() {
        this.socket = null;
        this.reconnectTimeout = 5000;
        this.services = new Map(); // endpoint -> service instance
    }

    /**
     * Registrar un servicio para que se actualice automáticamente
     * @param {string} endpoint 
     * @param {BaseService} service 
     */
    registerService(endpoint, service) {
        this.services.set(endpoint, service);
    }

    connect() {
        if (!APP_CONFIG.SYSTEM.USE_SYNC_SERVER) return;

        // Determinar URL de WebSocket basada en la API_URL
        let apiUrl = APP_CONFIG.SYSTEM.REMOTE_API_URL || APP_CONFIG.SYSTEM.API_URL || window.location.origin;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

        let wsUrl;
        if (apiUrl.startsWith('http')) {
            wsUrl = apiUrl.replace(/^http/, 'ws');
        } else {
            // Es una ruta relativa, usamos el host actual
            wsUrl = `${protocol}//${window.location.host}${apiUrl.startsWith('/') ? '' : '/'}${apiUrl}`;
        }

        // Limpiar /api o similares si están al final
        wsUrl = wsUrl.replace(/\/api\/?$/, '');

        console.log(`[Sync-RT] Conectando a ${wsUrl}...`);

        try {
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log('[Sync-RT] ✅ Conexión establecida.');
                this.login();
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'data-changed') {
                        this.handleDataChange(data.key);
                    } else if (data.type === 'force_reload') {
                        console.warn('[Sync-RT] 🔄 Recarga forzada por el administrador.');
                        window.location.reload(true);
                    } else if (data.type === 'global_alert') {
                        console.info('[Sync-RT] 🔔 Alerta global recibida:', data.payload.message);
                        if (window.showToast) {
                            // Show toast with longer duration for alerts (10 seconds)
                            window.showToast(`📢 MENSAJE DEL SISTEMA: ${data.payload.message}`, 'warning', 10000);
                        } else {
                            alert(`📢 MENSAJE DEL SISTEMA:\n\n${data.payload.message}`);
                        }
                    } else if (data.type === 'system_notification') {
                        console.info('[Sync-RT] 🔔 Notificación del sistema:', data);
                        if (window.showToast) {
                            const message = data.title ? `${data.title}: ${data.message}` : data.message;
                            const variant = data.variant || 'info';
                            const duration = data.duration !== undefined ? data.duration : 5000;
                            window.showToast(message, variant, duration);
                        }
                    } else if (data.type === 'chat_message' || 
                               data.type === 'chat_delete' || 
                               data.type === 'chat_delete_multiple' || 
                               data.type === 'user_connected' || 
                               data.type === 'chat_typing' ||
                               data.type === 'chat_stop_typing' ||
                               data.type === 'messages_read' ||
                               data.type === 'message_delivered' ||
                               data.type === 'chat_clear_conversation') {
                        // Re-emitir evento para que otros módulos (como el chat) lo escuchen sin tener su propio socket
                        console.log(`[Sync-RT] Re-emitting event: ${data.type}`, data.payload);
                        window.dispatchEvent(new CustomEvent('sync:ws_message', { detail: data }));
                    }
                } catch (e) {
                    console.error('[Sync-RT] Error parseando mensaje:', e);
                }
            };

            this.socket.onclose = () => {
                console.warn('[Sync-RT] ❌ Conexión cerrada. Reintentando...');
                setTimeout(() => this.connect(), this.reconnectTimeout);
            };

            this.socket.onerror = (err) => {
                console.error('[Sync-RT] Error en WebSocket:', err);
                this.socket.close();
            };
            
            // Re-identificar si el usuario cambia
            if (!this._userListenerAdded) {
                window.addEventListener('user-updated', () => this.login());
                this._userListenerAdded = true;
            }

        } catch (err) {
            console.error('[Sync-RT] Error al crear WebSocket:', err);
        }
    }

    login() {
        const username = localStorage.getItem('session_user');
        if (this.socket && this.socket.readyState === WebSocket.OPEN && username) {
            console.log(`[Sync-RT] Identificando conexión como: ${username}`);
            this.socket.send(JSON.stringify({
                type: 'chat_login',
                payload: { username }
            }));
        }
    }

    async handleDataChange(key) {
        const service = this.services.get(key);
        if (service) {
            console.log(`[Sync-RT] Notificación recibida para: ${key}. Actualizando cache...`);
            // El pull del servidor se encarga de actualizar el LocalStorage y el cache
            // y emite el evento 'service-synced'
            await service.syncWithServer();
        }
    }
}

export const realTimeSync = new RealTimeSync();
