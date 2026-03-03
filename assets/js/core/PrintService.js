/**
 * SERVICIO CENTRALIZADO DE IMPRESIÓN (PrintService)
 * -------------------------------------------------
 * Gestiona la impresión de documentos HTML limpios utilizando la estrategia
 * de "Iframe Aislado" (Isolated Iframe).
 * 
 * PROBLEMA RESUELTO:
 * Los estilos globales de la aplicación (Bootstrap, Layouts, etc.) interferían
 * con la impresión, causando márgenes erróneos, escalas diminutas y elementos
 * superpuestos.
 * 
 * SOLUCIÓN:
 * Este servicio crea un iframe temporal, inyecta solo el HTML/CSS necesario
 * para el reporte, y lanza la impresión desde ese entorno "limpio".
 * 
 * @module PrintService
 */

const PrintService = {

    /**
     * Imprime un documento HTML completo proporcionado como cadena.
     * Ideal para reportes complejos generados manualmente (ej: Cierre de Caja).
     * 
     * @param {string} htmlContent - El código HTML completo (<!DOCTYPE html>...</html>).
     */
    printHTML: function(htmlContent) {
        // 1. Limpiar iframes previos si existen (evita fugas de memoria)
        this._cleanIframe();

        // 2. Crear el iframe oculto
        const iframe = document.createElement('iframe');
        iframe.id = 'print-service-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        // 3. Escribir el contenido
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(htmlContent);
        doc.close();

        // 4. Esperar carga y lanzar impresión
        // Usamos un pequeño timeout para asegurar que recursos (si los hubiera) se procesen,
        // aunque en HTML puro es casi instantáneo.
        setTimeout(() => {
            if (iframe.contentWindow) {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }
            
            // 5. Programar limpieza tras un tiempo prudencial
            // (El usuario tarda unos segundos en interactuar con el diálogo de impresión)
            setTimeout(() => {
                this._cleanIframe();
            }, 60000); // 1 minuto de vida al iframe
        }, 500);
    },

    /**
     * Imprime el contenido de un elemento específico del DOM (ej: una tabla).
     * Envuelve el contenido en una plantilla estándar A4 con título y logo opcional.
     * 
     * @param {string} elementId - ID del elemento DOM a imprimir.
     * @param {string} title - Título que aparecerá en la cabecera del impreso.
     * @param {object} options - Opciones adicionales (landscape, firma, etc.) - TBD.
     */
    printElement: function(elementId, title = "Reporte de Impresión") {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error(`PrintService: Elemento #${elementId} no encontrado.`);
            return;
        }

        const session = window.sessionService || null;
        const user = session ? session.getUser() : null;
        const userName = user ? (typeof user === 'string' ? user : user.nombre) : "---";
        const dateStr = new Date().toLocaleDateString('es-ES', { 
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' 
        });

        // Plantilla HTML Estándar con Estilos Avanzados de Impresión
        const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <!-- RESTAURAR FIDELIDAD: Enlaces CSS del sistema -->
            <link href="assets/vendor/bootstrap.min.css" rel="stylesheet" />
            <link rel="stylesheet" href="assets/vendor/bootstrap-icons.css" />
            <link rel="stylesheet" href="assets/css/styles.css?v=V156_UNIFIED" />
            <link rel="stylesheet" href="assets/css/layout_fix.css?v=V156_UNIFIED" />
            <style>
                /* Forzar estilos de impresión de Bootstrap */
                @page { margin: 15mm; size: auto; }
                body { 
                    font-family: 'Inter', 'Segoe UI', Arial, sans-serif; 
                    color: #000; 
                    background: #fff !important; 
                    margin: 0; 
                    padding: 0;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                
                /* Cabecera Estándar */
                .print-header { border-bottom: 2px solid #0d6efd; margin-bottom: 20px; padding-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-end; }
                .print-header h1 { margin: 0; font-size: 18pt; color: #0d6efd; text-transform: uppercase; letter-spacing: 1px; }
                .print-header .meta { font-size: 9pt; text-align: right; color: #555; }
                
                /* Estilos para Tablas */
                table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 10pt; }
                th, td { padding: 10px 8px; border-bottom: 1px solid #dee2e6; text-align: left; }
                th { background-color: #f8f9fa !important; font-weight: bold; border-bottom: 2px solid #dee2e6; }
                
                /* --- REFINAMIENTOS ESPECÍFICOS --- */

                /* 1. NOTAS PERMANENTES */
                .post-it { 
                    border: 1px solid rgba(0,0,0,0.1) !important;
                    box-shadow: none !important;
                    transform: none !important; /* Quitar rotación en papel */
                    break-inside: avoid;
                    margin-bottom: 15px;
                }
                .note-yellow { background-color: #fff740 !important; }
                .note-pink   { background-color: #ff7eb9 !important; }
                .note-blue   { background-color: #7afcff !important; }
                .note-green  { background-color: #c7f464 !important; }
                .note-orange { background-color: #ffb347 !important; }
                
                /* 2. RACK DE HABITACIONES - DISEÑO PREMIUM PARA IMPRESIÓN */
                #rack-grid-container, #rack-habitaciones, #rack-desp-habitaciones, #atenciones-rack {
                    display: grid !important;
                    grid-template-columns: repeat(5, 1fr) !important; /* 5 columnas fijas para A4 */
                    gap: 12px !important;
                    width: 100% !important;
                }
                .room-card, .rack-box { 
                    border: 1.5px solid #dee2e6 !important;
                    box-shadow: none !important;
                    break-inside: avoid;
                    width: 100% !important;
                    height: 100px !important;
                    display: flex !important;
                    flex-direction: column !important;
                    border-radius: 10px !important;
                    position: relative !important;
                    overflow: hidden !important;
                    background-color: #fff !important;
                }
                
                /* "Header" de la tarjeta (Número de habitación) */
                .room-card h4, .rack-box { 
                    font-size: 18pt !important; 
                    font-weight: 800 !important; 
                    margin: 0 !important; 
                    padding: 8px 0 !important;
                    width: 100% !important;
                    text-align: center !important;
                    border-bottom: 1px solid rgba(0,0,0,0.05) !important;
                }
                
                .room-card .card-body { 
                    padding: 4px !important; 
                    flex-grow: 1 !important;
                    display: flex !important;
                    flex-direction: column !important;
                    justify-content: center !important;
                    align-items: center !important;
                }

                /* Layout de iconos y vista */
                .room-card .d-flex { 
                    gap: 6px !important; 
                    justify-content: center !important;
                    align-items: center !important;
                }
                
                /* Colores de fondo forzados para impresión con mejor contraste */
                .bg-danger-subtle { background-color: #fff5f5 !important; border-color: #feb2b2 !important; }
                .bg-primary-subtle { background-color: #f0f7ff !important; border-color: #bee3f8 !important; }
                .bg-warning-subtle { background-color: #fffaf0 !important; border-color: #fbd38d !important; }
                .bg-success-subtle { background-color: #f0fff4 !important; border-color: #9ae6b4 !important; }
                
                /* Colores de Rack Simplificados y Elegantes */
                .bg-primary { background-color: #2b6cb0 !important; color: white !important; }
                .bg-warning { background-color: #ecc94b !important; color: #744210 !important; }
                .bg-danger  { background-color: #c53030 !important; color: white !important; }
                .bg-success { background-color: #2f855a !important; color: white !important; }
                .bg-info    { background-color: #3182ce !important; color: white !important; }
                .bg-white   { background-color: #ffffff !important; border: 1.5px solid #e2e8f0 !important; }
                
                /* Badges y Detalles pequeños */
                .badge { 
                    display: inline-block !important;
                    padding: 3px 6px !important;
                    font-size: 7.5pt !important;
                    font-weight: 700 !important;
                    border-radius: 4px !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.5px !important;
                }
                
                .badge.position-absolute {
                    width: auto !important;
                    min-width: 60% !important;
                    top: 2px !important;
                }
                
                /* Iconos */
                .bi { font-size: 11pt !important; }
                .text-primary { color: #2b6cb0 !important; }
                .text-info    { color: #3182ce !important; }
                .text-warning { color: #d69e2e !important; }
                .text-danger  { color: #c53030 !important; }
                .text-success { color: #2f855a !important; }
                .text-muted   { color: #718096 !important; }

                /* Utilidades y Bootstrap Print Support */
                .text-end { text-align: right; }
                .text-center { text-align: center; }
                .fw-bold { font-weight: bold !important; }
                .text-muted { color: #6c757d !important; }
                
                .d-none { display: none !important; }
                .d-print-block { display: block !important; }
                .d-print-inline-block { display: inline-block !important; }
                .d-print-none, .no-print, .dropdown, .btn, button { display: none !important; }
                
                .animate__animated { animation: none !important; }
            </style>
        </head>
        <body>
            <div class="print-header">
                <div>
                    <h1>${title}</h1>
                    <div style="font-size: 10pt; color: #777;">Reception Suite - Hotel Garoé</div>
                </div>
                <div class="meta">
                    <div>Impreso: ${dateStr}</div>
                    <div>Por: ${userName}</div>
                </div>
            </div>

            <div class="print-content">
                ${element.outerHTML}
            </div>
            
            <div style="margin-top: 40px; font-size: 8pt; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 10px;">
                Documento generado por Reception Suite • La excelencia en gestión hotelera
            </div>
        </body>
        </html>
        `;

        this.printHTML(html);
    },

    /**
     * Captura un elemento como imagen (usando html2canvas) y lo imprime.
     * Ideal para racks y vistas visuales que deben verse idénticas a la pantalla.
     * 
     * @param {string} elementId - ID del elemento a capturar.
     * @param {string} title - Título del reporte.
     */
    printElementAsImage: async function(elementId, title = "Captura de Pantalla") {
        const imgData = await this.captureElement(elementId);
        if (!imgData) return;
        
        // 2. Generar HTML minimalista (una página limpia con la foto)
            const html = `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <title>${title}</title>
                <!-- RESTAURAR FIDELIDAD: Enlaces CSS para que la foto tenga los mismos iconos/estilos -->
                <link href="assets/vendor/bootstrap.min.css" rel="stylesheet" />
                <link rel="stylesheet" href="assets/vendor/bootstrap-icons.css" />
                <link rel="stylesheet" href="assets/css/styles.css?v=V156_UNIFIED" />
                <style>
                    @page { margin: 5mm; size: A4 landscape; }
                    body { 
                        margin: 0; 
                        padding: 15px; 
                        display: flex; 
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        font-family: 'Inter', sans-serif;
                        background-color: #ffffff;
                        height: 100vh;
                        box-sizing: border-box;
                    }
                    .header {
                        width: 100%;
                        border-bottom: 2px solid #333;
                        margin-bottom: 15px;
                        padding-bottom: 8px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        flex-shrink: 0;
                    }
                    h1 { margin: 0; font-size: 14pt; color: #333; font-weight: 800; }
                    .date { font-size: 9pt; color: #666; }
                    
                    /* AJUSTE DIN A4: Forzar que la imagen quepa siempre */
                    img { 
                        display: block;
                        max-width: 100%; 
                        max-height: calc(100vh - 80px); 
                        width: auto;
                        height: auto;
                        object-fit: contain;
                        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                        border: 1px solid #ddd;
                        border-radius: 8px;
                    }
                </style>
                </head>
                <body>
                    <div class="header">
                        <h1>${title}</h1>
                        <div class="date">${new Date().toLocaleString()}</div>
                    </div>
                    <img src="${imgData}" />
                </body>
                </html>
            `;


            this.printHTML(html);
    },

    /**
     * Captura un elemento y devuelve su representación en Base64.
     * 
     * @param {string|HTMLElement} elementOrId - Elemento o su ID.
     * @returns {Promise<string|null>} - DataURL de la imagen o null si falla.
     */
    captureElement: async function(elementOrId) {
        const element = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
        if (!element) return null;

        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });
            return canvas.toDataURL('image/png');
        } catch (error) {
            console.error("PrintService: Error capturando elemento:", error);
            return null;
        }
    },

    /**
     * Imprime múltiples páginas (imágenes o HTML), una por hoja.
     * Soporta array de strings (URLs de imagen) o objetos { type: 'image'|'html', content: '...' }
     * 
     * @param {Array<string|object>} items - Lista de ítems a imprimir.
     * @param {string} title - Título del reporte.
     */
    printMultiImage: function(items, title = "Reporte Multi-Página") {
        if (!items || items.length === 0) return;

        const html = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <link href="assets/vendor/bootstrap.min.css" rel="stylesheet" />
                <link rel="stylesheet" href="assets/vendor/bootstrap-icons.css" />
                <link rel="stylesheet" href="assets/css/styles.css?v=V156_UNIFIED" />
                <style>
                    @page { margin: 10mm; size: A4 landscape; }
                    body { margin: 0; padding: 0; background: #fff; }
                    .page-wrapper {
                        height: 100vh;
                        width: 100%;
                        display: flex;
                        flex-direction: column;
                        padding: 10px;
                        box-sizing: border-box;
                        page-break-after: always;
                    }
                    .page-wrapper:last-child { page-break-after: auto; }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 2px solid #333;
                        padding-bottom: 5px;
                        margin-bottom: 10px;
                        flex-shrink: 0;
                    }
                    h1 { margin: 0; font-size: 14pt; }
                    .meta { font-size: 9pt; color: #666; }
                    
                    .content-wrapper {
                        flex-grow: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: hidden;
                        position: relative;
                    }
                    img {
                        max-width: 100%;
                        max-height: 100%;
                        object-fit: contain;
                    }
                    .html-content {
                        width: 100%;
                        height: 100%;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                    }
                </style>
            </head>
            <body>
                ${items.map((item, idx) => {
                    let contentHtml = '';
                    if (typeof item === 'string') {
                        // Assume image URL
                        contentHtml = `<img src="${item}" />`;
                    } else if (typeof item === 'object') {
                        if (item.type === 'html') {
                            contentHtml = `<div class="html-content">${item.content}</div>`;
                        } else {
                            // Default to image
                            contentHtml = `<img src="${item.content || item.src}" />`;
                        }
                    }

                    return `
                    <div class="page-wrapper">
                        <div class="header">
                            <h1>${title} - Parte ${idx + 1}</h1>
                            <div class="meta">${new Date().toLocaleString()}</div>
                        </div>
                        <div class="content-wrapper">
                            ${contentHtml}
                        </div>
                    </div>
                    `;
                }).join('')}
            </body>
            </html>
        `;

        this.printHTML(html);
    },

    /**
     * Método interno para limpiar el iframe del DOM.
     * @private
     */
    _cleanIframe: function() {
        const existing = document.getElementById('print-service-iframe');
        if (existing) {
            document.body.removeChild(existing);
        }
    }
};

// Exportar globalmente
window.PrintService = PrintService;
