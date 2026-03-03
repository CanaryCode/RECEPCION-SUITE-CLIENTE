import { APP_CONFIG } from '../core/Config.js';
import { Utils } from '../core/Utils.js';
import { Ui } from '../core/Ui.js';

/**
 * MÓDULO DE SPOTIFY (spotify.js)
 * Gestiona el reproductor del footer y su configuración.
 */
export const Spotify = {
    /**
     * INICIALIZACIÓN DEL REPRODUCTOR
     */
    initPlayer() {
        const playlists = APP_CONFIG.HOTEL?.SPOTIFY_PLAYLISTS || [];
        const container = document.getElementById('spotify-footer-player');
        const switcher = document.getElementById('spotify-playlist-switcher');

        if (!container) return;

        // 1. Determinar URL inicial
        let initialUrl = "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM3M"; // Fallback
        if (playlists.length > 0) {
            initialUrl = playlists[0].url;
        }

        // 2. Renderizar Selector si hay múltiples listas
        if (switcher) {
            if (playlists.length >= 1) {
                switcher.classList.remove('d-none');
                switcher.innerHTML = playlists.map(p => `
                    <button class="btn btn-sm btn-success border-0 px-2 py-0 text-truncate" 
                            style="max-width: 120px; font-size: 0.65rem; border-radius: 4px;"
                            onclick="window.switchSpotifyPlaylist('${p.url}')"
                            title="${p.label}">
                        <i class="bi bi-music-note-list me-1"></i>${p.label}
                    </button>
                `).join('');
            } else {
                switcher.classList.add('d-none');
            }
        }

        this.switchPlaylist(initialUrl);

        // 3. Iniciar Minimizado por defecto
        if (container) {
            container.classList.add('minimized');
            const icon = document.getElementById('spotify-toggle-icon');
            if (icon) {
                icon.classList.remove('bi-chevron-up');
                icon.classList.add('bi-chevron-down');
            }
        }
    },

    /**
     * CAMBIAR PLAYLIST EN EL IFRAME
     */
    switchPlaylist(url) {
        const iframe = document.getElementById('spotify-footer-iframe');
        if (!iframe || !url || typeof url !== 'string') return;

        let embedUrl = url.trim();

        if (!embedUrl.includes('/embed/')) {
            const match = embedUrl.match(/(playlist|album|track|artist)\/([a-zA-Z0-9\-_]{15,})/);
            if (match) {
                const type = match[1];
                const id = match[2];
                embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
            } else {
                embedUrl = embedUrl.replace('open.spotify.com/', 'open.spotify.com/embed/');
            }
        }

        if (embedUrl.includes('?')) {
            embedUrl = embedUrl.split('?')[0];
        }

        const currentSrc = iframe.getAttribute('src');
        if (currentSrc === embedUrl) return;

        iframe.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
        iframe.setAttribute('loading', 'lazy');
        iframe.style.borderRadius = "12px";

        console.log(`[Spotify] Switching to: ${embedUrl}`);
        iframe.src = embedUrl;
    },

    /**
     * MINIMIZAR / MAXIMIZAR FOOTER
     */
    toggleFooter() {
        const container = document.getElementById('spotify-footer-player');
        const icon = document.getElementById('spotify-toggle-icon');
        if (container) {
            container.classList.toggle('minimized');
            if (icon) {
                icon.classList.toggle('bi-chevron-up');
                icon.classList.toggle('bi-chevron-down');
            }
        }
    },

    // --- CONFIGURACIÓN ---

    /**
     * RENDERIZAR LISTA EN CONFIGURACIÓN
     */
    renderConfig(tempConfig) {
        const list = tempConfig.HOTEL.SPOTIFY_PLAYLISTS || [];
        Ui.renderTable('config-spotify-playlists-list', list, (item, index) => `
            <div class="col-md-6 mb-2">
                <div class="border rounded p-2 d-flex align-items-center justify-content-between bg-white shadow-sm">
                    <div class="d-flex align-items-center text-truncate">
                        <i class="bi bi-spotify fs-4 text-success me-2"></i>
                        <div class="text-truncate">
                            <div class="fw-bold small text-truncate">${item.label}</div>
                        </div>
                    </div>
                    <div class="d-flex gap-1">
                        <button type="button" class="btn btn-sm btn-outline-primary border-0" onclick="Configurator.editSpotifyPlaylist(${index})" title="Editar"><i class="bi bi-pencil-square"></i></button>
                        <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="Configurator.removeSpotifyPlaylist(${index})" title="Eliminar"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>
        `);
    },

    addPlaylist(tempConfig, configuratorInstance) {
        const label = Utils.getVal('newSpotifyLabel');
        const url = Utils.getVal('newSpotifyUrl');
        if (label && url) {
            tempConfig.HOTEL.SPOTIFY_PLAYLISTS.push({ label, url });
            this.renderConfig(tempConfig);
            Utils.setVal('newSpotifyLabel', '');
            Utils.setVal('newSpotifyUrl', '');
            Ui.showToast("Playlist añadida", "success");
        }
    },

    async removePlaylist(index, tempConfig) {
        if (await Ui.showConfirm("¿Eliminar esta lista de Spotify?")) {
            tempConfig.HOTEL.SPOTIFY_PLAYLISTS.splice(index, 1);
            this.renderConfig(tempConfig);
            Ui.showToast("Playlist eliminada", "info");
        }
    },

    async editPlaylist(index, tempConfig) {
        const item = tempConfig.HOTEL.SPOTIFY_PLAYLISTS[index];
        Utils.setVal('newSpotifyLabel', item.label);
        Utils.setVal('newSpotifyUrl', item.url);
        tempConfig.HOTEL.SPOTIFY_PLAYLISTS.splice(index, 1);
        this.renderConfig(tempConfig);
        Ui.showToast("Cargado en el formulario para editar", "info");
    }
};

// Global exports for inline events
window.switchSpotifyPlaylist = (url) => Spotify.switchPlaylist(url);
window.toggleSpotifyFooter = () => Spotify.toggleFooter();
window.initFooterSpotify = () => Spotify.initPlayer();
