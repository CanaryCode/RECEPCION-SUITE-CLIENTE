import { APP_CONFIG } from '../core/Config.js?v=V153_DB_CONFIG';
import { ayudaService } from '../services/AyudaService.js';
import { sessionService } from '../services/SessionService.js';
import { Utils } from '../core/Utils.js';

/**
 * MÓDULO DE GUÍAS DE TRABAJO Y AYUDA (ayuda.js)
 * -------------------------------------------
 * Proporciona un checklist interactivo para cada turno (Mañana, Tarde, Noche).
 * Incluye un editor de texto enriquecido (WYSIWYG) flotante para que los 
 * jefes de recepción puedan personalizar las tareas con colores y negritas.
 */

let modoEdicion = false;    // Indica si el usuario puede modificar los textos
let turnoActual = 'noche';  // Turno que se está visualizando
let inputFoco = null;       // Referencia al campo que se está editando actualmente
const PASSWORD_EDICION = "1234"; 

/**
 * INICIALIZACIÓN
 */
export async function inicializarAyuda() {
    // 1. Cargar datos frescos del servidor (JSON Authority)
    await ayudaService.init();

    // Reparar el DOM si el contenedor principal no existe
    asegurarContenedorAyuda();

    // Configurar el selector de turno
    const select = document.getElementById('select-guia-ayuda');
    if (select) {
        select.removeEventListener('change', manejarCambioGuia);
        select.addEventListener('change', manejarCambioGuia);
        if (select.value) turnoActual = select.value;
    }

    const searchInput = document.getElementById('search-guia-ayuda');
    if (searchInput) {
        searchInput.removeEventListener('input', () => renderGuia());
        searchInput.addEventListener('input', () => renderGuia());
    }

    document.getElementById('btnImprimirAyuda')?.addEventListener('click', imprimirGuia);

    // Inyectar la barra de herramientas flotante (negrita, colores, etc.)
    inyectarToolbarFlotante();

    renderGuia();
}

function manejarCambioGuia(e) {
    cambiarGuia(e.target.value);
}

/**
 * REPARADOR DEL DOM
 * Si por algún error de plantilla falta el contenedor, lo inyecta dinámicamente.
 */
function asegurarContenedorAyuda() {
    if (!document.getElementById('ayuda-content')) {
        const tabContent = document.querySelector('.tab-content') || document.getElementById('main-content') || document.querySelector('main');
        if (tabContent) {
            const div = document.createElement('div');
            div.id = 'ayuda-content';
            div.className = 'tab-pane fade';
            div.setAttribute('role', 'tabpanel');
            tabContent.appendChild(div);
        }
    }
}

/**
 * BARRA DE HERRAMIENTAS FLOTANTE
 * Se muestra sobre el texto que estamos editando. Usa document.execCommand para el formato.
 */
function inyectarToolbarFlotante() {
    if (!document.getElementById('editor-toolbar')) {
        const toolbar = document.createElement('div');
        toolbar.id = 'editor-toolbar';
        toolbar.className = 'position-absolute bg-white border border-secondary rounded shadow p-2 d-none align-items-center gap-2';
        toolbar.style.zIndex = '9999';
        toolbar.innerHTML = `
            <div class="btn-group btn-group-sm" role="group">
                <button type="button" class="btn btn-light border border-secondary" onmousedown="event.preventDefault()" onclick="aplicarFormato('bold')"><i class="bi bi-type-bold"></i></button>
                <button type="button" class="btn btn-light border border-secondary" onmousedown="event.preventDefault()" onclick="aplicarFormato('italic')"><i class="bi bi-type-italic"></i></button>
            </div>
            <div class="btn-group btn-group-sm" role="group">
                <button type="button" class="btn btn-danger border-0" onmousedown="event.preventDefault()" onclick="aplicarFormato('foreColor', '#dc3545')"><i class="bi bi-fonts"></i></button>
                <button type="button" class="btn btn-primary border-0" onmousedown="event.preventDefault()" onclick="aplicarFormato('foreColor', '#0d6efd')"><i class="bi bi-fonts"></i></button>
                <button type="button" class="btn btn-warning text-dark" onmousedown="event.preventDefault()" onclick="aplicarFormato('hiliteColor', '#ffc107')"><i class="bi bi-highlighter"></i></button>
            </div>
            <div class="btn-group btn-group-sm" role="group">
                <button type="button" class="btn btn-warning border-0" onmousedown="event.preventDefault()" onclick="insertarIcono('warning')"><i class="bi bi-exclamation-triangle-fill"></i></button>
                <button type="button" class="btn btn-info border-0 text-white" onmousedown="event.preventDefault()" onclick="insertarIcono('info')"><i class="bi bi-info-circle-fill"></i></button>
                <button type="button" class="btn btn-success border-0" onmousedown="event.preventDefault()" onclick="insertarIcono('check')"><i class="bi bi-check-circle-fill"></i></button>
            </div>
        `;
        document.body.appendChild(toolbar);
    }
}

