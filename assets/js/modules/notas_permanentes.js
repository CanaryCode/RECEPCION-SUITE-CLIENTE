import { notasService } from '../services/NotasService.js';
import { Utils } from '../core/Utils.js';
import { Ui } from '../core/Ui.js';

/**
 * MÓDULO DE NOTAS PERMANENTES (NOTAS ADHESIVAS / POST-ITS)
 * --------------------------------------------------------
 * Permite a los recepcionistas dejar notas rápidas fijadas en el muro.
 * Las notas tienen colores configurables y una rotación visual aleatoria.
 * Soporta protección por contraseña para evitar ediciones no autorizadas.
 */

let notaEnEdicionId = null;  // ID de la nota que se abre en el modal
let modoEdicion = false;     // Si es falso, las notas el muro son solo lectura
const PASSWORD_EDICION = "1234";
let sortBy = 'manual';      // 'manual', 'recent', 'oldest'
let filterFavs = false;     // Filtrar solo favoritos


// ==========================================
// 1. INICIALIZACIÓN
// ==========================================

export async function inicializarNotasPermanentes() {
    const container = document.getElementById('notas-content');
    if (!container) return;

    // Carga de datos autoritativa (JSON Server)
    await notasService.init();

    // Event Listeners
    const form = document.getElementById('formNota');
    if (form) {
        form.removeEventListener('submit', guardarNota);
        form.addEventListener('submit', guardarNota);
    }

    const searchInput = document.getElementById('searchNotas');
    if (searchInput) {
        const newSearch = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearch, searchInput);
        newSearch.addEventListener('input', () => renderNotas());
    }

    // Configurar botones globales del módulo
    document.getElementById('btn-nueva-nota')?.addEventListener('click', () => abrirModalNota());
    document.getElementById('btn-lock-notas')?.addEventListener('click', toggleEdicionNotas);

    // Nuevos controles de ordenación y filtrado
    document.getElementById('sortNotas')?.addEventListener('change', (e) => {
        sortBy = e.target.value;
        renderNotas();
    });

    document.getElementById('btn-filter-favs')?.addEventListener('click', () => {
        filterFavs = !filterFavs;
        actualizarUIPiltros();
        renderNotas();
    });

    renderNotas();
}

// ==========================================
// 2. HANDLERS & ACCIONES
// ==========================================

export async function toggleEdicionNotas() {
    if (modoEdicion) {
        modoEdicion = false;
        renderNotas();
    } else {
        const pass = await Ui.showPrompt("🔒 Contraseña de administrador:", "password");
        if (pass === PASSWORD_EDICION) {
            modoEdicion = true;
            renderNotas();
        } else if (pass !== null) {
            Ui.showToast("Contraseña incorrecta", "danger");
        }
    }
}

export function abrirModalNota(id = null) {
    notaEnEdicionId = id;
    const modalEl = document.getElementById('modalNota');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    const title = document.getElementById('modalNotaTitle');

    // Resetear formulario
    document.getElementById('formNota').reset();
    document.getElementById('color-yellow').checked = true; // Default

    if (id) {
        const nota = notasService.getNotaById(id);
        if (nota) {
            title.innerText = "Editar Nota";
            Utils.setVal('notaTitulo', nota.titulo);
            Utils.setVal('notaContenido', nota.contenido);
            document.getElementById('notaProtegida').checked = !!nota.protegida;

            // Seleccionar color
            const colorRadio = document.querySelector(`input[name="colorNota"][value="${nota.color}"]`);
            if (colorRadio) colorRadio.checked = true;
        }
    } else {
        title.innerText = "Nueva Nota";
        document.getElementById('notaProtegida').checked = false;
    }

    modal.show();
}

function guardarNota(e) {
    e.preventDefault();

    const titulo = document.getElementById('notaTitulo').value.trim();
    const contenido = document.getElementById('notaContenido').value.trim();
    const color = document.querySelector('input[name="colorNota"]:checked').value;
    const protegida = document.getElementById('notaProtegida').checked;
    const modifiedAt = Date.now();

    if (!titulo && !contenido) {
        alert("La nota debe tener al menos título o contenido.");
        return;
    }

    const now = new Date();
    const fechaStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (notaEnEdicionId) {
        // Editar
        const notaExistente = notasService.getNotaById(notaEnEdicionId);
        if (notaExistente) {
            const notaActualizada = {
                ...notaExistente,
                titulo,
                contenido,
                color,
                protegida,
                modifiedAt,
                fecha: fechaStr
            };
            notasService.saveNota(notaActualizada);
        }
    } else {
        // Crear
        const nuevaNota = {
            id: Date.now(),
            titulo,
            contenido,
            color,
            protegida,
            modifiedAt,
            favorito: false,
            fecha: fechaStr,
            rotacion: (Math.random() * 4 - 2).toFixed(1)
        };
        notasService.saveNota(nuevaNota);
    }

    // Cerrar modal
    const modalEl = document.getElementById('modalNota');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.hide();

    // Si guardamos, volvemos a orden manual para ver la nueva nota o mantener el orden
    // sortBy = 'manual'; 
    // document.getElementById('sortNotas').value = 'manual';

    renderNotas();
}

