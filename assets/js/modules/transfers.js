/**
 * MÓDULO DE LOGÍSTICA DE TRANSFERS (transfers.js)
 * ----------------------------------------------
 * Gestiona las reservas de taxis, buses o transporte privado para clientes.
 * Permite emitir tickets impresos para el cliente y sincroniza las salidas 
 * del día con el panel de control (Dashboard).
 */

import { Utils } from '../core/Utils.js?v=V145_VAL_FIX';
import { APP_CONFIG } from "../core/Config.js?v=V145_VAL_FIX";
import { Ui } from '../core/Ui.js?v=V145_VAL_FIX';
import { transfersService } from '../services/TransfersService.js?v=V145_VAL_FIX';
import { PdfService } from '../core/PdfService.js?v=V145_VAL_FIX';

let transferParaImprimir = null; // Objeto temporal para el ticket

// ============================================================================
// ============================================================================
// INICIALIZACIÓN
// ============================================================================

export async function inicializarTransfers() {
    await transfersService.init();

    // 0. POBLAR DESTINOS DESDE APP_CONFIG
    const destinoSelect = document.getElementById('transfer_destino_select');
    if (destinoSelect) {
        const destinos = APP_CONFIG.TRANSFERS?.DESTINOS || ["Aeropuerto Norte", "Aeropuerto Sur"];
        // Limpiar opciones previas (excepto el "OTRO" si existe o resetear todo)
        destinoSelect.innerHTML = '<option value="" selected disabled>Seleccionar destino...</option>';
        destinos.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            destinoSelect.appendChild(opt);
        });
        const optOtro = document.createElement('option');
        optOtro.value = 'OTRO';
        optOtro.textContent = 'OTRO (Especificar)';
        destinoSelect.appendChild(optOtro);
    }

    // 1. CONFIGURAR VISTAS (Conmutador)
    Ui.setupViewToggle({
        buttons: [
            { id: 'btnVistaListaTransfers', viewId: 'transfers-lista-view', onShow: mostrarTransfers },
            { id: 'btnVistaFormTransfers', viewId: 'transfers-form-view', onShow: () => {
                // Determine if it's a new transfer or editing
                const isNew = !document.getElementById('transfer_id').value;
                
                if (isNew) {
                    document.getElementById('formTransfer')?.reset();
                    document.getElementById('transfer_id').value = '';
                    document.getElementById('transfer_destino_custom')?.classList.add('d-none');
                    document.getElementById('wrap_transfer_nombre_externo')?.classList.add('d-none');
                    document.getElementById('transfer_hab').required = true;
                    document.getElementById('btnSubmitTransfer').innerHTML = '<i class="bi bi-save-fill me-2"></i>Guardar Reserva';
                }

                // ALWAYS Reapply Date Rules (As requested: "always today" and "no past dates")
                const dateInput = document.getElementById('transfer_fecha');
                if (dateInput) {
                    const today = Utils.getTodayISO();
                    dateInput.value = today;
                    dateInput.min = today;
                }
            }}
        ]
    });

    // 2. CONFIGURAR FORMULARIO (Ui core)
    Ui.handleFormSubmission({
        formId: 'formTransfer',
        service: transfersService,
        idField: 'transfer_id', // Changed from 'id' to match HTML ID
        mapData: (rawData) => {
            const autor = Utils.validateUser();
            if (!autor) return null;

            const id = rawData.transfer_id;
            const selectDestino = document.getElementById('transfer_destino_select');
            const inputDestino = document.getElementById('transfer_destino_custom');
            
            let destino = selectDestino.value;
            if (destino === 'OTRO') {
                destino = inputDestino.value.trim();
            }

            const esExterno = document.getElementById('transfer_externo').checked;
            const habitacionValida = esExterno ? !!rawData.transfer_nombre_cliente : !!rawData.transfer_hab;

            if (!habitacionValida || !destino || !rawData.transfer_hora) {
                const msg = esExterno ? "Rellene Nombre, Hora y Destino." : "Rellene Habitación, Hora y Destino.";
                Ui.showToast(msg, "warning");
                return null;
            }

            const today = Utils.getTodayISO();
            const fechaInput = rawData.transfer_fecha;

            if (fechaInput < today) {
                Ui.showToast("No se permiten reservas en fechas pasadas.", "warning");
                return null;
            }
            
            return {
                transfer_id: id ? parseInt(id) : Date.now(),
                fecha: fechaInput,
                hora: rawData.transfer_hora,
                habitacion: esExterno ? 'EXTERNO' : (rawData.transfer_hab || '000'),
                nombre_cliente: esExterno ? rawData.transfer_nombre_cliente : '',
                externo: esExterno,
                tipo: rawData.transfer_tipo,
                pax: parseInt(rawData.transfer_pax) || 1,
                destino: destino,
                notas: rawData.transfer_notas.trim(),
                autor: autor,
                creadoEn: new Date().toISOString()
            };
        },
        onSuccess: (data, isEdit) => {
            Ui.showToast(isEdit ? "Reserva actualizada." : "Reserva creada.", "success");
            const inputDestino = document.getElementById('transfer_destino_custom');
            if (inputDestino) inputDestino.classList.add('d-none');
            const btnSubmit = document.getElementById('btnSubmitTransfer');
            if (btnSubmit) btnSubmit.innerHTML = '<i class="bi bi-save-fill me-2"></i>Guardar Reserva';
            cambiarVistaTransfers('lista');
        }
    });

    // Selector de destino
    const destinoInput = document.getElementById('transfer_destino_custom');
    if (destinoSelect && destinoInput) {
        destinoSelect.addEventListener('change', (e) => {
            const isOtro = e.target.value === 'OTRO';
            destinoInput.classList.toggle('d-none', !isOtro);
            destinoInput.disabled = !isOtro;
            destinoInput.required = isOtro;
            if (isOtro) destinoInput.focus();
        });
    }

    // Initial Date setup
    const dateInput = document.getElementById('transfer_fecha');
    if (dateInput) {
        const today = Utils.getTodayISO();
        dateInput.value = today;
        dateInput.min = today;
    }
    
    mostrarTransfers();
    setupIntersectionObserverTransfers();
}

