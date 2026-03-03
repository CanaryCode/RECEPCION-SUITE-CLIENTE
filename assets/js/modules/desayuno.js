import { Utils } from '../core/Utils.js';
import { APP_CONFIG } from "../core/Config.js";
import { Ui } from '../core/Ui.js';
import { desayunoService } from '../services/DesayunoService.js';

/**
 * MÓDULO DE DESAYUNOS TEMPRANOS (desayuno.js)
 * ------------------------------------------
 * Gestiona las peticiones de desayuno antes de la apertura del comedor.
 */

export async function inicializarDesayuno() {
    await desayunoService.init();

    // 1. CONFIGURAR VISTAS (Conmutador)
    Ui.setupViewToggle({
        buttons: [
            { id: 'btnVistaTrabajoDesayuno', viewId: 'desayuno-trabajo', onShow: mostrarDesayunos },
            { id: 'btnVistaRackDesayuno', viewId: 'desayuno-rack', onShow: renderVistaRackDesayuno }
        ]
    });

    // 2. AUTOCOMPLETE DE HABITACIONES
    Ui.initRoomAutocomplete('lista-habs-desayuno');
    Ui.attachRoomValidator('desayuno_hab', { allowEmpty: false });

    // 3. GESTIÓN DE FORMULARIO (Asistente)
    Ui.handleFormSubmission({
        formId: 'formNuevoDesayuno',
        service: desayunoService,
        idField: 'desayuno_hab',
        serviceIdField: 'hab', // Crucial para evitar duplicados en actualizaciones
        mapData: (rawData) => {
            const hab = rawData.desayuno_hab.trim().padStart(3, '0');
            const autor = Utils.validateUser();
            if (!autor) return null;

            return {
                hab,
                pax: parseInt(rawData.desayuno_pax),
                hora: rawData.desayuno_hora,
                obs: rawData.desayuno_obs,
                autor: rawData.autor || autor,
                timestamp: Date.now()
            };
        },
        onSuccess: () => {
            const btnSubmit = document.getElementById('btnSubmitDesayuno');
            if (btnSubmit) btnSubmit.innerHTML = '<i class="bi bi-save-fill me-2"></i>Guardar';
            // Reset form title/mode if needed, though Ui.handleFormSubmission usually resets form
            const titleEl = document.querySelector('#formNuevoDesayuno h6');
            if (titleEl) titleEl.innerHTML = '<i class="bi bi-cup-hot me-2"></i>Nuevo Desayuno';
            mostrarDesayunos();
        }
    });

    mostrarDesayunos();

    // Suscribirse a cambios del servicio para actualizar dashboard en tiempo real
    window.addEventListener('service-synced', (e) => {
        if (e.detail.endpoint === 'riu_desayunos') {
            mostrarDesayunos();
        }
    });
}

/**
 * RENDERIZADO DE TABLA Y DASHBOARD
 */
function mostrarDesayunos() {
    const desayunos = desayunoService.getAll();
    const listaDesayunos = Object.keys(desayunos)
        .sort((a, b) => (desayunos[a].hora || "99:99").localeCompare(desayunos[b].hora || "99:99"))
        .map(hab => ({ hab, ...desayunos[hab] }));

    // A. Dashboard (API Ui)
    Ui.updateDashboardWidget('desayunos', listaDesayunos, (item) => `
        <tr onclick="setTimeout(() => irADesayuno('${item.hab}'), 10)" style="cursor: pointer;">
            <td class="fw-bold">${item.hab}</td>
            <td class="text-end"><span class="badge bg-danger">${item.hora || '--:--'}</span></td>
        </tr>`);

    if (window.checkDailySummaryVisibility) window.checkDailySummaryVisibility();

    // B. Tabla Principal (API Ui)
    // B. Tabla Principal (API Ui)
    renderTablaDesayunos(listaDesayunos);

    // Initial Sort Enablement
    Ui.enableTableSorting('table-desayunos', listaDesayunos, (sortedData) => {
        renderTablaDesayunos(sortedData);
    });
}

function renderTablaDesayunos(lista) {
    Ui.renderTable('tablaDesayunoActivos', lista, (item) => `
        <tr id="desayuno-row-${item.hab}">
            <td class="fw-bold text-primary">${item.hab}</td>
            <td><span class="badge bg-light text-dark border">${item.pax} pax</span></td>
            <td><span class="badge bg-info text-dark"><i class="bi bi-clock me-1"></i>${item.hora}</span></td>
            <td class="text-muted small">
                ${item.obs || '-'}
                <div class="text-info mt-1" style="font-size: 0.65rem;">
                    <i class="bi bi-person-fill me-1"></i>${item.autor || 'N/A'}
                </div>
            </td>
            <td class="text-end">
                <button onclick="editarDesayuno('${item.hab}')" class="btn btn-sm btn-outline-primary border-0 me-1" data-bs-toggle="tooltip" title="Editar"><i class="bi bi-pencil"></i></button>
                <button onclick="eliminarDesayuno('${item.hab}')" class="btn btn-sm btn-outline-danger border-0" data-bs-toggle="tooltip" title="Eliminar"><i class="bi bi-trash"></i></button>
            </td>
        </tr>`, 'No hay pedidos de desayuno registrados.');
}

