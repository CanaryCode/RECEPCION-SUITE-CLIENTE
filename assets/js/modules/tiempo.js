import { Utils } from '../core/Utils.js';
import { Ui } from '../core/Ui.js';

/**
 * MÓDULO DE TIEMPO (tiempo.js)
 * ----------------------------
 * Visualiza e imprime el PDF del tiempo de eltiempo.es (Santa Cruz y Puerto de la Cruz)
 */

let moduloInicializado = false;

export function inicializarTiempo() {
    if (moduloInicializado) return;

    console.log("Modulo Tiempo inicializado");

    const user = Utils.validateUser ? Utils.validateUser() : null;
    if (user) {
        const el = document.getElementById('print-repc-nombre-tiempo');
        if (el) el.textContent = user;
    }

    setTimeout(() => {
        const iframes = document.querySelectorAll('iframe[id^="iframe-tiempo"]');
        const fallback = document.getElementById('tiempo-fallback');
        if (iframes.length > 0 && fallback) {
            let someFailed = false;
            iframes.forEach(iframe => {
                try {
                    if (!iframe.offsetHeight || iframe.offsetHeight < 100) someFailed = true;
                } catch (e) {}
            });
            if (someFailed) fallback.classList.remove('d-none');
        }
    }, 5000);

    moduloInicializado = true;
}

window.actualizarTiempo = () => {
    const iframes = document.querySelectorAll('iframe[id^="iframe-tiempo"]');
    iframes.forEach(iframe => {
        const currentSrc = iframe.src.split('?')[0];
        iframe.src = `${currentSrc}?t=${Date.now()}`;
    });
    Ui.showToast("Recargando pronósticos del tiempo...", "info");
};

/**
 * Imprime la sección del tiempo usando Print.js para evitar páginas en blanco
 */
window.imprimirTiempo = () => {
    const user = Utils.validateUser();
    if (!user) return;

    Ui.showToast("Preparando documentos para impresión...", "info");

    const pdfs = [
        "/api/system/web-proxy?url=" + encodeURIComponent("https://www.eltiempo.es/pdf/santa-cruz-de-tenerife.pdf"),
        "/api/system/web-proxy?url=" + encodeURIComponent("https://www.eltiempo.es/pdf/puerto-de-la-cruz.pdf")
    ];

    // Función recursiva para imprimir uno por uno (Print.js abre un diálogo por PDF)
    const printSequential = (index) => {
        if (index >= pdfs.length) {
            Ui.showToast("Proceso de impresión finalizado", "success");
            return;
        }

        printJS({
            printable: pdfs[index],
            type: 'pdf',
            showModal: true,
            modalMessage: `Preparando PDF ${index + 1} de ${pdfs.length}...`,
            onPrintDialogClose: () => {
                // Pequeña pausa para que el navegador respire antes del siguiente
                setTimeout(() => printSequential(index + 1), 500);
            },
            onError: (err) => {
                console.error("Error imprimiendo PDF:", err);
                Ui.showToast("Error al cargar uno de los PDFs", "danger");
                printSequential(index + 1);
            }
        });
    };

    printSequential(0);
};
