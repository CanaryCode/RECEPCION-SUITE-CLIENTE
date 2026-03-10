/**
 * MÓDULO DE INTERFAZ DE ALARMAS (system_alarms_ui.js)
 * --------------------------------------------------
 * Gestiona el formulario y la lista visual de alarmas recurrentes.
 * Permite configurar avisos diarios, por fecha específica o por días de la semana,
 * actuando como puente entre el usuario y el servicio de alarmas del sistema.
 */

import { systemAlarmsService } from '../services/SystemAlarmsService.js';
import { Utils } from '../core/Utils.js';
import { Ui } from '../core/Ui.js';
import { sessionService } from '../services/SessionService.js';
export function inicializarSystemAlarmsUI() {
    // 1. GESTIÓN DE FORMULARIO (Ui.handleFormSubmission)
    Ui.handleFormSubmission({
        formId: 'formSystemAlarm',
        service: systemAlarmsService,
        idField: 'sys_alarm_id',
        serviceIdField: 'id', // Mapping correcto para BaseService
        mapData: (rawData) => {
            const type = rawData.sys_alarm_type;
            const newId = rawData.sys_alarm_id || `sys_${Date.now()}`;
            let alarmData = {
                id: newId,
                hora: rawData.sys_alarm_hora,
                mensaje: rawData.sys_alarm_msg,
                titulo: rawData.sys_alarm_msg, // Required by Service Schema
                active: rawData.sys_alarm_active === 'on' || rawData.sys_alarm_active === true,
                type: type,
                date: null,
                days: null,
                day: null,
                usuario: null
            };

            if (type === 'date') {
                alarmData.date = rawData.sys_alarm_date;
            } else if (type === 'weekly') {
                const days = [];
                [0,1,2,3,4,5,6].forEach(d => {
                    const ck = document.getElementById(`day-${d}`);
                    if(ck && ck.checked) days.push(d);
                });
                alarmData.days = days;
            } else if (type === 'monthly') {
                alarmData.day = parseInt(rawData.sys_alarm_day);
            } else {
                alarmData.dias = 'todos'; // Legacy compatibility
            }
            
            // Handle Scope (Personal vs General)
            const scope = rawData.sys_alarm_scope;
            alarmData.usuario = (scope === 'personal') ? sessionService.getUser() : null;
            alarmData.autor = sessionService.getUser();
            
            console.log("[UI] Mapped Alarm Data:", alarmData);
            return alarmData;
        },
        onSuccess: () => {
            resetForm();
            renderAlarmsList();
        }
    });
    
    // Configurar inputs visibilidad
    window.togglePeriodicidadInputs = togglePeriodicidadInputs;
    togglePeriodicidadInputs(); // Init state

    // 1. CONFIGURAR VISTAS (Conmutador)
    Ui.setupViewToggle({
        buttons: [
            { id: 'btnVistaTrabajoAlarms', viewId: 'formSystemAlarm-col', onShow: () => {
                const listCol = document.getElementById('systemAlarms-list-col');
                if(listCol) { listCol.classList.remove('col-12'); listCol.classList.add('col-md-7'); }
            }},
            { id: 'btnVistaListaAlarms', onShow: () => {
                const listCol = document.getElementById('systemAlarms-list-col');
                if(listCol) { listCol.classList.remove('col-md-7'); listCol.classList.add('col-12'); }
                document.getElementById('formSystemAlarm-col')?.classList.add('d-none');
            }}
        ]
    });

    renderAlarmsList();
    
    // Helpers Globales
    window.editSystemAlarm = editSystemAlarm;
    window.deleteSystemAlarm = deleteSystemAlarm;
    window.toggleActiveSystemAlarm = toggleActiveSystemAlarm;
    window.resetFormSystemAlarm = resetForm;
    window.renderSystemAlarms = renderAlarmsList; // EXPOSED FOR SNOOZE UPDATES

    // 4. AUTO-REFRESH (Service Synced)
    window.addEventListener('service-synced', (e) => {
        if (e.detail && e.detail.endpoint === 'riu_system_alarms') {
            console.log("[UI] Alarms synced from background. Refreshing list...");
            renderAlarmsList();
        }
    });
}

/**
 * Función global para facilitar el cambio programático
 */
window.toggleViewAlarms = (vista) => {
    const btn = vista === 'trabajo' ? 'btnVistaTrabajoAlarms' : 'btnVistaListaAlarms';
    document.getElementById(btn)?.click();
};

