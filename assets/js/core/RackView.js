import { APP_CONFIG } from './Config.js';

/**
 * VISTA STANDARD DE RACK (RackView)
 * --------------------------------
 * Abstracción para pintar el estado de las habitaciones organizado por plantas.
 * Evita la duplicidad de lógica de bucles sobre APP_CONFIG.HOTEL.STATS_CONFIG.RANGOS.
 */
export const RackView = {

    /**
     * RENDERIZAR RACK
     * @param {string} containerId - ID del contenedor HTML
     * @param {Function} itemRenderer - Función (numHabitacion) => String HTML
     * @param {Function} floorRenderer - (Opcional) Función (planta) => String HTML Header
     * @param {Function} floorFilter - (Opcional) Función (planta, habitacionesDePlanta) => boolean. Si devuelve true, se renderiza la planta.
     * @param {Array} filteredRoomList - (Opcional) Lista de habitaciones válidas. SI se pasa, solo se iterarán estas o se usarán para filtrar.
     */
    render: (containerId, itemRenderer, floorRenderer = null, floorFilter = null) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const rangos = APP_CONFIG.HOTEL.STATS_CONFIG.RANGOS;
        if (!rangos) {
            container.innerHTML = '<div class="alert alert-warning">Configuración de hotel (RANGOS) no encontrada.</div>';
            return;
        }

        let html = '';
        
        rangos.forEach(r => {
            // Generar contenido de la planta en memoria primero para ver si está vacío
            const floorContent = [];
            for (let i = r.min; i <= r.max; i++) {
                const num = i.toString().padStart(3, '0');
                const itemHtml = itemRenderer(num);
                if (itemHtml) { // Si el renderer devuelve null/vacío, lo ignoramos
                    floorContent.push(itemHtml);
                }
            }

            // Aplicar filtros de planta (ej: si está vacía no mostrar)
            // Por defecto, si floorFilter es null, mostramos siempre que haya habitaciones o sea standard
            let shouldShowFloor = true;
            if (floorFilter) {
                shouldShowFloor = floorFilter(r.planta, floorContent);
            } else {
                // Comportamiento "Smart": Si el renderer devolvió items, mostramos.
                // Si la vista es "General" (Atenciones), suele quererse ver todo.
                // Si devolvió items específicos (filtro Rack), mostramos.
                // ASUNCIÓN: Si itemRenderer devuelve null para todos, es una planta vacía por filtro.
                if (floorContent.length === 0 && itemRenderer.length > 0) shouldShowFloor = false; 
            }

            if (shouldShowFloor && floorContent.length > 0) {
                 html += `<div class="rack-floor-container" data-planta="${r.planta}">`;
                 
                 // Render Header Planta
                if (floorRenderer) {
                    html += floorRenderer(r.planta);
                } else {
                    html += `
                    <div class="w-100 mt-3 mb-2 d-flex align-items-center">
                        <span class="badge bg-secondary me-2">Planta ${r.planta}</span>
                        <hr class="flex-grow-1 my-0 opacity-25">
                    </div>`;
                }
                
                // Render Habitaciones
                html += '<div class="d-flex flex-wrap gap-2 justify-content-center">';
                html += floorContent.join('');
                html += '</div>';
                
                html += '</div>'; // End rack-floor-container
            }
        });

        container.innerHTML = html;
        
        // Auto-inicializar tooltips si Bootstrap está presente
        if (window.bootstrap && window.bootstrap.Tooltip) {
             const tooltips = container.querySelectorAll('[data-bs-toggle="tooltip"]');
             [...tooltips].forEach(t => bootstrap.Tooltip.getOrCreateInstance(t));
        }
    }
};
