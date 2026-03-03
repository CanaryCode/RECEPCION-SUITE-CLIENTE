import { preciosService } from '../services/PreciosService.js';
import { Utils } from '../core/Utils.js';
import { Ui } from '../core/Ui.js';
import { APP_CONFIG } from "../core/Config.js";

/**
 * MÓDULO DE LISTA DE PRECIOS (precios.js)
 * --------------------------------------
 * Gestiona el catálogo de productos y servicios del hotel (Bebidas, Comida, etc).
 * Incluye un buscador en tiempo real, sistema de favoritos y un modo de edición 
 * protegido por contraseña para administradores.
 */

let modoEdicionPrecios = false;  // Flag para habilitar/deshabilitar cambios
let targetInputId = null;        // Referencia para el selector de iconos
const PASSWORD_EDICION = "1234";

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================

export function inicializarPrecios() {
    // Configurar buscador de texto
    const searchInput = document.getElementById('search-precios-modulo');
    if (searchInput) {
        // Clonar para eliminar listeners anteriores
        const newSearch = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearch, searchInput);
        newSearch.addEventListener('input', () => renderPrecios());
    }

    // Configurar Filtro de Departamento
    const filterDpto = document.getElementById('filter-precios-departamento');
    if (filterDpto) {
        filterDpto.addEventListener('change', () => renderPrecios());
    }

    // Configurar Filtro de Favoritos (Botón toggle)
    const filterFav = document.getElementById('filter-precios-fav');
    if (filterFav) {
        filterFav.addEventListener('click', (e) => {
            // Pequeño delay para que Bootstrap actualice el estado del botón
            setTimeout(() => renderPrecios(), 50);
        });
    }

    // Poblar Selectores de Departamento (desde Config)
    const dptoSelect = document.getElementById('new-precio-departamento');
    const dptos = APP_CONFIG.NOVEDADES?.DEPARTAMENTOS || [];
    
    if (dptoSelect) {
        dptoSelect.innerHTML = '<option value="" selected disabled>...</option>';
        dptos.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            dptoSelect.appendChild(opt);
        });
    }

    if (filterDpto) {
        filterDpto.innerHTML = '<option value="">Todos los Dptos</option>';
        dptos.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            filterDpto.appendChild(opt);
        });
    }

    // Configurar botón de impresión
    document.getElementById('btnImprimirPrecios')?.addEventListener('click', imprimirPrecios);

    // CONFIGURAR DELEGACIÓN GLOBAL DE EVENTOS (Unica vez)
    const container = document.getElementById('lista-precios-container');
    if (container && !container.dataset.initialized) {
        container.dataset.initialized = "true";
        
        container.addEventListener('click', (e) => {
            const starBtn = e.target.closest('.btn-toggle-fav');
            if (starBtn) {
                e.preventDefault();
                e.stopPropagation();
                toggleFavoritoPrecio(starBtn.dataset.id);
                return;
            }

            const deleteBtn = e.target.closest('.btn-delete-precio');
            if (deleteBtn) {
                e.preventDefault();
                e.stopPropagation();
                eliminarPrecio(deleteBtn.dataset.id);
                return;
            }

            const iconBox = e.target.closest('.price-icon-box');
            if (iconBox && modoEdicionPrecios) {
                const productId = iconBox.dataset.id;
                if (productId) abrirSelectorIconos(null, productId);
                return;
            }
        });

        container.addEventListener('blur', (e) => {
            if (e.target.hasAttribute('contenteditable')) {
                const card = e.target.closest('.price-card');
                const productId = card?.querySelector('.btn-toggle-fav')?.dataset.id;
                const field = e.target.dataset.field;
                if (productId && field) {
                    guardarPrecio(productId, field, e.target.innerText.trim());
                }
            }
        }, true);
    }

    renderPrecios();
}

// ==========================================
// 2. HANDLERS & ACCIONES
// ==========================================

/**
 * MODO EDICIÓN
 * Permite desbloquear el grid de precios para realizar cambios directos.
 * Requiere contraseña de administrador.
 */
export async function toggleEdicionPrecios() {
    if (modoEdicionPrecios) {
        modoEdicionPrecios = false;
        renderPrecios();
    } else {
        const pass = await Ui.showPrompt("🔒 Contraseña de administrador:", "password");
        if (pass === PASSWORD_EDICION) {
            modoEdicionPrecios = true;
            renderPrecios();
        } else if (pass !== null) {
            Ui.showToast("Contraseña incorrecta", "danger");
        }
    }
}

export function agregarPrecio(e) {
    e.preventDefault();
    const nombre = document.getElementById('new-precio-nombre').value;
    const precio = document.getElementById('new-precio-valor').value;
    const icono = document.getElementById('new-precio-icon').value;
    const comentario = document.getElementById('new-precio-comentario').value;
    const departamento = document.getElementById('new-precio-departamento').value;
    const favorito = document.getElementById('new-precio-fav').checked;

    if (nombre && precio) {
        preciosService.savePrecio({
            id: Date.now(),
            nombre,
            precio,
            icono,
            comentario,
            departamento: departamento || 'General',
            favorito: favorito
        });
        e.target.reset();
        // Restaurar valores por defecto manuales si el reset no lo hace todo
        document.getElementById('new-precio-departamento').value = "";
        document.getElementById('new-precio-icon').value = "📦";
        renderPrecios();
    }
}

