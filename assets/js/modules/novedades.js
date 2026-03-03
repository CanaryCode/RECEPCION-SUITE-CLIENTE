import { APP_CONFIG } from "../core/Config.js";
import { Utils } from '../core/Utils.js';
import { Ui } from '../core/Ui.js';
import { novedadesService } from '../services/NovedadesService.js';
import { sessionService } from '../services/SessionService.js';

/**
 * MÓDULO DE NOVEDADES Y COMUNICACIÓN (novedades.js)
 * -----------------------------------------------
 * Registra eventos, averías o avisos destinados a otros departamentos o turnos.
 * Soporta prioridades, estados de gestión (Pendiente/Terminada) y multiselección de departamentos.
 */

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

export async function inicializarNovedades() {
    await novedadesService.init();

    await novedadesService.init();

    // 1. CONFIGURAR VISTAS (Conmutador)
    // Fix: Usamos un ID dummy para la vista "Solo Novedades" para que setupViewToggle
    // oculte automáticamente "novedades-formulario" (que pertenece al btnTrabajo) al cambiar.
    Ui.setupViewToggle({
        buttons: [
            { id: 'btnVistaTrabajoNov', viewId: 'novedades-formulario' },
            { id: 'btnVistaSoloNov', viewId: 'novedades-solo-dummy' }
        ]
    });

    // Validar estado inicial explícito si fuera necesario, pero Ui.setupViewToggle ya lo hace.


    // 2. CONFIGURAR FORMULARIO (Asistente)
    Ui.handleFormSubmission({
        formId: 'formNovedad',
        service: novedadesService,
        idField: 'nov_id',
        mapData: (rawData) => {
            const isNew = !rawData.nov_id;
            const now = new Date();
            
            // Validar campos básicos (YA LO HACE EL NAVEGADOR CON REQUIRED, pero reforzamos)
            if (!rawData.nov_texto.trim()) return null;

            // Extraer departamentos
            let departamentos = Array.from(document.querySelectorAll('.check-nov-dept:checked')).map(cb => cb.value);
            if (departamentos.includes('Otro')) {
                const inputOtro = document.getElementById('nov_dept_otro_input');
                const nuevoDept = inputOtro.value.trim();
                departamentos = departamentos.filter(d => d !== 'Otro');
                if (nuevoDept) departamentos.push(nuevoDept);
                else {
                    alert("Por favor, especifique el nombre del departamento 'Otro'.");
                    return null;
                }
            }
            if (departamentos.length === 0) {
                alert("Selecciona al menos un departamento.");
                return null;
            }

            const data = {
                prioridad: rawData.nov_prioridad,
                texto: rawData.nov_texto,
                comentario: rawData.nov_comentario,
                departamentos,
                estado: rawData.nov_estado || 'Pendiente'
            };

            if (isNew) {
                data.id = Date.now();
                data.fecha = now.toLocaleDateString();
                data.hora = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
                data.id = parseInt(rawData.nov_id);
                data.fechaModificacion = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            }
            return data;
        },
        onSuccess: () => {
            const btn = document.getElementById('btnSubmitNovedad');
            if (btn) btn.innerHTML = '<i class="bi bi-save-fill me-2"></i>Registrar Novedad';
            document.getElementById('nov_dept_otro_input')?.classList.add('d-none');
            mostrarNovedades();
        }
    });

    generarCheckboxesDepartamentos();
    mostrarNovedades();
    setupIntersectionObserver();

    // Suscribirse a cambios del servicio para actualizar dashboard en tiempo real
    window.addEventListener('service-synced', (e) => {
        if (e.detail.endpoint === 'riu_novedades') {
            mostrarNovedades();
        }
    });
}

