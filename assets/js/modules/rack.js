import { rackService } from '../services/RackService.js';
import { APP_CONFIG } from '../core/Config.js';
import { Ui } from '../core/Ui.js';
import { RackView } from '../core/RackView.js';

/**
 * MÓDULO DE RACK INTERACTIVO (rack.js)
 */

let currentFilters = {
    tipos: new Set(),
    states: new Set(),
    vistas: new Set(),
    extras: new Set(),
    searchTerm: '' 
};

/**
 * INICIALIZACIÓN
 */
export async function inicializarRack() {
    await rackService.init(); 
    renderFilters();
    renderRack();

    // Search Listener
    document.getElementById('room-search-input')?.addEventListener('input', (e) => {
        currentFilters.searchTerm = e.target.value.trim().toLowerCase();
        renderRack();
    });

    document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
        currentFilters.tipos.clear();
        currentFilters.states.clear();
        currentFilters.vistas.clear();
        currentFilters.extras.clear();
        currentFilters.searchTerm = '';
        
        const searchInput = document.getElementById('room-search-input');
        if (searchInput) searchInput.value = '';

        document.querySelectorAll('#filter-tipos-container input, #filter-estados-container input, #filter-vistas-container input, #filter-extras-container input')
            .forEach(cb => cb.checked = false);
            renderRack();
    });
    
}

// Expose for global refreshes
window.renderRack = renderRack;
window.imprimirRack = async () => {
    if (Ui.hideAllTooltips) Ui.hideAllTooltips();
    if (window.PrintService) {
        await imprimirRackPaginado();
    } else {
        window.print();
    }
};

async function imprimirRackPaginado() {
    const floorContainers = document.querySelectorAll('.rack-floor-container');
    if (floorContainers.length === 0) return;

    Ui.showToast("Generando reporte por plantas...", "info");
    
    const images = [];
    for (const container of floorContainers) {
        const img = await PrintService.captureElement(container);
        if (img) images.push(img);
    }

    if (images.length > 0) {
        PrintService.printMultiImage(images, `Rack de Habitaciones - ${Utils.getTodayISO()}`);
    } else {
        Ui.showToast("No se pudo capturar el rack", "danger");
    }
}

// GLOBAL LISTENER - ATTACH IMMEDIATELY (Ensure it runs even if init fails)


function attachRackListener() {

    
    document.body.addEventListener('click', async (e) => {
        const roomCard = e.target.closest('.room-card');
        if (roomCard) {
            if (e.target.closest('.badge') && e.target.closest('.badge').onclick) return;

            const roomNum = roomCard.getAttribute('data-room-num');
            if (roomNum) {
                console.log(`[DEBUG] Click detectado en habitación: ${roomNum}`);
                console.log(`Intento de abrir habitación: ${roomNum}`);
                if (window.RoomDetailModal && window.RoomDetailModal.open) {
                    try {
                        window.RoomDetailModal.open(roomNum);
                    } catch (err) {
                        alert("Error al ejecutar Modal: " + err.message);
                    }
                } else {
                    alert("DEBUG Error: RoomDetailModal no existe en window");
                    console.error("RoomDetailModal no cargado");
                    alert("ERROR: El sistema de menús no está cargado.");
                }
                return;
            }
        }

        // Extras Checkboxes Confirmation
        const extrasIds = ['check-sofa', 'check-sofaCama', 'check-cheslong', 'check-ruidosa', 'check-tranquila'];
        if (e.target && extrasIds.includes(e.target.id)) {
            const fieldset = document.getElementById('room-details-fieldset');
            if (fieldset && fieldset.disabled) {
                e.preventDefault();
                return;
            }

            const featureName = e.target.nextElementSibling.innerText.trim();
            const isNowChecked = e.target.checked;
            
            setTimeout(async () => {
                const confirmed = await Ui.showConfirm(`¿Estás seguro de modificar "${featureName}"?`);
                if (confirmed) {
                    Ui.showToast("Modificación realizada", "success");
                } else {
                    e.target.checked = !isNowChecked; 
                }
            }, 10);
        }
    });
}

// Safely attach listener
if (document.body) attachRackListener();
else document.addEventListener('DOMContentLoaded', attachRackListener);