export async function eliminarPrecio(id) {
    if (await Ui.showConfirm("¿Eliminar este producto de la lista?")) {
        await preciosService.deletePrecio(id);
        renderPrecios();
    }
}

export async function toggleFavoritoPrecio(id) {
    await preciosService.toggleFavorito(id);
    renderPrecios();
}

export function guardarPrecio(id, campo, valor) {
    const p = preciosService.getPrecioById(id);
    if (p) {
        p[campo] = valor.trim();
        
        // NORMALIZACIÓN DE EMERGENCIA (Prevenir errores de validación en datos legado)
        p.nombre = p.nombre || p.concepto || "Sin nombre";
        p.departamento = p.departamento || "Recepción";
        if (p.favorito === undefined) p.favorito = true;
        if (p.comentario === undefined) p.comentario = p.descripcion || "";

        // Asegurar que el precio sea numérico para el validador
        if (campo === 'precio') {
            const num = parseFloat(valor.trim().replace(',', '.'));
            p.precio = isNaN(num) ? 0 : num;
        }

        preciosService.savePrecio(p);
    }
}

// ==========================================
// 3. RENDERIZADO
// ==========================================

/**
 * DIBUJAR LISTA DE PRECIOS
 * Renderiza el catálogo ordenado (favoritos primero).
 * Si el modo edición está activo, habilita 'contenteditable' en los campos.
 */
