import { LocalStorage } from '../core/LocalStorage.js';

/**
 * SERVICIO DE SESIÓN (SessionService)
 * ----------------------------------
 * Gestiona qué recepcionista está utilizando el programa en este momento.
 * El nombre del usuario se guarda en el PC para que no haya que elegirlo 
 * cada vez que se refresca la página.
 */
class SessionService {
    constructor() {
        this.STORAGE_KEY = 'session_user'; // Clave bajo la que se guarda el nombre en el navegador
    }

    /**
     * OBTENER USUARIO ACTUAL
     * @returns {string|null} El nombre del recepcionista o null si nadie se ha identificado.
     */
    getUser() {
        // Migración: Si existe en app_current_user (versión antigua), migrarlo a session_user
        const legacyUser = sessionStorage.getItem('app_current_user');
        if (legacyUser) {
            sessionStorage.setItem(this.STORAGE_KEY, legacyUser);
            sessionStorage.removeItem('app_current_user');
        }
        
        return sessionStorage.getItem(this.STORAGE_KEY);
    }

    /**
     * ESTABLECER USUARIO
     * Guarda el nombre del nuevo recepcionista temporalmente (solo esta pestana).
     */
    setUser(username) {
        if (username) {
            sessionStorage.setItem(this.STORAGE_KEY, username);
            // Notificar a otros módulos (Chat, Sync, etc)
            window.dispatchEvent(new CustomEvent('user-updated', { detail: { name: username } }));
        } else {
            this.logout();
        }
    }

    /**
     * CERRAR SESIÓN
     * Borra el nombre del usuario actual del sistema.
     */
    logout() {
        sessionStorage.removeItem(this.STORAGE_KEY);
        window.dispatchEvent(new CustomEvent('user-updated', { detail: { name: null } }));
    }

    /**
     * ¿ESTÁ IDENTIFICADO?
     * @returns {boolean} Verdadero si hay alguien logueado.
     */
    isAuthenticated() {
        return !!this.getUser();
    }
}

// Exportamos una única instancia para asegurar que todos usen la misma sesión
export const sessionService = new SessionService();