/**
 * CONFIGURAR VISIBILIDAD DE INPUTS
 * Muestra u oculta los selectores de fecha o días de la semana según el 
 * tipo de periodicidad seleccionado (diaria, semanal o fecha fija).
 */
function togglePeriodicidadInputs(retryCount = 0) {
    const typeEl = document.getElementById('sys_alarm_type');
    if (!typeEl) {
        if (retryCount < 5) {
            console.warn(`[AlarmsUI] Selector 'sys_alarm_type' no encontrado. Reintentando (${retryCount + 1}/5)...`);
            setTimeout(() => togglePeriodicidadInputs(retryCount + 1), 200);
        } else {
            console.error("[AlarmsUI] Error: Selector 'sys_alarm_type' no encontrado tras varios intentos.");
        }
        return;
    }
    const type = typeEl.value;
    const groupDate = document.getElementById('group-date');
    const groupDays = document.getElementById('group-days');
    const groupMonthly = document.getElementById('group-monthly');

    if (type === 'date') {
        groupDate.classList.remove('d-none');
        groupDays.classList.add('d-none');
        groupMonthly.classList.add('d-none');
        document.getElementById('sys_alarm_date').required = true;
        if(document.getElementById('sys_alarm_day')) document.getElementById('sys_alarm_day').required = false;
    } else if (type === 'weekly') {
        groupDate.classList.add('d-none');
        groupDays.classList.remove('d-none');
        groupMonthly.classList.add('d-none');
        document.getElementById('sys_alarm_date').required = false;
        if(document.getElementById('sys_alarm_day')) document.getElementById('sys_alarm_day').required = false;
    } else if (type === 'monthly') {
        groupDate.classList.add('d-none');
        groupDays.classList.add('d-none');
        groupMonthly.classList.remove('d-none');
        document.getElementById('sys_alarm_date').required = false;
        if(document.getElementById('sys_alarm_day')) document.getElementById('sys_alarm_day').required = true;
    } else {
        groupDate.classList.add('d-none');
        groupDays.classList.add('d-none');
        groupMonthly.classList.add('d-none');
        document.getElementById('sys_alarm_date').required = false;
        if(document.getElementById('sys_alarm_day')) document.getElementById('sys_alarm_day').required = false;
    }
}


