/**
 * MÓDULO DE ALARMAS DE SISTEMA (alarms.js)
 * ---------------------------------------
 * Gestiona los avisos recurrentes automáticos (Ej: Comprobar pH piscina, rondas).
 * A diferencia de los despertadores, estas alarmas son configurables para días
 * específicos y emiten un sonido de "Beep" sintetizado vía AudioContext.
 */

import { systemAlarmsService } from '../services/SystemAlarmsService.js';
import { desayunoService } from '../services/DesayunoService.js';

let audioCtx = null;
let beepInterval = null;

const ALARM_CHECK_INTERVAL = 15000; // Check every 15s for better precision

export async function inicializarSystemAlarms() {
    // Garantizar carga de datos desde disco
    await systemAlarmsService.init();

    // Inyectar modal especifico para Alarmas de Sistema
    crearModalSystemAlert();
    iniciarMonitorAlarmas();

    // Event Listener para el botón de la campana
    const btn = document.getElementById('btnSystemAlarms');
    if (btn) {
        btn.onclick = (e) => {
            e.preventDefault();
            window.openSystemAlarms();
        };
    }
}

window.openSystemAlarms = () => {
    console.log('Attempting to open System Alarms tab...');
    try {
        if (typeof window.navegarA === 'function') {
            window.navegarA('#system-alarms-content');
            return;
        }

        // Fallback 1: Click the hidden trigger explicitly
        let trigger = document.getElementById('tab-system-alarms-content');
        if (!trigger) {
             // Fallback 2: Any button
             trigger = document.querySelector('button[data-bs-target="#system-alarms-content"]');
        }
        
        if (trigger) {
            console.log('Trigger found:', trigger.id);
            const tab = bootstrap.Tab.getOrCreateInstance(trigger);
            tab.show();
        } else {
           console.error('System Alarms tab trigger not found!');
           alert('Error: No se encuentra la pestaña de alarmas.');
        }
    } catch (e) {
        console.error('Error opening alarms:', e);
        alert('Error abriendo alarmas: ' + e.message);
    }
};

function iniciarMonitorAlarmas() {
    if (intervalId) clearInterval(intervalId);
    checkAlarmas(); // Check init
    intervalId = setInterval(checkAlarmas, ALARM_CHECK_INTERVAL);
}

// Global interval definition
let intervalId = null; 

function checkAlarmas() {
    const now = new Date();
    checkSystemAlarms(now);
    checkBreakfasts(now);
}

function checkSystemAlarms(now) {
    const alarms = systemAlarmsService.getAlarms() || []; // Safeguard against null
    let pendingToday = false;

    if (!Array.isArray(alarms)) {
        console.warn('SystemAlarms: Expected array but got', typeof alarms);
        return; 
    }

    alarms.forEach(alarm => {
        // Check trigger
        if (systemAlarmsService.isTriggerDue(alarm, now)) {
            triggerAlarm(alarm);
        }
        
        // Check pending to update Bell (Future alarms today)
        if (alarm.active) {
            const parts = alarm.hora.split(':');
            const alarmDate = new Date(now);
            alarmDate.setHours(parseInt(parts[0]), parseInt(parts[1]), 0);
            
            if (alarmDate > now) {
                // Check periodicity
                const weekDay = now.getDay();
                const dateStr = now.toISOString().split('T')[0];

                let isToday = false;
                if (alarm.type === 'date') isToday = (alarm.date === dateStr);
                else if (alarm.type === 'weekly') isToday = (alarm.days && alarm.days.includes(weekDay));
                else if (alarm.type === 'monthly') isToday = (alarm.day === now.getDate());
                else {
                    // Daily legacy
                    if (alarm.dias === 'laborables') isToday = (weekDay >= 1 && weekDay <= 5);
                    else if (alarm.dias === 'finde') isToday = (weekDay === 0 || weekDay === 6);
                    else isToday = true; // todos
                }
                
                if (isToday) pendingToday = true;
            }
        }
    });
    
    updateBellStatus(pendingToday);
}

function checkBreakfasts(now) {
    const desayunos = desayunoService.getAll() || {};
    const currentHour = now.getHours().toString().padStart(2, '0');
    const currentMinute = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;

    Object.keys(desayunos).forEach(hab => {
        const item = desayunos[hab];
        if (item.hora === currentTime) {
            const fakeAlarm = {
                id: `bk_${hab}_${currentTime}`,
                titulo: 'DESAYUNO TEMPRANO',
                mensaje: `Habitación ${hab} (${item.pax} pax) - ${item.obs || 'Sin observaciones'}`,
                hora: item.hora,
                active: true,
                type: 'daily' 
            };
            triggerAlarm(fakeAlarm);
        }
    });
}

