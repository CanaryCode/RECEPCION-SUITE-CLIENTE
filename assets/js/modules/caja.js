import { APP_CONFIG } from "../core/Config.js";
import { Utils } from "../core/Utils.js";
import { Ui } from "../core/Ui.js";
import { sessionService } from "../services/SessionService.js";
import { cajaService } from "../services/CajaService.js";
import { valesService } from "../services/ValesService.js";
import { Modal } from "../core/Modal.js";
import { PdfService } from "../core/PdfService.js";

/**
 * MÓDULO DE GESTIÓN DE CAJA (caja.js)
 * ----------------------------------
 * Maneja el arqueo diario del hotel: recuento de efectivo, gestión de vales,
 * desembolsos de caja y generación de informes de cierre (PDF y Email).
 */

let interfazCajaGenerada = false; // Flag para evitar duplicar inputs monetarios
let listaVales = [];             // { id, concepto, importe } - IOUs (Pagos pendientes)
let listaDesembolsos = [];       // { id, concepto, importe } - Pagos directos desde caja
let fondoCajaValue = (APP_CONFIG.CAJA?.FONDO !== undefined) ? APP_CONFIG.CAJA.FONDO : -2000;

// ... (existing helper functions)

/**
 * GESTIÓN DE VALES
 * Los vales representan dinero que el hotel debe (o entregó) a un empleado/servicio
 * y que se resta de la recaudación final.
 */

window.abrirModalVales = async () => {
  await importarValesAutorizados();
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("modalVales"));
  renderVales();
  modal.show();
  setTimeout(() => document.getElementById("vale_receptor")?.focus(), 500);
};

window.agregarVale = async (e) => {
  e.preventDefault();

  const usuario = Utils.validateUser();
  if (!usuario) return;

  const receptorIn = document.getElementById("vale_receptor");
  const conceptoIn = document.getElementById("vale_concepto");
  const comentarioIn = document.getElementById("vale_comentario");
  const importeIn = document.getElementById("vale_importe");

  const receptor = receptorIn?.value?.trim() || "Recepción (Caja)";
  const concepto = conceptoIn.value.trim();
  const comentario = comentarioIn?.value?.trim() || "";
  const importe = parseFloat(importeIn.value);

  if (concepto && importe > 0) {
    // 1. Crear el vale REAL en el servicio central
    await valesService.createVale({
      receptor: receptor,
      concepto: concepto,
      comentario: comentario,
      importe: importe,
      usuario: usuario,
      estado: "Pendiente",
      firmado: true
    });

    // 2. Limpiar formulario
    if (receptorIn) receptorIn.value = "";
    conceptoIn.value = "";
    if (comentarioIn) comentarioIn.value = "";
    importeIn.value = "";
    if (receptorIn) receptorIn.focus(); else conceptoIn.focus();

    // 3. Sincronizar automáticamente la lista de caja para incluir el nuevo vale
    await importarValesAutorizados();

    Ui.showToast("Vale registrado y sincronizado.", "success");
  }
};

window.eliminarVale = (id) => {
  listaVales = listaVales.filter((v) => v.id !== id);
  cajaService.saveVales(listaVales);
  renderVales();
  calcularCaja();
};

/**
 * IMPORTAR VALES DESDE EL MÓDULO DE VALES
 * Busca vales con estado 'Pendiente' y que estén 'Firmados' (Autorizados).
 */
async function importarValesAutorizados() {
  try {
    // ASEGURAR QUE EL SERVICIO ESTÉ INICIALIZADO Y SINCRONIZADO (FRESH DATA)
    await valesService.reload();

    const todosLosVales = valesService.getAll();
    if (!todosLosVales || todosLosVales.length === 0) {
       listaVales = listaVales.filter(v => v.origin !== 'vales_module');
       renderVales();
       return;
    }

    // Filtrar autorizados (Firmados) y que NO estén contabilizados aún
    const autorizados = todosLosVales.filter(v => 
      v.estado !== 'Contabilizado' && v.firmado === true
    );

    let huboCambios = false;

    // FILTRAR LOGICA DE IMPORTACIÓN: Limpiar los vales que vienen del módulo para evitar duplicados e inconsistencias
    // Mantenemos los vales creados 'a mano' en esta sesión si los hubiera (aunque ahora todos deberían ir al servicio)
    listaVales = listaVales.filter(v => v.origin !== 'vales_module');

    autorizados.forEach(v => {
      listaVales.push({
        id: Date.now() + Math.random(), // ID local para la lista de caja
        moduloId: v.id,                 // Referencia al vale original
        receptor: v.receptor,           // Guardar receptor para el modal
        comentario: v.comentario,       // Guardar comentario para el modal
        concepto: `[VALE] ${v.receptor}: ${v.concepto}`,
        importe: v.importe,
        origin: 'vales_module'
      });
      huboCambios = true;
    });

    if (huboCambios) {
      cajaService.saveVales(listaVales);
      renderVales();
      calcularCaja();
      console.log(`[Caja] Se han importado ${autorizados.length} vales autorizados.`);
    }
  } catch (error) {
    console.error("Error al importar vales autorizados:", error);
  }
}