function generarCheckboxesDepartamentos() {
    const deptsCont = document.getElementById('nov_depts_container');
    if (!deptsCont) return;

    let html = APP_CONFIG.NOVEDADES.DEPARTAMENTOS.map(d => `
        <div class="form-check me-2">
            <input class="form-check-input check-nov-dept" type="checkbox" value="${d}" id="dept_${d.replace(/\s/g, '')}">
            <label class="form-check-label small" for="dept_${d.replace(/\s/g, '')}">${d}</label>
        </div>
    `).join('');

    html += `
        <div class="form-check me-2 d-flex align-items-center">
            <input class="form-check-input check-nov-dept" type="checkbox" value="Otro" id="dept_otro">
            <label class="form-check-label small me-2" for="dept_otro">Otro:</label>
            <input type="text" class="form-control form-control-sm d-none" id="nov_dept_otro_input" placeholder="Nuevo..." style="width: 120px;">
        </div>
    `;
    deptsCont.innerHTML = html;

    const checkOtro = document.getElementById('dept_otro');
    const inputOtro = document.getElementById('nov_dept_otro_input');
    if (checkOtro && inputOtro) {
        checkOtro.addEventListener('change', (e) => {
            inputOtro.classList.toggle('d-none', !e.target.checked);
            if (e.target.checked) inputOtro.focus();
            else inputOtro.value = '';
        });
    }
}

/**
 * Función global para facilitar el cambio programático
 */
window.cambiarVistaNovedades = (vista) => {
    const btn = vista === 'trabajo' ? 'btnVistaTrabajoNov' : 'btnVistaSoloNov';
    document.getElementById(btn)?.click();
};

// ============================================================================
// RENDERIZADO
// ============================================================================

/**
 * RENDERIZADO DE NOVEDADES
 * Actualiza tanto el mini-resumen del Dashboard como la tabla principal de gestión.
 * Aplica estilos visuales según prioridad (Urgente = Rojo).
 */
// ============================================================================
// PAGINACIÓN Y RENDERIZADO (LAZY LOAD)
// ============================================================================

// ============================================================================
// PAGINACIÓN Y RENDERIZADO (LAZY LOAD)
// ============================================================================

let currentFilteredNovedades = [];
let visibleCount = 50;
const PAGE_SIZE = 50;
let infiniteScrollController = null;

function setupIntersectionObserver() {
    infiniteScrollController = Ui.infiniteScroll({
        onLoadMore: window.cargarMasNovedades,
        sentinelId: 'sentinel-loader-nov'
    });
}


/**
 * RENDERIZADO DE NOVEDADES (CONTROLLER)
 * Prepara los datos, actualiza el Dashboard y llama al renderizado de la tabla.
 */
function mostrarNovedades() {
    const novedades = novedadesService.getNovedades();

    // 1. Actualizar Dashboard (Siempre con los datos más recientes)
    actualizarDashboardNovedades(novedades);

    // 2. Preparar Lista Filtrada (Por ahora sin filtro de texto en UI, pero preparado)
    // Ordenar por fecha desc (más reciente primero)
    // Nota: El servicio ya suele devolverlas ordenadas, pero aseguramos
    // Si hubiera filtro de búsqueda, lo aplicaríamos aquí
    currentFilteredNovedades = [...novedades]; 
    
    // Resetear paginación
    visibleCount = 50;
    
    // 3. Renderizar Tabla (Reset)
    renderListaNovedades(false);
}

function actualizarDashboardNovedades(novedades) {
    const pendientes = novedades.filter(n => n.estado !== 'Terminada');
    
    // USAR ABSTRACCIÓN DASHBOARD
    Ui.updateDashboardWidget('novedades', pendientes, (n) => {
        const color = n.prioridad === 'Urgente' ? 'text-danger' : 'text-info';
        return `
        <tr onclick="irANovedad(${n.id})" style="cursor: pointer;">
            <td><i class="bi bi-circle-fill ${color} me-2" style="font-size: 0.5rem;"></i>${n.texto}</td>
            <td class="text-end small text-muted">${n.hora}</td>
        </tr>`;
    });
}

/**
 * DIBUJAR TABLA PRINCIPAL (VIEW)
 * Soporta append para Infinite Scroll.
 */
