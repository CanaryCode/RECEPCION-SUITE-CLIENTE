import { Utils } from '../core/Utils.js';
import { Ui } from '../core/Ui.js';

/**
 * MÓDULO DE TIEMPO (tiempo.js)
 * ----------------------------
 * Visualiza e imprime el PDF del tiempo de eltiempo.es
 */

let moduloInicializado = false;

export function inicializarTiempo() {
    if (moduloInicializado) return;

    console.log("Modulo Tiempo inicializado");

    // No validamos usuario al inicializar para evitar la alerta al arrancar la app.
    // Solo actualizamos el nombre si ya hay alguien en sesión.
    const user = sessionService.getUser ? sessionService.getUser() : null;
    if (user) {
        const el = document.getElementById('print-repc-nombre-tiempo');
        if (el) el.textContent = user;
    }

    // Timer de seguridad: si en 5 segundos no parece haber cargado, mostramos el fallback
    setTimeout(() => {
        const iframe = document.getElementById('iframe-tiempo');
        const fallback = document.getElementById('tiempo-fallback');
        if (iframe && fallback) {
            try {
                // Si no podemos acceder al contenido (CORS), es probable que esté bloqueado o cargando
                // Pero si el iframe tiene altura 0 o algo raro, mostramos el botón
                if (!iframe.offsetHeight || iframe.offsetHeight < 100) {
                    fallback.classList.remove('d-none');
                }
            } catch (e) {
                // Ignorar error de CORS
            }
        }
    }, 5000);

    moduloInicializado = true;
}

/**
 * Actualiza el iframe del tiempo
 */
window.actualizarTiempo = () => {
    const iframe = document.getElementById('iframe-tiempo');
    if (iframe) {
        const currentSrc = iframe.src.split('?')[0];
        iframe.src = `${currentSrc}?t=${Date.now()}`;
        Ui.showToast("Recargando pronóstico del tiempo...", "info");
    }
};

/**
 * Imprime la sección del tiempo
 */
window.imprimirTiempo = () => {
    const user = Utils.validateUser();
    if (!user) return;

    // Ponemos la fecha actual en el reporte de impresión
    const printDate = document.getElementById('print-date-tiempo');
    if (printDate) {
        printDate.textContent = Utils.formatDate(Utils.getTodayISO());
    }

    // Usamos el servicio de impresión si está disponible o el estándar
    if (window.PrintService) {
        PrintService.printElement('tiempo-content-wrapper', `El Tiempo - Santa Cruz de Tenerife - ${Utils.getTodayISO()}`);
    } else {
        window.print();
    }
};