function updateBellStatus(hasPending) {
    const btn = document.getElementById('btnSystemAlarms');
    if (!btn) return;
    
    if (hasPending) {
        btn.classList.add('text-danger'); 
    } else {
        btn.classList.remove('text-danger');
        btn.classList.add('text-secondary');
    }
}

function triggerAlarm(alarm) {
    // Evitar disparar múltiples veces el mismo minuto
    const nowStr = new Date().toDateString();
    const triggerId = `${nowStr}_${alarm.id}_${alarm.hora}`;
    const lastTrigger = sessionStorage.getItem(triggerId);

    if (lastTrigger) return;

    sessionStorage.setItem(triggerId, "triggered");

    // Audio
    playBeep();

    // Mostrar Modal Interactivo
    showAlarmModal(alarm);
    
    // Update bell immediately
    updateBellStatus(true);
}

/**
 * REPRODUCIR BEEP (Sintetizador Web Audio)
 * Genera una señal cuadrada que sube de frecuencia para alertar al recepcionista.
 * Se repite cada segundo hasta que el usuario acepta el modal.
 */
function playBeep() {
    stopBeep(); 
    
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const beep = () => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime); // La 440
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    };

    beep(); 
    beepInterval = setInterval(beep, 1000); 
}

function stopBeep() {
    if (beepInterval) {
        clearInterval(beepInterval);
        beepInterval = null;
    }
}

function showAlarmModal(alarm) {
    const modalEl = document.getElementById('modalSystemAlert');
    if (!modalEl) return;

    const msgEl = document.getElementById('sysAlertMsg');
    const timeEl = document.getElementById('sysAlertTime');
    
    if (msgEl) msgEl.innerText = alarm.mensaje;
    if (timeEl) timeEl.innerText = alarm.hora;

    // Configurar botón Posponer
    const btnSnooze = document.getElementById('btnSysAlertSnooze');
    btnSnooze.onclick = () => {
        stopBeep();
        snoozeAlarm(alarm);
    };

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
}

/**
 * POSPONER ALARMA
 * Crea una alarma temporal de un solo uso programada para dentro de 10 minutos.
 */
async function snoozeAlarm(originalAlarm) {
    // 1. Limpiar alarmas pospuestas anteriores relacionadas con esta alarma
    const allAlarms = await systemAlarmsService.getAll();
    const previousSnoozes = allAlarms.filter(a => 
        a.id && a.id.toString().startsWith('snooze_') && 
        a.mensaje && a.mensaje.includes(originalAlarm.mensaje)
    );
    
    for (const oldSnooze of previousSnoozes) {
        await systemAlarmsService.delete(oldSnooze.id);
    }
    
    // 2. Calcular nueva hora (+10 min)
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    const newHora = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    
    // 3. Crear nueva alarma temporal
    const snoozeAlarm = {
        id: `snooze_${Date.now()}`,
        hora: newHora,
        titulo: `(REP) ${originalAlarm.titulo || 'Alarma'}`,
        mensaje: `(Pospuesto) ${originalAlarm.mensaje}`,
        type: 'date',
        date: now.toISOString().split('T')[0],
        active: true
    };
    
    await systemAlarmsService.add(snoozeAlarm); 
    
    // 4. Refresh UI
    if (typeof window.renderSystemAlarms === 'function') {
        window.renderSystemAlarms();
    }
    
    alert(`Alarma pospuesta para las ${newHora}`);
}

function crearModalSystemAlert() {
    if (document.getElementById('modalSystemAlert')) return;

    const div = document.createElement('div');
    div.innerHTML = `
        <div class="modal fade" id="modalSystemAlert" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-primary shadow-lg">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title fw-bold"><i class="bi bi-broadcast me-2"></i>AVISO DEL SISTEMA</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center p-4">
                        <h1 class="display-3 text-primary mb-3"><i class="bi bi-clock-history"></i></h1>
                        <h2 class="fw-bold mb-2" id="sysAlertTime">--:--</h2>
                        <h4 class="mb-4" id="sysAlertMsg">...</h4>
                        
                        <div class="d-grid gap-2 col-8 mx-auto">
                            <button class="btn btn-primary btn-lg fw-bold" id="btnSysAlertOk" data-bs-dismiss="modal">
                                <i class="bi bi-check-lg me-2"></i>ENTENDIDO / DETENER
                            </button>
                            <button class="btn btn-outline-secondary" id="btnSysAlertSnooze" data-bs-dismiss="modal">
                                <i class="bi bi-stopwatch me-2"></i>Posponer 10 min
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(div);

    // Initial listeners for Stop
    document.getElementById('btnSysAlertOk').addEventListener('click', stopBeep);
}
