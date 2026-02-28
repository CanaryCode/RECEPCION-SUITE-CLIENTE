/**
 * MÓDULO DE AYUDA A LA VALORACIÓN (valoracion.js)
 * ---------------------------------------------
 * Permite calcular el precio de una estancia basándose en múltiples periodos,
 * precios base y descuentos aplicables.
 */

import { APP_CONFIG } from '../core/Config.js?v=V153_DB_CONFIG';
import { Utils } from '../core/Utils.js?v=V145_VAL_FIX';
import { Ui } from '../core/Ui.js?v=V145_VAL_FIX';
import { LocalStorage } from '../core/LocalStorage.js';
import { sessionService } from '../services/SessionService.js';

let moduloInicializado = false;
let editingId = null;
const HISTORIAL_KEY = 'app_valoraciones_historial';
const HISTORIAL_PERMANENTE_KEY = 'app_valoraciones_permanente';
let selectedValuationIds = new Set();

export function inicializarValoracion() {
    if (moduloInicializado) return;
    
    // Configurar conmutador de vistas oficial
    Ui.setupViewToggle({
        buttons: [
            { id: 'btnValoracionVistaTrabajo', viewId: 'valoracion-view-form' },
            { id: 'btnValoracionVistaResumen', viewId: 'valoracion-view-list', onShow: () => {
                actualizarTablaHistorial();
            }},
            { id: 'btnValoracionVistaHistorico', viewId: 'valoracion-view-historico', onShow: () => {
                setFiltroReservasActivas();
            }},
            { id: 'btnValoracionVistaChequeo', viewId: 'valoracion-view-chequeo' }
        ]
    });

    // Registrar funciones globales
    window.agregarPeriodoValoracion = agregarPeriodoValoracion;
    window.eliminarPeriodoValoracion = eliminarPeriodoValoracion;
    window.actualizarValoracion = actualizarValoracion;
    window.resetearValoracion = resetearValoracion;
    window.imprimirValoracionActual = imprimirValoracionActual;
    window.guardarValoracionEnLista = guardarValoracionEnLista;
    window.limpiarHistorialValoraciones = limpiarHistorialValoraciones;
    window.imprimirHistorialCompleto = imprimirHistorialCompleto;
    window.eliminarValoracionHistorial = eliminarValoracionHistorial;
    window.editarValoracionHistorial = editarValoracionHistorial;
    window.cancelarEdicionValoracion = cancelarEdicionValoracion;
    window.imprimirSegunVista = imprimirSegunVista;
    window.imprimirChequeoExterno = imprimirChequeoExterno;
    window.limpiarSegunVista = limpiarSegunVista;
    window.renderSuplementosDinamicos = renderSuplementosDinamicos;
    window.handlePrecioSelect = handlePrecioSelect;
    window.handleSuplementoSelect = handleSuplementoSelect;
    window.handleSuplementoNinoSelect = handleSuplementoNinoSelect;
    window.handleDescuentoSelect = handleDescuentoSelect;
    window.agregarConceptoExtra = agregarConceptoExtra;
    window.eliminarConceptoExtra = eliminarConceptoExtra;
    window.actualizarTablaHistoricoPermanente = actualizarTablaHistoricoPermanente;
    window.setFiltroReservasActivas = setFiltroReservasActivas;
    window.limpiarFiltrosHistorico = limpiarFiltrosHistorico;
    window.eliminarRangoHistorialPermanente = eliminarRangoHistorialPermanente;
    window.toggleSeccionBorradoMasivo = toggleSeccionBorradoMasivo;
    window.aplicarPrevisualizacionBorrado = aplicarPrevisualizacionBorrado;
    window.copiarHistorialPortapapeles = copiarHistorialPortapapeles;
    window.ejecutarChequeoIniciativa = ejecutarChequeoIniciativa;
    window.limpiarResultadosChequeo = limpiarResultadosChequeo;
    window.imprimirValoracionIndividual = imprimirValoracionIndividual;
    window.toggleSelectAllValuations = toggleSelectAllValuations;
    window.toggleValuationSelection = toggleValuationSelection;
    window.seleccionarObsoletos = seleccionarObsoletos;

    // Migración de datos (si el histórico permanente está vacío)
    const currentPermanente = LocalStorage.get(HISTORIAL_PERMANENTE_KEY, []);
    if (currentPermanente.length === 0) {
        const tempHistorial = LocalStorage.get(HISTORIAL_KEY, []);
        if (tempHistorial.length > 0) {
            LocalStorage.set(HISTORIAL_PERMANENTE_KEY, tempHistorial);
            console.log("Valuations: Migrated ephemeral records to permanent history.");
        }
    }

    // Primer renderizado
    resetearValoracion(true);

    // Adjuntar validador de habitación
    Ui.attachRoomValidator('val-meta-room');
    
    moduloInicializado = true;
}

/**
 * EXTRAE UNA FECHA ISO (YYYY-MM-DD) DE UN REGISTRO DE PERIODO
 * Soporta tanto el campo Raw (nuevo) como el parseo del formato español (antiguo).
 */
function getIsoDateFromPeriod(period, isEnd = false) {
    const rawValue = isEnd ? period.finRaw : period.inicioRaw;
    if (rawValue && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)) return rawValue;

    const formattedValue = isEnd ? period.fin : period.inicio;
    if (!formattedValue) return '';

    // Intentar parsear "DD/MM/YYYY" -> "YYYY-MM-DD"
    const parts = formattedValue.split('/');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return '';
}

function agregarPeriodoValoracion(data = null) {
    const container = document.getElementById('valoracion-periodos-container');
    const template = document.getElementById('template-periodo-valoracion');
    if (!container || !template) return;

    const clone = template.content.cloneNode(true);
    const item = clone.querySelector('.periodo-item');
    const periodos = container.querySelectorAll('.periodo-item');
    const index = periodos.length;
    
    item.querySelector('.periodo-index').innerText = index + 1;
    
    const inputInicio = item.querySelector('.val-fecha-inicio');
    const inputFin = item.querySelector('.val-fecha-fin');
    const inputPrecio = item.querySelector('.val-precio');
    const customInput = item.querySelector('.val-custom-input');

    if (data) {
        // Cargar datos existentes (Modo Edición o Importación)
        inputInicio.value = data.inicioRaw || '';
        inputFin.value = data.finRaw || '';
        inputPrecio.value = data.precio || '';
        
        item.dataset.suplemento = data.suplemento || 0;
        item.dataset.suplementoNino = data.suplementoNino || 0;
        item.dataset.discount = data.descuento || 0;
        item.dataset.concepts = JSON.stringify(data.concepts || []);
    } else {
        item.dataset.suplemento = 0;
        item.dataset.suplementoNino = 0;
        item.dataset.discount = 0;
        item.dataset.concepts = '[]';

        // Lógica de valores por defecto basados en el periodo anterior
        if (index > 0) {
            const anterior = periodos[index - 1];
            const fechaFinAnterior = anterior.querySelector('.val-fecha-fin').value;
            const precioAnterior = anterior.querySelector('.val-precio').value;
            
            // Heredar descuento
            let descuentoAnterior = 0;
            if (anterior.dataset.discount === 'custom') {
                descuentoAnterior = parseFloat(anterior.querySelector('.val-custom-input').value) || 0;
            } else {
                descuentoAnterior = parseFloat(anterior.dataset.discount) || 0;
            }

            if (fechaFinAnterior) inputInicio.value = fechaFinAnterior;
            if (precioAnterior) inputPrecio.value = precioAnterior;
            
            // Heredar Dataset
            item.dataset.discount = descuentoAnterior;
            item.dataset.suplemento = anterior.dataset.suplemento || 0;
            item.dataset.suplementoNino = anterior.dataset.suplementoNino || 0;
            item.dataset.concepts = anterior.dataset.concepts || '[]';
        } else {
            inputInicio.value = Utils.getTodayISO();
        }
    }

    container.appendChild(clone);
    
    // Iniciar el estado de conceptos y suplementos
    renderSuplementosDinamicos(item);
    renderConceptosExtras(item);

    // Renderizar selectores para este periodo
    renderPreciosPredefinidosEnItem(item);
    
    // Cargar/Sincronizar descuento en los selectores
    const selectDesc = item.querySelector('.val-select-descuento');
    const customInputDesc = item.querySelector('.val-custom-input');
    const discountVal = parseFloat(item.dataset.discount) || 0;
    const isStandard = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].includes(discountVal);
    
    if (isStandard && item.dataset.discount !== 'custom') {
        selectDesc.value = discountVal;
    } else {
        selectDesc.value = 'custom';
        customInputDesc.value = discountVal;
        customInputDesc.classList.remove('d-none');
    }

    actualizarValoracion();
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}



