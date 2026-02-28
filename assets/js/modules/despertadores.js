import { APP_CONFIG } from "../core/Config.js?v=V153_DB_CONFIG";
import { Utils } from '../core/Utils.js';
import { despertadorService } from '../services/DespertadorService.js';
import { sessionService } from '../services/SessionService.js';
import { systemAlarmsService } from '../services/SystemAlarmsService.js';
import { Ui } from '../core/Ui.js';
import { RackView } from '../core/RackView.js';

/**
 * MÓDULO DE DESPERTADORES Y ALARMAS (despertadores.js)
 * ---------------------------------------------------
 * Gestiona las llamadas de despertador solicitadas por los clientes.
 * Incluye un sistema de verificación en tiempo real (cada 15s) que lanza 
 * un modal visual y una alarma sonora cuando llega la hora.
 */

let checkInterval = null;            // Intervalo de comprobación (15s)
let ultimoMinutoProcesado = "";      // Anti-repetición para no alarmar varias veces el mismo minuto
const alarmaAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
alarmaAudio.loop = true;             // Sonará en bucle hasta que se cierre el modal

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

/**
 * INICIALIZACIÓN
 * Configura el formulario, inyecta el modal de alarma y activa el verificador.
 */
export async function inicializarDespertadores() {
    await despertadorService.init();

    // 1. CONFIGURAR VISTAS (Conmutador)
    Ui.setupViewToggle({
        buttons: [
            { id: 'btnVistaTrabajoDesp', viewId: 'despertadores-trabajo', onShow: mostrarDespertadores },
            { id: 'btnVistaRackDesp', viewId: 'despertadores-rack', onShow: renderVistaRackDespertadores }
        ]
    });

    // 2. AUTOCOMPLETE DE HABITACIONES
    Ui.initRoomAutocomplete('lista-habs-desp');
    Ui.attachRoomValidator('desp_hab', { allowEmpty: false });

    // 3. GESTIÓN DE FORMULARIO (Asistente)
    Ui.handleFormSubmission({
        formId: 'formNuevoDespertador',
        service: despertadorService,
        idField: 'desp_hab',
        serviceIdField: 'habitacion', // Crucial para que BaseService encuentre el registro y actualice
        mapData: (rawData) => ({
            habitacion: rawData.desp_hab.toString().trim().padStart(3, '0'),
            hora: rawData.desp_hora,
            comentario: rawData.desp_comentario
        }),
        onSuccess: () => {
            const btnSubmit = document.getElementById('btnSubmitDespertador');
            if (btnSubmit) btnSubmit.innerHTML = '<i class="bi bi-alarm-fill me-2"></i>Programar';
            mostrarDespertadores();
        }
    });

    if (!document.getElementById('modalAlarmaDespertador')) {
        crearModalAlarma();
    }

    // Estilo estándar
    document.getElementById('despertadores-trabajo')?.classList.add('content-panel');
    document.getElementById('despertadores-rack')?.classList.add('content-panel');

    mostrarDespertadores();

    // Suscribirse a cambios del servicio para actualizar dashboard en tiempo real
    window.addEventListener('service-synced', (e) => {
        if (e.detail.endpoint === 'riu_despertadores') {
            mostrarDespertadores();
        }
    });

    /**
     * "DESBLOQUEO" DE AUDIO
     */
    document.addEventListener('click', () => {
        alarmaAudio.play().then(() => {
            alarmaAudio.pause();
            alarmaAudio.currentTime = 0;
        }).catch(e => { });
    }, { once: true });

    if (!checkInterval) {
        checkInterval = setInterval(verificarAlarmas, 15000);
    }
}

