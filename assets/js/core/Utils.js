import { APP_CONFIG } from './Config.js';
import { sessionService } from '../services/SessionService.js';

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
     * PARSER GENÉRICO DE FECHAS (Standardizer)
     * Intenta convertir cualquier entrada (string, Date, timestamp) en formato "YYYY-MM-DD" LOCAL.
     * Soporta formatos: "YYYY-MM-DD", "DD/MM/YYYY", Date objects, Timestamps.
     * @param {any} input - La fecha a parsear.
     * @returns {string} - Fecha en formato "YYYY-MM-DD" o cadena vacía si falla.
     */
    parseDate: (input) => {
        if (!input) return "";
        
        let date;

        if (input instanceof Date) {
            date = input;
        } else if (typeof input === 'number') {
            date = new Date(input);
        } else if (typeof input === 'string') {
            input = input.trim();
            if (!input) return "";

            // Formato DD/MM/YYYY (Español)
            if (input.includes('/')) {
                const parts = input.split('/');
                if (parts.length === 3) {
                    date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                }
            } 
            // Formato YYYY-MM-DD (ISO / Input Date)
            else if (input.includes('-')) {
                // Forzar parseo local para evitar desfases de zona horaria (ISO sin T suele interpretarse como UTC)
                const parts = input.split('-');
                if (parts.length === 3) {
                    date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                }
            }
            // Timestamp como string numeric
            else if (/^\d+$/.test(input)) {
                date = new Date(parseInt(input));
            }
        }

        if (!date || isNaN(date.getTime())) {
            console.warn(`[Utils] parseDate: No se pudo parsear '${input}'`);
            return "";
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    },

    /**
     * FORMATEAR FECHA PARA LEER
     * Convierte cualquier formato de fecha en "DD/MM/YYYY" para que sea más humano.
     */
    formatDate: (input) => {
        const iso = Utils.parseDate(input);
        if (!iso) return "";
        const parts = iso.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
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
    },

    /**
     * COMPRIMIR IMAGEN (Base64)
     * Redimensiona y comprime una imagen usando un Canvas para reducir peso.
     * @param {File} file - El objeto File de la imagen.
     * @param {Object} options - Opciones: maxWidth, maxHeight, quality.
     * @returns {Promise<string>} - Base64 de la imagen comprimida.
     */
    compressImage(file, { maxWidth = 800, maxHeight = 800, quality = 0.7 } = {}) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    },

    /**
     * OBTENER NÚMERO DE SEMANA ISO
     * Calcula el número de la semana actual según el estándar ISO-8601.
     */
    getWeekNumber: (d) => {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return weekNo;
    }
};