export async function toggleFavorito(id, event) {
    if(event) event.stopPropagation();
    const nota = notasService.getNotaById(id);
    if (nota) {
        nota.favorito = !nota.favorito;
        nota.modifiedAt = Date.now();
        await notasService.saveNota(nota);
        renderNotas();
    }
}

function actualizarUIPiltros() {
    const btn = document.getElementById('btn-filter-favs');
    const icon = document.getElementById('icon-filter-favs');
    if (btn && icon) {
        if (filterFavs) {
            btn.classList.replace('btn-outline-warning', 'btn-warning');
            icon.className = 'bi bi-star-fill';
        } else {
            btn.classList.replace('btn-warning', 'btn-outline-warning');
            icon.className = 'bi bi-star';
        }
    }
}

export async function eliminarNota(id) {
    if (await Ui.showConfirm("¿Eliminar esta nota?")) {
        await notasService.deleteNota(id);
        renderNotas();
    }
}

// ==========================================
// 3. RENDERIZADO
// ==========================================

/**
 * DIBUJAR MURO DE NOTAS
 * Renderiza todos los post-its con su inclinación (--rotation) y color específico.
 */
function renderNotas() {
    const grid = document.getElementById('grid-notas');
    if (!grid) return;

    actualizarEstadoBotonLock();
    const notas = notasService.getNotas();

    const searchInput = document.getElementById('searchNotas');
    const filtroText = searchInput ? searchInput.value.toLowerCase().trim() : "";
    
    let notasFiltradas = notas.filter(n => {
        const matchesSearch = !filtroText || 
            (n.titulo && n.titulo.toLowerCase().includes(filtroText)) ||
            (n.contenido && n.contenido.toLowerCase().includes(filtroText));
        
        const matchesFav = !filterFavs || !!n.favorito;
        
        return matchesSearch && matchesFav;
    });

    // APLICAR ORDENACIÓN
    if (sortBy === 'recent') {
        notasFiltradas.sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0));
    } else if (sortBy === 'oldest') {
        notasFiltradas.sort((a, b) => (a.modifiedAt || 0) - (b.modifiedAt || 0));
    } 
    // 'manual' no necesita sort porque el array ya viene ordenado por el Drag & Drop persistido.

    grid.innerHTML = '';

    if (notasFiltradas.length === 0) {
        let msg = 'No hay notas fijadas.';
        if (filtroText) msg = 'No se encontraron notas con ese texto.';
        else if (filterFavs) msg = 'No tienes notas favoritas marcadas.';

        grid.innerHTML = `
            <div class="col-12 text-center py-5 opacity-50">
                <i class="bi bi-stickies display-1 text-secondary"></i>
                <p class="mt-3 fs-5">${msg}</p>
            </div>`;
        return;
    }

    notasFiltradas.forEach(nota => {
        const rotacion = nota.rotacion || (Math.random() * 4 - 2).toFixed(1);
        const visibilityClass = modoEdicion ? '' : 'd-none';

        // LÓGICA DE PROTECCIÓN (Notas ocultas si está bloqueado)
        const isProtected = !!nota.protegida;
        const hideContent = isProtected && !modoEdicion;
        
        const cardTitle = hideContent ? `<i class="bi bi-shield-lock-fill me-2 text-muted"></i>Nota Protegida` : nota.titulo;
        const cardBody = hideContent ? 
            `<div class="text-center py-4 opacity-75">
                <i class="bi bi-eye-slash display-6 mb-2"></i>
                <p class="small mb-0">Contenido oculto.<br>Desbloquea para ver.</p>
             </div>` : 
            `<p class="card-text flex-grow-1" style="white-space: pre-wrap; font-size: 0.95rem; line-height: 1.5;">${nota.contenido}</p>`;

        // Gestión de Drag & Drop (Solo si está desbloqueado)
        const dragAttrs = modoEdicion ? `draggable="true" ondragstart="handleDragStart(event, ${nota.id})" ondragover="handleDragOver(event)" ondrop="handleDrop(event, ${nota.id})" ondragenter="handleDragEnter(event)" ondragleave="handleDragLeave(event)"` : '';
        const cursorStyle = modoEdicion ? 'cursor: grab;' : '';

        grid.innerHTML += `
            <div class="col-md-6 col-lg-4 col-xl-3 animate__animated animate__fadeIn" ${dragAttrs} style="${cursorStyle}">
                <div class="card post-it ${nota.color || 'note-yellow'} h-100 ${isProtected ? 'border-primary border-opacity-25 shadow' : ''}" style="--rotation: ${rotacion}deg;">
                    <div class="card-body d-flex flex-column p-3">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h5 class="card-title fw-bold mb-0 text-dark" style="font-family: 'Inter', sans-serif; font-size: 1.1rem;">${cardTitle}</h5>
                            <div class="d-flex align-items-center gap-2">
                                <button class="btn btn-link p-0 ${nota.favorito ? 'text-warning' : 'text-dark opacity-25'} hover-opacity-100" 
                                    onclick="toggleFavorito(${nota.id}, event)" title="Marcar como favorita">
                                    <i class="bi ${nota.favorito ? 'bi-star-fill' : 'bi-star'}"></i>
                                </button>
                                <div class="dropdown ${visibilityClass}">
                                    <button class="btn btn-link text-dark p-0 opacity-50 hover-opacity-100" data-bs-toggle="dropdown">
                                        <i class="bi bi-three-dots-vertical"></i>
                                    </button>
                                    <ul class="dropdown-menu dropdown-menu-end border-0 shadow">
                                        <li><button class="dropdown-item" onclick="abrirModalNota(${nota.id})"><i class="bi bi-pencil me-2"></i>Editar</button></li>
                                        <li><button class="dropdown-item text-danger" onclick="eliminarNota(${nota.id})"><i class="bi bi-trash me-2"></i>Eliminar</button></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        ${cardBody}
                        <div class="mt-2 d-flex justify-content-between align-items-center">
                            ${isProtected ? '<i class="bi bi-shield-lock-fill text-primary opacity-50" style="font-size: 0.8rem;" title="Nota Protegida"></i>' : '<span></span>'}
                            <small class="text-muted opacity-50" style="font-size: 0.7rem;">${nota.fecha}</small>
                        </div>
                    </div>
                </div>
            </div>`;
    });
}