function renderPreciosPredefinidosEnItem(item) {
    const select = item.querySelector('.val-select-precio');
    if (!select || !APP_CONFIG.VALORACION?.PRECIOS) return;

    // Mantener la opción manual
    select.innerHTML = '<option value="">(Manual / Seleccionar...)</option>' + 
        APP_CONFIG.VALORACION.PRECIOS.map(p => `
            <option value="${p.valor}">${p.label} (${p.valor.toFixed(2)}€)</option>
        `).join('');

    renderSuplementosDinamicos(item);
}

function handlePrecioSelect(select) {
    const item = select.closest('.periodo-item');
    const inputPrecio = item.querySelector('.val-precio');
    if (select.value !== "") {
        inputPrecio.value = select.value;
    }
    actualizarValoracion();
}

function renderSuplementosDinamicos(item) {
    const type = document.getElementById('val-meta-type').value;
    const isChild = document.getElementById('val-meta-child').checked;
    
    const container = item.querySelector('.val-suplementos-container');
    const selectSupl = item.querySelector('.val-select-suplemento');
    const labelDinamico = item.querySelector('.suplemento-label-dinamico');

    const containerNino = item.querySelector('.val-suplementos-nino-container');
    const selectNino = item.querySelector('.val-select-suplemento-nino');

    let showContainer = false;
    const valConfig = APP_CONFIG.VALORACION || {};

    if (type === 'Individual') {
        const list = valConfig.SUPLEMENTOS_INDIVIDUAL || [];
        if (list.length > 0) {
            showContainer = true;
            labelDinamico.innerText = 'Suplemento Hab. Individual (Extra)';
            selectSupl.innerHTML = '<option value="0">Sin suplemento</option>' + 
                list.map(s => `<option value="${s.valor}">${s.label} (+${s.valor.toFixed(2)}€)</option>`).join('');
        }
    } else if (type === 'Triple') {
        const list = valConfig.DESCUENTOS_TRIPLE || [];
        if (list.length > 0) {
            showContainer = true;
            labelDinamico.innerText = 'Precio 3ª Persona (Total Triple)';
            selectSupl.innerHTML = '<option value="0">Sin suplemento</option>' + 
                list.map(s => `<option value="${s.valor}">${s.label} (${s.valor < 0 ? '' : '+'}${s.valor.toFixed(2)}€)</option>`).join('');
        }
    }

    if (showContainer) {
        // Restaurar valor si existe en dataset
        const current = item.dataset.suplemento || "0";
        selectSupl.value = current;
    }
    container.classList.toggle('d-none', !showContainer);

    // Suplementos de niño
    if (isChild) {
        const listNino = valConfig.SUPLEMENTOS_NINO || [];
        if (listNino.length > 0) {
            containerNino.classList.remove('d-none');
            selectNino.innerHTML = '<option value="0">Sin suplemento niño</option>' + 
                listNino.map(s => `<option value="${s.valor}">${s.label} (+${s.valor.toFixed(2)}€)</option>`).join('');
            
            const currentNino = item.dataset.suplementoNino || "0";
            selectNino.value = currentNino;
        } else {
            containerNino.classList.add('d-none');
        }
    } else {
        containerNino.classList.add('d-none');
        item.dataset.suplementoNino = "0";
    }
}

function handleSuplementoSelect(select) {
    const item = select.closest('.periodo-item');
    item.dataset.suplemento = select.value;
    actualizarValoracion();
}

function handleSuplementoNinoSelect(select) {
    const item = select.closest('.periodo-item');
    item.dataset.suplementoNino = select.value;
    actualizarValoracion();
}

function handleDescuentoSelect(select) {
    const item = select.closest('.periodo-item');
    const customInput = item.querySelector('.val-custom-input');
    
    if (select.value === 'custom') {
        customInput.classList.remove('d-none');
        customInput.focus();
        item.dataset.discount = 'custom';
    } else {
        customInput.classList.add('d-none');
        item.dataset.discount = select.value;
    }
    actualizarValoracion();
}

function agregarConceptoExtra(btn) {
    const item = btn.closest('.periodo-item');
    const nameInput = item.querySelector('.val-new-concept-name');
    const priceInput = item.querySelector('.val-new-concept-price');
    
    const name = nameInput.value.trim();
    const price = parseFloat(priceInput.value) || 0;
    
    if (!name) return Ui.showToast("Introduce un nombre", "warning");

    let concepts = JSON.parse(item.dataset.concepts || '[]');
    concepts.push({ id: Date.now(), name, price });
    item.dataset.concepts = JSON.stringify(concepts);
    
    nameInput.value = '';
    priceInput.value = '';
    
    renderConceptosExtras(item);
    actualizarValoracion();
}

function eliminarConceptoExtra(btn, conceptId) {
    const item = btn.closest('.periodo-item');
    let concepts = JSON.parse(item.dataset.concepts || '[]');
    concepts = concepts.filter(c => c.id !== conceptId);
    item.dataset.concepts = JSON.stringify(concepts);
    
    renderConceptosExtras(item);
    actualizarValoracion();
}