/**
 * Función global para facilitar el cambio programático
 */
window.cambiarVistaTransfers = (vista) => {
    const btn = vista === 'lista' ? 'btnVistaListaTransfers' : 'btnVistaFormTransfers';
    document.getElementById(btn)?.click();
};

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * @deprecated Usando Ui.handleFormSubmission
 */
function manejarSubmitTransfer(e) { }

// ============================================================================
// RENDER
// ============================================================================

// ============================================================================
// PAGINACIÓN Y RENDERIZADO (LAZY LOAD)
// ============================================================================

// ============================================================================
// PAGINACIÓN Y RENDERIZADO (LAZY LOAD)
// ============================================================================

let currentFilteredTransfers = [];
let visibleCountTransfers = 50;
const PAGE_SIZE_TRANSFERS = 50;
let infiniteScrollControllerTransfers = null;

function setupIntersectionObserverTransfers() {
    infiniteScrollControllerTransfers = Ui.infiniteScroll({
        onLoadMore: window.cargarMasTransfers,
        sentinelId: 'sentinel-loader-transfers'
    });
}

/**
 * RENDER LÓGICO DE TRANSFERS (Controller)
 * Prepara los datos, limpia antiguos y actualiza dashboard.
 */
function mostrarTransfers() {
    // Clean old
    transfersService.cleanupOld(3); // Keep 3 days of history
    
    // Obtener todos
    let items = transfersService.getTransfers();
    const busqueda = document.getElementById('transfersSearch')?.value.toLowerCase() || '';

    // Filter
    if (busqueda) {
        items = items.filter(t => t.habitacion.toLowerCase().includes(busqueda) || t.destino.toLowerCase().includes(busqueda));
    }
    
    currentFilteredTransfers = [...items];
    
    // Actualizar Widget Dashboard
    actualizarDashboardTransfers();

    // Resetear paginación y renderizar lista
    visibleCountTransfers = PAGE_SIZE_TRANSFERS;
    renderListaTransfers(false);
}

/**
 * DIBUJAR TABLA DE TRANSFERS (View)
 * Soporta append para Infinite Scroll.
 */
