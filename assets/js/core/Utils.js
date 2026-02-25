import { APP_CONFIG } from './Config.js?v=V145_VAL_FIX';
import { sessionService } from '../services/SessionService.js?v=V145_VAL_FIX';

/**
 * UTILIDADES GENERALES DEL SISTEMA (Utils)
 * ---------------------------------------
 * Este módulo contiene funciones de apoyo que se usan en toda la aplicación,
 * desde formatear dinero hasta validar quién está usando el programa.
 */

export const Utils = {
    /**
     * GENERAR LISTA DE HABITACIONES
     * Basándose en la configuración de plantas y números, crea una lista de objetos.
     * Ejemplo: { num: "101", planta: 1 }
     */
    getHabitaciones: () => {
        const lista = [];
        if (APP_CONFIG.HOTEL && APP_CONFIG.HOTEL.STATS_CONFIG && APP_CONFIG.HOTEL.STATS_CONFIG.RANGOS) {
            APP_CONFIG.HOTEL.STATS_CONFIG.RANGOS.forEach(r => {
                for (let i = r.min; i <= r.max; i++) {
                    lista.push({ num: i.toString().padStart(3, '0'), planta: r.planta });
                }
            });
        }
        return lista;
    },

    /**
     * FORMATEAR DINERO (Euros)
     * Convierte un número en una cadena legible: "5" -> "5.00€"
     */
    formatCurrency: (amount) => {
        const num = parseFloat(amount);
        if (isNaN(num)) return "0.00€";
        const sign = num < 0 ? "-" : "";
        return sign + Math.abs(num).toFixed(2) + "€";
    },

    /**
     * OBTENER FECHA HOY (ISO)
     * Devuelve la fecha actual como "YYYY-MM-DD", ideal para campos de tipo date.
     */
    getTodayISO: () => {
        // Fix: Use local date instead of UTC
        const local = new Date();
        local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
        return local.toISOString().split('T')[0];
    },

    /**
     * FORMATEAR FECHA PARA LEER
     * Convierte "2024-05-20" en "20/05/2024" para que sea más humano.
     */
    formatDate: (dateStr) => {
        if (!dateStr) return "";
        try {
            if (dateStr instanceof Date) return dateStr.toLocaleDateString();
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            return dateStr;
        } catch (e) {
            return dateStr;
        }
    },

    /**
     * COPIAR AL PORTAPAPELES
     * Permite copiar texto (o HTML) para pegarlo luego en Word o Excel.
     */
    copyToClipboard: async (text, html = null) => {
        try {
            if (html && typeof ClipboardItem !== 'undefined') {
                const blobHtml = new Blob([html], { type: "text/html" });
                const blobText = new Blob([text], { type: "text/plain" });
                const data = [new ClipboardItem({ "text/html": blobHtml, "text/plain": blobText })];
                await navigator.clipboard.write(data);
            } else {
                await navigator.clipboard.writeText(text);
            }
            return true;
        } catch (err) {
            console.error("Error al copiar al portapapeles:", err);
            return false;
        }
    },

    /**
     * VALIDAR USUARIO (Recepción)
     * Comprueba que haya alguien identificado antes de permitir guardar cambios.
     */
    validateUser: () => {
        const user = sessionService.getUser();
        if (!user) {
            alert("⚠️ No hay usuario seleccionado. Selecciona tu nombre en el menú superior.");
            return null;
        }
        return user;
    },

    /**
     * FUNCIÓN DE IMPRESIÓN
     * Prepara una sección y abre la ventana de impresión del navegador.
     */
    printSection: (dateElementId, userElementId, userName) => {
        const now = new Date();
        const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (dateElementId) {
            const el = document.getElementById(dateElementId);
            if (el) el.innerText = dateStr;
        }

        if (userElementId && userName) {
            const el = document.getElementById(userElementId);
            if (el) el.innerText = userName;
        }

        window.print();
    },

    /**
     * OBTENER VALOR DE INPUT
     */
    getVal: (id) => {
        const el = document.getElementById(id);
        return el ? el.value : "";
    },

    /**
     * ASIGNAR VALOR A INPUT
     * Forma segura de cambiar el contenido de un campo de texto comprobando si existe.
     */
    setVal: (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    },

    /**
     * ASIGNAR HTML A ELEMENTO
     */
    setHtml: (id, html) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    },

    /**
     * MOSTRAR/OCULTAR CONTRASEÑA
     * Cambia entre 'password' (puntos) y 'text' (letras) para ver una clave.
     */
    togglePassword: (id) => {
        const input = document.getElementById(id);
        if(!input) return;
        input.type = input.type === "password" ? "text" : "password";
    },

    /**
     * CONVERTIR ARCHIVO A BASE64
     */
    fileToBase64: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    },

    /**
     * VERIFICAR SOLAPAMIENTO DE HORARIOS
     */
    checkOverlap: (startA, endA, startB, endB) => {
        return (startA < endB) && (startB < endA);
    }
};
