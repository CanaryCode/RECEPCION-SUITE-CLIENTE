import { calendarioService } from '../services/CalendarioService.js';
import { Utils } from '../core/Utils.js';
import { Ui } from '../core/Ui.js';
import { CompLoader } from '../core/CompLoader.js';

/**
 * MÓDULO DE CALENDARIO (calendario.js)
 * -----------------------------------
 * Maneja la lógica de visualización y gestión de eventos.
 */

let fechaReferencia = new Date();
let vistaActual = 'mes'; // dia, semana, mes, anio, lista
let modalEvento = null;

export async function inicializarCalendario() {
    // 1. Cargar Template
    await CompLoader.loadComponent('calendario-content', 'assets/templates/calendario.html');

    // 2. Inicializar Referencias UI
    _setupEventListeners();

    // 3. Render Inicial
    actualizarVista();

    // 4. Actualizar widget del Dashboard
    actualizarDashboardCalendario();

    // 5. Escuchar Sincronización Real-Time
    window.addEventListener('service-synced', (e) => {
        if (e.detail.endpoint === 'calendario_eventos') {
            console.log("Detectado cambio en servidor para calendario, actualizando...");
            actualizarVista();
            actualizarDashboardCalendario();
        }
    });

    console.log("Módulo Calendario inicializado");
}

/**
 * HELPER DE FORMATEO ROBUSTO (YYYY-MM-DD)
 * Evita desfases de zona horaria al no usar toISOString() directamente.
 * Se define como function para que tenga hoisting y esté disponible en el render inicial.
 */
function fmt(date) {
    if (!date || isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}


function _setupEventListeners() {
    // Conmutador de Vistas
    const viewButtons = ['btnCalendarioDia', 'btnCalendarioSemana', 'btnCalendarioMes', 'btnCalendarioAnio', 'btnCalendarioLista'];
    viewButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.onclick = () => {
                viewButtons.forEach(bid => document.getElementById(bid).classList.remove('active'));
                btn.classList.add('active');
                vistaActual = btn.dataset.view;
                actualizarVista();
            };
        }
    });

    // Navegación
    document.getElementById('btnCalendarioPrev').onclick = () => navegar(-1);
    document.getElementById('btnCalendarioSig').onclick = () => navegar(1);
    document.getElementById('btnCalendarioHoy').onclick = () => {
        fechaReferencia = new Date();
        actualizarVista();
    };

    // Acciones
    document.getElementById('btnNuevoEvento').onclick = () => abrirModalEvento();
    document.getElementById('btnImprimirCalendario').onclick = () => window.print();

    // Formulario Evento
    const form = document.getElementById('formEvento');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            await guardarEvento();
        };
    }

    document.getElementById('btnEliminarEvento').onclick = async () => {
        const id = document.getElementById('evento_id').value;
        if (id && await Ui.showConfirm("¿Eliminar este evento?")) {
            await calendarioService.deleteEvento(id);
            bootstrap.Modal.getInstance(document.getElementById('modalEvento')).hide();
            actualizarVista();
            actualizarDashboardCalendario();
        }
    };
}

function navegar(direccion) {
    const d = new Date(fechaReferencia);
    if (vistaActual === 'dia') {
        d.setDate(d.getDate() + direccion);
    } else if (vistaActual === 'semana') {
        d.setDate(d.getDate() + (direccion * 7));
    } else if (vistaActual === 'mes' || vistaActual === 'lista') {
        d.setMonth(d.getMonth() + direccion);
    } else if (vistaActual === 'anio') {
        d.setFullYear(d.getFullYear() + direccion);
    }
    fechaReferencia = d;
    actualizarVista();
}