function renderFilters() {
    const filters = rackService.getAllFilters();
    renderCheckboxGroup('filter-tipos-container', filters.tipos, 'tipos');
    renderCheckboxGroup('filter-estados-container', filters.estados, 'states');
    renderCheckboxGroup('filter-vistas-container', filters.vistas, 'vistas');
    renderCheckboxGroup('filter-extras-container', filters.extras, 'extras');
}

function renderCheckboxGroup(containerId, items, filterCategory) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = items.map(item => `
        <div class="form-check">
            <input class="form-check-input" type="checkbox" value="${item.id}" id="filter-${filterCategory}-${item.id}"
                onchange="toggleFilter('${filterCategory}', '${item.id}')">
            <label class="form-check-label small" for="filter-${filterCategory}-${item.id}">
                ${item.label}
            </label>
        </div>
    `).join('');
}

window.toggleFilter = (category, value) => {
    if (currentFilters[category].has(value)) {
        currentFilters[category].delete(value);
    } else {
        currentFilters[category].add(value);
    }
    renderRack();
};

function renderRack() {
    const container = document.getElementById('rack-grid-container');
    if (container) {
        container.className = 'row g-3 row-cols-auto justify-content-center';
    }
    const countDisplay = document.getElementById('rack-count-display');
    const printDate = document.getElementById('print-date-rack');
    
    if (!container) return;

    if (printDate) {
        const now = new Date();
        printDate.innerText = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    const allRooms = rackService.getRoomsWithDetails();
    
    const filteredRooms = allRooms.filter(r => {
        if (currentFilters.searchTerm && !r.num.includes(currentFilters.searchTerm)) return false;
        if (currentFilters.tipos.size > 0 && !currentFilters.tipos.has(r.tipo)) return false;
        if (currentFilters.states.size > 0) {
            const status = r.status || 'DISPONIBLE';
            if (!currentFilters.states.has(status)) return false;
        }
        if (currentFilters.vistas.size > 0 && !currentFilters.vistas.has(r.vista)) return false;
        if (currentFilters.extras.size > 0) {
            for (const extra of currentFilters.extras) {
                if (!r.extras[extra]) return false;
            }
        }
        return true;
    });

    if (countDisplay) countDisplay.innerText = filteredRooms.length;

    if (filteredRooms.length === 0) {
        // DEBUG: Mostrar por qué no hay habitaciones
        console.warn("Rack Debug: No rooms found.", {
            allRoomsCount: allRooms.length,
            filters: currentFilters,
            configRangos: APP_CONFIG.HOTEL?.STATS_CONFIG?.RANGOS
        });

        container.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-search display-1 opacity-25"></i>
                <p class="mt-3 fs-5">No se encontraron habitaciones con estos filtros.</p>
                <div class="alert alert-warning d-inline-block text-start mt-3">
                    <small><strong>Debug Info:</strong><br>
                    Total Habitaciones: ${allRooms.length}<br>
                    Filtros Activos: ${currentFilters.searchTerm || 'Ninguno'}<br>
                    Rangos Configurados: ${APP_CONFIG.HOTEL?.STATS_CONFIG?.RANGOS ? APP_CONFIG.HOTEL.STATS_CONFIG.RANGOS.length : 'No definidos'}</small>
                </div>
            </div>`;
        return;
    }

    const roomMap = new Map();
    filteredRooms.forEach(r => roomMap.set(r.num, r));

    RackView.render(
        'rack-grid-container', 
        (numHab) => {
            const roomData = roomMap.get(numHab);
            if (!roomData) return null;
            return generateRoomCard(roomData);
        },
        (planta) => `
            <h5 class="border-bottom pb-2 mb-3 text-secondary">
                <i class="bi bi-layers-fill me-2"></i>Planta ${planta}
            </h5>`
    );
}

function generateRoomCard(room) {
    let cardClass = 'border-secondary-subtle';
    let badgeText = '';
    let badgeClass = 'd-none';

    if (room.tipo === 'MASTER_SUITE') {
        cardClass = 'border-danger border-2 shadow-sm bg-danger-subtle';
        badgeText = 'MASTER SUITE';
        badgeClass = 'bg-danger text-white'; 
    } else if (room.tipo === 'SUITE_STANDARD') {
        cardClass = 'border-primary border-2 shadow-sm bg-primary-subtle';
        badgeText = 'SUITE STD';
        badgeClass = 'bg-primary text-white';
    } else if (room.tipo === 'DOBLE_SUPERIOR') {
        cardClass = 'border-warning border-2 bg-warning-subtle';
        badgeText = 'DBL SUPERIOR';
        badgeClass = 'bg-warning text-dark';
    } else if (room.extras.comunicada) {
        cardClass = 'border-danger border-2'; 
    } else if (room.extras.sofaCama || room.extras.sofa) { 
        if (!cardClass.includes('border-primary') && !cardClass.includes('border-danger')) {
             cardClass = 'border-warning border-2'; 
        }
    }

    let statusStyle = '';
    let statusIcon = '';
    if (room.status === 'BLOQUEADA') {
        statusStyle = 'opacity: 0.5; background-color: #ffe6e6 !important;';
        statusIcon = '<i class="bi bi-slash-circle-fill text-danger position-absolute top-0 end-0 m-1" title="Bloqueada"></i>';
    }

    let communicatedBadge = '';
    if (room.extras.comunicada && room.extras.comunicadaCon) {
        communicatedBadge = `<span class="badge bg-danger text-white position-absolute bottom-0 start-50 translate-middle-x mb-1 shadow-sm" style="font-size: 0.6rem; z-index: 5;"><i class="bi bi-arrow-left-right me-1"></i>${room.extras.comunicadaCon}</span>`;
    }

    let vistaIcon = 'bi-building';
    let vistaColor = 'text-secondary';
    if (room.vista === 'MAR') { vistaIcon = 'bi-water'; vistaColor = 'text-info'; }
    if (room.vista === 'PISCINA') { vistaIcon = 'bi-tsunami'; vistaColor = 'text-primary'; }

    let extrasIcons = [];
    if (room.extras.adaptada) extrasIcons.push('<i class="bi bi-person-wheelchair text-success fw-bold" title="Adaptada" style="font-size: 1.1em;"></i>');
    if (room.extras.sofaCama) extrasIcons.push('<i class="bi bi-archive-fill text-warning" title="Sofá Cama" style="font-size: 0.8em;"></i>');
    else if (room.extras.sofa) extrasIcons.push('<i class="bi bi-journal-bookmark-fill text-warning" title="Sofá" style="font-size: 0.8em;"></i>');
    
    if (room.extras.cheslong) extrasIcons.push('<i class="bi bi-layout-sidebar text-primary" title="Cheslong" style="font-size: 0.8em;"></i>');
    if (room.extras.comunicada) extrasIcons.push('<i class="bi bi-arrows-angle-expand text-danger" title="Comunicada"></i>');
    if (room.extras.ruidosa) extrasIcons.push('<i class="bi bi-speaker-fill text-muted" title="Ruidosa" style="font-size: 0.8em;"></i>');
    if (room.extras.tranquila) extrasIcons.push('<i class="bi bi-soundwave text-success" title="Tranquila" style="font-size: 0.8em;"></i>');
    if (room.comments) extrasIcons.push('<i class="bi bi-chat-dots-fill text-secondary" title="Tiene Observaciones"></i>');

    let mainBadgeHtml = '';
    if (badgeText) {
        mainBadgeHtml = `<span class="badge ${badgeClass} position-absolute top-0 start-50 translate-middle-x mt-1" style="font-size: 0.55rem; width: 90%;">${badgeText}</span>`;
    }

    return `
        <div class="card room-card ${cardClass}" 
             style="width: 140px; cursor: pointer; ${statusStyle}" 
             title="${room.tipo}" 
             data-room-num="${room.num}">
            <div class="card-body p-2 text-center position-relative">
                ${statusIcon}
                ${mainBadgeHtml}
                <h4 class="card-title fw-bold mb-1 text-dark mt-3">${room.num}</h4>
                <div class="d-flex justify-content-center align-items-center gap-2 fs-5 mb-3 text-secondary">
                    <i class="bi ${vistaIcon} ${vistaColor}" title="Vista: ${room.vista}"></i>
                    ${extrasIcons.length > 0 ? `<div class="d-flex gap-1 text-muted border-start ps-2 align-items-center">${extrasIcons.join('')}</div>` : ''}
                </div>
                ${communicatedBadge}
            </div>
        </div>
    `;
}