function renderVales() {
  // 1. Render en Modal
  const total = listaVales.reduce((sum, v) => sum + v.importe, 0);
  const totalLabel = document.getElementById("modalValesTotal");
  if (totalLabel) totalLabel.innerText = Utils.formatCurrency(total);

  const container = document.getElementById('listaVales');
  if (container) {
    if (listaVales.length === 0) {
      container.innerHTML = `<div class="text-center py-3 text-muted small">No hay vales registrados</div>`;
    } else {
      container.innerHTML = listaVales.map(v => `
        <div class="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
            <div class="d-flex flex-column" style="min-width: 0;">
                <span class="fw-bold text-dark small text-break" style="word-wrap: break-word;">${v.concepto}</span>
                <span class="text-muted x-small">Receptor: <span class="fw-bold text-dark">${v.receptor || 'No especificado'}</span></span>
                ${v.comentario ? `<span class="text-muted x-small italic">Obs: ${v.comentario}</span>` : ''}
            </div>
            <div class="d-flex align-items-center flex-shrink-0 ms-2">
                <span class="fw-bold text-primary me-3">${Utils.formatCurrency(v.importe)}</span>
                <button class="btn btn-sm btn-outline-danger border-0 p-1" onclick="eliminarVale(${v.id})" data-bs-toggle="tooltip" data-bs-title="Eliminar Vale">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
      `).join('');
    }
  }

  // 3. Render para IMPRESIÓN / PDF (Compact Grid - Ancho Completo)
  const printContainer = document.getElementById("print-vales-details");
  if (printContainer) {
    if (listaVales.length > 0) {
      printContainer.innerHTML = `
                <div class="border border-secondary rounded p-1 mt-1" style="background-color: #f8f9fa;">
                    <div class="d-flex justify-content-between align-items-center border-bottom border-secondary mb-1 pb-1">
                        <h6 class="fw-bold mb-0 text-dark" style="font-size: 11px;">DESGLOSE VALES (${listaVales.length})</h6>
                    </div>
                    <div class="d-flex flex-column gap-1" style="overflow: hidden;">
                        ${listaVales
                          .map(
                            (v) => `
                            <div class="d-flex justify-content-between border-bottom py-1" style="font-size: 10px; width: 100%; word-break: break-all;">
                                <span class="text-wrap me-2" style="max-width: 70%;">${v.concepto}</span>
                                <span class="fw-bold text-primary">${Utils.formatCurrency(v.importe)}</span>
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                </div>
            `;
    } else {
      printContainer.innerHTML = "";
    }
  }
}

/**
 * GESTIÓN DE DESEMBOLSOS
 * Pagos directos realizados desde la caja para compras rápidas o reparaciones.
 */

window.abrirModalDesembolsos = () => {
  const modal = bootstrap.Modal.getOrCreateInstance(
    document.getElementById("modalDesembolsos"),
  );
  renderDesembolsos();
  modal.show();
  setTimeout(
    () => document.getElementById("desembolso_concepto")?.focus(),
    500,
  );
};

window.agregarDesembolso = (e) => {
  e.preventDefault();
  const conceptoIn = document.getElementById("desembolso_concepto");
  const importeIn = document.getElementById("desembolso_importe");

  const concepto = conceptoIn.value.trim();
  const importe = parseFloat(importeIn.value);

  if (concepto && importe > 0) {
    listaDesembolsos.push({
      id: Date.now(),
      concepto,
      importe,
    });

    cajaService.saveDesembolsos(listaDesembolsos);

    conceptoIn.value = "";
    importeIn.value = "";
    conceptoIn.focus();

    renderDesembolsos();
    calcularCaja();
  }
};

window.eliminarDesembolso = (id) => {
  listaDesembolsos = listaDesembolsos.filter((d) => d.id !== id);
  cajaService.saveDesembolsos(listaDesembolsos);
  renderDesembolsos();
  calcularCaja();
};

function renderDesembolsos() {
  // 1. Render en Modal
  const total = listaDesembolsos.reduce((sum, d) => sum + d.importe, 0);
  const totalLabel = document.getElementById("modalDesembolsosTotal");
  if (totalLabel) totalLabel.innerText = Utils.formatCurrency(total);

  const container = document.getElementById('listaDesembolsos');
  if (container) {
    if (listaDesembolsos.length === 0) {
      container.innerHTML = `<div class="text-center py-3 text-muted small">No hay desembolsos registrados</div>`;
    } else {
      container.innerHTML = listaDesembolsos.map(d => `
        <div class="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
            <div class="d-flex flex-column" style="min-width: 0;">
                <span class="fw-bold text-dark small text-break" style="word-wrap: break-word;">${d.concepto}</span>
            </div>
            <div class="d-flex align-items-center flex-shrink-0 ms-2">
                <span class="fw-bold text-primary me-3">${Utils.formatCurrency(d.importe)}</span>
                <button class="btn btn-sm btn-outline-danger border-0 p-1" onclick="eliminarDesembolso(${d.id})" data-bs-toggle="tooltip" data-bs-title="Eliminar Desembolso">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
      `).join('');
    }
  }

  // 3. Render para IMPRESIÓN / PDF (Compact Grid - Ancho Completo)
  // Para impresión, mantenemos un toque distintivo pero sutil, o lo unificamos también?
  // User dijo "mismo color que todo", así que usaremos estilo neutro/gris similar a Vales.
  const printContainer = document.getElementById("print-desembolsos-details");
  if (printContainer) {
    if (listaDesembolsos.length > 0) {
      printContainer.innerHTML = `
                <div class="border border-secondary rounded p-1 mt-1" style="background-color: #f8f9fa;">
                    <div class="d-flex justify-content-between align-items-center border-bottom border-secondary mb-1 pb-1">
                        <h6 class="fw-bold mb-0 text-dark" style="font-size: 11px;">DESGLOSE DESEMBOLSOS (${listaDesembolsos.length})</h6>
                    </div>
                    <div class="d-flex flex-column gap-1" style="overflow: hidden;">
                        ${listaDesembolsos
                          .map(
                            (d) => `
                            <div class="d-flex justify-content-between border-bottom py-1" style="font-size: 10px; width: 100%; word-break: break-all;">
                                <span class="text-wrap me-2" style="max-width: 70%;">${d.concepto}</span>
                                <span class="fw-bold text-primary">${Utils.formatCurrency(d.importe)}</span>
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                </div>
            `;
    } else {
      printContainer.innerHTML = "";
    }
  }
}

/**
 * INICIALIZACIÓN
 * Prepara la interfaz monetaria y configura los cálculos automáticos de turno y fecha.
 */
export async function inicializarCaja() {
  await cajaService.init();
  const savedData = cajaService.getSessionData();
  
  listaVales = savedData.vales || [];
  listaDesembolsos = savedData.desembolsos || [];
  
  generarInterfazCaja();

  // Restaurar comentarios si existen
  const comentariosInput = document.getElementById("caja_comentarios_cierre");
  if (comentariosInput && savedData.comentarios) {
    comentariosInput.value = savedData.comentarios;
  }

  // Listener global para recalcular al escribir
  document.addEventListener("input", (e) => {
    if (e.target.closest("#caja-content")) {
      calcularCaja();
    }
  });

  renderVales();
  renderDesembolsos();
  await importarValesAutorizados();
  calcularCaja();
}

/**
 * Abre la sección de caja y asegura que esté actualizada.
 */
async function abrirCaja() {
  const triggerEl = document.getElementById("tab-caja-content");
  if (window.navegarA) {
    window.navegarA("caja-content");
  } else if (triggerEl) {
    triggerEl.click();
  }
  generarInterfazCaja();
  actualizarDatosAutomaticosCaja(); // Force update on open
  await importarValesAutorizados();
  calcularCaja();
}

function actualizarDatosAutomaticosCaja() {
  const ahora = new Date();

  // 1. FECHA (Hoy)
  const fechaInput = document.getElementById("caja_fecha");
  if (fechaInput) {
    // Formato ES: DD-MM-YYYY para visualización, o ISO para valor?
    // El input ahora es text, mejor mostrar algo legible
    // Pero para PDF/Email se usa el value. Usemos ISO YYYY-MM-DD para consistencia con lógica existente
    // o mejor DD/MM/YYYY que es más legible.
    // Revisando código existente: usa split('-') esperando YYYY-MM-DD o similar.
    // Utils.getTodayISO() devuelve YYYY-MM-DD.
    fechaInput.value = Utils.getTodayISO();
  }

  // 2. TURNO (Automático)
  /*
        07:00 - 15:00 -> Mañana
        15:00 - 23:00 -> Tarde
        23:00 - 07:00 -> Noche
    */
  const hora = ahora.getHours();
  let turno = "tarde"; // Default safe

  if (hora >= 7 && hora < 15) {
    turno = "mañana";
  } else if (hora >= 15 && hora < 23) {
    turno = "tarde";
  } else {
    turno = "noche";
  }

  const turnoInput = document.getElementById("caja_turno");
  if (turnoInput) {
    turnoInput.value = turno.toUpperCase();
  }
}

/**
 * Genera dinámicamente los inputs de billetes y monedas si no existen.
 */
function generarInterfazCaja() {
  if (interfazCajaGenerada) return;

  actualizarDatosAutomaticosCaja();

  // Generar Inputs de Dinero
  const billetes = APP_CONFIG.CAJA?.BILLETES || [500, 200, 100, 50, 20, 10, 5];
  const monedas = APP_CONFIG.CAJA?.MONEDAS || [
    2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01,
  ];

  renderizarInputs("billetes-container", billetes, "bi-cash", "BILLETES");
  renderizarInputs("monedas-container", monedas, "bi-coin", "MONEDAS");

  // Fondo por defecto
  const fondoInput = document.getElementById("input_fondo_arqueo");

  if (fondoInput && !fondoInput.value) {
    fondoInput.value = "2000.00";
  }

  interfazCajaGenerada = true;
}

// ============================================================================
// UI RENDERING
// ============================================================================

function renderizarInputs(containerId, valores, iconClass, titulo) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `<h6 class="small text-muted fw-bold mb-2">${titulo}</h6>`;
  container.classList.add("money-grid-container");

  valores.forEach((valor) => {
    const div = document.createElement("div");
    div.className = "input-group input-group-sm money-input-group";
    div.innerHTML = `
            <span class="input-group-text" style="width: 80px; justify-content: flex-start;"><i class="bi ${iconClass} me-2"></i>${valor}€</span>
            <input type="text" class="form-control input-caja text-center fw-bold" data-valor="${valor}" placeholder="0">
            <span class="input-group-text sub-caja fw-bold text-primary bg-white" style="width: 100px; justify-content: flex-end;">0.00€</span>
        `;
    container.appendChild(div);
  });
}

function agregarNuevoConcepto() {
  const container = document.getElementById("otros-container");
  if (!container) return;

  const div = document.createElement("div");
  div.className = "col-md-4 dynamic-concept";
  div.innerHTML = `
        <div class="input-group input-group-sm">
            <input type="text" class="form-control concept-name text-start fw-bold" placeholder="Ej: Gasto Extra..." style="width: 45%;">
            <input type="number" class="form-control concept-value text-center" placeholder="0.00" style="width: 35%;">
            <button class="btn btn-outline-danger d-print-none" onclick="this.closest('.dynamic-concept').remove(); calcularCaja();" style="width: 20%;" data-bs-toggle="tooltip" data-bs-title="Eliminar Concepto">
                <i class="bi bi-trash"></i>
            </button>
        </div>
    `;
  container.appendChild(div);
  div.querySelector(".concept-name").focus();
}

/**
 * LÓGICA DE CÁLCULO
 * Recorre todos los inputs de billetes y monedas, suma los vales/desembolsos 
 * y calcula la recaudación final restando el fondo de caja configurado.
 */
function calcularCaja() {
  let totalBilletes = 0,
    totalMonedas = 0;

  // Helper interno para procesar contenedores
  const procesarContainer = (containerId) => {
    let subtotal = 0;
    document.querySelectorAll(`#${containerId} .input-group`).forEach((row) => {
      const input = row.querySelector("input");
      const span = row.querySelector(".sub-caja");
      if (input && span && input.value !== "") {
        const val = parseFloat(input.dataset.valor);
        const cant = parseFloat(input.value) || 0;
        const total = val * cant;
        span.textContent = Utils.formatCurrency(total);
        subtotal += total;
      } else if (span) {
        span.textContent = Utils.formatCurrency(0);
      }
    });
    return subtotal;
  };

  totalBilletes = procesarContainer("billetes-container");
  totalMonedas = procesarContainer("monedas-container");
  const totalEfectivo = totalBilletes + totalMonedas;

  // Otros conceptos
  const getVal = (id) => parseFloat(document.getElementById(id)?.value) || 0;

  // VALES (Calculado desde array)
  const totalVales = listaVales.reduce((sum, v) => sum + v.importe, 0);
  const valesInput = document.getElementById("caja_vales_total");
  if (valesInput) valesInput.value = Utils.formatCurrency(totalVales);

  // FONDO (Cargar y mostrar signo si existe el elemento)
  // FIX: Usar getElementById para ser más específico y evitar colisiones
  // FONDO (Cargar y mostrar signo si existe el elemento)
  // FIX: Renombrado a ID único para evitar cualquier colisión con el buscador
  const fondoInput = document.getElementById("input_fondo_arqueo");
  
  if (fondoInput) {
      fondoInput.value = Utils.formatCurrency(-Math.abs(fondoCajaValue));
  }

  const safe = getVal("caja_safe");
  const sellosCant = getVal("caja_sellos_cant");
  const sellosPrecio = getVal("caja_sellos_precio");
  const totalSellos = sellosCant * sellosPrecio;

  const sellosLbl = document.getElementById("caja_sellos_total_lbl");
  if (sellosLbl) sellosLbl.textContent = Utils.formatCurrency(totalSellos);

  const extra = getVal("caja_monedas_extra");

  // DESEMBOLSOS (Calculado desde array)
  const desembolsos = listaDesembolsos.reduce((sum, d) => sum + d.importe, 0);
  const desembolsosInput = document.getElementById("caja_desembolsos");
  if (desembolsosInput)
    desembolsosInput.value = Utils.formatCurrency(desembolsos);

  // Dinámicos
  let totalDinamicos = 0;
  document
    .querySelectorAll(".concept-value")
    .forEach((input) => (totalDinamicos += parseFloat(input.value) || 0));

  // Sumar Total (Desembolsos ahora SUMAN, positivo)
  // fondoCaja ya está definido arriba

  // Total Otros: Suma de todos los conceptos manuales + Vales/Desembolsos (NO incluye el fondo aquí)
  const totalOtros =
    totalVales + safe + totalSellos + extra + totalDinamicos + desembolsos;

  // Total Tesorería: La suma total de dinero físico y vales (Excluyendo el fondo para que parta de 0)
  const totalTesoreria = totalEfectivo + totalOtros;

  // Producción (Venta): El resultado final menos el fondo de caja
  const recaudacion = totalTesoreria - Math.abs(fondoCajaValue);

  // Actualizar UI
  updateUIValue("subtotal_billetes", totalBilletes);
  updateUIValue("subtotal_monedas", totalMonedas);
  updateUIValue("total_efectivo", totalEfectivo);
  updateUIValue("subtotal_otros", totalOtros);
  updateUIValue("total_caja", totalTesoreria);
  updateUIValue("recaudacion_caja", recaudacion);

  // --- SINCRONIZACIÓN CON VISTA DE IMPRESIÓN (ROBUSTA) ---
  // No hay llamada a clonarDatosAPantallaImpresion aquí.

  // Persistir metadatos (Debounced para evitar escritura en cada tecla - FIX PERFORMANCE)
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
      cajaService.saveMetadata({
        fecha: document.getElementById("caja_fecha")?.value,
        turno: document.getElementById("caja_turno")?.value,
        comentarios: document.getElementById("caja_comentarios_cierre")?.value
      });
  }, 2000);
}

