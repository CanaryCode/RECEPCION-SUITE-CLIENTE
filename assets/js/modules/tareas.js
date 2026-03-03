import { APP_CONFIG } from "../core/Config.js";
import { Utils } from '../core/Utils.js';
import { Ui } from '../core/Ui.js';
import { tareasService } from '../services/TareasService.js';

/**
 * MÓDULO DE TAREAS (tareas.js)
 * -----------------------------------------------
 * Gestión de tareas pendientes, asignaciones y seguimiento diario.
 */

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

export async function inicializarTareas() {
    await tareasService.init();

    // 1. CONFIGURAR VISTAS (Conmutador)
    Ui.setupViewToggle({
        buttons: [
            { id: 'btnVistaTrabajoTareas', viewId: 'tareas-formulario' },
            { id: 'btnVistaSoloTareas', viewId: 'tareas-solo-dummy' } // Dummy for toggling
        ]
    });

    // 2. CONFIGURAR FORMULARIO
    Ui.handleFormSubmission({
        formId: 'formTarea',
        service: tareasService,
        idField: 'tarea_id',
        mapData: (rawData) => {
            const isNew = !rawData.tarea_id;
            
            if (!rawData.tarea_titulo.trim()) return null;

            const data = {
                titulo: rawData.tarea_titulo,
                descripcion: rawData.tarea_descripcion,
                prioridad: rawData.tarea_prioridad,
                fecha: rawData.tarea_fecha,
                estado: rawData.tarea_estado || 'Pendiente'
            };

            if (isNew) {
                data.id = Date.now();
                const now = new Date();
                data.hora = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
                data.id = parseInt(rawData.tarea_id);
            }
            return data;
        },
        onSuccess: () => {
            const btn = document.getElementById('btnSubmitTarea');
            if (btn) btn.innerHTML = '<i class="bi bi-save-fill me-2"></i>Guardar Tarea';
            mostrarTareas();
        }
    });

    // Carga inicial
    mostrarTareas();
    setupIntersectionObserverTareas();

    // Suscribirse a cambios del servicio para actualizar dashboard en tiempo real
    window.addEventListener('service-synced', (e) => {
        if (e.detail.endpoint === 'riu_tareas') {
            mostrarTareas();
        }
    });
}

// ============================================================================
// RENDERIZADO
// ============================================================================

let currentFilteredTareas = [];
let visibleCountTareas = 50;
const PAGE_SIZE_TAREAS = 50;
let infiniteScrollControllerTareas = null;

function setupIntersectionObserverTareas() {
    infiniteScrollControllerTareas = Ui.infiniteScroll({
        onLoadMore: window.cargarMasTareas,
        sentinelId: 'sentinel-loader-tareas'
    });
}

function mostrarTareas() {
    const tareas = tareasService.getTareas();

    // 1. Actualizar Dashboard
    actualizarDashboardTareas(tareas);

    // 2. Preparar Lista Filtrada (Ordenada por fecha y prioridad)
    currentFilteredTareas = [...tareas].sort((a, b) => {
        // Primero por estado (Pendientes primero)
        if (a.estado !== 'Terminada' && b.estado === 'Terminada') return -1;
        if (a.estado === 'Terminada' && b.estado !== 'Terminada') return 1;
        
        // Luego por fecha
        const dateA = new Date(a.fecha);
        const dateB = new Date(b.fecha);
        if (dateA < dateB) return -1;
        if (dateA > dateB) return 1;

        // Luego por prioridad
        const prioMap = { 'Alta': 1, 'Normal': 2, 'Baja': 3 };
        return (prioMap[a.prioridad] || 2) - (prioMap[b.prioridad] || 2);
    });
    
    visibleCountTareas = 50;
    renderListaTareas(false);
}

function actualizarDashboardTareas(tareas) {
    // Filtrar todas las tareas que no estén terminadas (incluyendo vencidas y próximas)
    const pendientes = tareas.filter(t => t.estado !== 'Terminada');
    
    Ui.updateDashboardWidget('tareas', pendientes, (t) => {
        const color = t.prioridad === 'Alta' ? 'text-danger' : (t.prioridad === 'Baja' ? 'text-success' : 'text-primary');
        return `
        <tr onclick="irATarea(${t.id})" style="cursor: pointer;">
            <td><i class="bi bi-circle-fill ${color} me-2" style="font-size: 0.5rem;"></i>${t.titulo}</td>
            <td class="text-end small text-muted">${t.prioridad}</td>
        </tr>`;
    });
}

