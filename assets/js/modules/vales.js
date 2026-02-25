import { Ui } from "../core/Ui.js";
import { Utils } from "../core/Utils.js";
import { valesService } from "../services/ValesService.js";
import { sessionService } from "../services/SessionService.js";

/**
 * MÓDULO DE VALES (vales.js)
 * --------------------------
 * Gestión de vales de caja: creación, firma y consulta histórica.
 * v8: Validación de usuario estándar (Utils.validateUser).
 */

let valesModuleInitialized = false;
let currentSort = { field: 'id', direction: 'desc' };

export async function initVales() {
    await valesService.init();
    renderView();
    valesModuleInitialized = true;
}

function renderView() {
    const container = document.getElementById('vales-content');
    if (!container) return;

    // Header Standard de Modulo
    const html = `
        <!-- HEADER MODULE -->
        <h4 class="module-title-discrete"><i class="bi bi-receipt me-2"></i>Control de Vales</h4>

        <!-- TOOLBAR (VISTAS Y ACCIONES ESTÁNDAR) -->
        <div class="module-toolbar d-flex justify-content-between align-items-center p-2 mb-3 no-print">
            <div class="btn-group shadow-sm" role="group">
                <button type="button" class="btn btn-outline-primary active fw-bold" id="btnVistaCrearVale" onclick="switchVistaVales('crear')">
                    <i class="bi bi-plus-circle me-2"></i>Nuevo Vale
                </button>
                <button type="button" class="btn btn-outline-primary fw-bold" id="btnVistaHistoricoVales" onclick="switchVistaVales('historico')">
                    <i class="bi bi-clock-history me-2"></i>Histórico
                </button>
            </div>
            
            <div class="d-flex gap-2">
                <div class="btn-print-wrapper d-flex gap-2">
                    <button class="btn btn-primary btn-sm fw-bold shadow-sm" onclick="imprimirVistaVales()" data-bs-toggle="tooltip" title="Imprimir Vista Actual">
                        <i class="bi bi-printer me-2"></i>Imprimir
                    </button>
                </div>
            </div>
        </div>

        <!-- CONTENIDO: VISTA CREACIÓN -->
        <div id="vista-vales-crear" class="row fade-in">
            <div class="col-md-5">
                <div class="card shadow-sm border-0 mb-4">
                    <div class="card-header bg-white py-3">
                        <h6 class="mb-0 fw-bold text-primary"><i class="bi bi-pencil-square me-2"></i>Emitir Nuevo Vale</h6>
                    </div>
                    <div class="card-body">
                        <form id="formNuevoVale">
                            <div class="mb-2">
                                <label class="form-label small mb-1 fw-bold">Receptor *</label>
                                <input type="text" id="vale_new_receptor" class="form-control form-control-sm" required placeholder="Nombre del receptor">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small mb-1 fw-bold">Concepto *</label>
                                <input type="text" id="vale_new_concepto" class="form-control form-control-sm" required placeholder="Ej: Compra material">
                            </div>
                            <div class="mb-3">
                                <label class="form-label small mb-1 fw-bold">Importe *</label>
                                <div class="input-group input-group-sm">
                                    <span class="input-group-text fw-bold">€</span>
                                    <input type="number" id="vale_new_importe" class="form-control fw-bold text-primary" required step="0.01" placeholder="0.00">
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small mb-1 fw-bold">Comentarios</label>
                                <textarea id="vale_new_comentario" class="form-control form-control-sm" rows="2" placeholder="Opcional..."></textarea>
                            </div>
                            <button type="submit" class="btn btn-primary btn-sm w-100 fw-bold shadow-sm">
                                <i class="bi bi-save me-2"></i>GUARDAR VALE
                            </button>
                        </form>
                    </div>
                </div>
            </div>
            <div class="col-md-7">
                <div class="alert alert-info border-0 shadow-sm small">
                    <i class="bi bi-info-circle-fill me-2"></i>
                    Consulta, imprime o gestiona los vales existentes desde la pestaña <strong>Histórico</strong>.
                </div>
            </div>
        </div>

        <!-- CONTENIDO: VISTA HISTÓRICO -->
        <div id="vista-vales-historico" class="d-none fade-in">
             <!-- BUSCADOR / FILTROS AVANZADOS -->
             <div class="card shadow-sm border-0 mb-3">
                <div class="card-body bg-light rounded p-3">
                    <div class="row g-2 align-items-end"> <!-- Añadido align-items-end para alinear etiquetas -->
                        <div class="col-md-3">
                            <label class="form-label x-small fw-bold text-muted mb-1">Rango de Fechas</label>
                            <div class="input-group input-group-sm">
                                <input type="date" id="vales_filter_start" class="form-control border-end-0" onchange="filtrarVales()">
                                <input type="date" id="vales_filter_end" class="form-control" onchange="filtrarVales()">
                            </div>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label x-small fw-bold text-muted mb-1">Receptor/Concepto</label>
                            <input type="text" id="vales_filter_search" class="form-control form-control-sm" placeholder="Buscar..." oninput="filtrarVales()">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label x-small fw-bold text-muted mb-1">Estado</label>
                            <select id="vales_filter_estado" class="form-select form-select-sm fw-bold" onchange="filtrarVales()">
                                <option value="">Todos</option>
                                <option value="Pendiente">PENDIENTE</option>
                                <option value="Contabilizado">CONTABILIZADO</option>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label x-small fw-bold text-muted mb-1">Firmado</label>
                            <select id="vales_filter_firmado" class="form-select form-select-sm fw-bold" onchange="filtrarVales()">
                                <option value="">Todos</option>
                                <option value="SI">SI</option>
                                <option value="NO">NO</option>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label x-small fw-bold text-muted mb-1">Importe Mín (€)</label>
                            <input type="number" id="vales_filter_importe" class="form-control form-control-sm" placeholder="Mínimo..." step="0.01" oninput="filtrarVales()">
                        </div>
                        <div class="col-md-1">
                            <button class="btn btn-sm btn-outline-secondary w-100" onclick="resetFiltrosVales()" title="Limpiar Filtros">
                                <i class="bi bi-x-circle"></i>
                            </button>
                        </div>
                    </div>
                </div>
             </div>

             <div class="card shadow-sm border-0">
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0" style="min-width: 900px;">
                        <thead class="table-light text-secondary small">
                            <tr>
                                <th class="ps-3 pointer" style="width: 15%;" onclick="ordenarVales('id')">
                                    Fecha / Hora <i class="bi bi-arrow-down-up ms-1 x-small opacity-50"></i>
                                </th>
                                <th class="pointer" style="width: 15%;" onclick="ordenarVales('receptor')">
                                    Receptor <i class="bi bi-arrow-down-up ms-1 x-small opacity-50"></i>
                                </th>
                                <th class="pointer" style="width: 15%;" onclick="ordenarVales('concepto')">
                                    Concepto <i class="bi bi-arrow-down-up ms-1 x-small opacity-50"></i>
                                </th>
                                <th class="text-end pointer" style="width: 15%;" onclick="ordenarVales('importe')">
                                    Importe <i class="bi bi-arrow-down-up ms-1 x-small opacity-50"></i>
                                </th>
                                <th class="text-center pointer" style="width: 15%;" onclick="ordenarVales('estado')">
                                    Estado <i class="bi bi-arrow-down-up ms-1 x-small opacity-50"></i>
                                </th>
                                <th class="text-center pointer" style="width: 12%;" onclick="ordenarVales('firmado')">
                                    Firmado <i class="bi bi-arrow-down-up ms-1 x-small opacity-50"></i>
                                </th>
                                <th class="text-end pe-3" style="width: 13%;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="valesTableBody">
                            <!-- JS Injection -->
                        </tbody>
                    </table>
                    <div id="valesEmptyState" class="text-center p-5 d-none">
                        <i class="bi bi-inbox fs-1 text-muted opacity-25"></i>
                        <p class="text-muted small mt-2">No se encontraron vales con estos criterios.</p>
                    </div>
                </div>
                <div class="card-footer bg-white border-top py-2 d-flex justify-content-between align-items-center">
                    <span class="small text-muted" id="valesCount">0 registros</span>
                    <span class="fw-bold text-primary fs-5" id="valesTotalSum">0.00€</span>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Globals
    window.switchVistaVales = switchVistaVales;
    window.filtrarVales = renderValesList;
    window.resetFiltrosVales = resetFiltrosVales;
    window.ordenarVales = ordenarVales;
    window.updateEstadoVale = updateEstadoVale;
    window.updateFirmadoVale = updateFirmadoVale;
    window.imprimirTicketVale = imprimirTicketVale;
    window.eliminarValeHistorico = eliminarValeHistorico;
    window.imprimirVistaVales = imprimirVistaVales;

    resetFiltrosVales();
    document.getElementById('formNuevoVale').addEventListener('submit', handleCreateVale);
}

function switchVistaVales(vista) {
    const btnCrear = document.getElementById('btnVistaCrearVale');
    const btnHist = document.getElementById('btnVistaHistoricoVales');
    const divCrear = document.getElementById('vista-vales-crear');
    const divHist = document.getElementById('vista-vales-historico');

    if (vista === 'crear') {
        btnCrear.classList.add('active');
        btnHist.classList.remove('active');
        divCrear.classList.remove('d-none');
        divHist.classList.add('d-none');
    } else {
        btnCrear.classList.remove('active');
        btnHist.classList.add('active');
        divCrear.classList.add('d-none');
        divHist.classList.remove('d-none');
        renderValesList();
    }
}

function resetFiltrosVales() {
    const today = Utils.getTodayISO();
    Utils.setVal('vales_filter_start', today);
    Utils.setVal('vales_filter_end', today);
    Utils.setVal('vales_filter_search', '');
    Utils.setVal('vales_filter_estado', '');
    Utils.setVal('vales_filter_firmado', '');
    Utils.setVal('vales_filter_importe', '');
    renderValesList();
}

function ordenarVales(field) {
    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = (field === 'importe' || field === 'id') ? 'desc' : 'asc';
    }
    renderValesList();
}

async function handleCreateVale(e) {
    e.preventDefault();
    
    // VALIDACIÓN ESTÁNDAR DE USUARIO
    const usuario = Utils.validateUser();
    if (!usuario) return; // Si no hay usuario, validateUser lanza el prompt/toast

    const receptor = Utils.getVal('vale_new_receptor');
    const concepto = Utils.getVal('vale_new_concepto');
    const importe = parseFloat(Utils.getVal('vale_new_importe'));
    const comentario = Utils.getVal('vale_new_comentario');

    if (!receptor || !concepto || isNaN(importe) || importe <= 0) {
        Ui.showToast("Datos obligatorios faltantes.", "warning");
        return;
    }

    try {
        await valesService.createVale({ receptor, concepto, importe, comentario, usuario });
        document.getElementById('formNuevoVale').reset();
        Ui.showToast("Vale guardado.", "success");
        if (document.getElementById('vista-vales-historico').classList.contains('active')) {
             renderValesList();
        }
    } catch (err) {
        Ui.showToast("Error al guardar.", "danger");
    }
}

async function updateEstadoVale(id, select) {
    const nuevoEstado = select.value;
    const vale = valesService.getById(id);
    
    // Si el valor no ha cambiado, no hacemos nada (aunque onchange ya lo filtra)
    if (vale.estado === nuevoEstado) return;

    if (await Ui.showConfirm(`¿Estás seguro de cambiar el estado del vale de "${vale.receptor}" a ${nuevoEstado.toUpperCase()}?`)) {
        try {
            await valesService.updateEstado(id, nuevoEstado);
            Ui.showToast("Estado actualizado correctamente.", "info");
        } catch (err) {
            Ui.showToast("Error al actualizar el estado.", "danger");
            // Revertir valor del select si falla
            renderValesList();
        }
    } else {
        // Revertir valor del select si el usuario cancela
        renderValesList();
    }
}

async function updateFirmadoVale(id, select) {
    const firmado = select.value === 'SI';
    const vale = valesService.getById(id);
    
    if (vale.firmado === firmado) return;

    const msg = firmado ? "¿Marcar este vale como FIRMADO?" : "¿Marcar este vale como NO FIRMADO?";

    if (await Ui.showConfirm(msg)) {
        try {
            await valesService.update(id, { firmado });
            Ui.showToast("Estado de firma actualizado.", "info");
        } catch (err) {
            Ui.showToast("Error al actualizar la firma.", "danger");
            renderValesList();
        }
    } else {
        renderValesList();
    }
}

function renderValesList() {
    // 1. Obtener Filtros
    const startStr = Utils.getVal('vales_filter_start');
    const endStr = Utils.getVal('vales_filter_end');
    const searchText = Utils.getVal('vales_filter_search')?.toLowerCase() || "";
    const estadoFiltro = Utils.getVal('vales_filter_estado');
    const firmadoFiltro = Utils.getVal('vales_filter_firmado');
    const importeMin = parseFloat(Utils.getVal('vales_filter_importe')) || 0;

    if (!startStr || !endStr) return;

    // 2. Filtrar por Fecha
    const startDate = new Date(startStr + 'T00:00:00');
    const endDate = new Date(endStr + 'T23:59:59');
    let vales = valesService.getValesByDateRange(startDate, endDate);

    // 3. Multi-Filtro Adicional
    vales = vales.filter(v => {
        const matchesSearch = v.receptor.toLowerCase().includes(searchText) || v.concepto.toLowerCase().includes(searchText);
        const matchesEstado = estadoFiltro === "" || v.estado === estadoFiltro;
        const matchesFirmado = firmadoFiltro === "" || (firmadoFiltro === "SI" ? v.firmado : !v.firmado);
        const matchesImporte = v.importe >= importeMin;

        return matchesSearch && matchesEstado && matchesFirmado && matchesImporte;
    });

    // 4. Ordenación
    vales.sort((a, b) => {
        let valA = a[currentSort.field];
        let valB = b[currentSort.field];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // 5. Render Table
    const tbody = document.getElementById('valesTableBody');
    const emptyState = document.getElementById('valesEmptyState');
    tbody.innerHTML = '';
    let totalSum = 0;

    if (vales.length === 0) {
        emptyState.classList.remove('d-none');
    } else {
        emptyState.classList.add('d-none');
        vales.forEach(v => {
            totalSum += v.importe;
            const fecha = new Date(v.fecha_creacion).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="ps-3">
                    <div class="small fw-bold">${fecha}</div>
                    <div class="x-small text-muted">ID: ${v.id}</div>
                    <div class="x-small text-info"><i class="bi bi-person-fill me-1"></i>${v.usuario || 'Anónimo'}</div>
                </td>
                <td><div class="fw-bold text-dark">${v.receptor}</div></td>
                <td><div class="text-primary small">${v.concepto}</div></td>
                <td class="text-end fw-bold fs-6 font-monospace">${Utils.formatCurrency(v.importe)}</td>
                <td class="text-center">
                    <select class="form-select form-select-sm x-small fw-bold" onchange="updateEstadoVale(${v.id}, this)">
                        <option value="Pendiente" ${v.estado === 'Pendiente' ? 'selected' : ''}>PENDIENTE</option>
                        <option value="Contabilizado" ${v.estado === 'Contabilizado' ? 'selected' : ''}>CONTABILIZADO</option>
                    </select>
                </td>
                <td class="text-center">
                    <select class="form-select form-select-sm x-small fw-bold ${v.firmado ? 'text-success' : 'text-danger'}" onchange="updateFirmadoVale(${v.id}, this)">
                        <option value="NO" ${!v.firmado ? 'selected' : ''}>NO</option>
                        <option value="SI" ${v.firmado ? 'selected' : ''}>SI</option>
                    </select>
                </td>
                <td class="text-end pe-3">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="imprimirTicketVale(${v.id})" title="Imprimir Ticket"><i class="bi bi-printer"></i></button>
                        <button class="btn btn-outline-danger" onclick="eliminarValeHistorico(${v.id})"><i class="bi bi-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('valesCount').textContent = `${vales.length} registros`;
    document.getElementById('valesTotalSum').textContent = Utils.formatCurrency(totalSum);
}

function imprimirTicketVale(id) {
    const vale = valesService.getById(id);
    if (!vale) return;

    const html = `
        <html>
        <head>
            <title>Vale de Caja #${vale.id}</title>
            <style>
                @page { size: 80mm auto; margin: 0; }
                body { font-family: 'Courier New', monospace; width: 280px; margin: 0 auto; padding: 10px; text-align: center; }
                h3, h4 { margin: 5px 0; }
                .text-left { text-align: left; font-size: 12px; margin-top: 15px; }
                .amount { text-align: right; font-size: 18px; font-weight: bold; margin: 10px 0; }
                .signatures { margin-top: 40px; }
                .sig-line { border-top: 1px solid #000; width: 180px; margin: 0 auto 30px auto; padding-top: 5px; font-size: 10px; }
                .footer { font-size: 9px; margin-top: 20px; font-style: italic; }
            </style>
        </head>
        <body>
            <h3>HOTEL GAROÉ</h3>
            <hr>
            <h4>VALE DE CAJA</h4>
            <div class="text-left">
                <p><strong>FECHA:</strong> ${new Date(vale.fecha_creacion).toLocaleString()}</p>
                <p><strong>EMITIDO POR:</strong> ${vale.usuario || 'Anónimo'}</p>
                <p><strong>RECEPTOR:</strong> ${vale.receptor}</p>
                <p><strong>CONCEPTO:</strong> ${vale.concepto}</p>
                <div class="amount">${Utils.formatCurrency(vale.importe)}</div>
            </div>
            <div class="signatures">
                <div class="sig-line">Firma Receptor</div>
                <div class="sig-line">Firma Recepcionista</div>
                <div class="sig-line" style="margin-bottom:10px;">Firma Dirección</div>
            </div>
            <div class="footer">Documento interno de control - Reception Suite v2</div>
        </body>
        </html>
    `;

    if (window.PrintService) {
        PrintService.printHTML(html);
    } else {
        // Fallback Legacy
        const w = window.open('', 'PRINT', 'height=600,width=400');
        w.document.write(html);
        w.document.close();
        setTimeout(() => { w.print(); w.close(); }, 300);
    }
}

function imprimirVistaVales() {
    if (window.PrintService) {
        // Detectar vista activa
        const isHistorico = !document.getElementById('vista-vales-historico').classList.contains('d-none');
        if (isHistorico) {
            PrintService.printElement('vista-vales-historico', `Histórico de Vales - ${Utils.getTodayISO()}`);
        } else {
            // Imprimir formulario de creación (raro, pero posible)
            PrintService.printElement('vista-vales-crear', 'Nuevo Vale de Caja');
        }
    } else {
        window.print();
    }
}

async function eliminarValeHistorico(id) {
    if (await Ui.showConfirm("¿Eliminar este vale?")) {
        await valesService.delete(id);
        renderValesList();
    }
}