async function actualizarVista() {
    // Actualizar Título del Periodo
    const tituloEl = document.getElementById('calendario-titulo-periodo');
    if (tituloEl) {
        if (vistaActual === 'dia') {
            tituloEl.innerText = Utils.formatDate(fechaReferencia);
        } else if (vistaActual === 'semana') {
            const { start, end } = _getWeekRange(fechaReferencia);
            tituloEl.innerText = `${Utils.formatDate(start)} - ${Utils.formatDate(end)}`;
        } else if (vistaActual === 'mes' || vistaActual === 'lista') {
            tituloEl.innerText = fechaReferencia.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
        } else if (vistaActual === 'anio') {
            tituloEl.innerText = fechaReferencia.getFullYear();
        }
    }

    // Ocultar todas las vistas y mostrar la activa
    const views = ['view-dia', 'view-semana', 'view-mes', 'view-anio', 'view-lista'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('d-none');
    });
    
    const activeView = document.getElementById(`view-${vistaActual}`);
    if (activeView) activeView.classList.remove('d-none');

    // Renderizar según vista
    if (vistaActual === 'dia') renderDia();
    else if (vistaActual === 'semana') renderTripleSemanaAlmanaque();
    else if (vistaActual === 'mes') renderTripleAlmanaque();
    else if (vistaActual === 'anio') renderAnio();
    else if (vistaActual === 'lista') renderListadoPersonal();
}