function sincronizarConceptosDinamicosImpresion() {
  const target = document.getElementById('print-dynamic-concepts');
  if (!target) return;

  let html = '';
  document.querySelectorAll('.dynamic-concept').forEach(div => {
    const nombre = div.querySelector('.concept-name')?.value || "Varios";
    const val = parseFloat(div.querySelector('.concept-value')?.value || 0);
    html += `<div style="display:flex; justify-content:space-between; padding: 4px 0; border-bottom: 1px solid #eee;">
                    <span><i class="bi bi-plus-circle me-2" style="font-size: 8pt; color: #666;"></i>${nombre}:</span>
                    <span style="font-weight:bold;">${Utils.formatCurrency(val)}</span>
                 </div>`;
  });
  target.innerHTML = html;
}

// Variable para debounce de guardado
let saveTimeout = null;

function generarResumenDineroImpresion(sourceContainerId, targetContainerId, mostrarTodos = false) {
  // Función mantenida por compatibilidad si se llama desde otro sitio, 
  // pero ahora usamos la lógica de generarHTMLReporte para mayor seguridad en el flujo principal.
  const target = document.getElementById(targetContainerId);
  if (!target) return;
  
  let html = '<div style="font-size: 8.5pt; color: #333;">';
  const icon = sourceContainerId.includes('billetes') ? 'bi-cash' : 'bi-coin';
  
  document.querySelectorAll(`#${sourceContainerId} .input-group`).forEach(row => {
    const input = row.querySelector('input');
    const cant = parseFloat(input?.value || 0);
    const valor = input.dataset.valor;
    const subtotal = parseFloat(valor) * (cant || 0);

    // Si no queremos mostrar todos y está a cero, saltamos
    if (!mostrarTodos && cant === 0) return;

    html += `<div style="display:flex; justify-content:space-between; margin-bottom: 3px; ${cant === 0 ? 'color:#bbb;' : ''}">
                    <span><i class="bi ${icon} me-1" style="font-size: 7pt; color: #999;"></i>${valor}€ x ${cant}</span>
                    <span style="font-weight:bold;">${Utils.formatCurrency(subtotal)}</span>
                 </div>`;
  });

  html += '</div>';
  target.innerHTML = html;
}