function crearModalAlarma() {
    const div = document.createElement('div');
    div.innerHTML = `
        <div class="modal fade" id="modalAlarmaDespertador" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" style="z-index: 10000;">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-danger shadow-lg">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title fw-bold"><i class="bi bi-alarm-fill me-2"></i>¡ALARMA DE DESPERTADOR!</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body text-center p-4">
                        <div class="display-1 text-danger mb-3"><i class="bi bi-bell-fill"></i></div>
                        <h2 class="fw-bold mb-3" id="alarma-hora-display">--:--</h2>
                        <div class="text-start bg-light p-3 rounded border" id="alarma-lista-display" style="max-height: 300px; overflow-y: auto;"></div>
                    </div>
                    <div class="modal-footer justify-content-center">
                        <button type="button" class="btn btn-secondary btn-lg fw-bold px-5" data-bs-dismiss="modal">CERRAR</button>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(div);
    document.getElementById('modalAlarmaDespertador').addEventListener('hidden.bs.modal', () => {
        alarmaAudio.pause();
        alarmaAudio.currentTime = 0;
    });
}

/**
 * Función global para facilitar el cambio programático
 */
window.cambiarVistaDespertadores = (vista) => {
    const btn = vista === 'trabajo' ? 'btnVistaTrabajoDesp' : 'btnVistaRackDesp';
    document.getElementById(btn)?.click();
};

// ============================================================================
// RENDERIZADO
// ============================================================================

function mostrarDespertadores() {
    actualizarEstadoCampana(new Date());
    const despertadores = despertadorService.getDespertadores();
    const sorted = [...despertadores].sort((a, b) => a.hora.localeCompare(b.hora));

    // Actualizar Dashboard (si existe)
    // USAR ABSTRACCIÓN DASHBOARD
    Ui.updateDashboardWidget('despertadores', sorted, (d) => `
        <tr onclick="irADespertador('${d.habitacion}')" style="cursor: pointer;">
            <td class="fw-bold">${d.habitacion}</td>
            <td class="text-end"><span class="badge bg-warning text-dark">${d.hora}</span></td>
        </tr>
    `);

    // Tabla Principal usando Ui.renderTable
    renderTablaDespertadores(sorted);

    // Initial Sort Enablement
    Ui.enableTableSorting('table-despertadores', sorted, (sortedData) => {
        renderTablaDespertadores(sortedData);
    });
}

function renderTablaDespertadores(lista) {
    Ui.renderTable('tablaDespertadoresActivos', lista, (data) => `
        <tr id="desp-row-${data.habitacion}">
            <td class="fw-bold text-primary">${data.habitacion}</td>
            <td><span class="badge bg-warning text-dark fs-6"><i class="bi bi-clock me-1"></i>${data.hora}</span></td>
            <td class="text-muted small">
                ${data.comentario || '-'}
                <div class="text-info mt-1" style="font-size: 0.65rem;">
                    <i class="bi bi-person-fill me-1"></i>${data.autor || 'N/A'}
                </div>
            </td>
            <td class="text-end">
                <button onclick="prepararEdicionDespertador('${data.habitacion}')" class="btn btn-sm btn-outline-primary border-0 me-1"
                        data-bs-toggle="tooltip" data-bs-title="Editar">
                    <i class="bi bi-pencil"></i>
                </button>
                <button onclick="eliminarDespertador('${data.habitacion}')" class="btn btn-sm btn-outline-success border-0"
                        data-bs-toggle="tooltip" data-bs-title="Marcar como hecho">
                    <i class="bi bi-check-circle-fill"></i>
                </button>
            </td>
        </tr>`, 
        'No hay despertadores programados.'
    );

    if (window.checkDailySummaryVisibility) window.checkDailySummaryVisibility();
}

function renderVistaRackDespertadores() {
    const statsCont = document.getElementById('desp-stats');
    
    const despertadores = despertadorService.getDespertadores();
    // Mapa para búsqueda O(1)
    const despMap = new Map();
    despertadores.forEach(d => despMap.set(d.habitacion, d));

    // USAR RACKVIEW ABSTRACTION
    RackView.render('rack-desp-habitaciones', (num) => {
        const data = despMap.get(num);
        const colorClass = data ? 'bg-warning text-dark' : 'bg-white text-muted border';

        return `
        <div class="d-flex align-items-center justify-content-center rounded rack-box ${colorClass}" 
             style="cursor: pointer;"
             onclick="window.RoomDetailModal ? window.RoomDetailModal.open('${num}') : console.error('No Modal')"
             data-bs-toggle="tooltip" data-bs-title="${data ? 'Despertador: ' + data.hora + (data.comentario ? ' - ' + data.comentario : '') : 'Sin programar'}">
            ${num}
        </div>`;
    });

    if (statsCont) {
        statsCont.innerHTML = `
        <div class="col-md-4">
            <div class="p-3 border rounded bg-warning text-dark text-center">
                <div class="small fw-bold opacity-75">LLAMADAS PENDIENTES</div>
                <div class="h3 mb-0 fw-bold">${despertadores.length}</div>
            </div>
        </div>`;
    }
}

/**
 * VERIFICADOR DE ALARMAS
 * Se ejecuta en segundo plano cada 15 segundos para comprobar si hay despertadores
 * cuya hora coincida con el minuto actual.
 */
function verificarAlarmas() {
    try {
        const ahora = new Date();
        const horaActual = `${ahora.getHours().toString().padStart(2, '0')}:${ahora.getMinutes().toString().padStart(2, '0')}`;

        if (horaActual === ultimoMinutoProcesado) return;
        
        const despertadores = despertadorService.getDespertadores();
        const alertas = [];

        despertadores.forEach(d => {
            if (d.hora === horaActual) {
                alertas.push({
                    type: 'room',
                    id: d.habitacion,
                    text: `Habitación ${d.habitacion}`,
                    subtext: d.comentario || ''
                });
            }
        });

        if (alertas.length > 0) {
            ultimoMinutoProcesado = horaActual;
            lanzarAlarma(alertas, horaActual, true); // Play sound = true
        }
    } catch (error) {
        console.error("Error en el verificador:", error);
    }
}

function lanzarAlarma(lista, hora, playSound = false) {
    alarmaAudio.currentTime = 0;
    if (playSound) {
        alarmaAudio.play().catch(err => console.error("Error audio:", err));
    }

    const modalEl = document.getElementById('modalAlarmaDespertador');
    if (modalEl && typeof bootstrap !== 'undefined') {
        document.getElementById('alarma-hora-display').innerText = hora;
        
        const container = document.getElementById('alarma-lista-display');
        container.innerHTML = lista.map(item => `
            <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom border-secondary border-opacity-25" id="alarm-item-${item.id}">
                <div class="text-start">
                    <div class="fw-bold fs-5">${item.text}</div>
                    ${item.subtext ? `<div class="small text-muted">${item.subtext}</div>` : ''}
                    <div class="small fw-bold text-primary">${item.horaStr || ''}</div> 
                </div>
                <div>
                    ${item.type === 'room' ? `
                    <button class="btn btn-sm btn-outline-danger me-1" onclick="borrarAlarmaDesdeModal('${item.id}')" title="Borrar Definitivamente">
                        <i class="bi bi-trash"></i>
                    </button>
                    ` : ''}
                    <button class="btn btn-success" onclick="atenderAlarma('${item.id}')" title="Marcar como atendida (Solo hoy)">
                        <i class="bi bi-check-lg"></i>
                    </button>
                </div>
            </div>
        `).join('');

        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    } else {
        // Fallback robusto: Solo mostrar alert si NO hay uno reciente
        const now = Date.now();
        if (!window._lastAlarmAlert || (now - window._lastAlarmAlert > 60000)) { // 1 min cooldown
            window._lastAlarmAlert = now;
            setTimeout(() => {
                const textos = lista.map(i => i.text + (i.subtext ? ` (${i.subtext})` : ''));
                alert("⏰ Alarmas Pendientes (Bootstrap Modal Falló):\n\n" + textos.join('\n'));
            }, 100);
        } else {
            console.warn("Alarma silenciada por cooldown (Modal falló).");
        }
    }
}

function abrirVisorAlarmasManual() {
    const ahora = new Date();
    const ahoraMins = (ahora.getHours() * 60) + ahora.getMinutes();
    const despertadores = despertadorService.getDespertadores();
    
    // Buscar PENDIENTES (Futuras hoy)
    const pendientes = [];
    
    despertadores.forEach(d => {
        const parts = d.hora.split(':');
        const dMins = (parseInt(parts[0]) * 60) + parseInt(parts[1]);
        if (dMins > ahoraMins) {
            pendientes.push({
               type: 'room',
               id: d.habitacion,
               text: `Habitación ${d.habitacion}`,
               subtext: d.comentario || '',
               horaStr: d.hora
            });
        }
    });

    pendientes.sort((a, b) => a.horaStr.localeCompare(b.horaStr));

    // SYSTEM ALARMS REMOVED (Separation of concerns)

    if (pendientes.length > 0) {
        lanzarAlarma(pendientes, "PENDIENTES HOY", false); // No sound
    } else {
        // Si no hay pendientes, ir al módulo completo para ver todo o crear nuevas
        if (window.navegarA) window.navegarA('#despertadores-content');
        cambiarVistaDespertadores('trabajo');
        mostrarDespertadores();
    }
}

window.atenderAlarma = async (id) => {
    const el = document.getElementById(`alarm-item-${id}`);
    if (el) {
        el.classList.add('opacity-25', 'text-decoration-line-through');
        const btns = el.querySelectorAll('button');
        btns.forEach(b => b.disabled = true);
        
        // ELIMINAR EL REGISTRO REAL (Ya se atendió)
        await despertadorService.removeDespertador(id);
        mostrarDespertadores(); // Actualizar tabla de fondo

        // Comprobar si quedan pendientes visualmente
        const container = document.getElementById('alarma-lista-display');
        const pendientes = container.querySelectorAll('div[id^="alarm-item-"]:not(.opacity-25)');
        if (pendientes.length === 0) {
            // Si no quedan, podemos cerrar el modal tras un breve delay o dejar que el recepcionista lo haga
             setTimeout(() => {
                 const modalEl = document.getElementById('modalAlarmaDespertador');
                 const modal = bootstrap.Modal.getInstance(modalEl);
                 if (modal) modal.hide();
             }, 1000);
        }
    }
};

window.borrarAlarmaDesdeModal = async (hab) => {
    if (await window.showConfirm("¿Eliminar esta alarma permanentemente? Ya no sonará mañana.")) {
        await despertadorService.removeDespertador(hab);
        atenderAlarma(hab); // Visualmente marcar como hecho
        mostrarDespertadores(); // Actualizar tabla de fondo
    }
};

// ============================================================================
// ACCIONES GLOBALES
// ============================================================================

function imprimirDespertadores() {
    if (window.PrintService) {
        const isRackActive = !document.getElementById('despertadores-rack').classList.contains('d-none');
        
        if (isRackActive) {
            // Imprimir Vista de Rack (Tipo Foto)
            window.PrintService.printElementAsImage('despertadores-rack', 'Rack de Despertadores');
        } else {
            // Imprimir Vista de Trabajo (Lista + Header)
            // Usamos el contenedor padre para incluir el header de impresión del template
            window.PrintService.printElement('despertadores-content', 'Reporte de Despertadores');
        }
    } else {
        window.print();
    }
}

window.irADespertador = (hab) => {
    // Defer navigation to allow bubbling to close dropdowns
    setTimeout(() => {
        navegarA('#despertadores-content');
        cambiarVistaDespertadores('trabajo');
        setTimeout(() => {
            const row = document.getElementById(`desp-row-${hab}`);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.classList.add('table-warning');
                setTimeout(() => row.classList.remove('table-warning'), 2000);
            }
        }, 100);
    }, 10);
};

window.prepararEdicionDespertador = (hab) => {
    const data = despertadorService.getByHab(hab);
    if (data) {
        Utils.setVal('desp_hab', hab);
        Utils.setVal('desp_hora', data.hora);
        Utils.setVal('desp_comentario', data.comentario || '');

        const btnSubmit = document.getElementById('btnSubmitDespertador');
        if (btnSubmit) btnSubmit.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Actualizar Despertador';

        cambiarVistaDespertadores('trabajo');
        
        // Scroll y Focus mejorado con Highlight
        const formCard = document.querySelector('#despertadores-trabajo .card');
        if (formCard) {
            formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            formCard.classList.add('border-primary', 'border-2');
            setTimeout(() => formCard.classList.remove('border-primary', 'border-2'), 2000);
        }

        // Set original ID for renaming support (Rename = Delete Old + Create New)
        document.getElementById('formNuevoDespertador').dataset.originalId = hab;

        document.getElementById('desp_hora')?.focus();
    }
};

window.eliminarDespertador = async (hab) => {
    if (await Ui.showConfirm(`¿Eliminar la alarma de la habitación ${hab}?`)) {
        await despertadorService.removeDespertador(hab);
        mostrarDespertadores();
    }
};

window.limpiarDespertadoresPasados = async () => {
    if (await Ui.showConfirm("¿Deseas limpiar todos los despertadores programados?")) {
        await despertadorService.clear();
        mostrarDespertadores();
    }
};

window.cambiarVistaDespertadores = cambiarVistaDespertadores;
window.imprimirDespertadores = imprimirDespertadores;
window.limpiarDespertadoresPasados = limpiarDespertadoresPasados;

function actualizarEstadoCampana(nowDate) {
    // FUNCIÓN DESHABILITADA: La campana ahora es exclusiva para Alarmas de Sistema.
}