/**
 * DIBUJAR GUÍA
 * Genera la lista de pasos. Si modoEdicion = true, los elementos son editables y arrastrables.
 */
function renderGuia() {
    let lista = ayudaService.getGuia(turnoActual, obtenerGuiaPorDefecto(turnoActual));
    const term = document.getElementById('search-guia-ayuda')?.value.toLowerCase().trim() || '';

    // Filter by keyword if term is present
    if (term) {
        lista = lista.filter(paso => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = paso.texto;
            const textContent = tempDiv.textContent || tempDiv.innerText || '';
            return textContent.toLowerCase().includes(term);
        });
    }

    const container = document.getElementById('lista-pasos-container');
    const formAgregar = document.getElementById('form-agregar-paso');
    const infoFooter = document.getElementById('info-footer');
    const btnEdicion = document.getElementById('texto-btn-edicion');
    const iconEdicion = document.getElementById('icono-candado');

    if (!container) return;

    // Actualizar título con icono del turno
    const tituloEl = document.getElementById('titulo-guia');
    if (tituloEl) {
        const iconos = { noche: '🌙', mañana: '☕', tarde: '☀️' };
        tituloEl.innerHTML = `<i class="bi bi-list-check me-2"></i>Checklist: Turno de ${turnoActual.charAt(0).toUpperCase() + turnoActual.slice(1)} ${iconos[turnoActual] || ''}`;
    }

    container.innerHTML = '';

    lista.forEach((paso, index) => {
        let itemHtml = '';
        if (modoEdicion) {
            // MODO EDICIÓN: Con drag & drop y contenteditable
            itemHtml = `
                <div class="guide-item d-flex align-items-center p-3 mb-2 rounded bg-white shadow-sm border-start border-4 border-warning"
                    draggable="true" ondragstart="handleDragStart(event, ${index})" ondragover="handleDragOver(event)" ondrop="handleDrop(event, ${index})"
                    ondragenter="handleDragEnter(event)" ondragleave="handleDragLeave(event)">
                    <span class="text-muted me-3 fw-bold"><i class="bi bi-grip-vertical"></i> ${index + 1}.</span>
                    <div contenteditable="true" class="form-control me-2 bg-white" 
                        onfocus="setFoco(this); mostrarToolbar()" onmouseup="actualizarPosicionToolbar()" 
                        onkeyup="actualizarPosicionToolbar()" onblur="ocultarToolbar(); actualizarTextoPaso(${paso.id}, this.innerHTML)" 
                        style="min-height: 38px; display: flex; align-items: center;">${paso.texto}</div>
                    <button class="btn btn-outline-danger btn-sm" onclick="eliminarPasoGuia(${paso.id})"><i class="bi bi-trash"></i></button>
                </div>`;
        } else {
            // MODO LECTURA: Con checkboxes grandes para el recepcionista
            const checked = paso.hecho ? 'checked' : '';
            const textClass = paso.hecho ? 'text-decoration-line-through text-muted' : 'fw-bold text-dark lead';
            const icon = paso.hecho ? '<i class="bi bi-check-circle-fill text-success fs-4"></i>' : '<i class="bi bi-circle text-primary fs-4"></i>';

            itemHtml = `
                <label class="guide-item ${paso.hecho ? 'done' : 'pending'} d-flex align-items-center p-3 mb-3 rounded shadow-sm cursor-pointer w-100" style="cursor: pointer;">
                    <div class="me-3 d-flex align-items-center">${icon}</div>
                    <input class="d-none" type="checkbox" ${checked} onchange="toggleCheckPaso(${paso.id})">
                    <div class="${textClass}" style="font-size: 1.05rem;">${paso.texto}</div>
                </label>`;
        }
        container.innerHTML += itemHtml;
    });

    // Inicializar tooltips (si hubiera alguno dinámico)
    Ui.initTooltips(container);

    actualizarUIEdicion(formAgregar, infoFooter, btnEdicion, iconEdicion);
}