function updateUIValue(id, val) {
  const el = document.getElementById(id);
  if (el) {
    const texto = Utils.formatCurrency(val);
    if (el.tagName === "INPUT") {
      el.value = texto;
    } else {
      el.textContent = texto;
    }

    if (id === "recaudacion_caja" || id === "print_recaudacion_final") {
      el.classList.remove("text-success", "text-danger");
      el.classList.add(val >= 0 ? "text-success" : "text-danger");
      if (id.startsWith("print")) {
        el.style.color = val >= 0 ? "#155724" : "#721c24"; // Colores directos para impresión
      }
    }
  }
}

// ============================================================================
// ACCIONES
// ============================================================================

async function resetearCaja(silent = false) {
  if (silent || await Ui.showConfirm("¿Estás seguro de borrar todos los datos de la caja?")) {
    
    // 1. Limpiar inputs de efectivo (billetes y monedas con clase específica)
    document.querySelectorAll(".input-caja").forEach(i => i.value = "");
    
    // 2. Limpiar inputs manuales (Safe, Sellos Cantidad, Extra)
    const manualInputs = ["caja_sellos_cant", "caja_safe", "caja_monedas_extra"];
    manualInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // 3. Limpiar conceptos dinámicos
    document.querySelectorAll(".dynamic-concept").forEach((el) => el.remove());

    // 4. Limpiar Comentarios DE FORMA EXPLÍCITA por ID
    const comentariosInput = document.getElementById("caja_comentarios_cierre");
    if (comentariosInput) comentariosInput.value = "";

    // 5. Preservar vales, limpiar desembolsos
    listaDesembolsos = [];
    // listaVales se mantiene intacta
    
    // 6. Sincronizar persistencia (Solo desembolsos y comentarios se resetean)
    const currentData = cajaService.getAll();
    await cajaService.save({
      ...currentData,
      desembolsos: [],
      comentarios: ""
    });
    
    // 7. Actualizar UI
    renderVales();
    renderDesembolsos();
    actualizarDatosAutomaticosCaja();
    
    // Restaurar precios por defecto de configuración
    const sellosPrecio = APP_CONFIG.CAJA?.SELLOS_PRECIO || "2.00";
    Utils.setVal("caja_sellos_precio", sellosPrecio);
    
    // Recalcular todo (Esto pondrá de nuevo el total de vales en su input)
    calcularCaja();
    
    if (!silent) Ui.showToast("Caja reiniciada (Vales conservados).", "info");
  }
}



async function cerrarCajaDefinitivo() {
    if (!await Ui.showConfirm("¿Estás seguro de CERRAR LA CAJA definitivamente?\n- Se imprimirá el reporte.\n- Se guardará una copia PDF en el servidor.\n- Los vales se marcarán como contabilizados.", "question")) {
        return;
    }

    // 1. Asegurar que los datos están calculados en el DOM antes de capturar
    calcularCaja();

    // 2. Generar y Subir PDF al servidor (USANDO STRING LITERAL PARA EVITAR PROBLEMAS DE VISIBILIDAD)
    try {
        Ui.showToast("Generando y archivando PDF...", "info");

        // Construir metadatos y contenido MANUALMENTE para asegurar que no sale blanco
        // ni afecta al layout visual
        const reportView = document.getElementById('caja-print-report-view');
        if (!reportView) throw new Error("No se encontró 'caja-print-report-view'");
        
        // Antes de pillar el HTML, sincronizamos los datos del DOM de impresion
        sincronizarMetadatosReporte();

        // Extraemos el HTML interno, pero nos aseguramos que se vea bien
        // SCOPED STYLES: Usamos selectores descendentes para NO afectar al resto de la página
        // SCOPED STYLES: Usamos selectores descendentes para NO afectar al resto de la página
        // COPIED FROM guardarCajaPDF for consistency
        const htmlContent = `
            <style>
                .pdf-content { font-size: 10pt; line-height: 1.4; font-family: Arial, sans-serif; color: #000; }
                .pdf-section { margin-bottom: 20px; border: 1px solid #eee; padding: 10px; border-radius: 5px; }
                .pdf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .pdf-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                .pdf-table td { padding: 4px; border-bottom: 1px solid #f0f0f0; }
                .pdf-total-row { font-weight: bold; background: #f8f9fa; }
                .text-success { color: #155724 !important; }
                .text-danger { color: #721c24 !important; }
                h2, h4, h5, h6 { color: #000; margin: 0; }
                /* Robustez para elementos ocultos */
                .d-print-block { display: block !important; visibility: visible !important; }
            </style>
            <div class="pdf-content">
                ${reportView.innerHTML}
            </div>
        `;

        const title = `Cierre Caja ${document.getElementById("caja_turno")?.value || 'S/T'}`;
        const author = sessionService.getUser() || 'Sistema';

        // LLAMADA PURA POR STRING
        const pdfBase64 = await PdfService.generateReport({
            title,
            author,
            htmlContent: htmlContent, // <--- STRING PURO
            filename: `Cierre_${Utils.getTodayISO()}.pdf`,
            outputType: 'base64'
        });

        if (pdfBase64) {
            const rawFilename = `Cierre_${Utils.getTodayISO()}_${document.getElementById("caja_turno")?.value || 'Shift'}-cierre.pdf`;
            const filename = rawFilename.replace(/[^a-z0-9._-]/gi, '_');

            await import('../core/Api.js').then(async ({ Api }) => {
                await Api.post('storage/upload', {
                    fileName: filename,
                    fileData: pdfBase64,
                    folder: 'caja_cierres'
                });
            });
            console.log("[Caja] PDF archivado correctamente en el servidor.");
            if (window.systemModal) window.systemModal.hide();
        }
    } catch (pdfErr) {
        console.error("Error al archivar PDF:", pdfErr);
        if (window.systemModal) window.systemModal.hide();
        Ui.showToast("No se pudo archivar el PDF, pero el cierre continuará.", "warning");
    }

    // 4. Imprimir el listado (Vista Reporte)
    imprimirCierreCaja();

    // 3. Procesar vales (Marcar como Contabilizados)
    let contador = 0;
    for (const valeLocale of listaVales) {
        if (valeLocale.origin === 'vales_module' && valeLocale.moduloId) {
            try {
                await valesService.updateEstado(valeLocale.moduloId, 'Contabilizado');
                contador++;
            } catch (error) {
                console.error(`Error al actualizar vale ${valeLocale.moduloId}:`, error);
            }
        }
    }

    // 4. Limpiar datos de la sesión actual (Silent para no pedir confirmación doble)
    await resetearCaja(true);

    // 5. Notificar éxito
    if (contador > 0) {
        Ui.showToast(`Caja cerrada y archivada. ${contador} vales procesados.`, "success");
    } else {
        Ui.showToast("Caja cerrada y archivada correctamente.", "success");
    }
}

