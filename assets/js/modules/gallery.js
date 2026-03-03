import { APP_CONFIG } from '../core/Config.js';
import { Ui } from '../core/Ui.js';
import { Api } from '../core/Api.js';

let moduloInicializado = false;
let currentScale = 1;
let currentRotation = 0;
let isDragging = false;
let startX, startY, translateX = 0, translateY = 0;
let currentImages = [];
let currentIndex = -1;
let currentTypeFilter = 'all'; // all, image, pdf
let currentFolderFilter = 'all';
let currentSearchQuery = '';
let currentSort = 'mtime_desc';
let showOnlyFavorites = false;
let selectionMode = false;
let selectedItems = []; // Array of URLs
let favorites = [];
let pdfThumbnailsCache = {};

// Paginación (Lazy DOM)
let _galleryFilteredImages = [];
let _galleryOffset = 0;
const _galleryLimit = 30; // Nodos a crear por cada scroll
let _galleryObserver = null; // El observador principal de los nodos
let _galleryScrollObserver = null; // El observador del fondo para infinite scroll

export const Gallery = {
    async inicializar() {
        try {
            if (moduloInicializado) return;
            
            // Cargar favoritos del servidor
            await this.loadFavorites();
        
        // Initial load
        await this.loadImages();
        
        // Debounce para la búsqueda (300ms)
        let searchTimeout;
        document.getElementById('gallerySearch')?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filterImages(e.target.value);
            }, 300);
        });

        // Event for Type Filter
        document.getElementById('galleryTypeFilter')?.addEventListener('change', (e) => {
            currentTypeFilter = e.target.value;
            this.renderGrid(currentImages);
        });

        // Event for Folder Filter
        document.getElementById('galleryFolderFilter')?.addEventListener('change', (e) => {
            currentFolderFilter = e.target.value;
            this.renderGrid(currentImages);
        });

        // Event for Sort
        document.getElementById('gallerySort')?.addEventListener('change', (e) => {
            currentSort = e.target.value;
            this.renderGrid(currentImages);
        });

        // Event for Favorite Filter
        document.getElementById('galleryFavoriteFilter')?.addEventListener('change', (e) => {
            showOnlyFavorites = e.target.checked;
            this.renderGrid(currentImages);
        });

        // Event for Selection Mode
        document.getElementById('gallerySelectionMode')?.addEventListener('change', (e) => {
            this.toggleSelectionMode(e.target.checked);
        });

        this.setupModalEvents();
        moduloInicializado = true;
        } catch (err) {
            console.error('[Gallery-Init-Error]', err);
            try { fetch('http://localhost:3001/debug-log', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({error: err.toString(), stack: err.stack})}); } catch(e){}
        }
    },

    async loadFavorites() {
        try {
            const data = await Api.get('/storage/gallery_favorites');
            if (data && Array.isArray(data)) {
                favorites = data;
            }
        } catch (e) {
            console.error("[Gallery] Error loading favorites:", e);
        }
    },

    async saveFavorites() {
        try {
            await Api.post('/storage/gallery_favorites', favorites);
        } catch (e) {
            console.error("[Gallery] Error saving favorites:", e);
        }
    },

    async toggleFavorite(url, event) {
        if (event) event.stopPropagation();
        
        const index = favorites.indexOf(url);
        if (index === -1) {
            favorites.push(url);
            Ui.showToast("Agregado a favoritos", "info");
        } else {
            favorites.splice(index, 1);
            Ui.showToast("Eliminado de favoritos", "secondary");
        }
        
        await this.saveFavorites();
        this.renderGrid(currentImages);
    },

    toggleSelectionMode(active) {
        selectionMode = active;
        if (!active) {
            this.clearSelection();
        }
        const bulkBar = document.getElementById('galleryBulkActions');
        if (bulkBar) {
            bulkBar.classList.toggle('d-none', !active);
            bulkBar.classList.toggle('d-flex', active);
        }
        this.renderGrid(currentImages);
    },

    toggleSelection(url, event) {
        if (event) event.stopPropagation();
        
        const idx = selectedItems.indexOf(url);
        if (idx === -1) {
            selectedItems.push(url);
        } else {
            selectedItems.splice(idx, 1);
        }
        
        this.updateSelectionUI();
    },

    updateSelectionUI() {
        const countEl = document.getElementById('gallerySelectedCount');
        if (countEl) countEl.textContent = selectedItems.length;
        
        // Update cards classes without full re-render for performance
        document.querySelectorAll('.gallery-card').forEach(card => {
            const url = card.dataset.url;
            if (url) {
                const isSelected = selectedItems.includes(url);
                card.classList.toggle('selected', isSelected);
                const checkbox = card.querySelector('.selection-checkbox');
                if (checkbox) checkbox.checked = isSelected;
            }
        });
    },

    clearSelection() {
        selectedItems = [];
        this.updateSelectionUI();
    },

    async copyCurrent() {
        const item = currentImages[currentIndex];
        if (!item) return;
        await this.copyToClipboard([item.url]);
    },

    async copySelected() {
        if (selectedItems.length === 0) {
            Ui.showToast("No hay elementos seleccionados", "warning");
            return;
        }
        await this.copyToClipboard(selectedItems);
    },

    async copyToClipboard(urls) {
        try {
            const paths = urls.map(url => {
                const item = currentImages.find(img => img.url === url);
                return item ? item.path : null;
            }).filter(p => p !== null);

            if (paths.length === 0) return;

            Ui.showToast(urls.length > 1 ? `Copiando ${urls.length} archivos...` : "Copiando archivo...", "info");
            
            const response = await Api.post('/system/copy-to-clipboard', { paths });
            
            if (response.success) {
                Ui.showToast(urls.length > 1 ? `${urls.length} archivos copiados` : "Archivo copiado", "success");
            } else {
                throw new Error(response.error || "Error al copiar");
            }
        } catch (e) {
            console.error("[Gallery] Copy error:", e);
            Ui.showToast("Error al copiar al portapapeles", "danger");
        }
    },

    async printCurrent() {
        const item = currentImages[currentIndex];
        if (!item) return;
        this.printUrls([item.url]);
    },

    printGrid() {
        if (window.PrintService) {
            PrintService.printElementAsImage('gallery-grid', 'Galaría de Información (Grid)');
        }
    },

    async printSelected() {
        if (selectedItems.length === 0) {
            Ui.showToast("No hay elementos seleccionados", "warning");
            return;
        }
        this.printUrls(selectedItems);
    },

    printUrls(urls) {
        if (!window.PrintService) {
            Ui.showToast("Servicio de impresión no disponible", "warning");
            return;
        }

        Ui.showToast("Preparando impresión...", "info");
        
        const items = urls.map(url => {
            if (url.toLowerCase().endsWith('.pdf')) {
                 const fileName = url.split('/').pop();
                 return {
                     type: 'html',
                     content: `
                        <div style="text-align: center; padding: 40px; border: 2px dashed #ccc; border-radius: 10px; max-width: 600px;">
                            <i class="bi bi-file-earmark-pdf" style="font-size: 4rem; color: #dc3545;"></i>
                            <h3 style="margin-top: 20px; color: #333;">Documento PDF: ${fileName}</h3>
                            <p style="color: #666; font-size: 1.1rem; margin-top: 10px;">
                                Los documentos PDF deben imprimirse individualmente desde su visor nativo para mantener el formato original.
                            </p>
                            <div style="margin-top: 20px; font-size: 0.9rem; color: #999;">
                                ${url}
                            </div>
                        </div>
                     `
                 };
            } else {
                return { type: 'image', src: url };
            }
        });

        PrintService.printMultiImage(items, "Galería de Imágenes");
    },

    toggleFullscreen() {
        const wrapper = document.getElementById('galleryModal').querySelector('.modal-content');
        if (!document.fullscreenElement) {
            wrapper.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    },
    async loadImages(resetFilters = false) {
        console.log('[DEBUG-GALLERY] loadImages called. Reset:', resetFilters);
        const container = document.getElementById('gallery-grid');
        if (!container) {
            console.error('[DEBUG-GALLERY] #gallery-grid not found!');
            return;
        }

        try {
            const mainPath = (APP_CONFIG.SYSTEM?.GALLERY_PATH || 'assets/gallery').trim();
            const configFolders = APP_CONFIG.SYSTEM?.GALLERY_FOLDERS || [];
            console.log('[DEBUG-GALLERY] mainPath:', mainPath, 'configFolders:', configFolders);

            // Reset filtros si se solicita (Manual Sync o Cambio de Módulo)
            if (resetFilters || currentFolderFilter === 'all') {
                currentSearchQuery = '';
                currentTypeFilter = 'all';
                currentFolderFilter = mainPath;
                showOnlyFavorites = false;
                
                // Sincronizar UI
                const searchInput = document.getElementById('gallerySearch');
                if (searchInput) searchInput.value = '';
                
                const typeSelect = document.getElementById('galleryTypeFilter');
                if (typeSelect) typeSelect.value = 'all';
                
                const favCheck = document.getElementById('galleryFavoriteFilter');
                if (favCheck) favCheck.checked = false;
            }

            container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 text-muted px-4">Recuperando archivos y miniaturas...</p></div>';

            let folderPaths = [mainPath, ...configFolders.map(f => (f.path || '').trim())];
            folderPaths = [...new Set(folderPaths)].filter(p => p !== '');



            this.updateFolderFilterUI(mainPath, configFolders);

            // FIX: Forzar lectura de disco con timestamp
            const response = await Api.post('/system/list-images', {
                folderPaths: folderPaths
            });

            if (response && response.images && response.images.length > 0) {
                currentImages = response.images;
                this.renderGrid(currentImages);
            } else {
                container.innerHTML = `
                    <div class="col-12 text-center text-muted py-5">
                        <i class="bi bi-images fs-1 mb-3"></i>
                        <p class="mb-2">No se encontraron archivos en las rutas configuradas.</p>
                    </div>`;
            }

        } catch (error) {
            console.error('Error loading gallery:', error);
            try { fetch('http://localhost:3001/debug-log', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({error: error.toString(), stack: error.stack, place: 'loadImages'})}); } catch(e){}
            container.innerHTML = `<div class="col-12 text-center text-danger py-5"><i class="bi bi-exclamation-triangle fs-1 mb-3"></i><p>Error de conexión: ${error.message}</p></div>`;
        }
    },

    updateFolderFilterUI(mainPath, folders) {
        const select = document.getElementById('galleryFolderFilter');
        if (!select) return;
        
        const currentVal = select.value;
        select.innerHTML = '<option value="all">Todas las Carpetas</option>';
        
        const normalize = (p) => p.trim().replace(/\\/g, '/').toLowerCase();
        const normalizedMain = normalize(mainPath);

        const optMain = document.createElement('option');
        optMain.value = mainPath.trim();
        optMain.textContent = `[Principal] ${mainPath}`;
        select.appendChild(optMain);
        
        folders.forEach(f => {
            const normalizedPath = normalize(f.path);
            if (normalizedPath === normalizedMain) return;
            const opt = document.createElement('option');
            opt.value = f.path.trim();
            opt.textContent = f.label || f.path;
            select.appendChild(opt);
        });

        if ([...select.options].some(o => o.value === currentFolderFilter)) {
            select.value = currentFolderFilter;
        }
    },

    renderGrid(images) {
        const container = document.getElementById('gallery-grid');
        if (!container) return;
        
        // Limpiar de forma segura
        while (container.firstChild) container.removeChild(container.firstChild);

        const normalize = (p) => (p || '').trim().replace(/\\/g, '/').toLowerCase();
        const normFilterFolder = normalize(currentFolderFilter);
        const searchVal = currentSearchQuery.toLowerCase().trim();

        // 1. Aplicar filtros
        let filtered = images.filter(img => {
            const matchesType = currentTypeFilter === 'all' || img.type === currentTypeFilter;
            const matchesFolder = currentFolderFilter === 'all' || normalize(img.folder) === normFilterFolder;
            const matchesSearch = searchVal === '' || img.name.toLowerCase().includes(searchVal);
            const matchesFavorite = !showOnlyFavorites || favorites.includes(img.url);
            return matchesType && matchesFolder && matchesSearch && matchesFavorite;
        });

        // 2. Ordenaci\u00F3n mejorada por tiempo real
        filtered.sort((a, b) => {
            const isFavA = favorites.includes(a.url);
            const isFavB = favorites.includes(b.url);
            if (isFavA && !isFavB) return -1;
            if (!isFavA && isFavB) return 1;
            
            if (currentSort === 'mtime_desc') return new Date(b.mtime).getTime() - new Date(a.mtime).getTime();
            if (currentSort === 'mtime_asc') return new Date(a.mtime).getTime() - new Date(b.mtime).getTime();
            if (currentSort === 'name_asc') return a.name.localeCompare(b.name, undefined, {sensitivity: 'base', numeric: true});
            return 0;
        });

        if (filtered.length === 0) {
            container.innerHTML = `<div class="col-12 text-center text-muted py-5">${images.length > 0 ? 'No hay archivos que coincidan con los filtros.' : 'No hay archivos en la galer\u00EDa.'}</div>`;
            return;
        }

        // 3. Lazy Loading Setup
        _galleryFilteredImages = filtered;
        _galleryOffset = 0;
        
        if (_galleryObserver) _galleryObserver.disconnect();
        if (_galleryScrollObserver) _galleryScrollObserver.disconnect();
        
        const observerOptions = { root: null, rootMargin: '200px', threshold: 0.01 };
        _galleryObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadCardContent(entry.target);
                    // Dejar de observar para no volver a cargar la misma imagen
                    _galleryObserver.unobserve(entry.target);
                }
            });
        }, observerOptions);

        _galleryScrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.renderNextGalleryChunk();
                }
            });
        }, { root: null, rootMargin: '300px', threshold: 0.01 });

        this.renderNextGalleryChunk();
    },

    renderNextGalleryChunk() {
        const container = document.getElementById('gallery-grid');
        if (!container) return;

        const fragment = document.createDocumentFragment();
        const chunk = _galleryFilteredImages.slice(_galleryOffset, _galleryOffset + _galleryLimit);
        
        if (chunk.length === 0) return; // No hay más imágenes

        chunk.forEach(img => {
            const col = document.createElement('div');
            col.className = 'col-6 col-md-4 col-lg-3 gallery-item-col mb-4';
            col.dataset.url = img.url;
            col.dataset.name = img.name;
            col.dataset.type = img.type;

            // Simple placeholder
            col.innerHTML = `
                <div class="card h-100 shadow-sm border-0 gallery-card-placeholder bg-light" style="min-height: 250px;">
                    <div class="d-flex align-items-center justify-content-center h-100 opacity-25">
                        <i class="bi bi-image fs-1"></i>
                    </div>
                </div>`;
            
            fragment.appendChild(col);
            _galleryObserver.observe(col);
        });

        // Eliminar el trigger anterior si existe
        const oldTrigger = document.getElementById('gallery-scroll-trigger');
        if (oldTrigger) {
            _galleryScrollObserver.unobserve(oldTrigger);
            oldTrigger.remove();
        }

        container.appendChild(fragment);
        _galleryOffset += _galleryLimit;

        // Añadir nuevo trigger si quedan imágenes
        if (_galleryOffset < _galleryFilteredImages.length) {
            const newTrigger = document.createElement('div');
            newTrigger.id = 'gallery-scroll-trigger';
            newTrigger.className = 'col-12 py-3 text-center text-muted';
            newTrigger.innerHTML = '<div class="spinner-border spinner-border-sm me-2"></div>Cargando más imágenes...';
            container.appendChild(newTrigger);
            _galleryScrollObserver.observe(newTrigger);
        }
    },

    loadCardContent(col) {
        const { url, name, type } = col.dataset;
        const localAgentUrl = sessionStorage.getItem('RS_LOCAL_AGENT_URL') || 'http://localhost:3001';
        const absoluteUrl = url.startsWith('/api/system/') ? `${localAgentUrl}${url}` : url;
        
        const isPdf = type === 'pdf';
        const isFav = favorites.includes(url);
        const isSelected = selectedItems.includes(url);
        const thumbId = `thumb-${Math.random().toString(36).substr(2, 9)}`;

        let iconHtml = isPdf 
            ? `<div class="d-flex flex-column align-items-center justify-content-center h-100 bg-light text-danger overflow-hidden" id="${thumbId}">
                <i class="bi bi-file-earmark-pdf fs-1"></i>
                <span class="small mt-2 text-center" style="font-size: 0.6rem;">Generando vista...</span>
               </div>`
            : `<div class="d-flex flex-column align-items-center justify-content-center h-100 bg-light text-muted overflow-hidden" id="${thumbId}">
                 <div class="spinner-border spinner-border-sm" role="status"></div>
               </div>
               <img id="img-${thumbId}" class="card-img-top d-none" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s;">`;

        col.innerHTML = `
            <div class="card h-100 shadow-sm border-0 gallery-card overflow-hidden ${isSelected ? 'selected' : ''} ${selectionMode ? 'selection-active' : ''} animate__animated animate__fadeIn" 
                 data-url="${url}"
                 onclick="${selectionMode ? `Gallery.toggleSelection('${url}', event)` : `Gallery.openViewer('${url}', '${name.replace(/'/g, "\\'")}', '${type}')`}">
                 
                ${selectionMode ? `<input type="checkbox" class="selection-checkbox" ${isSelected ? 'checked' : ''} onclick="Gallery.toggleSelection('${url}', event)">` : ''}
                
                <div class="favorite-btn ${isFav ? 'active' : ''}" onclick="Gallery.toggleFavorite('${url}', event)">
                    <i class="bi ${isFav ? 'bi-star-fill' : 'bi-star'}"></i>
                </div>
                
                <div class="card-img-wrapper" style="height: 180px; overflow: hidden; position: relative; cursor: pointer;">
                    ${iconHtml}
                </div>
                
                <div class="card-body p-2 bg-white text-center">
                    <div class="text-truncate small fw-bold" title="${name}">${name}</div>
                    <div class="text-muted" style="font-size: 0.6rem;">${isPdf ? 'Documento PDF' : 'Imagen'}</div>
                </div>
            </div>`;

        if (isPdf) {
            setTimeout(() => this.generatePdfThumbnail(absoluteUrl, thumbId, url), 50);
        } else {
            setTimeout(() => this.loadBlobUrl(absoluteUrl, `img-${thumbId}`, thumbId), 50);
        }
    },

    async loadBlobUrl(absoluteUrl, imgId, spinnerId) {
        const imgEl = document.getElementById(imgId);
        const spinner = document.getElementById(spinnerId);
        if (!imgEl) return;

        try {
            const token = sessionStorage.getItem('RS_STATION_KEY') || '';
            const finalUrl = absoluteUrl.includes('?') ? `${absoluteUrl}&token=${token}` : `${absoluteUrl}?token=${token}`;
            
            const response = await fetch(finalUrl, { headers: { 'X-Station-Key': token } });
            if (!response.ok) throw new Error('Network response was not ok');
            
            const blob = await response.blob();
            imgEl.src = URL.createObjectURL(blob);
            imgEl.onload = () => {
                imgEl.classList.remove('d-none');
                if (spinner) spinner.classList.add('d-none');
            };
        } catch (e) {
            console.error('[Gallery] Image blob fetch failed:', e);
            imgEl.src = absoluteUrl; // Fallback
            imgEl.classList.remove('d-none');
            if (spinner) spinner.classList.add('d-none');
        }
    },

    async generatePdfThumbnail(absoluteUrl, elementId, originalUrl) {
        if (pdfThumbnailsCache[originalUrl]) {
            setTimeout(() => this.applyThumbnailToElement(elementId, pdfThumbnailsCache[originalUrl]), 10);
            return;
        }

        try {
            if (typeof window['pdfjs-dist/build/pdf'] === 'undefined') return;
            const pdfjsLib = window['pdfjs-dist/build/pdf'];
            
            const token = sessionStorage.getItem('RS_STATION_KEY') || '';
            const finalUrl = absoluteUrl.includes('?') ? `${absoluteUrl}&token=${token}` : `${absoluteUrl}?token=${token}`;
            
            // Usamos httpHeaders en pdfjs para pasar el token también, aunque lo mandamos en URL
            const loadingTask = pdfjsLib.getDocument({ url: finalUrl, httpHeaders: { 'X-Station-Key': token } });
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            
            const viewport = page.getViewport({ scale: 0.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            pdfThumbnailsCache[originalUrl] = dataUrl;
            this.applyThumbnailToElement(elementId, dataUrl);
            
        } catch (e) {
            console.warn("[Gallery] PDF preview failed:", e.message);
            const el = document.getElementById(elementId);
            if (el) el.innerHTML = '<i class="bi bi-file-earmark-pdf fs-1"></i><span class="small mt-2">PDF</span>';
        }
    },

    applyThumbnailToElement(elementId, dataUrl) {
        const el = document.getElementById(elementId);
        if (el) {
            el.innerHTML = `<img src="${dataUrl}" style="width:100%; height:100%; object-fit:cover;">`;
            el.classList.remove('bg-light', 'text-danger');
        }
    },

    filterImages(query) {
        currentSearchQuery = query;
        this.renderGrid(currentImages);
    },

    openViewer(url, title, type = 'image') {
        const modalEl = document.getElementById('galleryModal');
        const img = document.getElementById('galleryViewerImage');
        const pdf = document.getElementById('galleryViewerPdf');
        const titleEl = document.getElementById('galleryViewerTitle');
        const controls = document.getElementById('galleryViewerControls');
        
        if (!modalEl || !img || !pdf) return;

        currentIndex = _galleryFilteredImages.findIndex(i => i.url === url);
        titleEl.textContent = title;
        
        const localAgentUrl = sessionStorage.getItem('RS_LOCAL_AGENT_URL') || 'http://localhost:3001';
        const absoluteUrl = url.startsWith('/api/system/') ? `${localAgentUrl}${url}` : url;

        if (type === 'pdf') {
            img.classList.add('d-none');
            pdf.classList.remove('d-none');
            
            // Para iframe de PDFs también evitamos el mixed content usando DataURL o Blob
            try {
                const token = sessionStorage.getItem('RS_STATION_KEY') || '';
                const finalUrl = absoluteUrl.includes('?') ? `${absoluteUrl}&token=${token}` : `${absoluteUrl}?token=${token}`;
                fetch(finalUrl, { headers: { 'X-Station-Key': token } })
                    .then(res => res.blob())
                    .then(blob => { pdf.src = URL.createObjectURL(blob); })
                    .catch(() => { pdf.src = absoluteUrl; });
            } catch (e) {
                pdf.src = absoluteUrl;
            }
            
            if (controls) controls.classList.add('d-none'); 
        } else {
            pdf.classList.add('d-none');
            img.classList.remove('d-none');
            img.src = ''; // Clear old immediately
            this.loadBlobUrl(absoluteUrl, 'galleryViewerImage', null);
            if (controls) controls.classList.remove('d-none');
            this.resetView();
        }

        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    },

    nextImage() {
        if (_galleryFilteredImages.length <= 1) return;
        currentIndex = (currentIndex + 1) % _galleryFilteredImages.length;
        this.syncViewer();
    },

    prevImage() {
        if (_galleryFilteredImages.length <= 1) return;
        currentIndex = (currentIndex - 1 + _galleryFilteredImages.length) % _galleryFilteredImages.length;
        this.syncViewer();
    },

    syncViewer() {
        const item = _galleryFilteredImages[currentIndex];
        if (!item) return;
        this.openViewer(item.url, item.name, item.type);
    },

    resetView() {
        currentScale = 1;
        currentRotation = 0;
        translateX = 0;
        translateY = 0;
        this.updateTransform();
    },

    adjustZoom(delta) {
        currentScale += delta;
        if (currentScale < 0.1) currentScale = 0.1;
        if (currentScale > 5) currentScale = 5;
        this.updateTransform();
    },

    rotateImage(deg) {
        currentRotation += deg;
        this.updateTransform();
    },

    updateTransform() {
        const img = document.getElementById('galleryViewerImage');
        if (img) {
            img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentScale}) rotate(${currentRotation}deg)`;
        }
    },

    setupModalEvents() {
        const imgContainer = document.getElementById('galleryViewerContainer');
        if (!imgContainer) return;

        imgContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.adjustZoom(delta);
        });

        imgContainer.addEventListener('mousedown', (e) => {
            if (currentScale <= 1) return; 
            isDragging = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
            imgContainer.style.cursor = 'grabbing';
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
            if (imgContainer) imgContainer.style.cursor = 'grab';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            this.updateTransform();
        });

        document.getElementById('galleryRotateLeft')?.addEventListener('click', (e) => { e.stopPropagation(); this.rotateImage(-90); });
        document.getElementById('galleryRotateRight')?.addEventListener('click', (e) => { e.stopPropagation(); this.rotateImage(90); });
        document.getElementById('galleryZoomIn')?.addEventListener('click', (e) => { e.stopPropagation(); this.adjustZoom(0.2); });
        document.getElementById('galleryZoomOut')?.addEventListener('click', (e) => { e.stopPropagation(); this.adjustZoom(-0.2); });
        document.getElementById('galleryResetView')?.addEventListener('click', (e) => { e.stopPropagation(); this.resetView(); });

        document.getElementById('galleryPrevBtn')?.addEventListener('click', (e) => { e.stopPropagation(); this.prevImage(); });
        document.getElementById('galleryNextBtn')?.addEventListener('click', (e) => { e.stopPropagation(); this.nextImage(); });

        if (!window._galleryKeyHandler) {
            window._galleryKeyHandler = true;
            window.addEventListener('keydown', (e) => {
                const modal = document.getElementById('galleryModal');
                if (!modal?.classList.contains('show')) return;
                if (e.key === 'ArrowRight') this.nextImage();
                if (e.key === 'ArrowLeft') this.prevImage();
            });
        }
    }
};

window.Gallery = Gallery;
