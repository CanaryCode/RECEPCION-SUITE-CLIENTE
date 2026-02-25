import { APP_CONFIG } from './Config.js?v=V145_VAL_FIX';
import { Utils } from './Utils.js';

/**
 * SERVICIO DE GENERACIÓN DE PDF (PdfService)
 * -----------------------------------------
 * Centraliza la creación de informes profesionales en PDF.
 * Utiliza html2pdf.js y aplica una estética estandarizada del hotel.
 */
export const PdfService = {
    
    /**
     * GENERAR REPORTE ESTÁNDAR
     * @param {Object} options 
     * @param {string} options.title - Título del reporte
     * @param {string} options.author - Nombre del recepcionista o autor
     * @param {string} options.htmlContent - Contenido HTML del cuerpo del reporte
     * @param {string} options.filename - Nombre de archivo sugerido (.pdf)
     * @param {Object} [options.metadata] - Datos adicionales para la cabecera (Fecha, Turno, etc.)
     */
    async generateReport({ title, author, htmlContent, element, filename, metadata = {}, outputType = 'save' }) {
        if (typeof html2pdf === 'undefined') {
            console.error("html2pdf.js no está cargado.");
            return;
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const hotelName = APP_CONFIG.HOTEL?.NOMBRE || "HOTEL GAROÉ";

        // 1. Construir el HTML completo como STRING (Evita fugas de CSS y PDFs en blanco)
        // Incluimos Bootstrap y estilos globales para fidelidad visual total
        const baseStyles = `
            <link rel="stylesheet" href="assets/vendor/bootstrap.min.css">
            <link rel="stylesheet" href="assets/vendor/bootstrap-icons.css">
            <link rel="stylesheet" href="assets/css/styles.css">
            <style>
                body { background: white !important; }
                .pdf-root { font-family: 'Inter', Arial, sans-serif; color: #333; padding: 0; margin: 0; background: white; }
                .pdf-report-body { padding: 10mm; margin: 0; background: white; }
                /* Forzar visibilidad de badges y tablas en el PDF */
                .badge { border: 1px solid #ddd; }
                table { width: 100% !important; border-collapse: collapse; margin-bottom: 1rem; }
                th, td { padding: 8px; border-bottom: 1px solid #dee2e6; text-align: left; }
                .bg-riu-class { background-color: #0d6efd !important; color: white !important; }
                .bg-riu-oro { background-color: #ffc107 !important; color: black !important; }
                .bg-riu-diamante { background-color: #212529 !important; color: white !important; }
            </style>
        `;

        const footerHtml = `
                <div style="margin-top: 20px; padding-top: 5px; border-top: 1px solid #eee; font-size: 7pt; color: #bbb; display: flex; justify-content: space-between; font-family: sans-serif;">
                    <span>Generado por Recepción Suite v5.0</span>
                    <span>Página 1 de 1</span>
                </div>
            </div>
        `;

        let finalBodyHtml = "";
        if (element) {
            // Si nos pasan un elemento, lo usamos directamente (ya viene clonado/limpio de ser necesario)
            finalBodyHtml = element.innerHTML;
        } else {
            finalBodyHtml = htmlContent || "";
        }

        const unifiedHtml = `<div class="pdf-root">${baseStyles}<div class="pdf-report-body">${finalBodyHtml}</div>${footerHtml}</div>`;

        // 2. Configuración de html2pdf
        // Optimización: Limpieza de tooltips antes de generar
        if (Ui.hideAllTooltips) Ui.hideAllTooltips();
        
        const opt = {
            margin: [5, 10, 10, 10], 
            filename: filename || `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2, 
                useCORS: true,
                letterRendering: false, 
                logging: false,
                backgroundColor: '#ffffff',
                ignoreElements: (node) => {
                    return node.tagName === 'IFRAME'; 
                }
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true }
        };

        // 3. Ejecutar generación directamente desde STRING
        try {
            const worker = html2pdf().set(opt).from(unifiedHtml);

            if (outputType === 'blob' || outputType === 'base64') {
                const pdfBlob = await worker.output('blob');
                
                if (outputType === 'blob') return pdfBlob;

                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = reader.result.split(',')[1];
                        resolve(base64);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(pdfBlob);
                });
            }

            await worker.save();
            return true;
        } catch (err) {
            console.error("Error al generar PDF:", err);
            return false;
        }
    }
};