function renderListaNovedades(append = false) {
    const tabla = document.getElementById('tablaNovedadesCuerpo');
    if (!tabla) return;

    if (!append) {
        // Reset count if new load
        visibleCount = Math.min(PAGE_SIZE, currentFilteredNovedades.length > 0 ? currentFilteredNovedades.length : PAGE_SIZE);
    }

    const total = currentFilteredNovedades.length;
    const start = append ? Math.max(0, visibleCount - PAGE_SIZE) : 0;
    const end = Math.min(visibleCount, total);

    if (append && start >= end) return;

    const slice = currentFilteredNovedades.slice(start, end);

    // USAR NUEVA ABSTRACCIÓN ÚNICA
    Ui.renderTable('tablaNovedadesCuerpo', slice, (n) => {
        const isUrgente = n.prioridad === 'Urgente';
        let statusClass = 'bg-secondary';
        if (n.estado === 'En Proceso') statusClass = 'bg-info text-dark';
        if (n.estado === 'Terminada') statusClass = 'bg-success';

        let rowClass = isUrgente ? 'nov-urgente' : '';

        const deptsBadges = n.departamentos.map(d => `<span class="badge bg-primary opacity-75 me-1" style="font-size: 0.6rem;">${d}</span>`).join('');
        const comentarioHtml = n.comentario ? `<div class="mt-1 p-2 bg-light rounded small border-start border-3"><strong>Seguimiento:</strong> ${n.comentario}</div>` : '';
        const modificadoHtml = n.fechaModificacion ? `<div class="text-info mt-1" style="font-size: 0.65rem;"><strong><i class="bi bi-info-circle me-1"></i>Modificado:</strong> ${n.fechaModificacion}</div>` : '';

        return `
        <tr id="nov-row-${n.id}" class="${rowClass}">
            <td class="small">
                <div class="fw-bold">${n.fecha}</div>
                <div class="text-muted">${n.hora}</div>
            </td>
            <td>
                <span class="badge ${isUrgente ? 'bg-danger' : 'bg-light text-dark border'}">${n.prioridad}</span>
            </td>
            <td>
                <div class="fw-bold mb-1">${n.texto}</div>
                <div class="mb-1">${deptsBadges}</div>
                <div class="small text-muted">Escrito por: <strong>${n.autor}</strong></div>
                ${comentarioHtml}
                ${modificadoHtml}
            </td>
            <td>
                <select onchange="cambiarEstadoNovedad(${n.id}, this.value)" class="form-select form-select-sm ${statusClass} bg-opacity-10 fw-bold">
                    <option value="Pendiente" ${n.estado === 'Pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                    <option value="En Proceso" ${n.estado === 'En Proceso' ? 'selected' : ''}>⚙️ En Proceso</option>
                    <option value="Terminada" ${n.estado === 'Terminada' ? 'selected' : ''}>✅ Terminada</option>
                </select>
            </td>
            <td class="text-end">
                <button onclick="prepararEdicionNovedad(${n.id})" class="btn btn-sm btn-outline-primary border-0 me-1" data-bs-toggle="tooltip" data-bs-title="Editar"><i class="bi bi-pencil"></i></button>
                <button onclick="eliminarNovedad(${n.id})" class="btn btn-sm btn-outline-danger border-0" data-bs-toggle="tooltip" data-bs-title="Eliminar"><i class="bi bi-trash"></i></button>
            </td>
        </tr>`;
    }, 'No hay novedades registradas.', append);

    // Gestionar Sentinel con Ui.js
    if (visibleCount < total) {
        const sentinelRow = Ui.createSentinelRow('sentinel-loader-nov', 'Cargando historial...', 5);
        tabla.appendChild(sentinelRow);
        
        if (infiniteScrollController) infiniteScrollController.reconnect();
    }

    if (window.checkDailySummaryVisibility) window.checkDailySummaryVisibility();

    if (!append) {
        Ui.enableTableSorting('table-novedades', currentFilteredNovedades, (sorted) => {
             currentFilteredNovedades = sorted;
             // Reset paging ?? Sorting full list usually means resetting custom paging or rendering all.
             // Our infinite scroll supports partial rendering.
             // If we sort, we sort the WHOLE currentFilteredNovedades array.
             // Then we should re-render from scratch (page 1) to show top results.
             visibleCount = PAGE_SIZE;
             renderListaNovedades(false);
        });
    }
}

