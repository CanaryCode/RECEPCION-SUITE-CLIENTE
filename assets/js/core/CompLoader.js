/**
 * SISTEMA DE CARGA DE COMPONENTES (CompLoader)
 * ------------------------------------------
 * Para mantener el archivo index.html limpio, cada módulo (Agenda, Riu, etc.)
 * tiene su propio archivo HTML en la carpeta 'assets/templates'.
 *
 * MAPA DE COMPONENTES (para referencia):
 * 'lost-found': { html: 'assets/templates/lost_found.html', js: 'assets/js/modules/lost_found.js', module: 'lostFoundModule' },
 * 'excursiones': { html: 'assets/templates/excursiones.html', js: 'assets/js/modules/excursiones.js', module: 'Excursiones' }
 *
 * Este módulo se encarga de leer esos archivos e inyectarlos en la página.
 */

import { APP_CONFIG } from './Config.js?v=V153_DB_CONFIG';

export const CompLoader = {
    /**
     * Carga un único archivo HTML dentro de un contenedor (div).
     * @param {string} id - El ID del div donde se meterá el HTML.
     * @param {string} path - La ruta del archivo .html a cargar.
     */
    loadComponent: async (id, path, retries = 2) => {
        try {
            const container = document.getElementById(id);
            if (!container) return;

            let lastError = null;
            for (let i = 0; i <= retries; i++) {
                try {
                    const response = await fetch(`${path}?v=${APP_CONFIG.VERSION || 'V112'}`);
                    if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
                    
                    const html = await response.text();
                    container.innerHTML = html;
                    return; // Éxito
                } catch (err) {
                    lastError = err;
                    if (i < retries) {
                        console.warn(`CompLoader: Reintentando [${id}] (${i + 1}/${retries})...`);
                        await new Promise(r => setTimeout(r, 500 * (i + 1)));
                    }
                }
            }
            throw lastError;
        } catch (error) {
            console.error(`Error crítico cargando el componente [${id}]:`, error);
        }
    },

    /**
     * CARGADOR MASIVO
     * Carga una lista completa de componentes en paralelo.
     * @param {Array<{id: string, path: string}>} components - Lista de objetos id/ruta.
     */
    loadAll: async (components) => {
        // Ejecutamos todas las cargas al mismo tiempo para que la app arranque más rápido
        const promises = components.map(comp => CompLoader.loadComponent(comp.id, comp.path));
        await Promise.all(promises);
    }
};