function renderListaTransfers(append = false) {
    const total = currentFilteredTransfers.length;
    const start = append ? Math.max(0, visibleCountTransfers - PAGE_SIZE_TRANSFERS) : 0;
    const end = Math.min(visibleCountTransfers, total);
    const slice = currentFilteredTransfers.slice(start, end);

    Ui.renderTable('tablaTransfersCuerpo', slice, renderFilaTransfer, 'No se encontraron reservas.', append);

    if (visibleCountTransfers < total) {
        const sentinelRow = Ui.createSentinelRow('sentinel-loader-transfers', 'Cargando reservas...', 7);
        const contenedor = document.getElementById('tablaTransfersCuerpo');
        if (contenedor) contenedor.appendChild(sentinelRow);
        if (infiniteScrollControllerTransfers) infiniteScrollControllerTransfers.reconnect();
    }

    if (!append) {
        Ui.enableTableSorting('table-transfers', currentFilteredTransfers, (sorted) => {
            currentFilteredTransfers = sorted;
            visibleCountTransfers = PAGE_SIZE_TRANSFERS;
            renderListaTransfers(false);
        });
    }
}

/**
 * RENDERIZAR FILA DE TRANSFER (Helper para renderTable)
 */
function renderFilaTransfer(t) {
    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = t.fecha === todayStr;
    const rowClass = isToday ? 'table-info bg-opacity-10' : '';
    
    const displayHab = t.externo 
        ? `<div class="fw-bold text-danger"><i class="bi bi-person-walking me-1"></i>${t.nombre_cliente || 'EXTERNO'}</div>`
        : `<span class="badge bg-secondary fs-6">${t.habitacion}</span>`;

    return `
        <tr class="${rowClass}" id="transfer-row-${t.transfer_id}">
            <td class="ps-4">
                <div class="fw-bold text-dark">${Utils.formatDate(t.fecha)}</div>
                <div class="fs-5 text-primary fw-bold font-monospace">${t.hora}</div>
            </td>
            <td>${displayHab}</td>
            <td>
                ${getIconoTipo(t.tipo)} <span class="small fw-bold">${t.tipo}</span>
            </td>
            <td>${t.pax}</td>
            <td>
                <div class="fw-bold">${t.destino}</div>
                ${t.notas ? `<div class="small text-muted fst-italic"><i class="bi bi-info-circle me-1"></i>${t.notas}</div>` : ''}
            </td>
            <td><small class="text-muted">${t.autor}</small></td>
            <td class="text-end pe-4 no-print">
                <button class="btn btn-sm btn-outline-dark me-1" onclick="imprimirTransferTicket(${t.transfer_id})" data-bs-toggle="tooltip" title="Imprimir Ticket">
                    <i class="bi bi-printer-fill"></i>
                </button>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editarTransfer(${t.transfer_id})" data-bs-toggle="tooltip" title="Editar">
                    <i class="bi bi-pencil-fill"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="eliminarTransfer(${t.transfer_id})" data-bs-toggle="tooltip" title="Eliminar">
                    <i class="bi bi-trash-fill"></i>
                </button>
            </td>
        </tr>`;
}

window.cargarMasTransfers = function() {
    if (visibleCountTransfers >= currentFilteredTransfers.length) return;
    visibleCountTransfers += PAGE_SIZE_TRANSFERS;
    renderListaTransfers(true);
};

/**
 * Actualiza el widget de Transfers en el Dashboard principal ("Resumen del Día")
 */
function actualizarDashboardTransfers() {
    const todayStr = Utils.getTodayISO();
    const all = transfersService.getTransfers();
    // SHOW TODAY + FUTURE (Next 48h or all upcoming)
    const todayTransfers = all.filter(t => t.fecha >= todayStr)
        .sort((a, b) => {
            if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
            return a.hora.localeCompare(b.hora);
        });

    Ui.updateDashboardWidget('transfers', todayTransfers, (t) => {
        const displayHab = t.externo ? (t.nombre_cliente || 'EXTERNO') : t.habitacion;
        const iconColor = t.fecha === todayStr ? 'text-primary' : 'text-secondary';
        
        return `
        <tr style="cursor: pointer;" onclick="irATransfer(${t.transfer_id})">
            <td>
                <i class="bi bi-circle-fill ${iconColor} me-2" style="font-size: 0.5rem;"></i>
                <span class="fw-bold">${displayHab}</span>
                <span class="small text-muted ms-1">- ${t.destino}</span>
            </td>
            <td class="text-end">
                <span class="badge bg-light text-dark border small">${t.hora}</span>
            </td>
        </tr>`;
    });

    if (window.checkDailySummaryVisibility) window.checkDailySummaryVisibility();
}