/**
 * VISTA RACK DE DESAYUNOS
 */
function renderVistaRackDesayuno() {
    const rackCont = document.getElementById('rack-desayuno-habitaciones');
    const statsCont = document.getElementById('desayuno-stats');
    if (!rackCont || !statsCont) return;

    const desayunos = desayunoService.getAll();
    const habsList = Utils.getHabitaciones();
    let totalPax = 0;
    let lastPlanta = -1;

    let html = '';
    habsList.forEach(h => {
        if (h.planta !== lastPlanta) {
            html += `<div class="w-100 mt-3 mb-2 d-flex align-items-center"><span class="badge bg-secondary me-2">Planta ${h.planta}</span><hr class="flex-grow-1 my-0 opacity-25"></div>`;
            lastPlanta = h.planta;
        }

        const data = desayunos[h.num];
        const hasData = !!data;
        const colorClass = hasData ? 'bg-success text-white' : 'bg-white text-muted border';

        if (hasData) totalPax += parseInt(data.pax);

        html += `
            <div class="d-flex align-items-center justify-content-center rounded rack-box room-card ${colorClass}" 
                 data-room-num="${h.num}"
                 data-bs-toggle="tooltip" data-bs-title="${hasData ? 'Pax: ' + data.pax + ' | Hora: ' + data.hora + (data.obs ? ' | Obs: ' + data.obs : '') : 'Sin pedido'}">
                ${h.num}
            </div>`;
    });
    
    rackCont.innerHTML = html;

    statsCont.innerHTML = `
        <div class="col-md-4">
            <div class="p-3 border rounded bg-success text-white text-center">
                <div class="small fw-bold opacity-75">TOTAL COMENSALES</div>
                <div class="h3 mb-0 fw-bold">${totalPax}</div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="p-3 border rounded bg-white text-center">
                <div class="small text-muted fw-bold">HABITACIONES</div>
                <div class="h3 mb-0 fw-bold text-dark">${Object.keys(desayunos).length}</div>
            </div>
        </div>`;
}

// === ACCIONES GLOBALES ===

window.eliminarDesayuno = async (hab) => {
    if (await Ui.showConfirm(`¿Eliminar el pedido de desayuno de la hab. ${hab}?`)) {
        desayunoService.removeByKey(hab);
        mostrarDesayunos();
    }
};

window.editarDesayuno = (hab) => {
    const data = desayunoService.getByKey(hab);
    if (!data) return;

    Utils.setVal('desayuno_hab', hab);
    Utils.setVal('desayuno_pax', data.pax);
    Utils.setVal('desayuno_hora', data.hora);
    Utils.setVal('desayuno_obs', data.obs || '');

    const btnSubmit = document.getElementById('btnSubmitDesayuno');
    if (btnSubmit) btnSubmit.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Actualizar Desayuno';
    
    // Change title to indicate edit mode
    const titleEl = document.querySelector('#formNuevoDesayuno h6');
    if (titleEl) titleEl.innerHTML = '<i class="bi bi-pencil me-2"></i>Editar Desayuno';

    // Set original ID to handle renaming/cleanup
    document.getElementById('formNuevoDesayuno').dataset.originalId = hab;

    document.getElementById('btnVistaTrabajoDesayuno').click();
    document.getElementById('desayuno_hab').focus();
};

window.irADesayuno = (hab) => {
    navegarA('#desayuno-content');
    document.getElementById('btnVistaTrabajoDesayuno').click();
    setTimeout(() => {
        const row = document.getElementById(`desayuno-row-${hab}`);
        if (row) {
            row.scrollIntoView({ behavior: "smooth", block: "center" });
            row.classList.add('table-warning');
            setTimeout(() => row.classList.remove('table-warning'), 2000);
        }
    }, 100);
};

window.limpiarDesayunos = async () => {
    if (await Ui.showConfirm("¿Deseas borrar TODOS los pedidos de desayuno?")) {
        desayunoService.clear();
        mostrarDesayunos();
    }
};

window.imprimirDesayunos = () => {
    // Check view context
    const isRack = document.getElementById('btnVistaRackDesayuno')?.classList.contains('active');
    
    if (window.PrintService) {
        if (isRack) {
            // Print Rack View (Tipo Foto)
            PrintService.printElementAsImage('rack-desayuno-habitaciones', `Rack de Desayunos - ${Utils.getTodayISO()}`);
        } else {
            // Print Work View
            PrintService.printElement('desayuno-trabajo', `Lista de Desayunos - ${Utils.getTodayISO()}`);
        }
    } else {
        const user = Utils.validateUser();
        if (!user) return;
        
        // Legacy Support with Context (basic toggle)
        if (isRack) {
             const work = document.getElementById('desayuno-trabajo');
             const rack = document.getElementById('rack-desayuno-habitaciones');
             if(work) work.classList.add('d-print-none');
             if(rack) rack.classList.remove('d-print-none');
             window.print();
             if(work) work.classList.remove('d-print-none');
             if(rack) rack.classList.add('d-print-none'); // Restore usually hidden state if needed
        } else {
             Utils.printSection('print-date-desayuno', 'print-repc-nombre-desayuno', user);
        }
    }
};

// Exponer globalmente para dashboard
window.mostrarDesayunos = mostrarDesayunos;