function renderPrecios() {
    const container = document.getElementById('lista-precios-container');
    const formAdd = document.getElementById('form-add-precio-container');
    const btnText = document.getElementById('btn-text-precios');
    const iconLock = document.getElementById('icon-lock-precios');

    if (!container) return;

    // Obtener estados de los filtros
    const textoFiltro = document.getElementById('search-precios-modulo')?.value.toLowerCase() || "";
    const dptoFiltro = document.getElementById('filter-precios-departamento')?.value || "";
    const soloFavs = document.getElementById('filter-precios-fav')?.classList.contains('active');

    // Normalizar estilos del padre para evitar doble scroll
    if (container.parentElement) {
        container.parentElement.style.maxHeight = 'none';
        container.parentElement.style.overflow = 'visible';
        container.parentElement.classList.remove('overflow-auto');
    }

    let precios = preciosService.getPrecios();

    // -- APLICAR FILTROS MULTI-CRITERIO --
    precios = precios.filter(p => {
        // 1. Filtro por Texto (Nombre + Comentario/Descripción)
        const nombreStr = (p.nombre || p.concepto || "").toLowerCase();
        const comentarioStr = (p.comentario || p.descripcion || "").toLowerCase();
        
        const matchTexto = !textoFiltro || 
            nombreStr.includes(textoFiltro) || 
            comentarioStr.includes(textoFiltro);
        
        // 2. Filtro por Departamento
        let matchDpto = true;
        if (dptoFiltro) {
            if (!p.departamento) {
                matchDpto = false;
            } else {
                const itemDept = p.departamento.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                const filterDept = dptoFiltro.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                matchDpto = itemDept === filterDept;
            }
        }

        // 3. Filtro por Favorito
        const matchFav = !soloFavs || p.favorito;

        return matchTexto && matchDpto && matchFav;
    });

    // Ordenar: Favoritos primero, luego alfabético
    precios.sort((a, b) => {
        if (a.favorito !== b.favorito) return b.favorito - a.favorito;
        return a.nombre.localeCompare(b.nombre);
    });

    // Renderizar Grid
    container.className = 'row g-3 no-print';
    container.innerHTML = '';

    // Check for duplicate IDs for debugging
    const idMap = {};
    precios.forEach(p => {
        if (idMap[p.id]) console.error(`[Precios] Duplicate ID found: ${p.id} (${p.nombre})`);
        idMap[p.id] = true;
    });

    if (precios.length === 0) {
        container.innerHTML = '<div class="col-12"><div class="p-5 text-center text-muted">No hay productos registrados o encontrados.</div></div>';
    } else {
        // Construct HTML string once
        container.innerHTML = precios.map(p => {
            // DATA NORMALIZATION (Legacy support)
            p.nombre = p.nombre || p.concepto || "Sin nombre";
            p.comentario = p.comentario || p.descripcion || ""; 
            
            const favClass = p.favorito ? 'text-warning' : 'text-muted opacity-25';
            const editable = modoEdicionPrecios ? 'contenteditable="true"' : '';
    
            // Determinar icono
            const esImagen = p.icono && (p.icono.includes('/') || p.icono.includes('.') || p.icono.startsWith('data:image'));
            const iconoHtml = esImagen
                ? `<img src="${p.icono}" alt="icon" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
                : `<span>${p.icono || '📦'}</span>`;
    
            return `
                <div class="col-md-6 col-lg-4 col-xl-3">
                    <div class="card h-100 border-0 shadow-sm price-card p-3 position-relative" data-id="${p.id}">
                        <button class="btn btn-link p-0 position-absolute top-0 end-0 mt-2 me-2 ${favClass} btn-toggle-fav" data-id="${p.id}"><i class="bi bi-star-fill"></i></button>
                        
                        <div class="d-flex align-items-center gap-3 h-100">
                            <div class="price-icon-box shadow-sm overflow-hidden position-relative" data-id="${p.id}" style="cursor: ${modoEdicionPrecios ? 'pointer' : 'default'}">
                                ${iconoHtml}
                                ${modoEdicionPrecios ? '<div class="position-absolute top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-center justify-content-center text-white opacity-0 hover-opacity-100"><i class="bi bi-pencil-fill small"></i></div>' : ''}
                            </div>
                            
                            <div class="flex-grow-1">
                                <span class="badge bg-light text-secondary border mb-1" style="font-size: 0.65rem;">${p.departamento || 'General'}</span>
                                <div class="fw-bold text-dark mb-1" ${editable} data-field="nombre">${p.nombre}</div>
                                <div class="small text-muted lh-sm mb-2" style="font-size: 0.8rem;" ${editable} data-field="comentario">${p.comentario || 'Sin descripción'}</div>
                                <div class="fw-bold text-primary fs-5"><span ${editable} data-field="precio">${p.precio}</span>€</div>
                            </div>
                            
                            ${modoEdicionPrecios ? `<button class="btn btn-light text-danger btn-sm position-absolute bottom-0 end-0 mb-2 me-2 btn-delete-precio" data-id="${p.id}"><i class="bi bi-trash"></i></button>` : ''}
                        </div>
                    </div>
                </div>`;
        }).join('');
    }

    // Renderizar Impresión (Tabla limpia)
    const tablaPrint = document.getElementById('tabla-precios-print');
    if (tablaPrint) {
        tablaPrint.innerHTML = precios.map(p => {
            const esImg = p.icono && (p.icono.includes('/') || p.icono.includes('.') || p.icono.startsWith('data:image'));
            const iconHtml = esImg
                ? `<img src="${p.icono}" alt="icon" style="width: 32px; height: 32px; object-fit: cover; border-radius: 50%;">`
                : `<span>${p.icono || '📦'}</span>`;

            return `
            <tr>
                <td class="text-center fs-4">${iconHtml}</td>
                <td class="fw-bold">${p.nombre}</td>
                <td class="text-muted small">${p.comentario || ''}</td>
                <td class="text-end fw-bold">${p.precio}€</td>
            </tr>`;
        }).join('');
    }

    // Actualizar UI según modo edición
    if (modoEdicionPrecios) {
        formAdd?.classList.remove('d-none');
        if (btnText) btnText.innerText = "Salir Edición";
        if (iconLock) iconLock.className = "bi bi-unlock-fill me-1";
    } else {
        formAdd?.classList.add('d-none');
        if (btnText) btnText.innerText = "Editar Lista";
        if (iconLock) iconLock.className = "bi bi-lock-fill me-1";
    }
}

// ==========================================
// 4. LÓGICA DE ICONOS (Migrada a IconSelector.js)
// ==========================================

export function abrirSelectorIconos(inputId = null, productId = null) {
    if (productId) {
        IconSelector.open(null, (value) => {
            guardarPrecio(productId, 'icono', value);
            renderPrecios();
        });
    } else {
        IconSelector.open(inputId);
    }
}

// ==========================================
// 5. IMPRESIÓN
// ==========================================

function imprimirPrecios() {
    if (window.PrintService) {
        const rows = document.getElementById('tabla-precios-print').innerHTML;
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Lista de Precios</title>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: #f8f9fa; padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6; }
                    td { padding: 8px; border-bottom: 1px solid #dee2e6; }
                    .text-end { text-align: right; }
                    .text-center { text-align: center; }
                    h1 { color: #0d6efd; margin-bottom: 5px; }
                </style>
            </head>
            <body>
                <h1>Lista de Precios</h1>
                <p style="color: #666; margin-bottom: 20px;">Hotel Garoé - ${Utils.getTodayISO()}</p>
                
                <table>
                    <thead>
                        <tr>
                            <th width="50" class="text-center">Ícono</th>
                            <th>Nombre</th>
                            <th>Descripción</th>
                            <th width="80" class="text-end">Precio</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </body>
            </html>
        `;
        PrintService.printHTML(html);
    } else {
        const user = Utils.validateUser();
        if (!user) return;
        Utils.printSection('print-date-precios', 'print-repc-nombre-precios', user);
    }
}

// Exportaciones para el HTML (OnClicks)
window.toggleEdicionPrecios = toggleEdicionPrecios;
window.agregarPrecio = agregarPrecio;
window.eliminarPrecio = eliminarPrecio;
window.toggleFavoritoPrecio = toggleFavoritoPrecio;
window.guardarPrecio = guardarPrecio;
window.imprimirPrecios = imprimirPrecios;
window.abrirSelectorIconos = abrirSelectorIconos;
window.seleccionarIcono = (v) => IconSelector.select(v); 
window.procesarImagenSubida = (i) => IconSelector.handleFileUpload(i);
