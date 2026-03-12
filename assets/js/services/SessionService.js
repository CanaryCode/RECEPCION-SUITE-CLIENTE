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
        // Migración: Si existe en sessionStorage (versión previa), migrarlo a localStorage
        const sessionUser = sessionStorage.getItem(this.STORAGE_KEY);
        if (sessionUser) {
            localStorage.setItem(this.STORAGE_KEY, sessionUser);
            sessionStorage.removeItem(this.STORAGE_KEY);
        }
        
        return localStorage.getItem(this.STORAGE_KEY);
    }

    /**
     * ESTABLECER USUARIO
     * Guarda el nombre del nuevo recepcionista permanentemente.
     */
    setUser(username) {
        if (username) {
            localStorage.setItem(this.STORAGE_KEY, username);
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
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem('current_hotel_id');
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