function renderListaTareas(append = false) {
    const tabla = document.getElementById('tablaTareasCuerpo');
    if (!tabla) return;

    if (!append) {
        visibleCountTareas = Math.min(PAGE_SIZE_TAREAS, currentFilteredTareas.length > 0 ? currentFilteredTareas.length : PAGE_SIZE_TAREAS);
    }

    const total = currentFilteredTareas.length;
    const start = append ? Math.max(0, visibleCountTareas - PAGE_SIZE_TAREAS) : 0;
    const end = Math.min(visibleCountTareas, total);

    if (append && start >= end) return;

    const slice = currentFilteredTareas.slice(start, end);

    Ui.renderTable('tablaTareasCuerpo', slice, (t) => {
        const isAlta = t.prioridad === 'Alta';
        const isTerminada = t.estado === 'Terminada';
        
        let statusClass = 'bg-secondary';
        if (t.estado === 'En Proceso') statusClass = 'bg-info text-dark';
        if (t.estado === 'Terminada') statusClass = 'bg-success';

        let rowClass = isAlta ? 'tarea-alta' : '';
        if (isTerminada) rowClass += ' tarea-terminada';

        return `
        <tr id="tarea-row-${t.id}" class="${rowClass}">
            <td class="small fw-bold">${Utils.formatDate(t.fecha)}</td>
            <td>
                <span class="badge ${isAlta ? 'bg-danger' : (t.prioridad === 'Baja' ? 'bg-success' : 'bg-light text-dark border')}">${t.prioridad}</span>
            </td>
            <td>
                <div class="fw-bold mb-1">${t.titulo}</div>
                <div class="small text-muted">${t.descripcion || 'Sin descripción'}</div>
                <div class="mt-1" style="font-size: 0.65rem;">Por: <strong>${t.autor}</strong></div>
            </td>
            <td>
                <select onchange="cambiarEstadoTarea(${t.id}, this.value)" class="form-select form-select-sm ${statusClass} bg-opacity-10 fw-bold">
                    <option value="Pendiente" ${t.estado === 'Pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                    <option value="En Proceso" ${t.estado === 'En Proceso' ? 'selected' : ''}>⚙️ En Proceso</option>
                    <option value="Terminada" ${t.estado === 'Terminada' ? 'selected' : ''}>✅ Terminada</option>
                </select>
            </td>
            <td class="text-end">
                <button onclick="prepararEdicionTarea(${t.id})" class="btn btn-sm btn-outline-primary border-0 me-1" data-bs-toggle="tooltip" data-bs-title="Editar"><i class="bi bi-pencil"></i></button>
                <button onclick="eliminarTarea(${t.id})" class="btn btn-sm btn-outline-danger border-0" data-bs-toggle="tooltip" data-bs-title="Eliminar"><i class="bi bi-trash"></i></button>
            </td>
        </tr>`;
    }, 'No hay tareas registradas.', append);

    if (visibleCountTareas < total) {
        const sentinelRow = Ui.createSentinelRow('sentinel-loader-tareas', 'Cargando más tareas...', 5);
        tabla.appendChild(sentinelRow);
        if (infiniteScrollControllerTareas) infiniteScrollControllerTareas.reconnect();
    }
}

window.cargarMasTareas = function() {
    if (visibleCountTareas >= currentFilteredTareas.length) return;
    visibleCountTareas += PAGE_SIZE_TAREAS;
    renderListaTareas(true);
};

// ============================================================================
// ACCIONES GLOBALES
// ============================================================================

window.cambiarEstadoTarea = async (id, nuevoEstado) => {
    const tarea = tareasService.getById(id);
    if (tarea) {
        tarea.estado = nuevoEstado;
        await tareasService.saveTarea(tarea);
    }
    mostrarTareas();
};

window.eliminarTarea = async (id) => {
    if (await Ui.showConfirm("¿Eliminar esta tarea definitivamente?")) {
        await tareasService.removeTarea(id);
        mostrarTareas();
    }
};

window.prepararEdicionTarea = (id) => {
    const t = tareasService.getById(id);
    if (t) {
        // Cambiar vista al formulario
        document.getElementById('btnVistaTrabajoTareas')?.click();
        
        Utils.setVal('tarea_id', t.id);
        Utils.setVal('tarea_titulo', t.titulo);
        Utils.setVal('tarea_prioridad', t.prioridad);
        Utils.setVal('tarea_fecha', t.fecha);
        Utils.setVal('tarea_descripcion', t.descripcion || '');

        const btn = document.getElementById('btnSubmitTarea');
        if (btn) btn.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Actualizar Tarea';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

window.limpiarTareasTerminadas = async () => {
    if (await Ui.showConfirm("¿Deseas borrar todas las tareas marcadas como 'Terminada'?")) {
        const all = tareasService.getTareas();
        const active = all.filter(t => t.estado !== 'Terminada');
        // Usamos saveTodas (heredado de BaseService)
        await tareasService.saveAll(active);
        mostrarTareas();
    }
};

window.irATarea = (id) => {
    setTimeout(() => {
        navegarA('#tareas-content');
        setTimeout(() => {
            const row = document.getElementById(`tarea-row-${id}`);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.classList.add('table-warning');
                setTimeout(() => row.classList.remove('table-warning'), 2000);
            }
        }, 300);
    }, 10);
};

window.imprimirTareas = () => {
    if (window.PrintService) {
        const dateStr = new Date().toLocaleDateString();
        PrintService.printElement('table-tareas', `Listado de Tareas - ${dateStr}`);
    } else {
        window.print();
    }
};

// Exponer globalmente
window.mostrarTareas = mostrarTareas;
window.inicializarTareas = inicializarTareas;