function getIconoTipo(tipo) {
    switch (tipo) {
        case 'TAXI': return '<i class="bi bi-taxi-front text-primary me-1"></i>';
        case 'BUS': return '<i class="bi bi-bus-front text-info me-1"></i>';
        default: return '<i class="bi bi-car-front-fill text-dark me-1"></i>';
    }
}

// ============================================================================
// GLOBAL ACTIONS
// ============================================================================

window.editarTransfer = (id) => {
    const item = transfersService.getByKey(id, 'transfer_id');
    if (item) {
        document.getElementById('transfer_id').value = item.transfer_id;
        document.getElementById('transfer_fecha').value = item.fecha;
        document.getElementById('transfer_hora').value = item.hora;
        document.getElementById('transfer_hab').value = item.externo ? '' : item.habitacion;
        document.getElementById('transfer_externo').checked = !!item.externo;
        document.getElementById('transfer_nombre_cliente').value = item.nombre_cliente || '';
        
        // Actualizar UI del formulario según si es externo
        toggleTransferExterno(!!item.externo);

        document.getElementById('transfer_tipo').value = item.tipo;
        document.getElementById('transfer_pax').value = item.pax;
        
        // LOGICA INTELIGENTE PARA POBLAR EL DESTINO EN EDICIÓN
        const selectDestino = document.getElementById('transfer_destino_select');
        const inputDestino = document.getElementById('transfer_destino_custom');
        
        const destinos = APP_CONFIG.TRANSFERS?.DESTINOS || ["Aeropuerto Norte", "Aeropuerto Sur"];
        
        if (destinos.includes(item.destino)) {
            selectDestino.value = item.destino;
            inputDestino.classList.add('d-none');
            inputDestino.disabled = true;
            inputDestino.value = '';
        } else {
            selectDestino.value = 'OTRO';
            inputDestino.classList.remove('d-none');
            inputDestino.disabled = false;
            inputDestino.value = item.destino;
        }

        document.getElementById('transfer_notas').value = item.notas || '';
        const btn = document.getElementById('btnSubmitTransfer');
        if (btn) btn.innerHTML = '<i class="bi bi-save-fill me-2"></i>Actualizar Reserva';
        
        cambiarVistaTransfers('form');
    }
};

window.eliminarTransfer = async (id) => {
    if (await Ui.showConfirm("¿Eliminar esta reserva?")) {
        await transfersService.delete(id, 'transfer_id');
        mostrarTransfers();
    }
};

/**
 * IMPRIMIR TICKET DE CLIENTE
 * Genera el documento que se entrega al huésped con los detalles de su reserva.
 */