function actualizarUIEdicion(formAgregar, infoFooter, btnEdicion, iconEdicion) {
    if (modoEdicion) {
        formAgregar?.classList.remove('d-none');
        if (infoFooter) infoFooter.innerHTML = "<strong>Modo Edición:</strong> Pincha en un paso para editar su texto. Usa la barra superior para colores.";
        if (formAgregar) {
            formAgregar.innerHTML = `
                <div class="d-flex gap-2 align-items-start">
                    <div id="nuevo-paso-texto" contenteditable="true" class="form-control bg-white" onfocus="setFoco(this); mostrarToolbar()" onmouseup="actualizarPosicionToolbar()" onkeyup="actualizarPosicionToolbar()" onblur="ocultarToolbar()" style="min-height: 38px;"></div>
                    <button onclick="agregarPasoGuiaManual()" class="btn btn-primary px-4"><i class="bi bi-plus-lg"></i> Añadir</button>
                </div>`;
        }
        if (btnEdicion) btnEdicion.innerText = "Salir Edición";
        if (iconEdicion) iconEdicion.className = "bi bi-unlock-fill me-1";
    } else {
        formAgregar?.classList.add('d-none');
        if (infoFooter) infoFooter.innerText = "Modo Lectura: Marca las tareas a medida que las completes. Se guardan automáticamente en este navegador.";
        if (btnEdicion) btnEdicion.innerText = "Editar Guía";
        if (iconEdicion) iconEdicion.className = "bi bi-lock-fill me-1";
    }
}

/**
 * GUÍAS POR DEFECTO
 * Contienen todos los pasos oficiales definidos por la dirección del hotel.
 */
function obtenerGuiaPorDefecto(turno) {
    if (turno === 'mañana') {
        return [
            { id: 1, texto: "Revisar <b class='text-primary'>correos urgentes</b> y reservas del día.", hecho: false },
            { id: 2, texto: "Verificar desayunos especiales y dietas.", hecho: false },
            { id: 3, texto: "Gestión de <span class='text-danger fw-bold'>Check-outs</span> y facturación.", hecho: false }
        ];
    } else if (turno === 'tarde') {
        return [
            { id: 1, texto: "Gestión de <b class='text-success'>Check-ins</b> y registro de policías.", hecho: false },
            { id: 2, texto: "Revisar asignación de habitaciones para mañana.", hecho: false }
        ];
    } else {
        return [
            { id: 1, texto: "<h6 class='mb-1 text-primary fw-bold'>1. Tareas Preparatorias</h6><b>Novedades:</b> Revisar novedades y apagar luces.", hecho: false },
            { id: 2, texto: "<b>Datáfonos:</b> Realizar operaciones comercio y cierre antes 00:00.", hecho: false },
            { id: 3, texto: "<h6 class='mb-1 text-primary fw-bold mt-2'>2. Liquidación y Caja</h6><b>Liquidación:</b> Puntear facturas y datáfonos.", hecho: false },
            { id: 4, texto: "<h6 class='mb-1 text-primary fw-bold mt-2'>3. Cierre del Día</h6><b>Ejecución:</b> Iniciar proceso de Cierre del Día en el PMS.", hecho: false }
            // (Simplificado para el ejemplo de documentación)
        ];
    }
}

