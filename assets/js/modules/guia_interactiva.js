import { Api } from '../core/Api.js';
import { Ui } from '../core/Ui.js';

/**
 * MÓDULO DE GUÍA INTERACTIVA DE USUARIO
 * ------------------------------------
 * Maneja la visualización de guías y manuales de uso para cada módulo de la app.
 * Implementa filtrado por categorías y búsqueda en tiempo real.
 */

let allGuiaData = [];
let filteredData = [];
let currentCategory = 'shortcuts';

export const GuiaInteractiva = {
    async inicializar() {
        console.log('[GuiaInteractiva] Inicializando...');
        
        try {
            // 1. Cargar Datos desde la Base de Datos
            allGuiaData = await Api.get('guia');
            if (!allGuiaData) throw new Error('No se pudo cargar los datos de la guía desde la base de datos.');

            // 2. Configurar Eventos de UI
            this.setupEvents();

            // 3. Render Inicial
            this.filterByCategory(currentCategory);

            // 4. Inicializar Tooltips (para los iconos de la toolbar)
            if (window.bootstrap) {
                const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
                tooltipTriggerList.map(function (tooltipTriggerEl) {
                    return new bootstrap.Tooltip(tooltipTriggerEl)
                })
            }
            
        } catch (error) {
            console.error('[GuiaInteractiva] Error en inicialización:', error);
            const grid = document.getElementById('guiaGrid');
            if (grid) grid.innerHTML = `<div class="col-12 text-center py-5 text-danger"><i class="bi bi-exclamation-triangle fs-1"></i><p>Error al cargar la guía: ${error.message}</p></div>`;
        }
    },

    setupEvents() {
        // Evento de Búsqueda
        document.getElementById('guiaSearch')?.addEventListener('input', (e) => {
            this.search(e.target.value);
        });

        // Eventos de Categoría (Usando los nuevos botones outline)
        document.querySelectorAll('#guiaCategories .btn-outline-primary').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.category;
                if (!category) return;

                // UI Update
                document.querySelectorAll('#guiaCategories .btn-outline-primary').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');

                this.filterByCategory(category);
            });
        });
    },

    filterByCategory(category) {
        currentCategory = category;
        filteredData = allGuiaData.filter(item => item.category === category);
        this.render();
    },

    search(query) {
        const q = query.toLowerCase().trim();
        if (!q) {
            this.filterByCategory(currentCategory);
            return;
        }

        filteredData = allGuiaData.filter(item => 
            item.title.toLowerCase().includes(q) || 
            item.description.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q)
        );
        this.render();
    },

    render() {
        const grid = document.getElementById('guiaGrid');
        if (!grid) return;

        grid.innerHTML = '';

        if (filteredData.length === 0) {
            grid.innerHTML = '<div class="col-12 text-center py-5 text-muted"><i class="bi bi-search fs-1 mb-3"></i><p>No se encontraron resultados para tu búsqueda.</p></div>';
            return;
        }

        filteredData.forEach(item => {
            const col = document.createElement('div');
            col.className = 'col-md-6 col-lg-4 animate__animated animate__zoomIn';
            col.innerHTML = `
                <div class="card h-100 border-0 shadow-sm help-card p-3" onclick="window.GuiaInteractiva.verDetalle('${item.id}')">
                    <div class="card-body">
                        <div class="icon-wrapper">
                            <i class="bi bi-${item.icon}"></i>
                        </div>
                        <h4 class="help-card-title">${item.title}</h4>
                        <p class="help-card-text">${item.description}</p>
                        <div class="text-primary fw-bold small mt-3">
                            Ver detalles <i class="bi bi-arrow-right ms-1"></i>
                        </div>
                    </div>
                </div>
            `;
            grid.appendChild(col);
        });
    },

    verDetalle(id) {
        const item = allGuiaData.find(i => i.id === id);
        if (!item) return;

        const content = document.getElementById('guiaDetalleContent');
        if (!content) return;

        const useCasesHtml = item.use_cases.map(uc => `
            <div class="use-case-item animate__animated animate__fadeInLeft" style="animation-delay: 0.1s">
                <i class="bi bi-check2-circle text-primary me-2"></i> ${uc}
            </div>
        `).join('');

        const considerationsHtml = item.considerations.map(c => `
            <div class="consideration-item animate__animated animate__fadeInLeft" style="animation-delay: 0.2s">
                <i class="bi bi-exclamation-circle-fill"></i>
                <div>${c}</div>
            </div>
        `).join('');

        content.innerHTML = `
            <div class="text-center mb-4 mt-2">
                <div class="icon-wrapper mx-auto" style="width: 80px; height: 80px; font-size: 2.5rem; background: rgba(13, 110, 253, 0.1); color: #0d6efd; border-radius: 20px; display: flex; align-items: center; justify-content: center;">
                    <i class="bi bi-${item.icon}"></i>
                </div>
                <h3 class="fw-bold mt-3 mb-1">${item.title}</h3>
                <p class="text-muted">${item.description}</p>
            </div>

            <div class="detail-section mb-4">
                <div class="detail-section-title">
                    <i class="bi bi-lightbulb-fill"></i> Casos de Uso
                </div>
                <div class="ps-1">
                    ${useCasesHtml}
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="bi bi-shield-exclamation"></i> Cosas a tener en cuenta
                </div>
                <div class="ps-1">
                    ${considerationsHtml}
                </div>
            </div>
        `;

        const modalEl = document.getElementById('modalGuiaDetalle');
        if (modalEl) {
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
        }
    },

    imprimir() {
        console.log('[GuiaInteractiva] Iniciando impresión...');
        // Simplemente lanzamos el print del navegador. 
        // El CSS (no-print) ya se encargará de ocultar botones y buscadores.
        window.print();
    }
};

// Exponer globalmente para eventos inline
window.GuiaInteractiva = GuiaInteractiva;