// ============================================================================
// IMPRESIÓN (ESTRATEGIA DE INYECCIÓN DINÁMICA)
// ============================================================================

/**
 * Genera el HTML completo del reporte basado en el estado actual.
 * @returns {string} HTML string del reporte formateado para A4.
 */
/**
 * Genera el DOCUMENTO HTML COMPLETO para impresión en Iframe Aislado.
 * NO depende de estilos externos. Todo el CSS es interno.
 */
function generarDocumentoImpresion() {
  const user = sessionService.getUser();
  const userName = user ? user.nombre : "---";
  const fecha = document.getElementById("caja_fecha")?.value || "---";
  const turno = document.getElementById("caja_turno")?.value || "---";
  const comentarios = document.getElementById("caja_comentarios_cierre")?.value || "";
  
  // Totales
  const totalCaja = document.getElementById("total_caja")?.textContent || "0.00€";
  const totalEfectivo = document.getElementById("total_efectivo")?.textContent || "0.00€";
  const subtotalOtros = document.getElementById("subtotal_otros")?.textContent || "0.00€";
  const recaudacion = document.getElementById("recaudacion_caja")?.textContent || "0.00€";

  // Helpers internos
  const getListItems = (containerId) => {
    const items = [];
    document.querySelectorAll(`#${containerId} .input-group`).forEach(row => {
      const input = row.querySelector('input');
      const valor = input?.dataset.valor || '0';
      const cant = parseFloat(input?.value || 0);
      const total = Utils.formatCurrency(cant * parseFloat(valor));
      if (cant > 0) {
        items.push(`
          <tr>
             <td style="padding: 2px 0; border-bottom: 1px dotted #ccc;">${cant} x ${valor}€</td>
             <td style="padding: 2px 0; border-bottom: 1px dotted #ccc; text-align: right; font-weight: bold;">${total}</td>
          </tr>
        `);
      }
    });
    return items.length ? `<table style="width:100%; font-size: 9pt;">${items.join('')}</table>` : '<div style="color: #999; font-size: 8pt; font-style: italic;">Sin efectivo</div>';
  };

  const billetesHTML = getListItems("billetes-container");
  const monedasHTML = getListItems("monedas-container");

  // Otros Conceptos
  const valesTotal = document.getElementById("caja_vales_total")?.value || "0.00";
  const desembolsosTotal = document.getElementById("caja_desembolsos")?.value || "0.00";
  const sellosTotal = document.getElementById("caja_sellos_total_lbl")?.textContent || "0.00€";
  const safeTotal = document.getElementById("caja_safe")?.value || "0.00";
  const extraTotal = document.getElementById("caja_monedas_extra")?.value || "0.00";
  const fondoTotal = document.getElementById("input_fondo_arqueo")?.value || "-2000.00€";

  const renderListDetails = (list) => {
      if (!list || list.length === 0) return '';
      return list.map(item => `
        <div style="display: flex; justify-content: space-between; font-size: 8pt; color: #555; margin-left: 10px;">
            <span>${item.desc || item.concepto || 'Item'}</span>
            <span>${Utils.formatCurrency(item.importe)}</span>
        </div>
      `).join('');
  };
  const valesDetails = renderListDetails(listaVales);
  const desembolsoDetails = renderListDetails(listaDesembolsos);

  // Dinámicos
  let dynamicHTML = "";
  document.querySelectorAll('.dynamic-concept').forEach(div => {
     const name = div.querySelector('.concept-name')?.value || "Varios";
     const val = div.querySelector('.concept-value')?.value || "0.00";
     if (parseFloat(val) !== 0) {
          dynamicHTML += `
            <tr>
                <td style="padding: 4px 0; border-bottom: 1px solid #eee;"><i style="margin-right: 5px;">+</i>${name}</td>
                <td style="padding: 4px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${Utils.formatCurrency(parseFloat(val))}</td>
            </tr>`;
     }
  });


  // RETORNAMOS EL DOCUMENTO HTML COMPLETO
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Cierre de Caja</title>
      <style>
        @page { size: A4; margin: 10mm; }
        body { 
          font-family: 'Segoe UI', Arial, sans-serif; 
          margin: 0; 
          padding: 0; 
          color: #000; 
          background: #fff;
          font-size: 10pt; /* Base font size */
        }
        table { border-collapse: collapse; width: 100%; }
        h1 { margin: 0; font-size: 20pt; color: #0d6efd; }
        .header-soft { color: #666; font-size: 9pt; }
        .section-title { 
            background: #f8f9fa; 
            padding: 5px 8px; 
            border-bottom: 2px solid #ddd; 
            font-weight: 700; 
            font-size: 10pt;
            margin-bottom: 10px;
            color: #333;
        }
        .text-end { text-align: right; }
        .fw-bold { font-weight: 700; }
        
        .box-tesoreria {
            background: #f1f8ff; 
            border: 1px solid #cfe2ff; 
            padding: 15px; 
            border-radius: 8px; 
            text-align: center; 
            margin-bottom: 20px;
        }
        .box-produccion {
            margin-top: 15px; 
            padding: 10px; 
            background: #e2f3e5; 
            border: 1px solid #badbcc; 
            border-radius: 6px;
        }
        .comments-box {
            border: 1px solid #ccc;
            padding: 10px;
            min-height: 100px;
            white-space: pre-wrap;
            font-family: inherit;
        }
      </style>
    </head>
    <body>
      
      <!-- HEADER -->
      <table style="border-bottom: 2px solid #0d6efd; margin-bottom: 20px;">
        <tr>
          <td style="vertical-align: bottom; padding-bottom: 10px;">
            <h1>CIERRE DE CAJA</h1>
            <div class="header-soft">Hotel Garoé - Módulo de Recepción</div>
          </td>
          <td class="text-end" style="vertical-align: bottom; padding-bottom: 10px;">
            <div><strong>Fecha:</strong> ${fecha}</div>
            <div><strong>Turno:</strong> ${turno}</div>
            <div><strong>Responsable:</strong> ${userName}</div>
          </td>
        </tr>
      </table>

      <!-- LAYOUT PRINCIPAL -->
      <table>
        <tr>
          <!-- IZQUIERDA -->
          <td style="width: 60%; vertical-align: top; padding-right: 20px; border-right: 1px solid #eee;">
            
            <!-- EFECTIVO -->
            <div class="section-title">DETALLE DE EFECTIVO</div>
            <table style="margin-bottom: 20px;">
              <tr>
                <td style="vertical-align: top; width: 48%;">
                    <div style="font-weight:bold; font-size:9pt; border-bottom:1px solid #ccc; margin-bottom:5px;">BILLETES</div>
                    ${billetesHTML}
                </td>
                <td style="width: 4%;"></td>
                <td style="vertical-align: top; width: 48%;">
                    <div style="font-weight:bold; font-size:9pt; border-bottom:1px solid #ccc; margin-bottom:5px;">MONEDAS</div>
                    ${monedasHTML}
                </td>
              </tr>
            </table>

            <!-- OTROS -->
            <div class="section-title">OTROS CONCEPTOS</div>
            <table style="font-size: 10pt;">
               <tr>
                 <td style="padding: 4px 0; border-bottom: 1px solid #eee;">Vales Registrados:</td>
                 <td class="text-end fw-bold" style="padding: 4px 0; border-bottom: 1px solid #eee;">${valesTotal}€</td>
               </tr>
               ${valesDetails ? `<tr><td colspan="2" style="padding-bottom: 5px;">${valesDetails}</td></tr>` : ''}

               <tr>
                 <td style="padding: 4px 0; border-bottom: 1px solid #eee;">Desembolsos:</td>
                 <td class="text-end fw-bold" style="padding: 4px 0; border-bottom: 1px solid #eee;">${desembolsosTotal}€</td>
               </tr>
               ${desembolsoDetails ? `<tr><td colspan="2" style="padding-bottom: 5px;">${desembolsoDetails}</td></tr>` : ''}

               <tr>
                 <td style="padding: 4px 0; border-bottom: 1px solid #eee;">Suma Sellos:</td>
                 <td class="text-end fw-bold" style="padding: 4px 0; border-bottom: 1px solid #eee;">${sellosTotal}</td>
               </tr>
               <tr>
                 <td style="padding: 4px 0; border-bottom: 1px solid #eee;">Safe:</td>
                 <td class="text-end fw-bold" style="padding: 4px 0; border-bottom: 1px solid #eee;">${Utils.formatCurrency(safeTotal)}</td>
               </tr>
               <tr>
                 <td style="padding: 4px 0; border-bottom: 1px solid #eee;">Extra / Otros:</td>
                 <td class="text-end fw-bold" style="padding: 4px 0; border-bottom: 1px solid #eee;">${Utils.formatCurrency(extraTotal)}</td>
               </tr>
               <tr>
                 <td style="padding: 6px 0; font-weight: bold; color: #555;">Fondo de Caja:</td>
                 <td class="text-end fw-bold" style="padding: 6px 0; color: #555;">${fondoTotal}</td>
               </tr>
               ${dynamicHTML}
            </table>

          </td>
          
          <!-- DERECHA -->
          <td style="width: 40%; vertical-align: top; padding-left: 20px;">
             
             <div class="box-tesoreria">
                <div style="font-size: 10pt; font-weight: bold; color: #004085; text-transform: uppercase;">TOTAL TESORERÍA</div>
                <div style="font-size: 22pt; font-weight: 800; color: #000; margin: 10px 0;">${totalCaja}</div>
                
                <table style="font-size: 9pt; margin-top: 10px;">
                    <tr><td>Efectivo:</td><td class="text-end">${totalEfectivo}</td></tr>
                    <tr><td>Otros:</td><td class="text-end">${subtotalOtros}</td></tr>
                </table>

                <div class="box-produccion">
                    <div style="font-size: 8pt; font-weight: bold; color: #155724;">PRODUCCIÓN (VENTA)</div>
                    <div style="font-size: 16pt; font-weight: 800; color: #155724;">${recaudacion}</div>
                </div>
             </div>

             <div style="font-weight: bold; font-size: 9pt; margin-bottom: 5px;">OBSERVACIONES:</div>
             <div class="comments-box">${comentarios}</div>

          </td>
        </tr>
      </table>

      <!-- FIRMAS -->
      <table style="margin-top: 50px;">
         <tr>
             <td style="text-align: center;">
                 <div style="border-top: 1px solid #000; width: 60%; margin: 0 auto; padding-top: 5px; font-size: 9pt;">Firma Recepcionista</div>
             </td>
             <td style="text-align: center;">
                 <div style="border-top: 1px solid #000; width: 60%; margin: 0 auto; padding-top: 5px; font-size: 9pt;">Firma Intervención</div>
             </td>
         </tr>
      </table>

    </body>
    </html>
  `;
}

function imprimirCierreCaja() {
  const user = sessionService.getUser();
  if (!user) {
    Ui.showToast("⚠️ No hay usuario seleccionado.", "warning");
    return;
  }
  
  // 1. Asegurar cálculos
  calcularCaja();

  // 2. Generar el documento HTML completo
  const docContent = generarDocumentoImpresion();

  // 4. Usar Servicio Centralizado de Impresión
  // Esto invoca la estrategia de Iframe Aislado definida en assets/js/core/PrintService.js
  if (window.PrintService) {
      PrintService.printHTML(docContent);
  } else {
      console.error("PrintService no encontrado. Fallback manual...");
      // Fallback por si acaso (aunque no debería ocurrir)
      const win = window.open('', '_blank');
      win.document.write(docContent);
      win.document.close();
      win.print();
  }

}

/**
 * EXPORTAR PDF (PdfService)
 * Genera un informe profesional de arqueo de caja utilizando la misma lógica limpia que la impresión.
 */
async function guardarCajaPDF() {
  const user = sessionService.getUser();
  if (!user) {
    Ui.showToast("⚠️ No hay usuario seleccionado.", "warning");
    return;
  }

  // Asegurar que los datos están calculados
  calcularCaja();

  const fechaVal = document.getElementById("caja_fecha")?.value || Utils.getTodayISO();
  const turnoVal = document.getElementById("caja_turno")?.value || "TURNO";
  
  // Limpiar y formatear nombre de archivo
  const fechaPartes = fechaVal.split("-");
  const fechaFormateada = fechaPartes.length === 3 ? `${fechaPartes[2]}-${fechaPartes[1]}-${fechaPartes[0]}` : fechaVal;
  const filename = `ARQUEO_${fechaFormateada}_${turnoVal}.pdf`.replace(/[^a-z0-9._-]/gi, '_');

  // Obtener el HTML limpio del documento de impresión
  const docContent = generarDocumentoImpresion();
  
  // Extraer Estilos y Cuerpo (PdfService los unificará)
  const styleStart = docContent.indexOf('<style>');
  const styleEnd = docContent.indexOf('</style>');
  const styles = (styleStart > -1 && styleEnd > -1) ? docContent.substring(styleStart, styleEnd + 8) : "";
  
  const bodyStart = docContent.indexOf('<body');
  const bodyEnd = docContent.indexOf('</body>');
  let bodyContent = docContent;
  if (bodyStart > -1 && bodyEnd > -1) {
      bodyContent = docContent.substring(docContent.indexOf('>', bodyStart) + 1, bodyEnd);
  }

  try {
      Ui.showToast("Generando reporte PDF...", "info");
      
      // Usar el servicio centralizado que es más robusto
      await PdfService.generateReport({
          title: `Cierre de Caja - ${fechaFormateada}`,
          author: user.nombre || 'Recepción',
          htmlContent: styles + bodyContent,
          filename: filename
      });
      
  } catch (error) {
      console.error("Error al generar PDF:", error);
      Ui.showToast("Error al generar el PDF.", "danger");
  }
}


/**
 * REPORTE EMAIL (HTML Rico)
 * Genera una plantilla visual con tablas de desglose detallado.
 * Al copiar al portapapeles, se inyecta tanto texto como HTML para que al pegar 
 * en Outlook/Gmail se mantenga el formato profesional.
 */
async function enviarCajaEmail() {
  const nombre = sessionService.getUser();
  if (!nombre) {
    alert("⚠️ No hay usuario seleccionado.");
    return;
  }

  const fecha = document.getElementById("caja_fecha")?.value || "";
  const turno = document.getElementById("caja_turno")?.value || "";

  // Obtener Totales Principales del DOM
  const totalCaja = document.getElementById("total_caja")?.innerText || "0.00€";
  const recaudacion =
    document.getElementById("recaudacion_caja")?.innerText || "0.00€";
  const efectivo =
    document.getElementById("total_efectivo")?.innerText || "0.00€";
  const billetesTotal =
    document.getElementById("subtotal_billetes")?.innerText || "0.00€";
  const monedasTotal =
    document.getElementById("subtotal_monedas")?.innerText || "0.00€";

  // --- HELPER: Obtener Desglose Detallado ---
  const getDesgloseDinero = (containerId) => {
    let items = [];
    document.querySelectorAll(`#${containerId} .input-group`).forEach((row) => {
      const input = row.querySelector("input");
      const cant = parseFloat(input?.value || 0);
      if (cant > 0) {
        const valor = input.dataset.valor;
        const total = parseFloat(valor) * cant;
        items.push({
          desc: `${valor}€ x ${cant}`,
          total: Utils.formatCurrency(total),
        });
      }
    });
    return items;
  };

  const periodicos = getDesgloseDinero("billetes-container");
  const metalico = getDesgloseDinero("monedas-container");

  // --- DESGLOSE VALES (SEPARADO) ---
  const valesItems = listaVales.map((v) => ({
    desc: v.concepto,
    total: Utils.formatCurrency(v.importe),
  }));
  const totalValesNum = listaVales.reduce((sum, v) => sum + v.importe, 0);
  const totalValesStr = Utils.formatCurrency(totalValesNum);

  // --- DESGLOSE DESEMBOLSOS (SEPARADO) ---
  const desembolsosItems = listaDesembolsos.map((d) => ({
    desc: d.concepto,
    total: Utils.formatCurrency(d.importe),
  }));
  const totalDesembolsosNum = listaDesembolsos.reduce(
    (sum, d) => sum + d.importe,
    0,
  );
  // const totalDesembolsosStr = Utils.formatCurrency(totalDesembolsosNum); // Already used?

  // --- DESGLOSE OTROS (Sin Vales ni Desembolsos viejos) ---
  let otrosItems = [];
  let otrosSum = 0; // Suma manual para mostrar total de esta sección

  const addSiExiste = (id, label, isCant = false) => {
    const val = parseFloat(document.getElementById(id)?.value || 0);
    if (val !== 0) {
      let total = 0;
      if (isCant) {
        // Caso especial Sellos
        const precio = parseFloat(
          document.getElementById("caja_sellos_precio")?.value || 0,
        );
        total = val * precio;
        otrosItems.push({
          desc: `${label} (${val} x ${Utils.formatCurrency(precio)})`,
          total: Utils.formatCurrency(total),
        });
      } else {
        total = val;
        otrosItems.push({ desc: label, total: Utils.formatCurrency(total) });
      }
      otrosSum += total;
    }
  };

  addSiExiste("caja_safe", "Safe");
  addSiExiste("caja_sellos_cant", "Sellos", true);
  addSiExiste("caja_monedas_extra", "Extra");

  // 2. Dinámicos
  document.querySelectorAll(".dynamic-concept").forEach((div) => {
    const nombre = div.querySelector(".concept-name")?.value || "Varios";
    const val = parseFloat(div.querySelector(".concept-value")?.value || 0);
    if (val !== 0) {
      otrosItems.push({ desc: nombre, total: Utils.formatCurrency(val) });
      otrosSum += val;
    }
  });

  // Desembolsos ya son su propia lista, no se añaden aqui.

  const totalOtrosStr = Utils.formatCurrency(otrosSum);

  const partes = fecha.split("-");
  const fechaFormateada =
    partes.length === 3 ? `${partes[2]}-${partes[1]}-${partes[0]}` : fecha;
  const subject = `Cierre de Caja - ${fechaFormateada} - ${turno.toUpperCase()}`;

  // --- GENERACIÓN HTML ---
  const generateTableRows = (items) => {
    return items
      .map(
        (i) => `
            <tr>
                <td style="padding: 6px 10px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #555; word-wrap: break-word; word-break: break-all; white-space: normal;">${i.desc}</td>
                <td style="padding: 6px 10px; border-bottom: 1px solid #f0f0f0; text-align: right; font-size: 13px; white-space: nowrap; vertical-align: top;">${i.total}</td>
            </tr>
        `,
      )
      .join("");
  };

  const htmlReporte = `
        <div style="font-family: 'Segoe UI', system-ui, sans-serif; color: #333; width: 100%; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background: #fff;">
            <div style="background-color: #f8f9fa; padding: 15px 20px; border-bottom: 3px solid #0d6efd;">
                <h2 style="color: #0d6efd; margin: 0; font-size: 20px;">CIERRE DE CAJA</h2>
                <div style="font-size: 13px; color: #666; margin-top: 5px;">H. Garoé | ${fechaFormateada} | ${turno.toUpperCase()}</div>
            </div>
            
            <div style="padding: 20px;">
                <!-- EFECTIVO -->
                <div style="margin-bottom: 25px;">
                    <div style="font-weight: bold; color: #000; border-bottom: 2px solid #eee; padding-bottom: 5px; margin-bottom: 10px;">
                        EFECTIVO <span style="float: right;">${efectivo}</span>
                    </div>
                    ${
                      periodicos.length > 0
                        ? `
                        <div style="font-size: 11px; font-weight: bold; color: #888; margin-bottom: 5px;">BILLETES (${billetesTotal})</div>
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; table-layout: fixed;">${generateTableRows(periodicos)}</table>
                    `
                        : ""
                    }
                    
                    ${
                      metalico.length > 0
                        ? `
                        <div style="font-size: 11px; font-weight: bold; color: #888; margin-bottom: 5px;">MONEDAS (${monedasTotal})</div>
                        <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">${generateTableRows(metalico)}</table>
                    `
                        : ""
                    }
                </div>

                <!-- VALES -->
                ${
                  valesItems.length > 0
                    ? `
                <div style="margin-bottom: 25px;">
                    <div style="font-weight: bold; color: #d63384; border-bottom: 2px solid #eee; padding-bottom: 5px; margin-bottom: 10px;">
                        VALES <span style="float: right;">${totalValesStr}</span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                         ${generateTableRows(valesItems)}
                    </table>
                </div>
                `
                    : ""
                }

                <!-- DESEMBOLSOS -->
                ${
                  desembolsosItems.length > 0
                    ? `
                <div style="margin-bottom: 25px;">
                    <div style="font-weight: bold; color: #0d6efd; border-bottom: 2px solid #eee; padding-bottom: 5px; margin-bottom: 10px;">
                        DESEMBOLSOS <span style="float: right;">${Utils.formatCurrency(totalDesembolsosNum)}</span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                         ${generateTableRows(desembolsosItems)}
                    </table>
                </div>
                `
                    : ""
                }

                <!-- OTROS CONCEPTOS -->
                ${
                  otrosItems.length > 0
                    ? `
                <div style="margin-bottom: 25px;">
                    <div style="font-weight: bold; color: #fd7e14; border-bottom: 2px solid #eee; padding-bottom: 5px; margin-bottom: 10px;">
                        VARIOS <span style="float: right;">${totalOtrosStr}</span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">${generateTableRows(otrosItems)}</table>
                </div>
                `
                    : ""
                }

                <!-- TOTALES -->
                <div style="background-color: #f1f8ff; padding: 15px; border-radius: 6px; margin-top: 10px;">
                    <table style="width: 100%;">
                        <tr>
                            <td style="font-weight: bold; color: #004085; font-size: 16px;">TOTAL TESORERÍA</td>
                            <td style="text-align: right; font-weight: bold; color: #004085; font-size: 20px;">${totalCaja}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: bold; color: #155724; font-size: 14px; padding-top: 5px;">PRODUCCIÓN (VENTA)</td>
                            <td style="text-align: right; font-weight: bold; color: #155724; font-size: 16px; padding-top: 5px;">${recaudacion}</td>
                        </tr>
                    </table>
                </div>

                <div style="margin-top: 15px; font-size: 12px; color: #999; text-align: right;">
                    Recepcionista: <strong>${nombre}</strong>
                </div>
            </div>
        </div>
    `;

  // --- GENERACIÓN TEXTO PLANO ---
  let textoPlano = `
📋 CIERRE DE CAJA - ${fechaFormateada}
=======================================
Turno: ${turno.toUpperCase()} | Usuario: ${nombre}

💵 EFECTIVO: ${efectivo}
`;
  if (periodicos.length)
    textoPlano +=
      periodicos.map((i) => `   ${i.desc.padEnd(15)} : ${i.total}`).join("\n") +
      "\n";
  if (metalico.length)
    textoPlano +=
      metalico.map((i) => `   ${i.desc.padEnd(15)} : ${i.total}`).join("\n") +
      "\n";

  if (valesItems.length) {
    textoPlano += `\n🎫 VALES: ${totalValesStr}\n`;
    textoPlano +=
      valesItems.map((i) => `   ${i.desc} : ${i.total}`).join("\n") + "\n";
  }

  if (desembolsosItems.length) {
    textoPlano += `\n🔴 DESEMBOLSOS: ${Utils.formatCurrency(totalDesembolsosNum)}\n`;
    textoPlano +=
      desembolsosItems.map((i) => `   ${i.desc} : ${i.total}`).join("\n") +
      "\n";
  }

  if (otrosItems.length) {
    textoPlano += `\n📑 VARIOS: ${totalOtrosStr}\n`;
    textoPlano +=
      otrosItems.map((i) => `   ${i.desc} : ${i.total}`).join("\n") + "\n";
  }

  textoPlano += `
=======================================
💰 TOTAL TESORERÍA:  ${totalCaja}
📈 PRODUCCIÓN:       ${recaudacion}
=======================================
`;

  // Copiar al portapapeles
  if (await Utils.copyToClipboard(textoPlano, htmlReporte)) {
    await window.showAlert(
      "📋 Reporte DETALLADO copiado. Pégalo en el correo.",
      "success",
    );
  } else {
    await window.showAlert("Resumen copiado como texto plano.", "info");
  }

  // Abrir cliente de correo
  const mailBody = `Buenos días,\n\nAdjunto le envío el detalle del cierre de caja.\n\n[PEGAR AQUÍ EL REPORTE DETALLADO]\n\nSaludos,\n${nombre}`;
  window.location.href = `mailto:administracion@hotelgaroe.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`;
}