window.imprimirTransferTicket = (id) => {
    const item = transfersService.getById(id, 'transfer_id');
    if (!item) return;

    // Fill print section
    document.getElementById('print_transfer_fecha').textContent = Utils.formatDate(item.fecha);
    document.getElementById('print_transfer_hora').textContent = item.hora;
    
    const labelHab = document.getElementById('label_print_hab');
    if (item.externo) {
        labelHab.textContent = 'Cliente / Client:';
        document.getElementById('print_transfer_hab').textContent = item.nombre_cliente || 'EXTERNO';
    } else {
        labelHab.textContent = 'Habitación / Room:';
        document.getElementById('print_transfer_hab').textContent = item.habitacion;
    }

    document.getElementById('print_transfer_tipo').textContent = item.tipo;
    document.getElementById('print_transfer_destino').textContent = item.destino;
    document.getElementById('print_transfer_pax').textContent = item.pax;
    document.getElementById('print_transfer_notas').textContent = item.notas || 'Sin observaciones';

    // Lógica de Impresión Atómica - ESTABILIZACIÓN NUCLEAR V2
    // Lógica de Impresión de Ticket - ESTABILIZACIÓN Iframe
    const ticketHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ticket de Transfer</title>
            <style>
                @page { margin: 0; size: 80mm 150mm; }
                body { font-family: 'Courier New', Courier, monospace; padding: 20px; font-size: 14px; margin: 0; background: #fff; color: #000; }
                .d-none { display: none !important; }
                .text-center { text-align: center; }
                .fw-bold { font-weight: bold; }
                .fs-4 { font-size: 1.5rem; }
                .mb-3 { margin-bottom: 1rem; }
                .border-bottom { border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            </style>
        </head>
        <body>
            <div class="text-center fw-bold fs-4 mb-3">TRANSFER</div>
            <div class="border-bottom">
                <div>Fecha/Date: <strong>${Utils.formatDate(item.fecha)}</strong></div>
                <div>Hora/Time: <strong>${item.hora}</strong></div>
            </div>
            <div class="border-bottom">
                <div>${item.externo ? 'CLIENTE:' : 'HABITACIÓN:'}</div>
                <div class="fs-4 fw-bold">${item.externo ? (item.nombre_cliente || 'EXTERNO') : item.habitacion}</div>
            </div>
            <div class="mb-3">
                <div>Destino: <strong>${item.destino}</strong></div>
                <div>Tipo: <strong>${item.tipo}</strong></div>
                <div>Pax: <strong>${item.pax}</strong></div>
            </div>
            ${item.notas ? `<div class="mb-3">Notas: ${item.notas}</div>` : ''}
            <div class="text-center" style="margin-top: 30px; font-size: 10px;">
                Reception Suite v2
            </div>
        </body>
        </html>
    `;

    if (window.PrintService) {
        PrintService.printHTML(ticketHTML);
    } else {
        window.print(); // Fallback malo
    }
};

window.filtrarTransfers = mostrarTransfers;

/**
 * IMPRIMIR LISTADO DE TRANSFERS (PdfService)
 * Genera un informe PDF profesional con el listado de todos los transfers filtrados.
 */
async function imprimirTransfers() {
    const user = Utils.validateUser();
    if (!user) {
        Ui.showToast("Debe identificar al usuario activo.", "warning");
        return;
    }
    
    if (window.PrintService) {
        // Imprimimos la tabla de lista
        // Buscamos el contenedor de tabla o la tabla en sí
        // En transfers.html la tabla suele ser #tablaTransfersVisual o similar. 
        // En el render se usa 'tablaTransfersCuerpo' que es el TBODY.
        // Necesitamos la TABLE completa. Asumiremos que el ID es 'table-transfers' (estándar Ui.enableTableSorting)
        
        const tableId = 'table-transfers';
        if (document.getElementById(tableId)) {
            PrintService.printElement(tableId, `Listado de Transfers - ${Utils.getTodayISO()}`);
        } else {
            // Fallback al contenedor de vista lista
            PrintService.printElement('transfers-lista-view', 'Listado de Transfers');
        }

    } else {
        window.print();
    }
}
window.imprimirTransfers = imprimirTransfers;

/**
 * TOGGLE UI CLIENTE EXTERNO
 */
window.toggleTransferExterno = (isExterno) => {
    const wrapNombre = document.getElementById('wrap_transfer_nombre_externo');
    const inputHab = document.getElementById('transfer_hab');
    const inputNombre = document.getElementById('transfer_nombre_cliente');

    if (isExterno) {
        wrapNombre?.classList.remove('d-none');
        inputHab.required = false;
        inputHab.disabled = true;
        inputHab.value = '';
        inputNombre.required = true;
    } else {
        wrapNombre?.classList.add('d-none');
        inputHab.required = true;
        inputHab.disabled = false;
        inputNombre.required = false;
        inputNombre.value = '';
    }
};

window.irATransfer = (id) => {
    if (window.navegarA) navegarA('#transfers-content');
    if (window.cambiarVistaTransfers) cambiarVistaTransfers('lista');

    setTimeout(() => {
        const row = document.getElementById(`transfer-row-${id}`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.classList.remove('highlight-row');
            void row.offsetWidth; 
            row.classList.add('highlight-row');
        }
    }, 150);
};
