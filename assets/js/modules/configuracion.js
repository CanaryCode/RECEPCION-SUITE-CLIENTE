import { APP_CONFIG } from '../core/Config.js';
import { Utils } from '../core/Utils.js';
import { Ui } from '../core/Ui.js';

import { IconSelector } from '../core/IconSelector.js';
import { MediaPicker } from '../core/MediaPicker.js';
import { Api } from '../core/Api.js';
import { configService } from '../services/ConfigService.js';
import { Spotify } from './spotify.js';

let moduloInicializado = false;
let tempConfig = null;
let pendingAccordionButton = null;

/**
 * MÓDULO DE CONFIGURACIÓN DEL SISTEMA (configuracion.js)
 */
export const Configurator = {
    /**
     * INICIALIZACIÓN
     */
    async inicializar() {
        console.log("Configurator.inicializar() CALLED");
        // NO renderizar aquí - solo cuando el usuario navegue al panel
        // this.renderInterfaz();
        this.initPinProtection();
        if (moduloInicializado) return;
        this.configurarEventos();

        // Renderizar cuando se active el panel de configuración
        const configPanel = document.getElementById('configuracion-content');
        if (configPanel) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.target.classList.contains('active')) {
                        this.renderInterfaz();
                        observer.disconnect(); // Solo renderizar una vez
                    }
                });
            });
            observer.observe(configPanel, { attributes: true, attributeFilter: ['class'] });
        }

        moduloInicializado = true;
    },

    /**
     * RENDERIZADO DE LA INTERFAZ
     */
    renderInterfaz() {
        try {
            try {
                tempConfig = JSON.parse(JSON.stringify(APP_CONFIG));
            } catch (e) {
                console.error("Error cloning config:", e);
                tempConfig = {};
            }

            if (!tempConfig || typeof tempConfig !== 'object') tempConfig = {};
            if (tempConfig.HOTEL && typeof tempConfig.HOTEL !== 'object') tempConfig.HOTEL = {};
            if (tempConfig.SYSTEM && typeof tempConfig.SYSTEM !== 'object') tempConfig.SYSTEM = {};
            if (tempConfig.NOVEDADES && typeof tempConfig.NOVEDADES !== 'object') tempConfig.NOVEDADES = {};
            if (tempConfig.TRANSFERS && typeof tempConfig.TRANSFERS !== 'object') tempConfig.TRANSFERS = {};

            this.verificarEstructuras();

            // Campos básicos
            Utils.setVal('conf_hotel_nombre', tempConfig.HOTEL?.NOMBRE || '');
            Utils.setVal('conf_work_mode', tempConfig.SYSTEM?.MODE || 'local');
            Utils.setVal('conf_api_url', tempConfig.SYSTEM?.API_URL || '');
            this.onWorkModeChange(tempConfig.SYSTEM?.MODE || 'local'); // Ajustar visibilidad

            Utils.setVal('conf_admin_pass', tempConfig.SYSTEM?.ADMIN_PASSWORD || '');
            Utils.setVal('conf_safe_precio', tempConfig.SAFE?.PRECIO_DIARIO || 2.00);
            Utils.setVal('conf_caja_fondo', tempConfig.CAJA?.FONDO !== undefined ? tempConfig.CAJA.FONDO : -2000.00);
            Utils.setVal('conf_gallery_path', tempConfig.SYSTEM?.GALLERY_PATH || 'assets/gallery');
            Utils.setVal('conf_sync_interval', tempConfig.SYSTEM?.SYNC_INTERVAL || 10000);
            Utils.setVal('conf_cocktail_dia', tempConfig.HOTEL?.COCKTAIL_CONFIG?.DIA !== undefined ? tempConfig.HOTEL.COCKTAIL_CONFIG.DIA : 5);
            Utils.setVal('conf_cocktail_hora', tempConfig.HOTEL?.COCKTAIL_CONFIG?.HORA || '19:00');

            // Listas dinámicas
            this.renderCocktailLugares();
            this.renderRecepcionistas(); // Se inicia la carga asíncrona
            this.renderDestinosTransfers();
            this.renderDepartamentosGlobal();
            this.renderAppLaunchers();
            this.renderGalleryFolders();
            this.renderRangos();
            this.renderFiltros('TIPOS', 'list-filtros-tipos');
            this.renderFiltros('VISTAS', 'list-filtros-vistas');
            this.renderFiltros('CARACTERISTICAS', 'list-filtros-carac');
            this.renderExcursionesCatalogo();
            this.renderInstalaciones();
            this.renderTourOperators();
            Spotify.renderConfig(tempConfig);
            this.renderValoracionPrecios();
            this.renderValoracionSuplIndiv();
            this.renderValoracionDescTriple();
            this.renderValoracionSuplNino();

            // Cargar módulo de actualizaciones
            this.loadActualizacionesModule();
        } catch (err) {
            console.error("FATAL ERROR in Configurator.renderInterfaz:", err);
            Ui.showToast("Error crítico cargando configuración: " + err.message, "danger");
            if (confirm("Error cargando configuración. ¿Desea resetear la configuración local para intentar arreglarlo?")) {
                localStorage.removeItem('app_config_override');
                location.reload();
            }
        }
    },

    verificarEstructuras() {
        if (!tempConfig.HOTEL) tempConfig.HOTEL = { RECEPCIONISTAS: [] };
        if (!tempConfig.HOTEL.RECEPCIONISTAS) tempConfig.HOTEL.RECEPCIONISTAS = [];
        if (!tempConfig.CAJA) tempConfig.CAJA = { BILLETES: [], MONEDAS: [], FONDO: -2000 };
        if (!tempConfig.TRANSFERS) tempConfig.TRANSFERS = { DESTINOS: [] };
        if (!tempConfig.NOVEDADES) tempConfig.NOVEDADES = { DEPARTAMENTOS: [] };
        if (!tempConfig.NOVEDADES.DEPARTAMENTOS) tempConfig.NOVEDADES.DEPARTAMENTOS = [];
        if (!tempConfig.SYSTEM) tempConfig.SYSTEM = { API_URL: '/api' };
        if (!tempConfig.HOTEL.STATS_CONFIG) tempConfig.HOTEL.STATS_CONFIG = { RANGOS: [], FILTROS: {} };
        if (!tempConfig.HOTEL.STATS_CONFIG.FILTROS) tempConfig.HOTEL.STATS_CONFIG.FILTROS = { TIPOS: [], VISTAS: [], CARACTERISTICAS: [] };
        if (!tempConfig.EXCURSIONES_CATALOGO) tempConfig.EXCURSIONES_CATALOGO = [];
        if (!tempConfig.HOTEL.INSTALACIONES) tempConfig.HOTEL.INSTALACIONES = [];
        if (!tempConfig.HOTEL.ALARMAS_SISTEMA) tempConfig.HOTEL.ALARMAS_SISTEMA = [];
        if (!tempConfig.AGENDA) tempConfig.AGENDA = { PAISES: [] };
        if (!tempConfig.COBRO) tempConfig.COBRO = { VALORES: [] };
        if (!tempConfig.HOTEL.COCKTAIL_CONFIG) tempConfig.HOTEL.COCKTAIL_CONFIG = { DIA: 5, HORA: '19:00' };
        if (!tempConfig.HOTEL.TO_LISTS) tempConfig.HOTEL.TO_LISTS = { ES: [], DE: [], FR: [], UK: [] };
        if (!tempConfig.HOTEL.SPOTIFY_PLAYLISTS) tempConfig.HOTEL.SPOTIFY_PLAYLISTS = [];
        if (!tempConfig.HOTEL.COCKTAIL_LUGARES) tempConfig.HOTEL.COCKTAIL_LUGARES = [];
        if (!tempConfig.VALORACION) tempConfig.VALORACION = { PRECIOS: [] };
        if (!tempConfig.VALORACION.PRECIOS) tempConfig.VALORACION.PRECIOS = [];
        if (!tempConfig.VALORACION.SUPLEMENTOS_INDIVIDUAL) tempConfig.VALORACION.SUPLEMENTOS_INDIVIDUAL = [];
        if (!tempConfig.VALORACION.DESCUENTOS_TRIPLE) tempConfig.VALORACION.DESCUENTOS_TRIPLE = [];
        if (!tempConfig.VALORACION.SUPLEMENTOS_NINO) tempConfig.VALORACION.SUPLEMENTOS_NINO = [];

        if (!tempConfig.SYSTEM.LAUNCHERS || tempConfig.SYSTEM.LAUNCHERS.length === 0) {
            tempConfig.SYSTEM.LAUNCHERS = [
                { label: 'Spotify', path: 'https://open.spotify.com/', type: 'url', icon: 'spotify', embedded: true },
                { label: 'Google Maps', path: 'https://www.google.com/maps', type: 'maps', icon: 'geo-alt-fill', embedded: true },
                { label: 'WhatsApp', path: 'https://web.whatsapp.com/', type: 'url', icon: 'whatsapp', embedded: true },
                { label: 'El Tiempo', path: 'https://www.eltiempo.es/', type: 'url', icon: 'cloud-sun', embedded: true }
            ];
        }
    },

    // --- RENDERERS ---

    async renderRecepcionistas() {
        try {
            const data = await Api.get('storage/recepcionistas');
            const list = Array.isArray(data) ? data.map(u => typeof u === 'string' ? u : u.nombre) : [];
            tempConfig.HOTEL.RECEPCIONISTAS = list;

            Ui.renderTable('config-recepcionistas-list', list, (nombre) => `
                <div class="badge bg-light text-dark border p-2 d-flex align-items-center">
                    <span class="fs-6 text-truncate me-2" style="max-width: 150px;">${nombre}</span>
                    <button type="button" class="btn btn-link link-primary p-0 text-decoration-none me-2" onclick="Configurator.editRecepcionista('${nombre}')" title="Editar"><i class="bi bi-pencil-square"></i></button>
                    <button type="button" class="btn-close" style="width: 0.5em; height: 0.5em;" onclick="Configurator.removeRecepcionista('${nombre}')" title="Eliminar"></button>
                </div>
            `);
        } catch (e) {
            console.error("Error loading receptionists:", e);
            Ui.renderTable('config-recepcionistas-list', [], () => '');
        }
    },

    renderDestinosTransfers() {
        Ui.renderTable('list-destinos-transfers', tempConfig.TRANSFERS.DESTINOS, (d) => `
            <div class="badge bg-light text-dark border p-2 d-flex align-items-center">
                <span class="fs-6 me-2 text-truncate" style="max-width: 150px;">${d}</span>
                <button type="button" class="btn btn-link link-primary p-0 text-decoration-none me-2" onclick="Configurator.editDestinoTransfer('${d}')" title="Editar"><i class="bi bi-pencil-square"></i></button>
                <button type="button" class="btn-close" style="width: 0.5em; height: 0.5em;" onclick="Configurator.removeDestinoTransfer('${d}')" title="Eliminar"></button>
            </div>
        `);
    },

    renderDepartamentosGlobal() {
        Ui.renderTable('list-departamentos-global', tempConfig.NOVEDADES.DEPARTAMENTOS, (d) => `
            <div class="badge bg-white text-primary border p-2 d-flex align-items-center shadow-sm">
                <i class="bi bi-tag-fill me-2 small opacity-50"></i>
                <span class="fs-6 me-2 text-truncate" style="max-width: 150px;">${d}</span>
                <button type="button" class="btn btn-link link-primary p-0 text-decoration-none me-2" onclick="Configurator.editDepartamentoGlobal('${d}')" title="Editar"><i class="bi bi-pencil-square"></i></button>
                <button type="button" class="btn-close" style="width: 0.5em; height: 0.5em;" onclick="Configurator.removeDepartamentoGlobal('${d}')" title="Eliminar"></button>
            </div>
        `);
    },

    renderAppLaunchers() {
        Ui.renderTable('list-app-launchers', tempConfig.SYSTEM.LAUNCHERS, (l, index) => {
            const isImage = l.icon && (l.icon.startsWith('data:') || l.icon.includes('.') || l.icon.includes('/'));
            const iconHtml = isImage
                ? `<img src="${l.icon}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 12px;" class="me-3 shadow-sm">`
                : `<i class="bi bi-${l.icon || 'box-arrow-up-right'}" style="font-size: 2.2rem; color: #444;" class="me-3"></i>`;

            return `
            <div class="col-md-6 mb-2">
                <div class="border rounded p-2 d-flex align-items-center justify-content-between bg-white shadow-sm">
                    <div class="d-flex align-items-center text-truncate">
                        ${iconHtml}
                        <div class="text-truncate">
                            <div class="fw-bold small text-truncate">
                                ${l.type === 'folder'
                    ? '<span class="badge bg-warning-subtle text-warning border-warning border-opacity-25 me-1" style="font-size: 0.5rem;">CARPETA</span>'
                    : (l.type === 'url' ? '<span class="badge bg-success-subtle text-success border-success border-opacity-25 me-1" style="font-size: 0.5rem;">WEB</span>'
                        : (l.type === 'maps' ? '<span class="badge bg-danger-subtle text-danger border-danger border-opacity-25 me-1" style="font-size: 0.5rem;">MAPAS</span>'
                            : (l.type === 'documentos' ? '<span class="badge bg-info-subtle text-info border-info border-opacity-25 me-1" style="font-size: 0.5rem;">DOCS</span>'
                                : '<span class="badge bg-info-subtle text-info border-info border-opacity-25 me-1" style="font-size: 0.5rem;">APP / ARCHIVO</span>')))}
                                ${l.label}
                            </div>
                            <div class="text-muted text-truncate" style="font-size: 0.6rem;">${l.path}</div>
                        </div>
                    </div>
                    <div>
                        <button type="button" class="btn btn-sm btn-outline-primary border-0 me-1" onclick="Configurator.editAppLauncher(${index})" title="Editar"><i class="bi bi-pencil"></i></button>
                        <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="Configurator.removeAppLauncher(${index})" title="Eliminar"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>`;
        });
    },

    renderGalleryFolders() {
        if (!tempConfig.SYSTEM.GALLERY_FOLDERS) tempConfig.SYSTEM.GALLERY_FOLDERS = [];
        Ui.renderTable('list-gallery-folders', tempConfig.SYSTEM.GALLERY_FOLDERS, (f, index) => `
            <div class="col-md-6 mb-2">
                <div class="border rounded p-2 d-flex align-items-center justify-content-between bg-white shadow-sm">
                    <div class="d-flex align-items-center text-truncate">
                        <i class="bi bi-images fs-3 text-primary me-3"></i>
                        <div class="text-truncate">
                            <div class="fw-bold small text-truncate">${f.label}</div>
                            <div class="text-muted text-truncate" style="font-size: 0.6rem;">${f.path}</div>
                        </div>
                    </div>
                    <div>
                        <button type="button" class="btn btn-sm btn-outline-primary border-0 me-1" onclick="Configurator.editGalleryFolder(${index})" title="Editar"><i class="bi bi-pencil"></i></button>
                        <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="Configurator.removeGalleryFolder(${index})" title="Eliminar"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>
        `);
    },

    renderRangos(data = null) {
        const list = data || tempConfig.HOTEL.STATS_CONFIG.RANGOS || [];
        let totalRooms = 0;

        Ui.renderTable('config-rangos-table', list, (r, index) => {
            const originalIndex = tempConfig.HOTEL.STATS_CONFIG.RANGOS.indexOf(r);
            totalRooms += (r.max - r.min) + 1;
            return `
             <tr>
                 <td>PB ${r.planta}</td>
                 <td>${r.min}</td>
                 <td>${r.max}</td>
                 <td class="text-end">
                     <button type="button" class="btn btn-outline-primary btn-sm border-0 me-1" onclick="Configurator.editRango(${originalIndex})" title="Editar"><i class="bi bi-pencil"></i></button>
                     <button type="button" class="btn btn-outline-danger btn-sm border-0" onclick="Configurator.removeRango(${originalIndex})" title="Eliminar"><i class="bi bi-trash"></i></button>
                 </td>
             </tr>`;
        });

        const totalDisplay = document.getElementById('total-rooms-count');
        if (totalDisplay) totalDisplay.textContent = totalRooms;

        if (!data) {
            Ui.enableTableSorting('table-rangos', tempConfig.HOTEL.STATS_CONFIG.RANGOS, (sorted) => this.renderRangos(sorted));
        }
    },

    renderFiltros(type, containerId) {
        const list = tempConfig.HOTEL.STATS_CONFIG.FILTROS[type] || [];
        Ui.renderTable(containerId, list, (item) => {
            const label = item.label || item;
            const icon = item.icon || '';
            const isImage = icon && (icon.startsWith('data:') || icon.includes('.') || icon.includes('/'));
            const iconHtml = isImage
                ? `<img src="${icon}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 8px;" class="me-2 shadow-sm">`
                : (icon.length < 5
                    ? `<span class="me-2" style="font-size: 2.22rem; vertical-align: middle;">${icon}</span>`
                    : `<i class="bi bi-${icon} me-2" style="font-size: 2rem; color: #333; vertical-align: middle;"></i>`);

            return `
            <div class="badge bg-white text-secondary border d-flex align-items-center fw-normal shadow-sm p-1 ps-2 pe-2">
                ${iconHtml}
                <span class="me-2 text-truncate" style="max-width: 120px;">${label}</span>
                <button type="button" class="btn-close" style="width: 0.4em; height: 0.4em;" 
                    onclick="Configurator.removeFilter('${type}', '${label}')"></button>
            </div>`;
        });
    },

    renderExcursionesCatalogo(data = null) {
        const list = data || tempConfig.EXCURSIONES_CATALOGO;
        Ui.renderTable('config-excursiones-list', list, (item, index) => {
            const originalIndex = tempConfig.EXCURSIONES_CATALOGO.indexOf(item);
            return `
            <tr>
                <td>
                    <div class="fw-bold">${item.nombre}</div>
                    <div class="small text-muted">${item.operador || 'Sin operador'}</div>
                </td>
                <td>
                    <span class="badge ${item.esTicket ? 'bg-info' : 'bg-primary'} opacity-75">
                        ${item.esTicket ? 'Ticket' : 'Excursión'}
                    </span>
                </td>
                <td class="text-center">
                    <div class="small text-muted">A: ${item.precioAdulto}€</div>
                    <div class="small text-muted">N: ${item.precioNiño || 0}€</div>
                    <div class="small text-muted text-primary">G: ${item.precioGrupo || 0}€</div>
                </td>
                <td class="text-end">
                    <button type="button" class="btn btn-outline-primary btn-sm border-0 me-1" onclick="Configurator.editExcursionAlCatalogo(${originalIndex})" title="Editar"><i class="bi bi-pencil"></i></button>
                    <button type="button" class="btn btn-outline-danger btn-sm border-0" onclick="Configurator.removeExcursionAlCatalogo(${originalIndex})" title="Eliminar"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
        });
        if (!data) {
            Ui.enableTableSorting('table-excursiones', tempConfig.EXCURSIONES_CATALOGO, (sorted) => this.renderExcursionesCatalogo(sorted));
        }
    },

    renderInstalaciones() {
        Ui.renderTable('config-instalaciones-list', tempConfig.HOTEL.INSTALACIONES, (inst, index) => `
            <div class="badge bg-white text-dark border p-2 d-flex align-items-center shadow-sm">
                <i class="bi bi-${inst.icono || 'geo-fill'} me-2 text-primary"></i>
                <div class="text-start me-3">
                    <div class="fw-bold small">${inst.nombre}</div>
                    <div class="text-muted" style="font-size: 0.65rem;">${inst.apertura} - ${inst.cierre}</div>
                </div>
                <button type="button" class="btn btn-link link-primary p-0 text-decoration-none me-2" onclick="Configurator.editInstalacion(${index})" title="Editar"><i class="bi bi-pencil-square"></i></button>
                <button type="button" class="btn-close" style="width: 0.5em; height: 0.5em;" onclick="Configurator.removeInstalacion(${index})" title="Eliminar"></button>
            </div>
        `);
    },

    renderTourOperators() {
        const nacs = [{ id: 'ES' }, { id: 'DE' }, { id: 'FR' }, { id: 'UK' }];
        nacs.forEach(n => {
            const list = tempConfig.HOTEL.TO_LISTS[n.id] || [];
            Ui.renderTable(`list-to-${n.id.toLowerCase()}`, list, (to) => `
                <div class="badge bg-light text-dark border p-2 d-flex align-items-center">
                    <span class="fs-6 me-2 text-truncate" style="max-width: 150px;">${to}</span>
                    <button type="button" class="btn-close" style="width: 0.5em; height: 0.5em;" onclick="Configurator.removeTourOperator('${n.id}', '${to}')"></button>
                </div>
            `);
        });
    },

    renderCocktailLugares() {
        const list = tempConfig.HOTEL.COCKTAIL_LUGARES || [];
        Ui.renderTable('list-cocktail-lugares', list, (item, index) => `
            <tr>
                <td><span class="fw-bold">${item.es}</span></td>
                <td><span class="small text-muted">${item.en || ''}</span></td>
                <td><span class="small text-muted">${item.de || ''}</span></td>
                <td><span class="small text-muted">${item.fr || ''}</span></td>
                <td class="text-center">
                    <div class="form-check form-check-inline m-0">
                        <input class="form-check-input" type="radio" name="lugarDefault" 
                            ${item.default ? 'checked' : ''} 
                            onclick="Configurator.setCocktailLugarDefault(${index})">
                    </div>
                </td>
                <td class="text-end">
                    <button type="button" class="btn btn-outline-primary btn-sm border-0 me-1" onclick="Configurator.editCocktailLugar(${index})" title="Editar"><i class="bi bi-pencil"></i></button>
                    <button type="button" class="btn btn-outline-danger btn-sm border-0" onclick="Configurator.removeCocktailLugar(${index})" title="Eliminar"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `);
    },

    renderSpotifyPlaylists() {
        Spotify.renderConfig(tempConfig);
    },

    renderValoracionPrecios() {
        if (!tempConfig.VALORACION) tempConfig.VALORACION = { PRECIOS: [] };
        Ui.renderTable('list-valoracion-precios', tempConfig.VALORACION.PRECIOS, (item, index) => `
            <div class="col-md-4 mb-2">
                <div class="border rounded p-2 d-flex align-items-center justify-content-between bg-white shadow-sm h-100">
                    <div class="d-flex align-items-center text-truncate">
                        <i class="bi bi-tag-fill fs-5 text-primary me-2"></i>
                        <div class="text-truncate">
                            <div class="fw-bold small text-truncate">${item.label}</div>
                            <div class="badge bg-primary-subtle text-primary" style="font-size: 0.7rem;">${item.valor.toFixed(2)}€ Base</div>
                        </div>
                    </div>
                    <div class="d-flex gap-1">
                        <button type="button" class="btn btn-sm btn-outline-primary border-0" onclick="Configurator.editValoracionPrecio(${index})" title="Editar"><i class="bi bi-pencil-square"></i></button>
                        <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="Configurator.removeValoracionPrecio(${index})" title="Eliminar"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>
        `);
    },

    renderValoracionSuplIndiv() {
        Ui.renderTable('list-valoracion-supl-indiv', tempConfig.VALORACION.SUPLEMENTOS_INDIVIDUAL, (item, index) => `
            <div class="col-md-4 mb-2">
                <div class="border rounded p-2 d-flex align-items-center justify-content-between bg-white shadow-sm h-100">
                    <div class="d-flex align-items-center text-truncate">
                        <i class="bi bi-person-fill fs-5 text-info me-2"></i>
                        <div class="text-truncate">
                            <div class="fw-bold small text-truncate">${item.label}</div>
                            <div class="badge bg-info-subtle text-info" style="font-size: 0.7rem;">+${item.valor.toFixed(2)}€ Supl.</div>
                        </div>
                    </div>
                    <div class="d-flex gap-1">
                        <button type="button" class="btn btn-sm btn-outline-primary border-0" onclick="Configurator.editValoracionSuplIndiv(${index})" title="Editar"><i class="bi bi-pencil-square"></i></button>
                        <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="Configurator.removeValoracionSuplIndiv(${index})" title="Eliminar"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>
        `);
    },

    renderValoracionDescTriple() {
        Ui.renderTable('list-valoracion-desc-triple', tempConfig.VALORACION.DESCUENTOS_TRIPLE, (item, index) => `
            <div class="col-md-4 mb-2">
                <div class="border rounded p-2 d-flex align-items-center justify-content-between bg-white shadow-sm h-100">
                    <div class="d-flex align-items-center text-truncate">
                        <i class="bi bi-people-fill fs-5 text-success me-2"></i>
                        <div class="text-truncate">
                            <div class="fw-bold small text-truncate">${item.label}</div>
                            <div class="badge bg-success-subtle text-success" style="font-size: 0.7rem;">${item.valor < 0 ? '' : '+'}${item.valor.toFixed(2)}€</div>
                        </div>
                    </div>
                    <div class="d-flex gap-1">
                        <button type="button" class="btn btn-sm btn-outline-primary border-0" onclick="Configurator.editValoracionDescTriple(${index})" title="Editar"><i class="bi bi-pencil-square"></i></button>
                        <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="Configurator.removeValoracionDescTriple(${index})" title="Eliminar"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>
        `);
    },

    renderValoracionSuplNino() {
        Ui.renderTable('list-valoracion-supl-nino', tempConfig.VALORACION.SUPLEMENTOS_NINO, (item, index) => `
            <div class="col-md-4 mb-2">
                <div class="border rounded p-2 d-flex align-items-center justify-content-between bg-white shadow-sm h-100">
                    <div class="d-flex align-items-center text-truncate">
                        <i class="bi bi-smartwatch fs-5 text-warning me-2"></i>
                        <div class="text-truncate">
                            <div class="fw-bold small text-truncate">${item.label}</div>
                            <div class="badge bg-warning-subtle text-warning" style="font-size: 0.7rem;">+${item.valor.toFixed(2)}€ Niño</div>
                        </div>
                    </div>
                    <div class="d-flex gap-1">
                        <button type="button" class="btn btn-sm btn-outline-primary border-0" onclick="Configurator.editValoracionSuplNino(${index})" title="Editar"><i class="bi bi-pencil-square"></i></button>
                        <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="Configurator.removeValoracionSuplNino(${index})" title="Eliminar"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>
        `);
    },

    // --- EVENTOS ---
    configurarEventos() { },

    pickGalleryFolder() {
        MediaPicker.pickFile({ fileType: 'folder', onSelect: (path) => Utils.setVal('conf_gallery_path', path) });
    },

    addGalleryFolder() {
        const label = Utils.getVal('newGalleryLabel');
        const path = Utils.getVal('newGalleryPath');
        if (!label || !path) return;
        tempConfig.SYSTEM.GALLERY_FOLDERS.push({ label, path });
        this.renderGalleryFolders();
        Utils.setVal('newGalleryLabel', '');
        Utils.setVal('newGalleryPath', '');
    },

    async removeGalleryFolder(index) {
        if (await Ui.showConfirm("¿Eliminar carpeta?")) {
            tempConfig.SYSTEM.GALLERY_FOLDERS.splice(index, 1);
            this.renderGalleryFolders();
        }
    },

    async editGalleryFolder(index) {
        const item = tempConfig.SYSTEM.GALLERY_FOLDERS[index];
        tempConfig.SYSTEM.GALLERY_FOLDERS.splice(index, 1);
        this.renderGalleryFolders();
        Utils.setVal('newGalleryLabel', item.label);
        Utils.setVal('newGalleryPath', item.path);
    },

    pickNewGalleryFolder() {
        MediaPicker.pickFile({ fileType: 'folder', onSelect: (path) => Utils.setVal('newGalleryPath', path) });
    },

    addDepartamentoGlobal() {
        const val = Utils.getVal('newDepartamentoGlobal');
        if (val && !tempConfig.NOVEDADES.DEPARTAMENTOS.includes(val)) {
            tempConfig.NOVEDADES.DEPARTAMENTOS.push(val);
            this.renderDepartamentosGlobal();
            Utils.setVal('newDepartamentoGlobal', '');
        }
    },

    async removeDepartamentoGlobal(val) {
        if (await Ui.showConfirm(`¿Eliminar ${val}?`)) {
            tempConfig.NOVEDADES.DEPARTAMENTOS = tempConfig.NOVEDADES.DEPARTAMENTOS.filter(d => d !== val);
            this.renderDepartamentosGlobal();
        }
    },

    async addRecepcionista() {
        const nombre = Utils.getVal('newRecepcionista');
        if (nombre && !tempConfig.HOTEL.RECEPCIONISTAS.includes(nombre)) {
            try {
                tempConfig.HOTEL.RECEPCIONISTAS.push(nombre);
                await Api.post('storage/recepcionistas', tempConfig.HOTEL.RECEPCIONISTAS);
                this.renderRecepcionistas();
                Utils.setVal('newRecepcionista', '');
                Ui.showToast("Recepcionista añadido correctamente", "success");
            } catch (e) {
                console.error("Error adding receptionist:", e);
                tempConfig.HOTEL.RECEPCIONISTAS = tempConfig.HOTEL.RECEPCIONISTAS.filter(r => r !== nombre);
                Ui.showToast("Error al guardar en la base de datos", "danger");
            }
        }
    },

    async removeRecepcionista(nombre) {
        if (await Ui.showConfirm(`¿Eliminar ${nombre}?`)) {
            try {
                const newList = tempConfig.HOTEL.RECEPCIONISTAS.filter(r => r !== nombre);
                await Api.post('storage/recepcionistas', newList);
                tempConfig.HOTEL.RECEPCIONISTAS = newList;
                this.renderRecepcionistas();
                Ui.showToast("Recepcionista eliminado", "success");
            } catch (e) {
                console.error("Error removing receptionist:", e);
                Ui.showToast("Error al eliminar de la base de datos", "danger");
            }
        }
    },

    addDestinoTransfer() {
        const val = Utils.getVal('newDestinoTransfer');
        if (val && !tempConfig.TRANSFERS.DESTINOS.includes(val)) {
            tempConfig.TRANSFERS.DESTINOS.push(val);
            this.renderDestinosTransfers();
            Utils.setVal('newDestinoTransfer', '');
        }
    },

    async removeDestinoTransfer(val) {
        if (await Ui.showConfirm(`¿Eliminar ${val}?`)) {
            tempConfig.TRANSFERS.DESTINOS = tempConfig.TRANSFERS.DESTINOS.filter(d => d !== val);
            this.renderDestinosTransfers();
        }
    },

    addAppLauncher() {
        const label = Utils.getVal('newLauncherLabel');
        const path = Utils.getVal('newLauncherPath');
        const icon = Utils.getVal('newLauncherIcon');
        const type = document.getElementById('newLauncherType')?.value || 'app';
        const embedded = document.getElementById('newLauncherEmbedded')?.checked || false;

        if (!label || !path) {
            Ui.showToast("Nombre y ruta son obligatorios", "warning");
            return;
        }

        tempConfig.SYSTEM.LAUNCHERS.push({ label, path, icon, type, embedded });
        this.renderAppLaunchers();

        // Reset fields
        Utils.setVal('newLauncherLabel', '');
        Utils.setVal('newLauncherPath', '');
        Utils.setVal('newLauncherIcon', '');
        const checkEmbedded = document.getElementById('newLauncherEmbedded');
        if (checkEmbedded) checkEmbedded.checked = false;

        Ui.showToast("Lanzador añadido", "success");
    },

    async pickLauncherFile() {
        const type = document.getElementById('newLauncherType')?.value || 'app';
        let fileType = 'executable';
        if (type === 'folder') fileType = 'folder';
        if (type === 'documentos') fileType = 'file'; // Any file for docs

        MediaPicker.pickFile({
            fileType: fileType,
            onSelect: (path) => Utils.setVal('newLauncherPath', path)
        });
    },

    onLauncherTypeChange(type) {
        const labelPath = document.getElementById('labelLauncherPath');
        const inputPath = document.getElementById('newLauncherPath');
        const wrapperEmbedded = document.getElementById('wrapperLauncherEmbedded');

        if (labelPath) {
            if (type === 'url' || type === 'maps' || type === 'video') {
                labelPath.innerText = 'Enlace / URL';
                if (inputPath) inputPath.placeholder = 'https://...';
            } else if (type === 'folder') {
                labelPath.innerText = 'Ruta de Carpeta';
                if (inputPath) inputPath.placeholder = 'C:\\...';
            } else {
                labelPath.innerText = 'Ruta de Archivo';
                if (inputPath) inputPath.placeholder = 'C:\\...\\app.exe';
            }
        }

        if (wrapperEmbedded) {
            wrapperEmbedded.classList.toggle('d-none', type !== 'url' && type !== 'video' && type !== 'maps');
        }
    },

    async removeAppLauncher(index) {
        if (await Ui.showConfirm("¿Eliminar este lanzador?")) {
            tempConfig.SYSTEM.LAUNCHERS.splice(index, 1);
            this.renderAppLaunchers();
        }
    },

    async editAppLauncher(index) {
        const item = tempConfig.SYSTEM.LAUNCHERS[index];

        // Cargar datos en el formulario
        Utils.setVal('newLauncherLabel', item.label);
        Utils.setVal('newLauncherPath', item.path);
        Utils.setVal('newLauncherIcon', item.icon || '');

        const typeSelect = document.getElementById('newLauncherType');
        if (typeSelect) {
            typeSelect.value = item.type || 'app';
            this.onLauncherTypeChange(typeSelect.value);
        }

        const checkEmbedded = document.getElementById('newLauncherEmbedded');
        if (checkEmbedded) checkEmbedded.checked = !!item.embedded;

        // Eliminar del temporal para que al "Añadir" se reemplace o simplemente se mueva
        tempConfig.SYSTEM.LAUNCHERS.splice(index, 1);
        this.renderAppLaunchers();

        Ui.showToast("Cargado en el formulario para editar", "info");
    },

    addRango() {
        const planta = parseInt(Utils.getVal('newRangePlanta'));
        const min = parseInt(Utils.getVal('newRangeMin'));
        const max = parseInt(Utils.getVal('newRangeMax'));
        if (isNaN(planta)) return;
        tempConfig.HOTEL.STATS_CONFIG.RANGOS.push({ planta, min, max });
        this.renderRangos();
    },

    addFilter(type) {
        const inputId = (type === 'TIPOS' ? 'newFiltroTipo' : (type === 'VISTAS' ? 'newFiltroVista' : 'newFiltroCarac'));
        const val = Utils.getVal(inputId);
        if (val) {
            const containerId = (type === 'TIPOS' ? 'list-filtros-tipos' : (type === 'VISTAS' ? 'list-filtros-vistas' : 'list-filtros-carac'));
            tempConfig.HOTEL.STATS_CONFIG.FILTROS[type].push({ label: val, icon: Utils.getVal(inputId + 'Emoji') });
            this.renderFiltros(type, containerId);
            Utils.setVal(inputId, '');
            Utils.setVal(inputId + 'Emoji', '');
        }
    },

    addExcursionAlCatalogo() {
        const nombre = Utils.getVal('newExc_nombre');
        const operador = Utils.getVal('newExc_operador');
        const pAdulto = parseFloat(Utils.getVal('newExc_pAdulto')) || 0;
        const pNino = parseFloat(Utils.getVal('newExc_pNiño')) || 0;
        const esTicket = document.getElementById('newExc_esTicket')?.value === 'true';

        if (!nombre || pAdulto <= 0) {
            Ui.showToast("Nombre y precio base son obligatorios", "warning");
            return;
        }

        tempConfig.EXCURSIONES_CATALOGO.push({
            id: `CAT-${Date.now()}`,
            nombre,
            operador,
            precioAdulto: pAdulto,
            precioNiño: pNino,
            esTicket
        });

        this.renderExcursionesCatalogo();

        // Reset
        Utils.setVal('newExc_nombre', '');
        Utils.setVal('newExc_operador', '');
        Utils.setVal('newExc_pAdulto', '');
        Utils.setVal('newExc_pNiño', '');
    },

    addInstalacion() {
        const nombre = Utils.getVal('newInst_nombre');
        const apertura = Utils.getVal('newInst_apertura') || '08:00';
        const cierre = Utils.getVal('newInst_cierre') || '20:00';
        const icono = Utils.getVal('newInst_icono') || 'geo-fill';

        if (nombre) {
            tempConfig.HOTEL.INSTALACIONES.push({ nombre, apertura, cierre, icono });
            this.renderInstalaciones();
            Utils.setVal('newInst_nombre', '');
        }
    },

    addSpotifyPlaylist() {
        Spotify.addPlaylist(tempConfig);
    },

    editSpotifyPlaylist(index) {
        Spotify.editPlaylist(index, tempConfig);
    },

    removeSpotifyPlaylist(index) {
        Spotify.removePlaylist(index, tempConfig);
    },

    setCocktailLugarDefault(index) {
        tempConfig.HOTEL.COCKTAIL_LUGARES.forEach((l, i) => l.default = (i === index));
    },

    addCocktailLugar() {
        const es = Utils.getVal('newLugarES');
        const en = Utils.getVal('newLugarEN');
        const de = Utils.getVal('newLugarDE');
        const fr = Utils.getVal('newLugarFR');

        if (!es) {
            Ui.showToast("El nombre en español es obligatorio", "warning");
            return;
        }

        tempConfig.HOTEL.COCKTAIL_LUGARES.push({
            es, en, de, fr,
            default: tempConfig.HOTEL.COCKTAIL_LUGARES.length === 0
        });

        this.renderCocktailLugares();

        // Reset
        Utils.setVal('newLugarES', '');
        Utils.setVal('newLugarEN', '');
        Utils.setVal('newLugarDE', '');
        Utils.setVal('newLugarFR', '');
    },

    async editCocktailLugar(index) {
        const item = tempConfig.HOTEL.COCKTAIL_LUGARES[index];
        tempConfig.HOTEL.COCKTAIL_LUGARES.splice(index, 1);
        this.renderCocktailLugares();

        Utils.setVal('newLugarES', item.es);
        Utils.setVal('newLugarEN', item.en || '');
        Utils.setVal('newLugarDE', item.de || '');
        Utils.setVal('newLugarFR', item.fr || '');

        Ui.showToast("Cargado para editar", "info");
    },

    async removeCocktailLugar(index) {
        if (await Ui.showConfirm("¿Eliminar este lugar?")) {
            tempConfig.HOTEL.COCKTAIL_LUGARES.splice(index, 1);
            this.renderCocktailLugares();
        }
    },

    async editRecepcionista(nombre) {
        if (!await Ui.showConfirm(`¿Editar ${nombre}?`)) return;
        this.removeRecepcionista(nombre);
        Utils.setVal('newRecepcionista', nombre);
    },

    async editDestinoTransfer(val) {
        if (!await Ui.showConfirm(`¿Editar ${val}?`)) return;
        this.removeDestinoTransfer(val);
        Utils.setVal('newDestinoTransfer', val);
    },

    addValoracionPrecio() {
        const label = Utils.getVal('newValPrecioLabel');
        const valor = parseFloat(Utils.getVal('newValPrecioValor')) || 0;
        if (!label || valor <= 0) return;
        if (!tempConfig.VALORACION) tempConfig.VALORACION = { PRECIOS: [] };
        tempConfig.VALORACION.PRECIOS.push({ label, valor });
        this.renderValoracionPrecios();
        Utils.setVal('newValPrecioLabel', '');
        Utils.setVal('newValPrecioValor', '');
    },

    async removeValoracionPrecio(index) {
        if (await Ui.showConfirm("¿Eliminar?")) {
            tempConfig.VALORACION.PRECIOS.splice(index, 1);
            this.renderValoracionPrecios();
        }
    },

    async editValoracionPrecio(index) {
        const item = tempConfig.VALORACION.PRECIOS[index];
        tempConfig.VALORACION.PRECIOS.splice(index, 1);
        this.renderValoracionPrecios();
        Utils.setVal('newValPrecioLabel', item.label);
        Utils.setVal('newValPrecioValor', item.valor);
    },

    addValoracionSuplIndiv() {
        const label = Utils.getVal('newValSuplIndivLabel');
        const valor = parseFloat(Utils.getVal('newValSuplIndivValor')) || 0;
        if (!label || valor <= 0) return;
        tempConfig.VALORACION.SUPLEMENTOS_INDIVIDUAL.push({ label, valor });
        this.renderValoracionSuplIndiv();
        Utils.setVal('newValSuplIndivLabel', '');
        Utils.setVal('newValSuplIndivValor', '');
    },

    async removeValoracionSuplIndiv(index) {
        if (await Ui.showConfirm("¿Eliminar suplemento?")) {
            tempConfig.VALORACION.SUPLEMENTOS_INDIVIDUAL.splice(index, 1);
            this.renderValoracionSuplIndiv();
        }
    },

    async editValoracionSuplIndiv(index) {
        const item = tempConfig.VALORACION.SUPLEMENTOS_INDIVIDUAL[index];
        tempConfig.VALORACION.SUPLEMENTOS_INDIVIDUAL.splice(index, 1);
        this.renderValoracionSuplIndiv();
        Utils.setVal('newValSuplIndivLabel', item.label);
        Utils.setVal('newValSuplIndivValor', item.valor);
    },

    addValoracionDescTriple() {
        const label = Utils.getVal('newValDescTripleLabel');
        const valor = parseFloat(Utils.getVal('newValDescTripleValor')) || 0;
        if (!label) return;
        tempConfig.VALORACION.DESCUENTOS_TRIPLE.push({ label, valor });
        this.renderValoracionDescTriple();
        Utils.setVal('newValDescTripleLabel', '');
        Utils.setVal('newValDescTripleValor', '');
    },

    async removeValoracionDescTriple(index) {
        if (await Ui.showConfirm("¿Eliminar precio?")) {
            tempConfig.VALORACION.DESCUENTOS_TRIPLE.splice(index, 1);
            this.renderValoracionDescTriple();
        }
    },

    async editValoracionDescTriple(index) {
        const item = tempConfig.VALORACION.DESCUENTOS_TRIPLE[index];
        tempConfig.VALORACION.DESCUENTOS_TRIPLE.splice(index, 1);
        this.renderValoracionDescTriple();
        Utils.setVal('newValDescTripleLabel', item.label);
        Utils.setVal('newValDescTripleValor', item.valor);
    },

    addValoracionSuplNino() {
        const label = Utils.getVal('newValSuplNinoLabel');
        const valor = parseFloat(Utils.getVal('newValSuplNinoValor')) || 0;
        if (!label || valor <= 0) return;
        tempConfig.VALORACION.SUPLEMENTOS_NINO.push({ label, valor });
        this.renderValoracionSuplNino();
        Utils.setVal('newValSuplNinoLabel', '');
        Utils.setVal('newValSuplNinoValor', '');
    },

    async removeValoracionSuplNino(index) {
        if (await Ui.showConfirm("¿Eliminar suplemento?")) {
            tempConfig.VALORACION.SUPLEMENTOS_NINO.splice(index, 1);
            this.renderValoracionSuplNino();
        }
    },

    async editValoracionSuplNino(index) {
        const item = tempConfig.VALORACION.SUPLEMENTOS_NINO[index];
        tempConfig.VALORACION.SUPLEMENTOS_NINO.splice(index, 1);
        this.renderValoracionSuplNino();
        Utils.setVal('newValSuplNinoLabel', item.label);
        Utils.setVal('newValSuplNinoValor', item.valor);
    },

    onWorkModeChange(mode) {
        const apiUrlInput = document.getElementById('conf_api_url');
        const btnTest = document.getElementById('btnTestConn');
        if (mode === 'local') {
            if (apiUrlInput) apiUrlInput.disabled = true;
            if (btnTest) btnTest.disabled = true;
            Utils.setVal('conf_api_url', '/api');
        } else {
            if (apiUrlInput) apiUrlInput.disabled = false;
            if (btnTest) btnTest.disabled = false;
        }
    },

    async testConnection() {
        const url = Utils.getVal('conf_api_url');
        const feedback = document.getElementById('test-conn-feedback');
        const btn = document.getElementById('btnTestConn');

        if (!url) {
            Ui.showToast("Introduce una URL para probar", "warning");
            return;
        }

        if (feedback) {
            feedback.classList.remove('d-none', 'text-success', 'text-danger');
            feedback.classList.add('text-info');
            feedback.innerHTML = '<i class="bi bi-hourglass-split me-1 animate-spin"></i>Probando conexión...';
        }

        if (btn) btn.disabled = true;

        const isOk = await Api.checkHealth(url);

        if (btn) btn.disabled = false;

        if (feedback) {
            feedback.classList.remove('text-info');
            if (isOk) {
                feedback.classList.add('text-success');
                feedback.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>¡Conexión exitosa! El servidor responde correctamente.';
            } else {
                feedback.classList.add('text-danger');
                feedback.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i>Error de conexión. Verifica la IP y que el servidor Docker esté encendido.';
            }
        }
    },

    async saveConfigLocal() {
        try {
            // Capturar campos básicos de la UI antes de guardar
            tempConfig.HOTEL.NOMBRE = Utils.getVal('conf_hotel_nombre');

            if (!tempConfig.SYSTEM) tempConfig.SYSTEM = {};
            tempConfig.SYSTEM.MODE = Utils.getVal('conf_work_mode');
            tempConfig.SYSTEM.API_URL = Utils.getVal('conf_api_url');
            tempConfig.SYSTEM.ADMIN_PASSWORD = Utils.getVal('conf_admin_pass');
            tempConfig.SYSTEM.GALLERY_PATH = Utils.getVal('conf_gallery_path');
            tempConfig.SYSTEM.SYNC_INTERVAL = parseInt(Utils.getVal('conf_sync_interval')) || 10000;

            if (!tempConfig.SAFE) tempConfig.SAFE = {};
            tempConfig.SAFE.PRECIO_DIARIO = parseFloat(Utils.getVal('conf_safe_precio')) || 2.0;

            if (!tempConfig.CAJA) tempConfig.CAJA = {};
            tempConfig.CAJA.FONDO = parseFloat(Utils.getVal('conf_caja_fondo')) || -2000.0;

            if (!tempConfig.HOTEL.COCKTAIL_CONFIG) tempConfig.HOTEL.COCKTAIL_CONFIG = {};
            tempConfig.HOTEL.COCKTAIL_CONFIG.DIA = parseInt(Utils.getVal('conf_cocktail_dia'));
            tempConfig.HOTEL.COCKTAIL_CONFIG.HORA = Utils.getVal('conf_cocktail_hora');

            // --- GUARDADO LOCAL EN EL AGENTE (PC CLIENTE) ---
            const localPayload = {
                LAUNCHERS: tempConfig.SYSTEM.LAUNCHERS,
                GALLERY_FOLDERS: tempConfig.SYSTEM.GALLERY_FOLDERS,
                GALLERY_PATH: tempConfig.SYSTEM.GALLERY_PATH
            };

            // Intentar HTTP primero (PCs sin SSL), luego HTTPS (servidores con SSL)
            const agentUrls = [
                'http://localhost:3001/api/system/local-config',
                'https://localhost:3001/api/system/local-config'
            ];

            let localSaved = false;
            for (const url of agentUrls) {
                try {
                    const localResponse = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Station-Key': sessionStorage.getItem('RS_STATION_KEY') || ''
                        },
                        body: JSON.stringify(localPayload)
                    });
                    if (localResponse.ok) {
                        console.log(`[AGENT] ✓ Configuración local guardada en ${url}`);
                        localSaved = true;
                        break;
                    } else {
                        console.warn(`[AGENT] Guardado local falló en ${url} con estado ${localResponse.status}`);
                    }
                } catch (e) {
                    console.warn(`[AGENT] Error guardando en ${url}:`, e.message);
                }
            }

            if (!localSaved) {
                console.warn("[AGENT] No se pudo guardar config local en agente (HTTP ni HTTPS). Se guardarán en global como fallback.");
            }

            // --- GUARDADO GLOBAL (Copia de seguridad en servidor) ---
            const globalConfigToSave = JSON.parse(JSON.stringify(tempConfig));
            
            await configService.saveConfig(globalConfigToSave);
            Ui.showToast("Configuración guardada correctamente", "success");
            setTimeout(() => location.reload(), 1000);
        } catch (e) {
            console.error("Error saving config:", e);
            Ui.showToast("Error al guardar la configuración: " + e.message, "danger");
        }
    },

    exportLocalConfig() {
        if (!tempConfig || !tempConfig.SYSTEM) return;
        const localData = {
            LAUNCHERS: tempConfig.SYSTEM.LAUNCHERS || [],
            GALLERY_FOLDERS: tempConfig.SYSTEM.GALLERY_FOLDERS || [],
            GALLERY_PATH: tempConfig.SYSTEM.GALLERY_PATH || ''
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localData, null, 2));
        const anchor = document.createElement('a');
        anchor.setAttribute("href", dataStr);
        anchor.setAttribute("download", "recepcion_suite_local_config.json");
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        Ui.showToast("Configuración local exportada", "success");
    },

    importLocalConfig(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (!tempConfig.SYSTEM) tempConfig.SYSTEM = {};
                
                if (imported.LAUNCHERS) tempConfig.SYSTEM.LAUNCHERS = imported.LAUNCHERS;
                if (imported.GALLERY_FOLDERS) tempConfig.SYSTEM.GALLERY_FOLDERS = imported.GALLERY_FOLDERS;
                if (imported.GALLERY_PATH !== undefined) tempConfig.SYSTEM.GALLERY_PATH = imported.GALLERY_PATH;

                // Re-render the UI elements affected
                Configurator.renderAppLaunchers();
                Configurator.renderVisualizadorFolders();
                Utils.setVal('conf_gallery_path', tempConfig.SYSTEM.GALLERY_PATH || '');

                Ui.showToast("Configuración local restaurada. Guardando...", "info");
                
                // Programmatically trigger a save so it hits the agent immediately
                Configurator.saveConfigLocal();
            } catch (err) {
                console.error("Error parsing imported config:", err);
                Ui.showToast("El archivo seleccionado no es válido", "danger");
            }
        };
        reader.readAsText(file);
        
        // Reset the input so the same file could be imported again if needed
        event.target.value = '';
    },


    /**
     * PROTECCIÓN POR PIN
     */
    initPinProtection() {
        const protectedButtons = document.querySelectorAll('button[data-requires-pin="true"]');
        protectedButtons.forEach(btn => {
            btn.removeAttribute('data-bs-toggle');

            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                const targetId = btn.getAttribute('data-bs-target');
                const targetEl = document.querySelector(targetId);
                const isOpening = !targetEl.classList.contains('show');

                if (isOpening) {
                    pendingAccordionButton = btn;
                    this.showPinModal();
                } else {
                    this.toggleAccordion(btn);
                }
            };
        });

        // Configurar tecla Enter en el input del PIN
        const pinInput = document.getElementById('config-pin-input');
        if (pinInput) {
            pinInput.onkeyup = (e) => {
                if (e.key === 'Enter') this.validatePin();
            };
        }
    },

    showPinModal() {
        const modalEl = document.getElementById('configPinModal');
        const input = document.getElementById('config-pin-input');
        const errorMsg = document.getElementById('pin-error-msg');

        if (input) input.value = '';
        if (errorMsg) errorMsg.classList.add('d-none');

        if (typeof bootstrap !== 'undefined') {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
            modalEl.addEventListener('shown.bs.modal', () => {
                input.focus();
                // Bloquear navegación mientras está el modal
                document.body.classList.add('modal-open-config');
            }, { once: true });
        } else {
            const pin = prompt("Introduce PIN de Administrador (Sensible):");
            if (pin) {
                if (input) input.value = pin;
                this.validatePin();
            }
        }
    },

    validatePin() {
        const input = document.getElementById('config-pin-input');
        const errorMsg = document.getElementById('pin-error-msg');
        const pin = input?.value;
        const correctPin = APP_CONFIG.SYSTEM?.ADMIN_PASSWORD || "1234";

        if (pin === String(correctPin)) {
            const modalEl = document.getElementById('configPinModal');
            if (typeof bootstrap !== 'undefined') {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }

            if (pendingAccordionButton) {
                this.toggleAccordion(pendingAccordionButton);
                pendingAccordionButton = null;
            }
            Ui.showToast("Acceso concedido", "success");
        } else {
            if (errorMsg) errorMsg.classList.remove('d-none');
            if (input) {
                input.value = '';
                input.focus();
            }
        }
    },


    toggleAccordion(btn) {
        const targetId = btn.getAttribute('data-bs-target');
        const targetEl = document.querySelector(targetId);
        if (targetEl && typeof bootstrap !== 'undefined') {
            const bsCollapse = bootstrap.Collapse.getInstance(targetEl) || new bootstrap.Collapse(targetEl, { toggle: false });
            bsCollapse.toggle();
        } else if (targetEl) {
            targetEl.classList.toggle('show'); // Fallback básico
        }
    },

    /**
     * Carga el módulo de actualizaciones de forma dinámica
     */
    async loadActualizacionesModule() {
        try {
            const container = document.getElementById('actualizaciones-module-container');
            if (!container) {
                console.warn('[CONFIGURATOR] No se encontró contenedor para módulo de actualizaciones');
                return;
            }

            // Importar el módulo
            const { default: Actualizaciones } = await import('./actualizaciones.js');

            // Renderizar el HTML
            container.innerHTML = Actualizaciones.render();

            // Inicializar el módulo
            Actualizaciones.init();

            console.log('[CONFIGURATOR] Módulo de actualizaciones cargado');
        } catch (error) {
            console.error('[CONFIGURATOR] Error cargando módulo de actualizaciones:', error);
        }
    }
};

window.Configurator = Configurator;
window.saveConfigLocal = () => Configurator.saveConfigLocal();
window.exportLocalConfig = () => Configurator.exportLocalConfig();
window.importLocalConfig = (event) => Configurator.importLocalConfig(event);
window.addRecepcionista = () => Configurator.addRecepcionista();
window.addDestinoTransfer = () => Configurator.addDestinoTransfer();
window.addDepartamentoGlobal = () => Configurator.addDepartamentoGlobal();
window.addAppLauncher = () => Configurator.addAppLauncher();
window.editAppLauncher = (i) => Configurator.editAppLauncher(i);
window.removeAppLauncher = (i) => Configurator.removeAppLauncher(i);
window.pickLauncherFile = () => Configurator.pickLauncherFile();
window.addRango = () => Configurator.addRango();
window.addFilter = (t) => Configurator.addFilter(t);
window.addGalleryFolder = () => Configurator.addGalleryFolder();
window.pickNewGalleryFolder = () => Configurator.pickNewGalleryFolder();
window.pickGalleryFolder = () => Configurator.pickGalleryFolder();
window.addTourOperator = (n) => Configurator.addTourOperator(n);
window.addInstalacion = () => Configurator.addInstalacion();
window.addCocktailLugar = () => Configurator.addCocktailLugar();
window.addSpotifyPlaylist = () => Configurator.addSpotifyPlaylist();
window.editSpotifyPlaylist = (i) => Configurator.editSpotifyPlaylist(i);
window.removeSpotifyPlaylist = (i) => Configurator.removeSpotifyPlaylist(i);
window.addExcursionAlCatalogo = () => Configurator.addExcursionAlCatalogo();
window.testConnection = () => Configurator.testConnection();
window.onWorkModeChange = (m) => Configurator.onWorkModeChange(m);
window.IconSelector = IconSelector;
export function inicializarConfiguracion() { Configurator.inicializar(); }