// --- MANEJADORES DE EVENTOS ---

function cambiarGuia(nuevoTurno) {
    turnoActual = nuevoTurno;
    renderGuia();
}

/**
 * ACTIVAR EDICIÓN
 * Protegido por una contraseña sencilla para evitar cambios accidentales por parte del staff.
 */
export async function toggleEdicionGuia() {
    if (modoEdicion) {
        modoEdicion = false;
        renderGuia();
    } else {
        const pass = await window.showPrompt("🔒 Contraseña de Edición:", "password");
        if (pass === PASSWORD_EDICION) {
            modoEdicion = true;
            renderGuia();
        } else if (pass !== null) window.showAlert("Contraseña incorrecta.", "error");
    }
}

export async function resetearChecksGuia() {
    if (await window.showConfirm("¿Restaurar la guía oficial? Esto borrará tus cambios personalizados.")) {
        let lista = obtenerGuiaPorDefecto(turnoActual).map(p => ({ ...p, hecho: false }));
        ayudaService.saveGuia(turnoActual, lista);
        renderGuia();
    }
}

export function toggleCheckPaso(id) {
    let lista = ayudaService.getGuia(turnoActual);
    lista = lista.map(p => p.id === id ? { ...p, hecho: !p.hecho } : p);
    ayudaService.saveGuia(turnoActual, lista);
    renderGuia();
}

export function agregarPasoGuiaManual() {
    const div = document.getElementById('nuevo-paso-texto');
    const texto = div.innerHTML.trim();
    if (texto) {
        let lista = ayudaService.getGuia(turnoActual);
        const nuevoId = Date.now();
        lista.push({ id: nuevoId, texto, hecho: false });
        ayudaService.saveGuia(turnoActual, lista);
        div.innerHTML = '';
        renderGuia();
    }
}

export async function eliminarPasoGuia(id) {
    if (await window.showConfirm("¿Eliminar este paso de la guía?")) {
        let lista = ayudaService.getGuia(turnoActual);
        lista = lista.filter(p => p.id !== id);
        ayudaService.saveGuia(turnoActual, lista);
        renderGuia();
    }
}

export function actualizarTextoPaso(id, nuevoTexto) {
    let lista = ayudaService.getGuia(turnoActual);
    lista = lista.map(p => p.id === id ? { ...p, texto: nuevoTexto } : p);
    ayudaService.saveGuia(turnoActual, lista);
}

// --- LÓGICA DE BARRA DE HERRAMIENTAS ---

export function setFoco(el) { inputFoco = el; }
export function mostrarToolbar() { 
    document.getElementById('editor-toolbar')?.classList.replace('d-none', 'd-flex'); 
    actualizarPosicionToolbar(); 
}
export function ocultarToolbar() { 
    // Pequeño delay para permitir clicks en la propia barra
    setTimeout(() => document.getElementById('editor-toolbar')?.classList.replace('d-flex', 'd-none'), 200); 
}
export function actualizarPosicionToolbar() { 
    if (!inputFoco) return; 
    const tb = document.getElementById('editor-toolbar'); 
    if (!tb || tb.classList.contains('d-none')) return; 
    const r = inputFoco.getBoundingClientRect(); 
    tb.style.top = `${r.top + window.scrollY - tb.offsetHeight - 8}px`; 
    tb.style.left = `${r.left + window.scrollX + (r.width / 2) - (tb.offsetWidth / 2)}px`; 
}

export function aplicarFormato(cmd, val) { 
    if (!inputFoco) return; 
    inputFoco.focus(); 
    document.execCommand(cmd, false, val); 
}

export function insertarIcono(tipo) { 
    if (!inputFoco) return; 
    inputFoco.focus(); 
    const icon = tipo === 'warning' ? `<i class="bi bi-exclamation-triangle-fill text-warning me-1"></i>` : tipo === 'check' ? `<i class="bi bi-check-circle-fill text-success me-1"></i>` : `<i class="bi bi-info-circle-fill text-info me-1"></i>`; 
    document.execCommand('insertHTML', false, icon + '&nbsp;'); 
}