function renderAlarmsList() {
    updateBadge(); // Actualizar badge global
    const tbody = document.getElementById('tableSystemAlarmsBody');
    if (!tbody) return;

    const currentUser = sessionService.getUser();
    const alarms = systemAlarmsService.getVisibleAlarms(currentUser).sort((a, b) => {
        const hA = a.hora || '00:00';
        const hB = b.hora || '00:00';
        return hA.localeCompare(hB);
    });

    const renderRow = (a) => {
        let freqBadge = '';
        if (a.type === 'date') {
            freqBadge = `<span class="badge bg-secondary">${Utils.formatDate(a.date)}</span>`;
        } else if (a.type === 'weekly' || Array.isArray(a.days)) { // Support legacy days array too
            const daysMap = {0:'D', 1:'L', 2:'M', 3:'X', 4:'J', 5:'V', 6:'S'};
            const dList = (a.days || a.dias).sort().map(d => daysMap[d] || '?').join(', ');
            freqBadge = `<span class="badge bg-info text-dark" style="font-size: 0.75rem;">${dList}</span>`;
        } else if (a.type === 'monthly') {
            freqBadge = `<span class="badge bg-dark text-white">Día ${a.day} / Mes</span>`;
        } else {
            // Daily or Legacy strings
            if (a.dias === 'laborables') freqBadge = '<span class="badge bg-primary text-white">L-V</span>';
            else if (a.dias === 'finde') freqBadge = '<span class="badge bg-warning text-dark">S-D</span>';
            else freqBadge = '<span class="badge bg-success">Todos los días</span>';
        }

        const activeSwitch = `
        <div class="form-check form-switch d-flex justify-content-center">
            <input class="form-check-input" type="checkbox" ${a.active ? 'checked' : ''} onclick="toggleActiveSystemAlarm('${a.id}')">
        </div>`;

        const scopeIcon = a.usuario 
            ? `<i class="bi bi-person-fill text-primary" title="Personal (${a.usuario})"></i>` 
            : `<i class="bi bi-globe-americas text-success" title="General"></i>`;

        return `
            <tr class="${!a.active ? 'opacity-50' : ''}">
                <td class="text-center">${scopeIcon}</td>
                <td class="fw-bold text-primary fs-5 font-monospace">${a.hora}</td>
                <td>${a.mensaje}</td>
                <td>${freqBadge}</td>
                <td>${activeSwitch}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="editSystemAlarm('${a.id}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteSystemAlarm('${a.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    };

    Ui.renderTable('tableSystemAlarmsBody', alarms, renderRow, 'No hay alarmas configuradas.');

    Ui.enableTableSorting('table-system-alarms', alarms, (sortedData) => {
        Ui.renderTable('tableSystemAlarmsBody', sortedData, renderRow, 'No hay alarmas configuradas.');
    });
}

function editSystemAlarm(id) {
    const alarm = systemAlarmsService.getAlarms().find(a => a.id === id);
    if (!alarm) return;

    Utils.setVal('sys_alarm_id', alarm.id);
    Utils.setVal('sys_alarm_hora', alarm.hora);
    Utils.setVal('sys_alarm_msg', alarm.mensaje);
    
    // Type inference
    let type = alarm.type || 'daily';
    if (!alarm.type) {
        // Try to infer from legacy
        if (Array.isArray(alarm.dias)) type = 'weekly';
        else if (alarm.date) type = 'date';
        else type = 'daily';
    }
    
    Utils.setVal('sys_alarm_type', type);
    togglePeriodicidadInputs(); // Show correct inputs

    if (type === 'date') {
        Utils.setVal('sys_alarm_date', alarm.date);
    } else if (type === 'weekly') {
        // Reset checkboxes
        [0,1,2,3,4,5,6].forEach(d => document.getElementById(`day-${d}`).checked = false);
        const days = alarm.days || (Array.isArray(alarm.dias) ? alarm.dias : []);
        days.forEach(d => {
            const ck = document.getElementById(`day-${d}`);
            if(ck) ck.checked = true;
        });
    } else if (type === 'monthly') {
        Utils.setVal('sys_alarm_day', alarm.day);
    }

    const activeCk = document.getElementById('sys_alarm_active');
    if(activeCk) activeCk.checked = alarm.active;

    const scopeSelector = document.getElementById('sys_alarm_scope');
    if(scopeSelector) {
        scopeSelector.value = alarm.usuario ? 'personal' : 'global';
    }

    const btn = document.querySelector('#formSystemAlarm button[type="submit"]');
    if(btn) btn.innerHTML = '<i class="bi bi-save me-2"></i>Actualizar';
}

function deleteSystemAlarm(id) {
    Ui.showConfirm("¿Borrar esta alarma del sistema?").then(async confirmed => {
        if (confirmed) {
            await systemAlarmsService.deleteAlarm(id);
            renderAlarmsList();
        }
    });
}

async function toggleActiveSystemAlarm(id) {
    await systemAlarmsService.toggleActive(id);
    renderAlarmsList();
}

function resetForm() {
    document.getElementById('formSystemAlarm').reset();
    document.getElementById('sys_alarm_id').value = '';
    togglePeriodicidadInputs();
    const btn = document.querySelector('#formSystemAlarm button[type="submit"]');
    if(btn) btn.innerHTML = '<i class="bi bi-plus-circle me-2"></i>Guardar Alarma';
}

function updateBadge() {
    const currentUser = sessionService.getUser();
    const alarmsData = systemAlarmsService.getVisibleAlarms(currentUser) || []; 
    const alarms = Array.isArray(alarmsData) ? alarmsData.filter(a => a.active) : [];
    const badge = document.getElementById('badgeSystemAlarms');
    const bellBtn = document.getElementById('btnSystemAlarms');
    
    if (!badge || !bellBtn) return;

    if (alarms.length > 0) {
        badge.classList.remove('d-none');
        bellBtn.classList.remove('text-secondary');
        bellBtn.classList.add('text-danger', 'animation-pulse');
    } else {
        badge.classList.add('d-none');
        bellBtn.classList.remove('text-danger', 'animation-pulse');
        bellBtn.classList.add('text-secondary');
    }
}

/**
 * IMPRESIÓN DE ALARMAS
 */
export function imprimirSystemAlarms() {
    if (window.PrintService) {
        window.PrintService.printElement('table-system-alarms', 'Alertas del Sistema - Configuración');
    } else {
        window.print();
    }
}

window.imprimirSystemAlarms = imprimirSystemAlarms;