window.cargarMasNovedades = function() {
    if (visibleCount >= currentFilteredNovedades.length) return;
    visibleCount += PAGE_SIZE;
    renderListaNovedades(true);
};

// ============================================================================
// ACCIONES GLOBALES
// ============================================================================

function imprimirNovedades() {
    const user = Utils.validateUser();
    if (!user) return;

    // 2. Usar Servicio Centralizado (Estrategia Iframe)
    if (window.PrintService) {
        const dateStr = new Date().toLocaleDateString();
        // Intentar imprimir el cuerpo de la tabla o el contenedor de la lista
        const table = document.getElementById('table-novedades'); // ID probable de la tabla
        if (table) {
            PrintService.printElement('table-novedades', `Libro de Novedades - ${dateStr}`);
        } else {
             // Fallback al contenedor general
            PrintService.printElement('novedades-formulario', `Libro de Novedades - ${dateStr}`);
        }
    } else {
        window.print();
    }
}

window.cambiarEstadoNovedad = async (id, nuevoEstado) => {
    const novedad = novedadesService.getById(id);
    if (novedad) {
        novedad.estado = nuevoEstado;
        await novedadesService.saveNovedad(novedad);
    }
    mostrarNovedades();
};

window.eliminarNovedad = async (id) => {
    if (await Ui.showConfirm("¿Eliminar esta novedad definitivamente?")) {
        await novedadesService.removeNovedad(id);
        mostrarNovedades();
    }
};

/**
 * EDITAR NOVEDAD
 * Carga los datos de una novedad existente en el formulario para su modificación.
 */
window.prepararEdicionNovedad = (id) => {
    const n = novedadesService.getById(id);
    if (n) {
        cambiarVistaNovedades('trabajo');
        Utils.setVal('nov_id', n.id);
        Utils.setVal('nov_prioridad', n.prioridad);
        Utils.setVal('nov_texto', n.texto);
        Utils.setVal('nov_comentario', n.comentario || '');

        // Marcar departamentos
        // Resetear todos primero
        document.querySelectorAll('.check-nov-dept').forEach(cb => cb.checked = false);
        const deptOtroCheck = document.getElementById('dept_otro');
        const deptOtroInput = document.getElementById('nov_dept_otro_input');
        if (deptOtroCheck) deptOtroCheck.checked = false;
        if (deptOtroInput) {
            deptOtroInput.value = '';
            deptOtroInput.classList.add('d-none');
        }

        n.departamentos.forEach(dept => {
            const cb = document.querySelector(`.check-nov-dept[value="${dept}"]`);
            if (cb) {
                cb.checked = true;
            } else {
                // Es un departamento personalizado
                if (deptOtroCheck && deptOtroInput) {
                    deptOtroCheck.checked = true;
                    deptOtroInput.value = dept;
                    deptOtroInput.classList.remove('d-none');
                }
            }
        });

        const btn = document.getElementById('btnSubmitNovedad');
        if (btn) btn.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Actualizar Novedad';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

window.cambiarVistaNovedades = cambiarVistaNovedades;
window.imprimirNovedades = imprimirNovedades;

window.irANovedad = (id) => {
    // Defer
    setTimeout(() => {
        navegarA('#novedades-content');
        cambiarVistaNovedades('solo');
        setTimeout(() => {
            const row = document.getElementById(`nov-row-${id}`);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.classList.add('table-warning');
                setTimeout(() => row.classList.remove('table-warning'), 2000);
            }
        }, 100);
    }, 10);
};

window.limpiarNovedadesTerminadas = async () => {
    if (await Ui.showConfirm("¿Deseas borrar todas las novedades marcadas como 'Terminada'?")) {
        // En lugar de acceder a localStorage, usamos servicio (simulado aquí con lógica manual pq servicio no tiene deleteBulk)
        const all = novedadesService.getNovedades();
        const active = all.filter(n => n.estado !== 'Terminada');
        novedadesService.saveNovedades(active);
        mostrarNovedades();
    }
};

// Exponer globalmente para dashboard
window.mostrarNovedades = mostrarNovedades;