function imprimirGuia() {
    // 1. Obtener datos actuales
    const lista = ayudaService.getGuia(turnoActual, []);
    const user = Utils.validateUser();
    if (!user) return;

    // 2. Construir HTML limpio para impresión (Tabla profesional)
    let html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <div style="border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; color: #333;">CHECKLIST: TURNO DE ${turnoActual.toUpperCase()}</h3>
                <div style="text-align: right; font-size: 12px; color: #666;">
                    <b>Fecha:</b> ${Utils.getTodayISO()}<br>
                    <b>Recepcionista:</b> ${user}
                </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="border: 1px solid #ddd; padding: 12px; text-align: center; width: 80px;">ESTADO</th>
                        <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">TAREA / PROCEDIMIENTO</th>
                    </tr>
                </thead>
                <tbody>
    `;

    lista.forEach((p) => {
        const checkMark = p.hecho ? '<b style="color: #198754;">[X] HECHO</b>' : '<b style="color: #dee2e6;">[ ] PENDIENTE</b>';
        const textStyle = p.hecho ? 'text-decoration: line-through; color: #666;' : 'font-weight: bold; color: #000;';
        
        html += `
            <tr>
                <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-family: monospace;">${checkMark}</td>
                <td style="border: 1px solid #ddd; padding: 10px; ${textStyle}">${p.texto}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            
            <div style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px; font-size: 10px; color: #aaa; text-align: center;">
                Reception Suite v2 - Sistema de Gestión Hotelera
            </div>
        </div>
    `;

    // 3. Enviar al servicio de impresión
    if (window.PrintService) {
        PrintService.printHTML(html);
    } else {
        window.print();
    }
}

// --- DRAG AND DROP ---
let draggedItemIndex = null;
export function handleDragStart(e, index) { draggedItemIndex = index; e.dataTransfer.effectAllowed = 'move'; e.target.style.opacity = '0.4'; }
export function handleDragOver(e) { e.preventDefault(); return false; }
export function handleDragEnter(e) { e.target.closest('.guide-item')?.classList.add('bg-light', 'border-primary'); }
export function handleDragLeave(e) { e.target.closest('.guide-item')?.classList.remove('bg-light', 'border-primary'); }
export function handleDrop(e, targetIndex) {
    e.stopPropagation();
    document.querySelectorAll('.guide-item').forEach(el => { el.style.opacity = '1'; el.classList.remove('bg-light', 'border-primary'); });
    if (draggedItemIndex !== null && draggedItemIndex !== targetIndex) {
        let lista = ayudaService.getGuia(turnoActual);
        const [movedItem] = lista.splice(draggedItemIndex, 1);
        lista.splice(targetIndex, 0, movedItem);
        ayudaService.saveGuia(turnoActual, lista);
        renderGuia();
    }
    draggedItemIndex = null;
    return false;
}

// Exponer funciones globales
window.cambiarGuia = cambiarGuia;
window.toggleEdicionGuia = toggleEdicionGuia;
window.resetearChecksGuia = resetearChecksGuia;
window.toggleCheckPaso = toggleCheckPaso;
window.agregarPasoGuiaManual = agregarPasoGuiaManual;
window.eliminarPasoGuia = eliminarPasoGuia;
window.actualizarTextoPaso = actualizarTextoPaso;
window.setFoco = setFoco;
window.mostrarToolbar = mostrarToolbar;
window.ocultarToolbar = ocultarToolbar;
window.actualizarPosicionToolbar = actualizarPosicionToolbar;
window.aplicarFormato = aplicarFormato;
window.insertarIcono = insertarIcono;
window.imprimirGuia = imprimirGuia;
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDragEnter = handleDragEnter;
window.handleDragLeave = handleDragLeave;
window.handleDrop = handleDrop;
