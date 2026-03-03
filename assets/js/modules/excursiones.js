import { Utils } from "../core/Utils.js";
import { Ui } from "../core/Ui.js";
import { APP_CONFIG } from "../core/Config.js";
import { excursionService } from "../services/ExcursionService.js";

/**
 * MÓDULO DE EXCURSIONES Y TICKETS (excursiones.js)
 * ----------------------------------------------
 * Gestiona la interfaz de venta, catálogo e historial.
 */

let moduleInitialized = false;
let currentSummaryData = {
    total: 0,
    producto: null
};

export const Excursiones = {
    async init() {
        if (moduleInitialized) return;

        await excursionService.init();
        this.renderInterface();
        this.setupEvents();
        
        moduleInitialized = true;
        Ui.attachRoomValidator('exc_habitacion', { allowEmpty: false });
    },

    /**
     * Render principal
     */
    renderInterface() {
        this.limpiarFormulario();
        
        // Setup View Toggles
        Ui.setupViewToggle({
            buttons: [
                { id: 'btnExcursionesVistaVenta', viewId: 'excursiones-venta' },
                { id: 'btnExcursionesVistaLista', viewId: 'excursiones-lista', onShow: () => this.refreshData() }
            ]
        });

        this.updateCatalogSelect();
        this.refreshData();
    },

    /**
     * Cargar opciones del catálogo
     */
    updateCatalogSelect() {
        const select = document.getElementById('exc_tipo_id');
        if (!select) return;

        // Limpiar excepto el primero
        select.innerHTML = '<option value="" selected disabled>Seleccione una opción...</option>';
        
        const catalogo = APP_CONFIG.EXCURSIONES_CATALOGO || [];
        catalogo.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.nombre} (${item.precioAdulto}€ / ${item.precioNiño || 0}€)`;
            select.appendChild(option);
        });
    },

    /**
     * Configurar eventos de la interfaz
     */
    setupEvents() {
        // Al cambiar el producto
        const select = document.getElementById('exc_tipo_id');
        if (select) {
            select.addEventListener('change', () => this.calculateTotal());
        }

        // Al cambiar cantidades
        ['exc_adultos', 'exc_ninos', 'exc_grupos'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.calculateTotal());
        });

        // Buscador
        const searchInput = document.getElementById('search-excursiones');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterVentas(e.target.value));
        }

        // Form Submission
        let shouldPrint = false;

        Ui.handleFormSubmission({
            formId: 'formExcursionVenta',
            service: excursionService,
            idField: 'exc_id',
            serviceIdField: 'id',
            mapData: (data) => {
                const autor = Utils.validateUser();
                if (!autor) return null;

                // Capturamos la preferencia de impresión antes de que el formulario se resetee
                shouldPrint = document.getElementById('exc_imprimir_ticket')?.checked;

                const esExterno = document.getElementById('exc_es_externo').checked;
                const huesped = esExterno ? data.exc_nombre_externo : data.exc_huesped;
                const hab = esExterno ? 'EXTERNO' : data.exc_habitacion;

                if (!huesped) {
                    Ui.showToast("El nombre del huésped o cliente es obligatorio", "warning");
                    return null;
                }

                return {
                    id: data.exc_id || '',
                    tipoId: data.exc_tipo_id,
                    huesped: huesped,
                    habitacion: hab,
                    externo: esExterno,
                    fechaExcursion: Utils.parseDate(data.exc_fecha_actividad),
                    adultos: parseInt(data.exc_adultos) || 0,
                    niños: parseInt(data.exc_ninos) || 0,
                    grupos: parseInt(data.exc_grupos) || 0,
                    total: parseFloat(currentSummaryData?.total) || 0,
                    estado: data.exc_estado,
                    comments: document.getElementById('exc_comments')?.value || "",
                    vendedor: autor
                };
            },
            onSuccess: async (id, data) => {
                // Obtenemos la venta real para asegurar que tiene ID y fecha generados por el servicio
                const ventas = await excursionService.getVentas();
                const ventaReal = ventas.find(v => v.id === id) || { ...data, id };

                if (shouldPrint) {
                    this.imprimirTicket(ventaReal);
                }

                this.limpiarFormulario();
                this.refreshData();
                Ui.showToast("Venta registrada correctamente.", "success");
            }
        });

        window.Excursiones = this; // Para ajustes de Qty desde el HTML
    },

    /**
     * UI Externo
     */
    toggleExterno(isExterno) {
        const wrapHuesped = document.getElementById('wrap_exc_nombre_huesped');
        const wrapExterno = document.getElementById('wrap_exc_nombre_externo');
        const inputHab = document.getElementById('exc_habitacion');

        if (isExterno) {
            if (wrapHuesped) wrapHuesped.classList.add('d-none');
            if (wrapExterno) wrapExterno.classList.remove('d-none');
            if (inputHab) {
                inputHab.disabled = true;
                inputHab.value = 'EXTERNO';
                inputHab.required = false;
            }
        } else {
            if (wrapHuesped) wrapHuesped.classList.remove('d-none');
            if (wrapExterno) wrapExterno.classList.add('d-none');
            if (inputHab) {
                inputHab.disabled = false;
                if (inputHab.value === 'EXTERNO') inputHab.value = '';
                inputHab.required = true;
            }
        }
        
        // Recalcular para asegurar que currentSummaryData no sea null y el total sea correcto
        this.calculateTotal(); 
    },

    /**
     * Ajustar cantidades (+1 / -1)
     */
    adjustQty(id, delta) {
        const input = document.getElementById(id);
        if (!input) return;
        let val = parseInt(input.value) || 0;
        val += delta;
        if (val < 0) val = 0;
        input.value = val;
        this.calculateTotal();
    },

    /**
     * Calcular total en tiempo real
     */
    calculateTotal() {
        const tipoId = document.getElementById('exc_tipo_id').value;
        const adultos = parseInt(document.getElementById('exc_adultos').value) || 0;
        const ninos = parseInt(document.getElementById('exc_ninos').value) || 0;
        const grupos = parseInt(document.getElementById('exc_grupos').value) || 0;
        
        const catalog = APP_CONFIG.EXCURSIONES_CATALOGO || [];
        const producto = catalog.find(c => c.id === tipoId);

        const emptyMsg = document.getElementById('exc_summary_empty');
        const content = document.getElementById('exc_summary_content');

        if (!producto) {
            if (emptyMsg) emptyMsg.classList.remove('d-none');
            if (content) content.classList.add('d-none');
            return;
        }

        if (emptyMsg) emptyMsg.classList.add('d-none');
        if (content) content.classList.remove('d-none');

        const subtotalAdultos = adultos * (producto.precioAdulto || 0);
        const subtotalNinos = ninos * (producto.precioNiño || 0);
        const subtotalGrupos = grupos * (producto.precioGrupo || 0);
        const total = subtotalAdultos + subtotalNinos + subtotalGrupos;

        currentSummaryData = { total, producto };

        // Actualizar UI del resumen
        Utils.setHtml('summary_nombre', producto.nombre);
        Utils.setHtml('summary_operador', producto.operador || 'N/A');
        
        // Adultos
        const adRow = document.getElementById('summary_adultos_row'); // Note: I should add this ID or just use setHtml if it exists
        Utils.setHtml('summary_adultos_label', `Adultos (${adultos} x ${producto.precioAdulto}€):`);
        Utils.setHtml('summary_adultos_subtotal', `${subtotalAdultos.toFixed(2)}€`);
        
        // Niños
        const ninosRow = document.getElementById('summary_ninos_row');
        if (ninosRow) {
            if (ninos > 0) {
                ninosRow.classList.remove('d-none');
                Utils.setHtml('summary_ninos_label', `Niños (${ninos} x ${producto.precioNiño || 0}€):`);
                Utils.setHtml('summary_ninos_subtotal', `${subtotalNinos.toFixed(2)}€`);
            } else {
                ninosRow.classList.add('d-none');
            }
        }

        // Grupos
        const gruposRow = document.getElementById('summary_grupos_row');
        if (gruposRow) {
            if (grupos > 0) {
                gruposRow.classList.remove('d-none');
                Utils.setHtml('summary_grupos_label', `Grupos (${grupos} x ${producto.precioGrupo || 0}€):`);
                Utils.setHtml('summary_grupos_subtotal', `${subtotalGrupos.toFixed(2)}€`);
            } else {
                gruposRow.classList.add('d-none');
            }
        }

        Utils.setHtml('summary_total', `${total.toFixed(2)}€`);
    },

    /**
     * Cargar datos del histórico
     */
    async refreshData() {
        const ventas = await excursionService.getVentas();
        this.renderVentas(ventas);
    },

    renderVentas(ventas) {
        const container = document.getElementById('table-excursiones-ventas');
        const empty = document.getElementById('empty-excursiones-list');
        if (!container) return;

        if (!ventas.length) {
            container.innerHTML = '';
            if (empty) empty.classList.remove('d-none');
            return;
        }

        if (empty) empty.classList.add('d-none');

        const catalogo = APP_CONFIG.EXCURSIONES_CATALOGO || [];

        // Ordenar por fecha de venta (descendente)
        ventas.sort((a,b) => new Date(b.fechaVenta) - new Date(a.fechaVenta));

        container.innerHTML = ventas.map(v => {
            const producto = catalogo.find(c => c.id === v.tipoId) || { nombre: 'Descatalogado' };
            const statusClass = v.estado === 'Cobrado' ? 'bg-success-subtle text-success border-success' : 'bg-warning-subtle text-warning border-warning';
            
            // Layout optimizado para Proforma (evitando 'elementos de trabajo' pesados en impresión)
            const displayHab = v.externo 
                ? `<div class="fw-bold text-danger"><i class="bi bi-person-walking me-1"></i>EXTERNO</div>`
                : `<span class="badge bg-light text-dark border">${v.habitacion}</span>`;

            return `
            <tr>
                <td class="small text-muted">${new Date(v.fechaVenta).toLocaleDateString()} <span class="d-print-none text-opacity-50 small">${new Date(v.fechaVenta).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></td>
                <td class="text-center">${displayHab}</td>
                <td class="text-truncate" style="max-width: 150px;">${v.huesped}</td>
                <td>
                    <div class="fw-bold">${producto.nombre}</div>
                    <div class="small text-muted" style="font-size: 0.75rem;">F. Act: ${v.fechaExcursion || '---'}</div>
                </td>
                <td class="text-center">
                    <span class="badge bg-light text-dark border">A: ${v.adultos}</span>
                    ${v.niños > 0 ? `<span class="badge bg-light text-dark border">N: ${v.niños}</span>` : ''}
                    ${v.grupos > 0 ? `<span class="badge bg-light text-primary border">G: ${v.grupos}</span>` : ''}
                </td>
                <td class="text-end fw-bold">${(parseFloat(v.total) || 0).toFixed(2)}€</td>
                <td class="text-center">
                    <span class="badge ${statusClass} border opacity-75" style="font-size: 0.7rem;">${v.estado.toUpperCase()}</span>
                </td>
                <td class="text-end d-print-none">
                    <button class="btn btn-sm btn-outline-secondary" onclick="Excursiones.imprimirTicketById('${v.id}')" title="Imprimir Ticket">
                        <i class="bi bi-printer"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger border-0 ms-1" onclick="Excursiones.borrarVenta('${v.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
    },

    /**
     * Filtrado dinámico
     */
    async filterVentas(term) {
        const query = term.toLowerCase();
        const ventas = await excursionService.getVentas();
        const filtered = ventas.filter(v => 
            v.huesped.toLowerCase().includes(query) || 
            (v.habitacion && v.habitacion.includes(query))
        );
        this.renderVentas(filtered);
    },

    /**
     * Resetear formulario
     */
    limpiarFormulario() {
        const form = document.getElementById('formExcursionVenta');
        if (form) form.reset();
        Utils.setVal('exc_id', '');
        Utils.setVal('exc_fecha_actividad', Utils.getTodayISO());
        Utils.setVal('exc_adultos', '1');
        Utils.setVal('exc_ninos', '0');
        Utils.setVal('exc_grupos', '0');
        document.getElementById('exc_es_externo').checked = false;
        const inputComments = document.getElementById('exc_comments');
        if (inputComments) inputComments.value = '';
        const checkPrint = document.getElementById('exc_imprimir_ticket');
        if (checkPrint) checkPrint.checked = false;
        
        this.toggleExterno(false);
        this.calculateTotal();
    },

    /**
     * IMPRESIÓN DE REPORTE (Listado)
     */
    imprimirReporte() {
        if (window.PrintService) {
            PrintService.printElement('table-excursiones-ventas', `Reporte de Excursiones - ${Utils.getTodayISO()}`);
        } else {
            const user = Utils.validateUser();
            if (!user) return;
            Ui.preparePrintReport({
                dateId: 'print-date-excursiones',
                memberId: 'print-repc-nombre-excursiones',
                memberName: user
            });
            window.print();
        }
    },

    /**
     * EXPORTAR A CSV
     */
    async exportarCSV() {
        const ventas = await excursionService.getVentas();
        if (!ventas.length) return Ui.showToast("No hay datos para exportar", "warning");

        const catalogo = APP_CONFIG.EXCURSIONES_CATALOGO || [];
        const headers = ["ID", "Fecha Venta", "Habitacion", "Huesped", "Excursion", "Adultos", "Ninos", "Total", "Estado", "Vendedor"];
        
        const rows = ventas.map(v => {
            const prod = catalogo.find(c => c.id === v.tipoId)?.nombre || '---';
            return [
                v.id,
                new Date(v.fechaVenta).toLocaleString(),
                v.habitacion,
                `"${v.huesped}"`,
                `"${prod}"`,
                v.adultos,
                v.niños,
                v.total.toFixed(2),
                v.estado,
                v.vendedor
            ];
        });

        Utils.downloadCSV("ventas_excursiones.csv", headers, rows);
    },

    /**
     * IMPRESIÓN DE TICKET
     */
    async imprimirTicketById(id) {
        const ventas = await excursionService.getVentas();
        const venta = ventas.find(v => v.id === id);
        if (venta) this.imprimirTicket(venta);
    },

    imprimirTicket(venta) {
        const catalogo = APP_CONFIG.EXCURSIONES_CATALOGO || [];
        const producto = catalogo.find(c => c.id === venta.tipoId) || { nombre: 'DESCONOCIDO', operador: '---' };

        const ticketHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Ticket Excursión #${venta.id}</title>
                <style>
                    @page { size: 80mm auto; margin: 0; }
                    body { font-family: 'Courier New', monospace; width: 100%; margin: 0; padding: 10px; box-sizing: border-box; font-size: 13px; }
                    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                    .title { font-size: 1.1em; font-weight: bold; margin: 5px 0; }
                    .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
                    .label { font-weight: bold; }
                    .total { font-size: 1.5em; font-weight: bold; text-align: right; margin-top: 10px; border-top: 2px solid #000; padding-top: 5px; }
                    .footer { text-align: center; margin-top: 20px; font-size: 0.8em; font-style: italic; }
                    .status { text-align: center; font-weight: bold; margin: 10px 0; border: 1px solid #000; padding: 2px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>HOTEL GAROÉ</div>
                    <div class="title">TICKET EXCURSIÓN</div>
                    <div>${new Date().toLocaleString()}</div>
                </div>

                <div class="info-row"><span class="label">ID:</span> <span>${venta.id}</span></div>
                <div class="info-row"><span class="label">Vendedor:</span> <span>${venta.vendedor}</span></div>
                <hr style="border-top: 1px dashed #000;">
                
                <div style="font-weight:bold; font-size:1.1em; margin-bottom:5px;">${producto.nombre}</div>
                <div class="info-row"><span class="label">Operador:</span> <span>${producto.operador}</span></div>
                <div class="info-row"><span class="label">Fecha Act:</span> <span>${venta.fechaExcursion}</span></div>
                <div class="info-row"><span class="label">Huésped:</span> <span style="text-align:right">${venta.huesped}</span></div>
                <div class="info-row"><span class="label">Hab:</span> <span>${venta.habitacion}</span></div>

                <hr style="border-top: 1px dashed #000;">
                
                <div class="info-row"><span class="label">Adultos:</span> <span>${venta.adultos}</span></div>
                ${venta.niños > 0 ? `<div class="info-row"><span class="label">Niños:</span> <span>${venta.niños}</span></div>` : ''}
                ${venta.grupos > 0 ? `<div class="info-row"><span class="label">Grupos:</span> <span>${venta.grupos}</span></div>` : ''}

                <div class="total">${parseFloat(venta.total).toFixed(2)}€</div>
                
                <div class="status">${(venta.estado || 'COBRADO').toUpperCase()}</div>

                ${venta.comments ? `<div style="margin-top:10px; font-style:italic;">Nota: ${venta.comments}</div>` : ''}

                <div class="footer">
                    <p>Gracias por su compra.<br>Reception Suite</p>
                </div>
            </body>
            </html>
        `;

        if (window.PrintService) {
            PrintService.printHTML(ticketHTML);
        } else {
            console.warn("PrintService no disponible.");
            alert("No se puede imprimir el ticket.");
        }
    },

    async borrarVenta(id) {
        if (await Ui.showConfirm("¿Seguro que desea eliminar este registro de venta?")) {
            await excursionService.eliminarVenta(id);
            this.refreshData();
            Ui.showToast("Registro eliminado", "info");
        }
    }
};