// ============================================================================
// EXPORTACIONES GLOBALES
// ============================================================================
window.abrirCaja = abrirCaja;
window.resetearCaja = resetearCaja;
window.imprimirCierreCaja = imprimirCierreCaja;
window.calcularCaja = calcularCaja;
window.agregarNuevoConcepto = agregarNuevoConcepto;
window.guardarCajaPDF = guardarCajaPDF;
window.enviarCajaEmail = enviarCajaEmail;
window.cerrarCajaDefinitivo = cerrarCajaDefinitivo;

window.toggleLockCaja = (inputId, btn) => {
  const input = document.getElementById(inputId);
  if (!input) return;

  // Check for both readonly (inputs) and disabled (selects)
  const isLocked =
    input.hasAttribute("readonly") || input.hasAttribute("disabled");
  const icon = btn.querySelector("i");

  if (isLocked) {
    input.removeAttribute("readonly");
    input.removeAttribute("disabled");
    input.classList.remove("bg-light");
    icon.className = "bi bi-unlock-fill";
    // Visual feedback based on color
    if (inputId === "caja_fecha") {
      btn.classList.remove("btn-outline-primary", "text-primary");
      btn.classList.add("btn-primary", "text-white");
    } else {
      btn.classList.remove("btn-outline-success", "text-success");
      btn.classList.add("btn-success", "text-white");
    }
  } else {
    // Lock it back
    if (input.tagName === "SELECT") {
      input.setAttribute("disabled", "true");
    } else {
      input.setAttribute("readonly", "true");
    }
    input.classList.add("bg-light");
    icon.className = "bi bi-lock-fill";

    // Restore visual state
    if (inputId === "caja_fecha") {
      btn.classList.remove("btn-primary", "text-white");
      btn.classList.add("btn-outline-primary", "text-primary");
    } else {
      btn.classList.remove("btn-success", "text-white");
      btn.classList.add("btn-outline-success", "text-success");
    }
  }
};

// Listener para manejar cambios manuales en el fondo y formatearlo al salir
document.addEventListener('change', (e) => {
    if (e.target.id === 'caja_fondo') {
        const raw = e.target.value.replace(/[^-0.9,.]/g, '').replace(',', '.');
        fondoCajaValue = Math.abs(parseFloat(raw) || 0);
        calcularCaja();
    }
});
document.addEventListener('blur', (e) => {
    if (e.target.id === 'caja_fondo') {
        calcularCaja(); // Esto disparará el formateo visual ahora que no está enfocado
    }
}, true);