function renderConceptosExtras(item) {
    const container = item.querySelector('.val-conceptos-list');
    const concepts = JSON.parse(item.dataset.concepts || '[]');
    
    if (concepts.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = concepts.map(c => `
        <div class="d-flex justify-content-between align-items-center bg-white border rounded p-1 mb-1 small animate__animated animate__fadeIn">
            <div class="text-truncate px-2">
                <i class="bi bi-plus-minus me-1 text-primary"></i>${c.name}
            </div>
            <div class="d-flex align-items-center">
                <span class="fw-bold ${c.price < 0 ? 'text-danger' : 'text-success'} me-2">${c.price < 0 ? '' : '+'}${c.price.toFixed(2)}€</span>
                <button class="btn btn-sm text-danger p-0 px-2" onclick="window.eliminarConceptoExtra(this, ${c.id})"><i class="bi bi-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function seleccionarSuplemento(btn, valor, type) {
    const item = btn.closest('.periodo-item');
    const container = btn.closest('.val-supl-chips-container');

    if (type === 'nino') {
        container.querySelectorAll('.val-chip-supl-nino').forEach(c => {
            c.classList.remove('active', 'btn-warning');
            c.classList.add('btn-outline-warning');
        });
        btn.classList.remove('btn-outline-warning');
        btn.classList.add('active', 'btn-warning');
        item.dataset.suplementoNino = valor;
    } else {
        container.querySelectorAll('.val-chip-supl').forEach(c => {
            const btnType = c.dataset.type;
            const btnClass = btnType === 'triple' ? 'btn-success' : 'btn-info';
            const btnOutlineClass = btnType === 'triple' ? 'btn-outline-success' : 'btn-outline-info';
            
            c.classList.remove('active', btnClass);
            c.classList.add(btnOutlineClass);
        });
        
        const isTriple = type === 'triple';
        btn.classList.remove(isTriple ? 'btn-outline-success' : 'btn-outline-info');
        btn.classList.add('active', isTriple ? 'btn-success' : 'btn-info');
        item.dataset.suplemento = valor;
    }

    actualizarValoracion();
}


async function eliminarPeriodoValoracion(btn) {
    const item = btn.closest('.periodo-item');
    const container = document.getElementById('valoracion-periodos-container');
    
    if (container.querySelectorAll('.periodo-item').length <= 1) {
        Ui.showToast("Debe haber al menos un periodo", "warning");
        return;
    }

    if (await Ui.showConfirm("¿Eliminar este periodo?")) {
        item.classList.add('animate__fadeOutLeft');
        setTimeout(() => {
            item.remove();
            reindexarPeriodos();
            actualizarValoracion();
        }, 300);
    }
}

function reindexarPeriodos() {
    const items = document.querySelectorAll('#valoracion-periodos-container .periodo-item');
    items.forEach((item, i) => {
        item.querySelector('.periodo-index').innerText = i + 1;
    });
}


function actualizarValoracion() {
    const items = document.querySelectorAll('#valoracion-periodos-container .periodo-item');
    let totalGlobal = 0;
    let diasTotales = 0;
    let htmlDesglose = '';

    const roomType = document.getElementById('val-meta-type').value;

    items.forEach((item, i) => {
        // Asegurar que los chips de suplementos se actualicen según el tipo global
        renderSuplementosDinamicos(item);

        const fechaIni = item.querySelector('.val-fecha-inicio').value;
        const fechaFin = item.querySelector('.val-fecha-fin').value;
        const basePrice = parseFloat(item.querySelector('.val-precio').value) || 0;
        
        let descuento = 0;
        if (item.dataset.discount === 'custom') {
            descuento = parseFloat(item.querySelector('.val-custom-input').value) || 0;
        } else {
            descuento = parseFloat(item.dataset.discount) || 0;
        }

        // Suplementos
        const supplement = parseFloat(item.dataset.suplemento) || 0;
        const childSupplement = parseFloat(item.dataset.suplementoNino) || 0;

        let nights = 0;
        if (fechaIni && fechaFin) {
            const start = new Date(fechaIni);
            const end = new Date(fechaFin);
            nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            if (nights < 0) nights = 0;
        }

        // Cálculo de estadía base
        let pricePerNight = 0;
        let formula = "";
        
        // Base according to occupancy
        let basePriceOccupancy = basePrice;
        let formulaBase = `${basePrice}`;

        if (roomType === 'Individual') {
            basePriceOccupancy = basePrice;
            formulaBase = `${basePrice}`;
        } else if (roomType === 'Doble') {
            basePriceOccupancy = basePrice * 2;
            formulaBase = `(${basePrice} * 2)`;
        } else if (roomType === 'Triple') {
            basePriceOccupancy = basePrice * 3;
            formulaBase = `(${basePrice} * 3)`;
        }

        // Apply occupancy formula
        pricePerNight = basePriceOccupancy + supplement + childSupplement;
        
        // Build formula string
        formula = formulaBase;
        if (supplement !== 0) formula += ` ${supplement < 0 ? '-' : '+'} ${Math.abs(supplement)}`;
        if (childSupplement > 0) formula += ` + ${childSupplement}`;

        // Subtotal noches (con descuento aplicado solo a la estadía)
        const subtotalEstadia = (nights * pricePerNight) * (1 - (descuento / 100));
        
        // Sumar conceptos extra (no se les aplica el descuento de la habitación)
        const concepts = JSON.parse(item.dataset.concepts || '[]');
        const totalExtras = concepts.reduce((sum, c) => sum + c.price, 0);
        
        const subtotalNeto = subtotalEstadia + totalExtras;
        
        totalGlobal += subtotalNeto;
        diasTotales += nights;

        // UI Updates for the item
        item.querySelector('.val-resumen-dias').innerText = nights;
        item.querySelector('.val-resumen-precio').innerText = pricePerNight.toFixed(2);
        item.querySelector('.val-resumen-formula').innerText = formula;
        item.querySelector('.val-resumen-subtotal').innerText = subtotalNeto.toFixed(2);
        
        // Reactividad: Si no hay días pero hay precio, el desglose ayuda a ver que "algo" ocurre
        if (nights > 0 || totalExtras !== 0 || pricePerNight > 0) {
            let conceptsHtml = '';
            if (concepts.length > 0) {
                conceptsHtml = concepts.map(c => `<div class="text-info" style="font-size: 0.65rem;">• ${c.name}: ${c.price < 0 ? '' : '+'}${c.price.toFixed(2)}€</div>`).join('');
            }

            htmlDesglose += `
                <div class="d-flex justify-content-between align-items-center mb-2 p-2 border-bottom small">
                    <div class="text-truncate" style="max-width: 70%">
                        <div class="fw-bold text-dark">P${i+1}: ${nights}n (${roomType || 'S/T'})</div>
                        <div class="text-muted" style="font-size: 0.7rem;">${Utils.formatDate(fechaIni)} - ${Utils.formatDate(fechaFin)}</div>
                        ${conceptsHtml}
                    </div>
                    <div class="text-end">
                        <div class="fw-bold text-primary">${subtotalNeto.toFixed(2)}€</div>
                        <div class="text-muted" style="font-size: 0.65rem;">${pricePerNight.toFixed(2)}€/n (-${descuento}%)</div>
                    </div>
                </div>`;
        }
    });

    document.getElementById('valoracion-total-global').innerText = Utils.formatCurrency(totalGlobal);
    document.getElementById('valoracion-total-dias').innerText = `${diasTotales} noches`;
    document.getElementById('valoracion-desglose-resumen').innerHTML = htmlDesglose || '<div class="text-center text-muted py-4">Sin datos</div>';
}

async function resetearValoracion(force = false) {
    if (!force && !await Ui.showConfirm(editingId ? "¿Cancelar edición?" : "¿Limpiar calculadora?")) return;

    const container = document.getElementById('valoracion-periodos-container');
    if (container) {
        container.querySelectorAll('.periodo-item').forEach(item => {
            delete item.dataset.suplemento;
            delete item.dataset.suplementoNino;
            delete item.dataset.concepts;
        });
        container.innerHTML = '';
    }
    
    document.getElementById('val-meta-room').value = '';
    document.getElementById('val-meta-booking').value = '';
    document.getElementById('val-meta-name').value = '';
    document.getElementById('val-meta-type').value = 'Doble';
    document.getElementById('val-meta-child').checked = false;
    document.getElementById('val-meta-comments').value = '';
    
    editingId = null;
    const btnSave = document.getElementById('btn-save-valuation');
    const labelReset = document.getElementById('label-reset-val');
    const btnReset = document.getElementById('btn-reset-valuation');

    if (btnSave) btnSave.innerHTML = '<i class="bi bi-save me-2"></i>Guardar en Lista';
    if (labelReset) labelReset.innerText = 'Limpiar';
    if (btnReset) {
        btnReset.classList.remove('btn-outline-warning');
        btnReset.classList.add('btn-light');
    }

    agregarPeriodoValoracion();
}

function guardarValoracionEnLista() {
    if (!Utils.validateUser()) return;
    const totalGlobal = parseFloat(document.getElementById('valoracion-total-global').innerText.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    if (totalGlobal <= 0) {
        Ui.showToast("Cálculo vacío", "warning");
        return;
    }

    const roomInput = document.getElementById('val-meta-room');
    const room = roomInput.value.trim() || '-';
    
    if (room !== '-' && !Utils.getHabitaciones().some(h => h.num === room.padStart(3, '0'))) {
        Ui.showToast(`La habitación ${room} no existe.`, "danger");
        roomInput.focus();
        return;
    }

    const bookingIndex = document.getElementById('val-meta-booking');
    const booking = bookingIndex.value.trim() || '-';
    
    if (booking === '-' || booking === '') {
        Ui.showToast("El Número de Reserva es obligatorio", "warning");
        bookingIndex.focus();
        return;
    }
    const name = document.getElementById('val-meta-name').value || '-';
    const type = document.getElementById('val-meta-type').value || '-';
    const hasChild = document.getElementById('val-meta-child').checked;
    const comments = document.getElementById('val-meta-comments').value || '';
    
    // Capturar periodos detallados
    const periodos = Array.from(document.querySelectorAll('#valoracion-periodos-container .periodo-item')).map((item, i) => {
        const descVal = item.dataset.discount === 'custom' ? parseFloat(item.querySelector('.val-custom-input').value) || 0 : parseFloat(item.dataset.discount);
        return {
            index: i + 1,
            inicio: Utils.formatDate(item.querySelector('.val-fecha-inicio').value),
            inicioRaw: item.querySelector('.val-fecha-inicio').value,
            fin: Utils.formatDate(item.querySelector('.val-fecha-fin').value),
            finRaw: item.querySelector('.val-fecha-fin').value,
            precio: parseFloat(item.querySelector('.val-precio').value) || 0,
            descuento: descVal,
            suplemento: parseFloat(item.dataset.suplemento) || 0,
            suplementoNino: parseFloat(item.dataset.suplementoNino) || 0,
            concepts: JSON.parse(item.dataset.concepts || '[]'),
            noches: parseInt(item.querySelector('.val-resumen-dias').innerText) || 0,
            subtotal: parseFloat(item.querySelector('.val-resumen-subtotal').innerText) || 0
        };
    }).filter(p => p.noches > 0);

    const registro = {
        id: editingId || Date.now(),
        timestamp: Date.now(),
        fechaHora: new Date().toLocaleString(),
        room,
        booking,
        name,
        type,
        hasChild,
        comments,
        receptionist: sessionService.getUser() || 'Sistema',
        periodos,
        totalNoches: parseInt(document.getElementById('valoracion-total-dias').innerText) || 0,
        total: totalGlobal
    };

    // Almacenamiento Dual
    let historial = LocalStorage.get(HISTORIAL_KEY, []);
    let historialPermanente = LocalStorage.get(HISTORIAL_PERMANENTE_KEY, []);

    if (editingId) {
        historial = historial.map(r => r.id === editingId || r.id.toString() === editingId.toString() ? registro : r);
        historialPermanente = historialPermanente.map(r => r.id === editingId || r.id.toString() === editingId.toString() ? registro : r);
        Ui.showToast("Valoración actualizada", "success");
    } else {
        historial.unshift(registro);
        historialPermanente.unshift(registro);
        Ui.showToast("Guardado en Histórico y Cola", "success");
    }
    
    LocalStorage.set(HISTORIAL_KEY, historial);
    LocalStorage.set(HISTORIAL_PERMANENTE_KEY, historialPermanente);
    
    resetearValoracion(true);
    
    // Cambiar a la vista de lista (Cola de Impresión) por defecto al guardar
    document.getElementById('btnValoracionVistaResumen').click();
}

function actualizarTablaHistorial() {
    const container = document.getElementById('valoracion-tabla-historial');
    if (!container) return;

    const historial = LocalStorage.get(HISTORIAL_KEY, []);
    if (historial.length === 0) {
        container.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Lista vacía</td></tr>';
        return;
    }

    container.innerHTML = historial.map(reg => `
        <tr>
            <td class="small text-muted">${reg.fechaHora}</td>
            <td>
                <div class="fw-bold text-truncate" style="max-width: 120px;">${reg.room !== '-' ? 'Hab: ' + reg.room : ''}</div>
                <div class="small text-muted text-truncate" style="max-width: 120px;">${reg.booking !== '-' ? 'Res: ' + reg.booking : ''}</div>
                <div class="small fw-bold text-truncate text-primary" style="max-width: 120px;">${reg.name && reg.name !== '-' ? reg.name : ''}</div>
            </td>
            <td>
                <div class="small">${reg.type !== '-' ? reg.type : 'N/A'}</div>
                <div class="small">${reg.hasChild ? '<span class="badge bg-info-subtle text-info">Con Niño</span>' : '<span class="text-muted opacity-50">Sin Niño</span>'}</div>
            </td>
            <td>${reg.receptionist}</td>
            <td class="small">${reg.periodos.length} per.</td>
            <td>${reg.totalNoches || reg.nochesTotales || 0}</td>
            <td class="text-end fw-bold text-primary">${Utils.formatCurrency(reg.total)}</td>
            <td class="text-center no-print">
                <div class="btn-group">
                    <button class="btn btn-outline-primary btn-sm" onclick="window.imprimirValoracionIndividual('${reg.id}')" title="Imprimir esta valoración">
                        <i class="bi bi-printer"></i>
                    </button>
                    <button class="btn btn-outline-primary btn-sm" onclick="window.editarValoracionHistorial('${reg.id}')" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm" onclick="window.eliminarValoracionHistorial('${reg.id}')" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function editarValoracionHistorial(id) {
    if (!Utils.validateUser()) return;
    const historial = LocalStorage.get(HISTORIAL_KEY) || [];
    const historialPermanente = LocalStorage.get(HISTORIAL_PERMANENTE_KEY) || [];
    
    const reg = historial.find(r => r.id === id || r.id.toString() === id.toString()) || 
                historialPermanente.find(r => r.id === id || r.id.toString() === id.toString());
    
    if (!reg) {
        Ui.showToast('No se encontró el registro', 'error');
        return;
    }

    editingId = id;
    
    // Cambiar a la vista de formulario
    const btnTrabajo = document.getElementById('btnValoracionVistaTrabajo');
    if (btnTrabajo) btnTrabajo.click();

    // Limpiar container
    const container = document.getElementById('valoracion-periodos-container');
    container.innerHTML = '';
    
    // Cargar metadata
    document.getElementById('val-meta-room').value = (reg.room && reg.room !== '-') ? reg.room : '';
    document.getElementById('val-meta-booking').value = (reg.booking && reg.booking !== '-') ? reg.booking : '';
    document.getElementById('val-meta-name').value = (reg.name && reg.name !== '-') ? reg.name : '';
    document.getElementById('val-meta-type').value = (reg.type || reg.habitacion || '');
    document.getElementById('val-meta-child').checked = !!(reg.hasChild || reg.nino);
    document.getElementById('val-meta-comments').value = reg.comments || '';
    
    // Cargar periodos
    reg.periodos.forEach(p => agregarPeriodoValoracion(p));

    // Cambiar texto de botón y vista
    document.getElementById('btn-save-valuation').innerHTML = '<i class="bi bi-check-circle me-2"></i>Actualizar Registro';
    
    const labelReset = document.getElementById('label-reset-val');
    const btnReset = document.getElementById('btn-reset-valuation');
    if (labelReset) labelReset.innerText = 'Cancelar Edición';
    if (btnReset) {
        btnReset.classList.remove('btn-light');
        btnReset.classList.add('btn-outline-warning');
    }

    document.getElementById('btnValoracionVistaTrabajo').click();
}

function cancelarEdicionValoracion() {
    resetearValoracion(true);
}

async function eliminarValoracionHistorial(id) {
    if (!Utils.validateUser()) return;
    if (await Ui.showConfirm("¿Eliminar de la lista?")) {
        const historial = LocalStorage.get(HISTORIAL_KEY) || [];
        const historialPermanente = LocalStorage.get(HISTORIAL_PERMANENTE_KEY) || [];

        LocalStorage.set(HISTORIAL_KEY, historial.filter(r => String(r.id) !== String(id)));
        LocalStorage.set(HISTORIAL_PERMANENTE_KEY, historialPermanente.filter(r => String(r.id) !== String(id)));
        
        actualizarTablaHistorial();
        actualizarTablaHistoricoPermanente();
    }
}

async function limpiarHistorialValoraciones() {
    if (await Ui.showConfirm("¿Borrar TODA la lista?")) {
        LocalStorage.remove(HISTORIAL_KEY);
        actualizarTablaHistorial();
    }
}

function imprimirSegunVista() {
    const isListView = !document.getElementById('valoracion-view-list').classList.contains('d-none');
    const isHistoryView = !document.getElementById('valoracion-view-historico').classList.contains('d-none');
    const isCheckView = !document.getElementById('valoracion-view-chequeo').classList.contains('d-none');
    
    if (isCheckView) {
        imprimirChequeoExterno();
    } else if (isHistoryView) {
        imprimirTablaCompactaHistorico();
    } else if (isListView) {
        imprimirHistorialCompleto();
    } else {
        imprimirValoracionActual();
    }
}

/**
 * IMPRESIÓN DE RESULTADOS DE CHEQUEO EXTERNO
 */
function imprimirChequeoExterno() {
    const tableBody = document.getElementById('val-check-results-table');
    const stats = document.getElementById('val-check-stats').innerText;
    
    if (!tableBody || tableBody.rows.length === 0) {
        Ui.showToast("No hay resultados de chequeo para imprimir", "warning");
        return;
    }

    let rowsHtml = '';
    Array.from(tableBody.rows).forEach(row => {
        rowsHtml += `
        <tr>
            <td>${row.cells[0].innerText}</td>
            <td>${row.cells[1].innerText}</td>
            <td>${row.cells[2].innerText}</td>
            <td>${row.cells[3].innerText}</td>
            <td style="text-align: center;">${row.cells[4].innerText}</td>
        </tr>`;
    });

    const html = `
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; margin: 20px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0d6efd; padding-bottom: 10px; margin-bottom: 20px; }
        .title { color: #0d6efd; margin: 0; font-size: 18pt; }
        .stats { background: #f8f9fa; padding: 10px; border-radius: 8px; margin-bottom: 20px; font-weight: bold; border: 1px solid #dee2e6; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #0d6efd; color: white; border: 1px solid #0d6efd; padding: 10px; text-align: left; font-size: 10pt; }
        td { border: 1px solid #dee2e6; padding: 8px; font-size: 9pt; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .footer { margin-top: 30px; font-size: 8pt; color: #666; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
    </style>
    <div class="header">
        <h1 class="title">Verificación de Valoraciones Externa</h1>
        <div style="text-align: right;">
            <strong>Fecha:</strong> ${new Date().toLocaleDateString()}<br>
            <strong>Usuario:</strong> ${window.currentUser || 'Recepcionista'}
        </div>
    </div>
    <div class="stats">${stats}</div>
    <table>
        <thead>
            <tr>
                <th>Reserva</th>
                <th>Pestaña (Externo)</th>
                <th>Histórico (Local)</th>
                <th>Diferencia</th>
                <th style="text-align: center;">Estado</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>
    <div class="footer">
        Este documento es un reporte de validación cruzada generado por Recepción Suite v2.0
    </div>`;

    if (window.PrintService) {
        window.PrintService.printHTML(html);
    } else {
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>Reporte Chequeo Valoración</title></head><body>${html}</body></html>`);
        win.document.close();
        setTimeout(() => { win.print(); win.close(); }, 500);
    }
}

function limpiarSegunVista() {
    // Esta función ya no es necesaria desde el toolbar, pero la mantenemos por si acaso 
    // o la eliminamos si estamos seguros. El usuario pidió quitar el botón de arriba.
    const isListView = !document.getElementById('valoracion-view-list').classList.contains('d-none');
    if (isListView) {
        limpiarHistorialValoraciones();
    } else {
        resetearValoracion();
    }
}

function imprimirValoracionActual() {
    const total = document.getElementById('valoracion-total-global').innerText;
    const room = document.getElementById('val-meta-room').value || '-';
    const booking = document.getElementById('val-meta-booking').value || '-';
    const receptionist = sessionService.getUser() || 'Sistema';
    const desglose = Array.from(document.querySelectorAll('#valoracion-desglose-resumen > div')).map(div => div.outerHTML).join('');

    const html = `
        <div style="font-family: Arial, sans-serif; padding: 40px; border: 2px solid #000; max-width: 750px; margin: 0 auto;">
            <div style="display:flex; justify-content:space-between; border-bottom: 2px solid #000; padding-bottom: 10px;">
                <h2 style="margin:0;">VALORACIÓN DE ESTANCIA</h2>
                <div style="text-align:right;">${new Date().toLocaleString()}</div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px 0;">
                <div><strong>Habitación:</strong> ${room}</div>
                <div><strong>Reserva:</strong> ${booking}</div>
                <div><strong>Valorado por:</strong> ${receptionist}</div>
                <div><strong>Tipo / Ocupación:</strong> ${document.getElementById('val-meta-type').value || 'N/A'} ${document.getElementById('val-meta-child').checked ? '(+ Niñ@)' : ''}</div>
                <div><strong>Estancia:</strong> ${document.getElementById('valoracion-total-dias').innerText} noches</div>
            </div>
            ${document.getElementById('val-meta-comments').value ? `<div style="padding: 10px; border: 1px dashed #ccc; margin-bottom: 20px; font-size: 10pt;"><strong>Notas:</strong> ${document.getElementById('val-meta-comments').value}</div>` : ''}
            <div style="border: 1px solid #ccc; padding: 10px; background:#f9f9f9; margin-bottom: 20px;">
                ${desglose}
            </div>
            <div style="display:flex; justify-content:space-between; background:#000; color:#fff; padding:15px;">
                <h3 style="margin:0;">TOTAL ESTIMADO</h3>
                <h3 style="margin:0;">${total}</h3>
            </div>
        </div>`;
    
    if (window.PrintService) window.PrintService.printHTML(html); else window.print();
}

function imprimirHistorialCompleto() {
    const historial = LocalStorage.get(HISTORIAL_KEY, []);
    if (!historial.length) return;

    let html = _getPrintStyles();
    let itemsHtml = '';
    
    historial.forEach((reg, i) => {
        if (i % 4 === 0) itemsHtml += '<div class="page-container">';
        itemsHtml += _generarHtmlItemValoracion(reg, historial.length - i);
        if ((i + 1) % 4 === 0 || i === historial.length - 1) itemsHtml += '</div>';
    });

    if (window.PrintService) {
        window.PrintService.printHTML(html + itemsHtml);
    } else {
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>Historial de Valoraciones</title></head><body>${html + itemsHtml}</body></html>`);
        win.document.close();
        win.print();
    }
}


function toggleSeccionBorradoMasivo() {
    const section = document.getElementById('seccion-mantenimiento-historico');
    const normalFilters = document.getElementById('filtros-historico-normal');
    const extraButtons = document.getElementById('botones-filtros-historico');
    const btnToggle = document.getElementById('btn-toggle-mantenimiento');
    const masterCol = document.getElementById('col-header-select-all');

    if (!section || !normalFilters) return;

    if (section.classList.contains('d-none')) {
        section.classList.remove('d-none');
        normalFilters.classList.add('d-none');
        if (extraButtons) extraButtons.classList.add('d-none');
        if (masterCol) masterCol.classList.remove('d-none');
        
        if (btnToggle) {
            btnToggle.innerText = 'Volver a Vista Normal';
            btnToggle.classList.replace('btn-outline-danger', 'btn-light');
        }

        // Fecha por defecto: hoy menos 2 días
        const dateEnd = new Date();
        dateEnd.setDate(dateEnd.getDate() - 2);
        document.getElementById('val-batch-delete-end').value = dateEnd.toISOString().split('T')[0];
        
        aplicarPrevisualizacionBorrado();
    } else {
        section.classList.add('d-none');
        normalFilters.classList.remove('d-none');
        if (extraButtons) extraButtons.classList.remove('d-none');
        if (masterCol) masterCol.classList.add('d-none');

        if (btnToggle) {
            btnToggle.innerHTML = '<i class="bi bi-eraser-fill me-1"></i>Modo Mantenimiento';
            btnToggle.classList.replace('btn-light', 'btn-outline-danger');
        }

        selectedValuationIds.clear();
        actualizarTablaHistoricoPermanente(); // Restaurar tabla normal
    }
}

function aplicarPrevisualizacionBorrado() {
    const filters = getFilteredHistoricalData(false, true);
    const today = new Date().toISOString().split('T')[0];
    const filterDeparture = document.getElementById('val-batch-delete-end').value;

    // Solo seleccionamos aquellas cuya SALIDA ya pasó y coinciden con el filtro
    const targets = filters.filter(reg => {
        const departure = getIsoDateFromPeriod(reg.periodos[reg.periodos.length - 1], true);
        return departure <= (filterDeparture || today);
    });
    
    selectedValuationIds = new Set(targets.map(r => r.id.toString()));
    
    const master = document.getElementById('val-master-checkbox');
    if (master) master.checked = (selectedValuationIds.size === targets.length && targets.length > 0);

    actualizarTablaHistoricoPermanente(false, true);

    const counter = document.getElementById('batch-delete-count-preview');
    if (counter) {
        counter.innerHTML = `<i class="bi bi-info-circle me-1"></i> <strong>${filters.length}</strong> reg. en total. <strong>${selectedValuationIds.size}</strong> marcados para borrar.`;
    }
}

function getFilteredHistoricalData(smartFilter = false, batchPreview = false) {
    let data = LocalStorage.get(HISTORIAL_PERMANENTE_KEY) || [];
    let filterArrival = document.getElementById('val-filter-arrival').value;
    let filterDeparture = document.getElementById('val-filter-departure').value;
    
    if (batchPreview) {
        filterDeparture = document.getElementById('val-batch-delete-end').value;
    }

    const today = new Date().toISOString().split('T')[0];

    return data.filter(reg => {
        if (!reg.periodos || reg.periodos.length === 0) return false;
        
        const arrival = getIsoDateFromPeriod(reg.periodos[0], false);
        const departure = getIsoDateFromPeriod(reg.periodos[reg.periodos.length - 1], true);

        if (batchPreview) {
            // En modo mantenimiento queremos ver TODO para comparar, 
            // no filtramos el array principal, el filtrado visual/selección se hace en el render.
            return true;
        }

        // Filtro Inteligente (Reservas Activas por defecto)
        if (smartFilter) {
            if (!arrival || !departure) return false;
            return arrival <= today && (departure >= today || (arrival === today && departure === today));
        }

        // Filtros Manuales (si existen)
        if (filterArrival && arrival < filterArrival) return false;
        if (filterDeparture && departure > filterDeparture) return false;

        return true;
    });
}

function actualizarTablaHistoricoPermanente(smartFilter = false, batchPreview = false) {
    const container = document.getElementById('valoracion-tabla-historico-permanente');
    if (!container) return;

    const filtered = getFilteredHistoricalData(smartFilter, batchPreview);
    const today = new Date().toISOString().split('T')[0];

    if (filtered.length === 0) {
        container.innerHTML = `<tr><td colspan="${batchPreview ? '7' : '6'}" class="text-center text-muted py-5">
            <i class="bi bi-inbox fs-1 d-block mb-2 opacity-25"></i>
            No se encontraron valoraciones ${batchPreview ? 'en este rango de fechas' : (smartFilter ? 'activas hoy (' + today + ')' : 'con estos filtros')}.
        </td></tr>`;
        return;
    }

    container.innerHTML = filtered.map(reg => {
        const idStr = reg.id.toString();
        const isSelected = selectedValuationIds.has(idStr);
        const arrival = getIsoDateFromPeriod(reg.periodos[0], false);
        const departure = getIsoDateFromPeriod(reg.periodos[reg.periodos.length - 1], true);
        
        const isChild = reg.hasChild || reg.nino || false;
        const occupantType = reg.type || reg.habitacion || 'S/T';

        // Lógica de colores en Mantenimiento
        let rowClass = "";
        let isInactive = false;
        if (batchPreview) {
            const filterDeparture = document.getElementById('val-batch-delete-end').value || today;
            const isActive = arrival <= today && (departure >= today || (arrival === today && departure === today));
            isInactive = departure <= filterDeparture;

            if (isActive) rowClass = "table-success fw-semibold";
            else if (isSelected) rowClass = "table-danger";
            else if (isInactive) rowClass = "border-danger border-opacity-25"; // Candidato pero no seleccionado
            else rowClass = "opacity-50";
        }

        return `
            <tr class="${rowClass}">
                <td class="text-center">
                    ${batchPreview && !rowClass.includes('table-success') ? `
                        <div class="form-check d-flex justify-content-center">
                            <input class="form-check-input" type="checkbox" value="${idStr}" 
                                ${isSelected ? 'checked' : ''} 
                                onchange="window.toggleValuationSelection('${idStr}')">
                        </div>
                    ` : (batchPreview ? '<i class="bi bi-check-circle-fill text-success" title="Activa"></i>' : '')}
                </td>
                <td class="small text-muted">${Utils.formatDate(reg.timestamp || reg.id)}</td>
                <td>
                    <div class="fw-bold text-dark">${reg.room && reg.room !== '-' ? reg.room : '---'}</div>
                    <div class="small text-muted">${reg.booking && reg.booking !== '-' ? reg.booking : 'Sin reserva'}</div>
                    <div class="small fw-bold text-primary">${reg.name && reg.name !== '-' ? reg.name : ''}</div>
                </td>
                <td>
                    <span class="badge bg-light text-dark border">${occupantType}</span>
                    ${isChild ? '<span class="badge bg-info text-white ms-1">Niño</span>' : ''}
                </td>
                <td>
                    <div class="small">
                        <span class="text-success fw-bold">${Utils.formatDate(arrival)}</span> 
                        <i class="bi bi-arrow-right mx-1 opacity-50"></i> 
                        <span class="text-danger fw-bold">${Utils.formatDate(departure)}</span>
                    </div>
                    <div class="text-muted" style="font-size: 0.75rem;">${reg.totalNoches || reg.nochesTotales || 0} noches / ${reg.periodos.length} per.</div>
                </td>
                <td class="text-end fw-bold text-primary fs-6">${Utils.formatCurrency(reg.total)}</td>
                <td class="text-center">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" title="Imprimir" onclick="window.imprimirValoracionIndividual('${reg.id}')">
                            <i class="bi bi-printer"></i>
                        </button>
                        <button class="btn btn-outline-primary" title="Editar/Ver" onclick="window.editarValoracionHistorial('${reg.id}')">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-outline-danger" title="Eliminar" onclick="window.eliminarValoracionHistorial('${reg.id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function toggleValuationSelection(id) {
    const idStr = id.toString();
    if (selectedValuationIds.has(idStr)) {
        selectedValuationIds.delete(idStr);
    } else {
        selectedValuationIds.add(idStr);
    }
    
    // Update counter and row appearance
    const filtered = getFilteredHistoricalData(false, true);
    const counter = document.getElementById('batch-delete-count-preview');
    if (counter) {
        counter.innerHTML = `<i class="bi bi-info-circle me-1"></i> <strong>${filtered.length}</strong> registros encontrados. <strong>${selectedValuationIds.size}</strong> seleccionados para borrar.`;
    }

    // Refresh only the table rows appearance without full reload if possible,
    // but for simplicity we re-render as it's cleaner.
    actualizarTablaHistoricoPermanente(false, true);
    
    // Update master checkbox
    const master = document.getElementById('val-master-checkbox');
    if (master) master.checked = (selectedValuationIds.size === filtered.length && filtered.length > 0);
}

function toggleSelectAllValuations(checked) {
    const filtered = getFilteredHistoricalData(false, true);
    if (checked) {
        selectedValuationIds = new Set(filtered.map(r => r.id.toString()));
    } else {
        selectedValuationIds.clear();
    }
    
    const counter = document.getElementById('batch-delete-count-preview');
    if (counter) {
        counter.innerHTML = `<i class="bi bi-info-circle me-1"></i> <strong>${filtered.length}</strong> registros encontrados. <strong>${selectedValuationIds.size}</strong> seleccionados para borrar.`;
    }
    actualizarTablaHistoricoPermanente(false, true);
}

function seleccionarObsoletos() {
    const date = new Date();
    date.setDate(date.getDate() - 2);
    const dateStr = date.toISOString().split('T')[0];
    
    document.getElementById('val-batch-delete-end').value = dateStr;
    aplicarPrevisualizacionBorrado();
    Ui.showToast("Se han seleccionado registros anteriores a " + Utils.formatDate(dateStr), "info");
}

function setFiltroReservasActivas() {
    document.getElementById('val-filter-arrival').value = '';
    document.getElementById('val-filter-departure').value = '';
    
    // Forzar desactivación total del modo mantenimiento para evitar estados inconsistentes
    desactivarMantenimientoForce();

    actualizarTablaHistoricoPermanente(true);
}

function limpiarFiltrosHistorico() {
    document.getElementById('val-filter-arrival').value = '';
    document.getElementById('val-filter-departure').value = '';
    
    desactivarMantenimientoForce();

    actualizarTablaHistoricoPermanente(false);
}

async function eliminarRangoHistorialPermanente() {
    if (!Utils.validateUser()) return;

    if (selectedValuationIds.size === 0) {
        return Ui.showToast("No hay registros seleccionados para borrar", "warning");
    }

    const msg = `¿Desea borrar permanentemente los ${selectedValuationIds.size} registros seleccionados? Esta acción no se puede deshacer.`;
    
    if (await Ui.showConfirm(msg)) {
        let historial = LocalStorage.get(HISTORIAL_PERMANENTE_KEY, []);
        const totalAntes = historial.length;

        // Filtramos para MANTENER lo que NO está en el Set de seleccionados
        historial = historial.filter(reg => !selectedValuationIds.has(reg.id.toString()));

        const borrados = totalAntes - historial.length;
        LocalStorage.set(HISTORIAL_PERMANENTE_KEY, historial);
        
        selectedValuationIds.clear();
        toggleSeccionBorradoMasivo(); // Cierra y refresca
        
        Ui.showToast(`Se han eliminado ${borrados} registros del histórico permanente.`, "success");
    }
}

/**
 * RESETEA TOTALMENTE EL ESTADO DEL MODO MANTENIMIENTO
 * Asegura que el botón, los paneles y las variables vuelvan a su estado normal.
 */
function desactivarMantenimientoForce() {
    const section = document.getElementById('seccion-mantenimiento-historico');
    const normalFilters = document.getElementById('filtros-historico-normal');
    const extraButtons = document.getElementById('botones-filtros-historico');
    const btnToggle = document.getElementById('btn-toggle-mantenimiento');
    const masterCol = document.getElementById('col-header-select-all');

    if (section) section.classList.add('d-none');
    if (normalFilters) normalFilters.classList.remove('d-none');
    if (extraButtons) extraButtons.classList.remove('d-none');
    if (masterCol) masterCol.classList.add('d-none');
    
    if (btnToggle) {
        btnToggle.innerHTML = '<i class="bi bi-eraser-fill me-1"></i>Modo Mantenimiento';
        btnToggle.classList.replace('btn-light', 'btn-outline-danger');
    }

    selectedValuationIds.clear();
}



async function ejecutarChequeoIniciativa() {
    const area = document.getElementById('val-check-paste-area');
    const tableBody = document.getElementById('val-check-results-table');
    const stats = document.getElementById('val-check-stats');
    
    const text = area.value.trim();
    if (!text) return Ui.showToast("Pega datos para analizar", "warning");

    const lines = text.split('\n');
    const historical = LocalStorage.get(HISTORIAL_PERMANENTE_KEY) || [];
    
    let matches = 0;
    let mismatches = 0;
    let notFound = 0;
    
    tableBody.innerHTML = '';
    
    lines.forEach((line, index) => {
        // Ignorar encabezados si el usuario pega la tabla completa
        if (line.toLowerCase().includes('reserva') && line.toLowerCase().includes('total')) return;

        // Intentar separar por tabulador o espacio múltiple
        const parts = line.split(/\t|\s{2,}/).map(p => p.trim()).filter(p => p);
        if (parts.length < 2) return;

        let bookingNum = null;
        let externalPrice = null;

        // SI PARECE NUESTRO FORMATO (9 columnas), usamos índices fijos
        if (parts.length === 9) {
            bookingNum = parts[2]; // Reserva (Columna 3)
            externalPrice = parseFloat(parts[8].replace(/[^\d.,-]/g, '').replace(',', '.')); // Total (Columna 9)
        } else {
            // HEURÍSTICA MEJORADA para otros formatos
            // Buscamos algo que no sea una fecha y que parezca un ID o reserva
            bookingNum = parts.find(p => !p.includes('/') && (/^\d{5,15}$/.test(p) || p.startsWith('RES-') || p.length > 5));
            externalPrice = parts.map(p => parseFloat(p.replace(/[^\d.,-]/g, '').replace(',', '.'))).find(p => !isNaN(p) && p > 0);
        }

        if (!bookingNum || isNaN(externalPrice)) return;

        // Buscar en histórico
        const record = historical.find(r => r.booking === bookingNum || String(r.booking).includes(bookingNum) || bookingNum.includes(String(r.booking)));
        
        let statusHtml = '';
        let diffHtml = '';
        let localPriceStr = '---';

        if (record) {
            const localPrice = record.total;
            localPriceStr = Utils.formatCurrency(localPrice);
            const diff = Math.abs(localPrice - externalPrice);
            
            if (diff <= 1.0) {
                matches++;
                statusHtml = '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Coincide</span>';
                diffHtml = '<span class="text-success">0.00€</span>';
            } else {
                mismatches++;
                statusHtml = '<span class="badge bg-warning text-dark"><i class="bi bi-exclamation-triangle me-1"></i>Diferencia</span>';
                diffHtml = `<span class="text-danger fw-bold">${(localPrice - externalPrice).toFixed(2)}€</span>`;
            }
        } else {
            notFound++;
            statusHtml = '<span class="badge bg-secondary"><i class="bi bi-question-circle me-1"></i>No encontrado</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold">${bookingNum}</td>
            <td>${Utils.formatCurrency(externalPrice)}</td>
            <td>${localPriceStr}</td>
            <td>${diffHtml || '---'}</td>
            <td class="text-center">${statusHtml}</td>
        `;
        tableBody.appendChild(tr);
    });

    stats.innerHTML = `Analizados: ${matches + mismatches + notFound} | <span class="text-success">OK: ${matches}</span> | <span class="text-warning">Error: ${mismatches}</span> | <span class="text-muted">Desconocidos: ${notFound}</span>`;
    
    if (matches + mismatches + notFound === 0) {
        Ui.showToast("No se detectaron datos válidos en el texto pegado", "danger");
    }
}

function limpiarResultadosChequeo() {
    document.getElementById('val-check-results-table').innerHTML = '';
    document.getElementById('val-check-stats').innerText = 'Esperando datos...';
}

async function copiarHistorialPortapapeles() {
    // Solo copiamos las reservas que están activas hoy basándonos en el filtro inteligente
    const activeData = getFilteredHistoricalData(true);

    if (activeData.length === 0) {
        return Ui.showToast("No hay reservas activas para copiar", "warning");
    }

    // Cabecera TSV
    let tsv = "Fecha Reg\tHabitación\tReserva\tNombre\tOcupación\tLlegada\tSalida\tNoches\tTotal (€)\n";

    activeData.forEach(reg => {
        const arrival = getIsoDateFromPeriod(reg.periodos[0], false);
        const departure = getIsoDateFromPeriod(reg.periodos[reg.periodos.length - 1], true);
        const occupantType = reg.type || reg.habitacion || '-';
        const total = reg.total.toString().replace('.', ',');

        tsv += `${Utils.formatDate(reg.timestamp || reg.id)}\t`;
        tsv += `${reg.room || '-'}\t`;
        tsv += `${reg.booking || '-'}\t`;
        tsv += `${reg.name || '-'}\t`;
        tsv += `${occupantType}${reg.hasChild ? ' (Niño)' : ''}\t`;
        tsv += `${Utils.formatDate(arrival)}\t`;
        tsv += `${Utils.formatDate(departure)}\t`;
        tsv += `${reg.totalNoches || 0}\t`;
        tsv += `${total}\n`;
    });

    try {
        await navigator.clipboard.writeText(tsv);
        Ui.showToast("Historial copiado al portapapeles", "success");
    } catch (err) {
        console.error("Error al copiar:", err);
        Ui.showToast("Error al copiar al portapapeles", "danger");
    }
}

/**
 * IMPRESIÓN COMPACTA DEL HISTÓRICO
 */
function imprimirTablaCompactaHistorico() {
    const data = LocalStorage.get(HISTORIAL_PERMANENTE_KEY) || [];
    const filterArrival = document.getElementById('val-filter-arrival').value;
    const filterDeparture = document.getElementById('val-filter-departure').value;
    
    const filtered = data.filter(reg => {
        if (!reg.periodos || reg.periodos.length === 0) return false;
        const arrival = getIsoDateFromPeriod(reg.periodos[0], false);
        const departure = getIsoDateFromPeriod(reg.periodos[reg.periodos.length - 1], true);
        if (filterArrival && arrival < filterArrival) return false;
        if (filterDeparture && departure > filterDeparture) return false;
        return true;
    });

    if (filtered.length === 0) {
        Ui.showToast("No hay datos para imprimir con los filtros actuales", "warning");
        return;
    }

    let html = `
    <style>
        table { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 10pt; }
        th { background: #f0f0f0; border: 1px solid #ccc; padding: 8px; text-align: left; }
        td { border: 1px solid #eee; padding: 6px 8px; }
        h2 { font-family: sans-serif; text-align: center; margin-bottom: 20px; }
        .text-end { text-align: right; }
        .fw-bold { font-weight: bold; }
    </style>
    <h2>ARCHIVO HISTÓRICO - VALORACIONES</h2>
    <table>
        <thead>
            <tr>
                <th>Llegada</th>
                <th>Salida</th>
                <th>Reserva</th>
                <th>Nombre</th>
                <th>Hab.</th>
                <th class="text-end">Precio Total</th>
            </tr>
        </thead>
        <tbody>
            ${filtered.sort((a,b) => b.timestamp - a.timestamp).map(reg => {
                const arrival = getIsoDateFromPeriod(reg.periodos[0], false);
                const departure = getIsoDateFromPeriod(reg.periodos[reg.periodos.length - 1], true);
                return `
                <tr>
                    <td>${Utils.formatDate(arrival)}</td>
                    <td>${Utils.formatDate(departure)}</td>
                    <td>${reg.booking || '-'}</td>
                    <td class="fw-bold">${reg.name || '-'}</td>
                    <td>${reg.room || '-'}</td>
                    <td class="text-end fw-bold">${Utils.formatCurrency(reg.total)}</td>
                </tr>`;
            }).join('')}
        </tbody>
    </table>`;

    if (window.PrintService) window.PrintService.printHTML(html); else {
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>Historial Compacto</title></head><body>${html}</body></html>`);
        win.document.close();
        win.print();
    }
}

function _getPrintStyles() {
    return `
    <style>
        @media print {
            @page { size: A4; margin: 0; }
            body { margin: 0; padding: 0; }
            .page-container { width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; display: flex; flex-direction: column; }
            .valuation-item { 
                height: 74.25mm; /* Exact 1/4 of A4 height */
                border-bottom: 1px dashed #ccc; 
                padding: 10mm; 
                box-sizing: border-box; 
                position: relative;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
            .valuation-item:nth-child(4n) { border-bottom: none; }
        }
        .header-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; border-bottom: 2px solid #333; padding-bottom: 4px;}
        .data-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 10pt; margin-bottom: 8px; }
        .periods-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 8px 0; }
        .periods-table th { text-align: left; color: #666; border-bottom: 1px solid #eee; padding: 4px 0; }
        .periods-table td { padding: 4px 0; border-bottom: 1px solid #f9f9f9; }
        .total-box { display: flex; justify-content: space-between; align-items: center; background: #f4f4f4; padding: 8px 12px; border-radius: 4px; font-weight: bold; font-size: 12pt; }
        .label-sm { font-size: 8pt; color: #888; text-transform: uppercase; display: block; }
    </style>`;
}

function _generarHtmlItemValoracion(reg, num) {
    return `
    <div class="valuation-item">
        <div class="header-row">
            <span style="font-weight: bold; font-size: 14pt;">VALORACIÓN ${num ? '#' + num : ''}</span>
            <span style="color: #666; font-size: 9pt;">${reg.fechaHora || Utils.formatDate(reg.timestamp)}</span>
        </div>
        
        <div class="data-row">
            <div><span class="label-sm">Habitación</span><strong>${reg.room || '-'}</strong></div>
            <div><span class="label-sm">Reserva</span><strong>${reg.booking || '-'}</strong></div>
            <div><span class="label-sm">Ocupación</span><span>${reg.type || reg.habitacion || 'N/A'} ${(reg.hasChild || reg.nino) ? '(Niño)' : ''}</span></div>
            <div><span class="label-sm">Valorado por</span><strong>${reg.receptionist || '-'}</strong></div>
        </div>
        
        ${reg.comments ? `<div style="font-size: 8pt; background: #fff; border-left: 3px solid #eee; padding-left: 5px; margin-bottom: 5px;"><strong>Nota:</strong> ${reg.comments}</div>` : ''}
        
        <table class="periods-table">
            <thead>
                <tr>
                    <th>Periodo / Conceptos</th>
                    <th>Precio/n</th>
                    <th style="text-align: right;">Subtotal</th>
                </tr>
            </thead>
            <tbody>
                ${reg.periodos.map(p => `
                    <tr>
                        <td>
                            <div>${p.inicio} - ${p.fin} (${p.noches}n) ${p.descuento > 0 ? `<small>(-${p.descuento}%)</small>` : ''}</div>
                            ${(p.concepts || []).map(c => `<div style="font-size: 8pt; color: #666; padding-left: 10px;">• ${c.name}: ${c.price < 0 ? '' : '+'}${c.price.toFixed(2)}€</div>`).join('')}
                        </td>
                        <td>${(parseFloat(p.precio) || 0).toFixed(2)}€</td>
                        <td style="text-align: right; font-weight: bold;">${(parseFloat(p.subtotal) || 0).toFixed(2)}€</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="total-box">
            <span>TOTAL ESTIMADO</span>
            <span style="color: #0d6efd;">${Utils.formatCurrency(reg.total)}</span>
        </div>
    </div>`;
}

function imprimirValoracionIndividual(id) {
    const historial = LocalStorage.get(HISTORIAL_KEY) || [];
    const historialPermanente = LocalStorage.get(HISTORIAL_PERMANENTE_KEY) || [];
    
    const reg = historial.find(r => r.id === id || r.id.toString() === id.toString()) || 
                historialPermanente.find(r => r.id === id || r.id.toString() === id.toString());
    
    if (!reg) return Ui.showToast("No se encontró el registro", "error");

    const html = _getPrintStyles() + '<div class="page-container">' + _generarHtmlItemValoracion(reg) + '</div>';
    
    if (window.PrintService) {
        window.PrintService.printHTML(html);
    } else {
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>Valoración Individual</title></head><body>${html}</body></html>`);
        win.document.close();
        win.print();
    }
}