// ==========================================
// 4. DRAG AND DROP HANDLERS
// ==========================================

export function handleDragStart(e, id) {
    if (!modoEdicion) return;
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.style.opacity = '0.4';
}

export function handleDragOver(e) {
    if (!modoEdicion) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
}

export function handleDragEnter(e) {
    if (!modoEdicion) return;
    e.preventDefault();
    e.currentTarget.classList.add('scale-up-center'); // Efecto visual opcional
}

export function handleDragLeave(e) {
    if (!modoEdicion) return;
    e.currentTarget.classList.remove('scale-up-center');
}

export function handleDrop(e, targetId) {
    if (!modoEdicion) return;
    e.preventDefault();
    e.currentTarget.style.opacity = '1';
    e.currentTarget.classList.remove('scale-up-center');

    const sourceId = parseInt(e.dataTransfer.getData("text/plain"));

    if (sourceId === targetId) return;

    // Reordenar array
    const notas = notesService.getNotas(); // Usando alias correcto abajo o import
    const fromIndex = notas.findIndex(n => n.id === sourceId);
    const toIndex = notas.findIndex(n => n.id === targetId);

    if (fromIndex !== -1 && toIndex !== -1) {
        // Mover elemento
        const [movedNote] = notas.splice(fromIndex, 1);
        notas.splice(toIndex, 0, movedNote);

        // Guardar y renderizar
        notesService.saveNotas(notas); // Asegurar que sea notasService
        renderNotas();
    }
}

function actualizarEstadoBotonLock() {
    const btnLock = document.getElementById('btn-lock-notas');
    const iconLock = document.getElementById('icon-lock-notas');
    const textLock = document.getElementById('text-lock-notas');
    const btnNew = document.getElementById('btn-nueva-nota');

    if (btnLock) {
        if (modoEdicion) {
            btnLock.classList.replace('btn-outline-secondary', 'btn-outline-danger');
            if (iconLock) iconLock.className = 'bi bi-unlock-fill';
            if (textLock) textLock.textContent = 'Edición Activa';
            btnNew?.classList.remove('d-none');
        } else {
            btnLock.classList.replace('btn-outline-danger', 'btn-outline-secondary');
            if (iconLock) iconLock.className = 'bi bi-lock-fill';
            if (textLock) textLock.textContent = 'Bloqueado';
            btnNew?.classList.add('d-none');
        }
    }
}

// Helper interno para evitar problemas de ámbito con la variable importada
const notesService = notasService;

// Exportar funciones para HTML
window.toggleEdicionNotas = toggleEdicionNotas;
window.abrirModalNota = abrirModalNota;
window.eliminarNota = eliminarNota;
window.toggleFavorito = toggleFavorito;
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDrop = handleDrop;
window.handleDragEnter = handleDragEnter;
window.handleDragLeave = handleDragLeave;

window.imprimirNotas = () => {
    if (Ui.hideAllTooltips) Ui.hideAllTooltips();
    if (window.PrintService) {
        PrintService.printElement('grid-notas', `Tablón de Notas - ${Utils.getTodayISO()}`);
    } else {
        window.print();
    }
};