async function renderDia(targetId = 'view-dia', fecha = fechaReferencia) {
    const container = document.getElementById(targetId);
    if (!container) return;

    const isoDate = fmt(fecha);
    const eventos = await calendarioService.getEventosDia(isoDate);
    eventos.sort((a, b) => a.hora.localeCompare(b.hora));

    let html = `<div class="p-3 bg-white border rounded shadow-sm">
        <h5 class="border-bottom pb-2 mb-3">Eventos del ${Utils.formatDate(fecha)}</h5>`;

    if (eventos.length === 0) {
        html += `<p class="text-muted text-center py-5 italic">No hay eventos para este día.</p>`;
    } else {
        html += `<div class="event-list">`;
        eventos.forEach(ev => {
            const isFestivo = ev.readonly === true;
            const isUrgent = ev.priority === 'Urgente';
            const clickAction = isFestivo ? '' : `onclick="window.editarEventoCalendario('${ev.id}')"`;
            const color = isFestivo ? '#999' : (ev.color || '#0d6efd');
            const style = `border-left: 4px solid ${color}; ${isFestivo ? 'cursor: default;' : 'cursor: pointer;'}`;
            
            html += `
                <div class="event-item d-flex align-items-center ${isUrgent ? 'is-urgent' : ''} ${isFestivo ? 'is-festivo' : ''}" ${clickAction} style="${style}">
                    <span class="event-time me-3 fw-bold" style="min-width: 50px;">${ev.hora}</span>
                    <span class="event-title flex-grow-1">${ev.titulo}</span>
                    <div class="small fw-bold ms-2 ${isUrgent ? 'text-danger' : 'text-muted'}">${isFestivo ? 'Festivo' : (ev.priority || 'Normal')}</div>
                </div>`;
        });
        html += `</div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
}

// Vista de Triple Semana (Pasada, Actual, Siguiente)
async function renderTripleSemanaAlmanaque() {
    const container = document.getElementById('triple-week-container');
    if (!container) return;
    container.innerHTML = '';

    const d = new Date(fechaReferencia);
    const weeks = [
        new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7),
        new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)
    ];

    const labels = ['SEMANA PASADA', 'ESTA SEMANA', 'SEMANA SIGUIENTE'];

    for (let i = 0; i < 3; i++) {
        const weekHtml = await _generateSemanaHtml(weeks[i], labels[i]);
        container.innerHTML += weekHtml;
    }
}

async function _generateSemanaHtml(refDate, label) {
    const { start, end } = _getWeekRange(refDate);
    const rangeStr = `${Utils.formatDate(start)} - ${Utils.formatDate(end)}`;
    const eventos = await calendarioService.getEventosRango(
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0]
    );

    let html = `
        <div class="week-almanac-section">
            <div class="week-almanac-title">${label} <small class="text-muted ms-2">${rangeStr}</small></div>
            <div class="week-almanac-grid">`;

    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const iso = d.toISOString().split('T')[0];
        const dayEvents = eventos.filter(e => e.fecha === iso);
        dayEvents.sort((a, b) => a.hora.localeCompare(b.hora));

        const isToday = iso === new Date().toISOString().split('T')[0];
        const hasPersonal = dayEvents.some(e => e.readonly !== true);
        const hasFestivo = dayEvents.some(e => e.readonly === true);
        
        let highlightClass = '';
        if (hasPersonal) highlightClass = 'has-events';
        else if (hasFestivo) highlightClass = 'has-festivo';
        if (isToday) highlightClass = 'border-primary shadow-sm';

        html += `
            <div class="week-day-card ${highlightClass}" onclick="window.cambiarFechayDia('${iso}')">
                <div class="week-day-header">
                    <span class="week-day-name">${_getDiaSemana(iso)}</span>
                    <span class="week-day-number">${d.getDate()}</span>
                </div>
                <div class="week-day-body">`;
        
        dayEvents.slice(0, 4).forEach(ev => {
            const isU = ev.priority === 'Urgente' || ev.categoria === 'Urgente';
            const isF = ev.categoria === 'festivo';
            const color = isF ? '#ccc' : (ev.color || '#0d6efd');
            html += `
                <div class="event-item text-truncate ${isU ? 'is-urgent' : ''} ${isF ? 'is-festivo' : ''}" 
                     style="border-left: 3px solid ${color}; font-size: 0.65rem; padding: 1px 4px; margin-bottom: 2px;">
                    <span class="fw-bold">${ev.hora}</span> ${ev.titulo}
                </div>`;
        });

        if (dayEvents.length > 4) {
            html += `<div class="text-center text-muted" style="font-size: 0.6rem;">+${dayEvents.length - 4}</div>`;
        }
        
        html += `</div></div>`;
    }
    html += `</div></div>`;
    return html;
}

// Vista de Triple Almanaque (Mes Anterior, Actual, Siguiente)
async function renderTripleAlmanaque() {
    const container = document.getElementById('triple-almanac-container');
    if (!container) return;
    container.innerHTML = '';

    const d = new Date(fechaReferencia);
    const months = [
        new Date(d.getFullYear(), d.getMonth() - 1, 1),
        new Date(d.getFullYear(), d.getMonth(), 1),
        new Date(d.getFullYear(), d.getMonth() + 1, 1)
    ];

    for (const mDate of months) {
        const monthHtml = await _generateAlmanaqueHtml(mDate);
        container.innerHTML += monthHtml;
    }
}

async function _generateAlmanaqueHtml(refDate) {
    const monthName = refDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
    
    let html = `
        <div class="almanac-month-section">
            <div class="almanac-month-title">${monthName}</div>
            <div class="almanac-grid">`;
    
    // Header días
    ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach(d => {
        html += `<div class="almanac-header-day fw-bold text-muted" style="font-size: 0.7rem;">${d}</div>`;
    });

    const startOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const endOfMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
    
    const startDay = startOfMonth.getDay();
    const diff = startDay === 0 ? 6 : startDay - 1;
    const startGrid = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), startOfMonth.getDate() - diff);

    const eventosRango = await calendarioService.getEventosRango(fmt(startGrid), fmt(new Date(startGrid.getFullYear(), startGrid.getMonth(), startGrid.getDate() + 41)));

    for (let i = 0; i < 42; i++) {
        const d = new Date(startGrid);
        d.setDate(d.getDate() + i);
        const iso = fmt(d);
        const monthEvents = eventosRango.filter(e => e.fecha === iso);
        const hasPersonalEvents = monthEvents.some(e => e.readonly !== true);
        const hasFestivos = monthEvents.some(e => e.readonly === true);

        const isToday = iso === fmt(new Date());
        const isOtherMonth = d.getMonth() !== refDate.getMonth();
        
        let highlightClass = '';
        if (hasPersonalEvents) highlightClass = 'has-events';
        else if (hasFestivos) highlightClass = 'has-festivo';
        if (isToday) highlightClass = 'today';

        let dayHtml = `
            <div class="almanac-day ${isOtherMonth ? 'other-month' : ''} ${highlightClass}" onclick="window.cambiarFechayDia('${iso}')">
                <div class="almanac-day-number">${d.getDate()}</div>
                <div class="event-micro-list">`;
        
        monthEvents.slice(0, 3).forEach(ev => {
            const isFe = ev.readonly === true;
            const color = isFe ? '#ccc' : (ev.color || '#0d6efd');
            dayHtml += `<div class="event-item text-truncate ${isFe ? 'is-festivo' : ''} ${ev.priority === 'Urgente' ? 'is-urgent' : ''}" 
                             style="border-left-color: ${color}; font-size: 0.6rem; padding: 0px 4px; margin-bottom:1px; line-height:1.2;">
                             ${ev.titulo}
                        </div>`;
        });
        
        if (monthEvents.length > 3) {
            dayHtml += `<div class="small text-muted text-center" style="font-size: 0.55rem;">+${monthEvents.length - 3}</div>`;
        }

        dayHtml += `</div></div>`;
        html += dayHtml;
    }
    
    html += `</div></div>`;
    return html;
}

// Vista de Semana tipo Almanaque (7 días en rejilla)
async function renderSemanaGrid() {
    const container = document.getElementById('week-almanac-grid');
    if (!container) return;
    container.innerHTML = '';

    const { start, end } = _getWeekRange(fechaReferencia);
    const eventos = await calendarioService.getEventosRango(
        fmt(start),
        fmt(end)
    );

    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const iso = d.toISOString().split('T')[0];
        const dayEvents = eventos.filter(e => e.fecha === iso);
        dayEvents.sort((a, b) => a.hora.localeCompare(b.hora));

        const isToday = iso === new Date().toISOString().split('T')[0];
        const hasPersonal = dayEvents.some(e => e.readonly !== true);
        
        let htmlElement = `
            <div class="week-day-card ${hasPersonal ? 'has-events' : ''} ${isToday ? 'border-primary' : ''}" onclick="window.cambiarFechayDia('${iso}')">
                <div class="week-day-header">
                    <span class="week-day-name">${_getDiaSemana(iso)}</span>
                    <span class="week-day-number">${d.getDate()}</span>
                </div>
                <div class="week-day-body">`;
        
        dayEvents.slice(0, 4).forEach(ev => {
            const isU = ev.priority === 'Urgente';
            const isF = ev.readonly === true;
            const color = isF ? '#ccc' : (ev.color || '#0d6efd');
            htmlElement += `
                <div class="event-item text-truncate ${isU ? 'is-urgent' : ''} ${isF ? 'is-festivo' : ''}" 
                     style="border-left: 3px solid ${color}; font-size: 0.65rem; padding: 1px 4px; margin-bottom: 2px;">
                    <span class="fw-bold">${ev.hora}</span> ${ev.titulo}
                </div>`;
        });

        if (dayEvents.length > 4) {
            htmlElement += `<div class="text-center text-muted" style="font-size: 0.6rem;">+${dayEvents.length - 4}</div>`;
        }
        
        htmlElement += `</div></div>`;
        container.innerHTML += htmlElement;
    }
}

async function renderAnio() {
    const container = document.getElementById('year-almanac-grid');
    if (!container) return;
    container.innerHTML = '';

    const year = fechaReferencia.getFullYear();
    
    for (let m = 0; m < 12; m++) {
        const monthDate = new Date(year, m, 1);
        const monthName = monthDate.toLocaleString('es-ES', { month: 'long' }).toUpperCase();
        
        let monthHtml = `
            <div class="month-mini-card shadow-sm" style="cursor: pointer;" onclick="window.irAMes(${m}, ${year})">
                <h6 class="text-primary fw-bold text-center mb-2" style="font-size: 0.8rem;">${monthName}</h6>
                <div class="month-mini-grid">`;
        
        // Header mini
        ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach(d => monthHtml += `<div class="fw-bold text-muted" style="font-size:0.5rem">${d}</div>`);
        
        const first = new Date(year, m, 1);
        const last = new Date(year, m + 1, 0);
        const startDay = first.getDay();
        const diff = startDay === 0 ? 6 : startDay - 1;
        
        for (let i = 0; i < diff; i++) monthHtml += `<div></div>`;
        
        for (let d = 1; d <= last.getDate(); d++) {
        const currentIso = fmt(new Date(year, m, d));
        const isToday = currentIso === fmt(new Date());
            monthHtml += `<div class="${isToday ? 'bg-primary text-white rounded-circle' : ''}" style="font-size:0.6rem; padding: 1px;">${d}</div>`;
        }
        
        monthHtml += `</div></div>`;
        container.innerHTML += monthHtml;
    }
}

async function renderListadoPersonal() {
    const container = document.getElementById('listado-eventos-container');
    if (!container) return;
    
    // Obtener TODOS los eventos del servicio
    const allEvents = await calendarioService.getAll();

    // Filtrar solo eventos personales (no festivos)
    const personal = allEvents.filter(ev => ev.readonly !== true);
    // Ordenar por fecha y hora (más recientes o próximos?)
    // Lo ideal es cronológico para una agenda
    personal.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));

    let html = `
        <div class="listado-header d-flex justify-content-between align-items-center mb-4 p-2 bg-light rounded border">
            <h4 class="fw-bold m-0 text-primary"><i class="bi bi-list-check me-2"></i>Mi Agenda Personal</h4>
            <span class="badge bg-primary rounded-pill px-3">${personal.length} eventos en total</span>
        </div>`;

    if (personal.length === 0) {
        html += `
            <div class="text-center py-5 bg-white rounded shadow-sm border">
                <div class="display-4 text-muted mb-3"><i class="bi bi-calendar-x"></i></div>
                <p class="text-muted">No tienes eventos personales creados para este mes.</p>
                <button class="btn btn-primary" onclick="abrirModalEvento()">Añadir primer evento</button>
            </div>`;
    } else {
        personal.forEach(ev => {
            // Manegar fecha de forma segura para evitar Invalid Date
            let dateStr = ev.fecha;
            if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
            const date = new Date(dateStr + 'T00:00:00');
            
            const dayNum = isNaN(date.getDate()) ? '??' : date.getDate();
            const monthShort = isNaN(date.getTime()) ? 'INV' : date.toLocaleString('es-ES', { month: 'short' }).toUpperCase();
            const isUrgent = ev.priority === 'Urgente';
            
            html += `
                <div class="listado-item shadow-sm border-start" style="border-left: 5px solid ${ev.color || '#0d6efd'}" onclick="window.editarEventoCalendario('${ev.id}')">
                    <div class="listado-date-circle" style="background: ${ev.color || '#0d6efd'}">
                        <span class="listado-date-day">${dayNum}</span>
                        <span class="listado-date-month">${monthShort}</span>
                    </div>
                    <div class="listado-info">
                        <div class="listado-title">${ev.titulo}</div>
                        <div class="listado-meta">
                            <i class="bi bi-clock me-1"></i> ${ev.hora} 
                            <span class="mx-2">•</span>
                            <span class="${isUrgent ? 'text-danger fw-bold' : ''}">${ev.priority || 'Normal'}</span>
                        </div>
                        ${ev.descripcion ? `<div class="text-muted small mt-1 text-truncate" style="max-width: 500px;">${ev.descripcion}</div>` : ''}
                    </div>
                    <div class="listado-actions">
                         <i class="bi bi-chevron-right text-muted"></i>
                    </div>
                </div>`;
        });
    }
    container.innerHTML = html;
}

/**
 * Navega a un mes específico desde la vista de año
 */
function irAMes(m, y) {
    fechaReferencia = new Date(y, m, 1);
    vistaActual = 'mes';
    _syncViewButtons('btnCalendarioMes');
    actualizarVista();
}

/**
 * Navega a un día específico y cambia a vista día
 */
function cambiarFechayDia(iso) {
    fechaReferencia = new Date(iso);
    vistaActual = 'dia';
    _syncViewButtons('btnCalendarioDia');
    actualizarVista();
}

/**
 * Helper para sincronizar visualmente los botones de vista
 */
function _syncViewButtons(activeId) {
    const viewButtons = ['btnCalendarioDia', 'btnCalendarioSemana', 'btnCalendarioMes', 'btnCalendarioAnio', 'btnCalendarioLista'];
    viewButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeId);
    if (activeBtn) activeBtn.classList.add('active');
}

async function abrirModalEvento(eventoId = null) {
    const modalEl = document.getElementById('modalEvento');
    if (!modalEl) return;
    
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    const form = document.getElementById('formEvento');
    form.reset();
    
    document.getElementById('evento_id').value = '';
    document.getElementById('btnEliminarEvento').classList.add('d-none');
    document.getElementById('modalEventoLabel').innerText = 'Nuevo Evento';
    document.getElementById('evento_color').value = '#0d6efd';
    document.getElementById('evento_prioridad').value = 'Normal';

    if (eventoId) {
        if (typeof eventoId === 'string' && eventoId.startsWith('festivo_')) {
            Ui.showToast("Los festivos oficiales no se pueden editar", "info");
            return;
        }

        const ev = await calendarioService.getById(eventoId);
        if (ev) {
            document.getElementById('evento_id').value = ev.id;
            document.getElementById('evento_titulo').value = ev.titulo;
            document.getElementById('evento_fecha').value = ev.fecha;
            document.getElementById('evento_hora').value = ev.hora;
            document.getElementById('evento_prioridad').value = ev.priority || 'Normal';
            document.getElementById('evento_color').value = ev.color || '#0d6efd';
            document.getElementById('evento_descripcion').value = ev.descripcion || '';
            
            document.getElementById('btnEliminarEvento').classList.remove('d-none');
            document.getElementById('modalEventoLabel').innerText = 'Editar Evento';
        }
    } else {
        document.getElementById('evento_fecha').value = fechaReferencia.toISOString().split('T')[0];
        document.getElementById('evento_hora').value = new Date().toTimeString().substring(0, 5);
    }

    modal.show();
}

async function guardarEvento() {
    const rawId = document.getElementById('evento_id').value;
    const data = {
        id: rawId ? Number(rawId) : null,
        titulo: document.getElementById('evento_titulo').value.trim(),
        fecha: document.getElementById('evento_fecha').value,
        hora: document.getElementById('evento_hora').value,
        priority: document.getElementById('evento_prioridad').value,
        color: document.getElementById('evento_color').value,
        descripcion: document.getElementById('evento_descripcion').value.trim()
    };

    if (!data.titulo || !data.fecha || !data.hora) {
        Ui.showToast("Rellene los campos obligatorios", "warning");
        return;
    }

    await calendarioService.saveEvento(data);
    Ui.showToast("Evento guardado correctamente");

    bootstrap.Modal.getInstance(document.getElementById('modalEvento')).hide();
    actualizarVista();
    actualizarDashboardCalendario();
}

/**
 * Función global para editar evento desde los listados
 */
window.editarEventoCalendario = (id) => {
    abrirModalEvento(id);
};

// --- HELPERS DE FECHAS ---

function _getWeekRange(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Lunes inicio
    const start = new Date(date.getFullYear(), date.getMonth(), diff);
    const end = new Date(date.getFullYear(), date.getMonth(), diff + 6);
    return { start, end };
}

function _getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function _getDiaSemana(fechaStr) {
    const d = new Date(fechaStr + 'T00:00:00'); // Forzar hora local
    return d.toLocaleString('es-ES', { weekday: 'short' }).toUpperCase();
}

/**
 * Actualiza el widget de Calendario en el Dashboard principal ("Resumen del Día")
 * Cuando el módulo de calendario está cargado, llama a la función global de actualización
 */
async function actualizarDashboardCalendario() {
    // Llamar a la función global de actualización si existe
    if (typeof window.actualizarWidgetCalendario === 'function') {
        await window.actualizarWidgetCalendario();
    }
}

window.abrirModalEvento = abrirModalEvento;
window.guardarEvento = guardarEvento;
window.editarEventoCalendario = editarEventoCalendario;
window.irAMes = irAMes;
window.cambiarFechayDia = cambiarFechayDia;
window.actualizarDashboardCalendario = actualizarDashboardCalendario;
