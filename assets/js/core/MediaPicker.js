import { Api } from './Api.js';
import { IconSelector } from './IconSelector.js';

/**
 * MEDIA FILLER / UNIFIED PICKER (MediaPicker)
 * -------------------------------------------
 * Componente unificado para seleccionar recursos (Iconos, Archivos, Imágenes).
 * Abstrae la lógica de selección para usarla en cualquier parte del sistema.
 */
export const MediaPicker = {
    
    /**
     * SELECCIONAR ICONO
     * Abre el selector de iconos de Bootstrap.
     * @param {string} targetInputId - ID del input donde se escribirá el valor.
     */
    pickIcon(targetInputId) {
        // Por ahora reutilizamos el potente IconSelector existente, pero lo exponemos centralizado.
        IconSelector.open(targetInputId);
    },

    /**
     * SELECCIONAR ARCHIVO
     * Abre un explorador de archivos del servidor (File Browser).
     * @param {Object} options - Opciones de configuración
     * @param {Function} options.onSelect - Callback(path) al seleccionar.
     * @param {string} [options.fileType='any'] - 'executable', 'image', 'any'. (Afecta al icono y filtro visual).
     * @param {string} [options.startPath='C:\\'] - Ruta inicial.
     */
    async pickFile({ onSelect, fileType = 'any', startPath = 'C:\\' }) {
        this._ensureFileBrowserModal();
        
        const modalEl = document.getElementById('mediaPickerModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        
        // Configurar título y contexto según tipo
        const titleEl = modalEl.querySelector('.modal-title');
        const helpEl = modalEl.querySelector('#mp-help-text');
        
        if (fileType === 'executable' || fileType === 'any') {
            titleEl.innerHTML = '<i class="bi bi-file-earmark-code me-2"></i>Seleccionar App o Archivo';
            helpEl.textContent = 'Busca la aplicación (.exe) o el documento que quieras abrir.';
        } else if (fileType === 'image') {
            titleEl.innerHTML = '<i class="bi bi-image me-2"></i>Seleccionar Imagen';
            helpEl.textContent = 'Selecciona una imagen (jpg, png, webp).';
        } else if (fileType === 'folder' || fileType === 'documentos') {
            titleEl.innerHTML = fileType === 'folder' ? '<i class="bi bi-folder-check me-2"></i>Seleccionar Carpeta' : '<i class="bi bi-file-earmark-medical me-2"></i>Documentos (Archivo o Carpeta)';
            helpEl.textContent = fileType === 'folder' ? 'Navega y pulsa "Seleccionar esta carpeta".' : 'Selecciona un archivo o pulsa "Seleccionar esta carpeta" para listar su contenido.';
        } else {
            titleEl.innerHTML = '<i class="bi bi-folder2-open me-2"></i>Explorador de Archivos';
            helpEl.textContent = 'Navega por el servidor local.';
        }

        // Setup navegación
        this._currentSelectCallback = onSelect;
        this._currentFileType = fileType;
        
        // Show/Hide "Select Folder" button
        const selectFolderBtn = modalEl.querySelector('#btn-mp-select-folder');
        if (selectFolderBtn) {
            selectFolderBtn.classList.toggle('d-none', fileType !== 'folder' && fileType !== 'documentos');
            // Remove old listeners to avoid duplicates
            const newBtn = selectFolderBtn.cloneNode(true);
            selectFolderBtn.parentNode.replaceChild(newBtn, selectFolderBtn);
            
            newBtn.onclick = () => {
                const currentPath = document.getElementById('mp-current-path').value;
                this._confirmSelection(currentPath);
            };
        }

        await this._loadPath(startPath);
        modal.show();
    },

    // --- INTERNALS (File Browser Logic) ---

    async _loadPath(targetPath) {
        const container = document.getElementById('mp-list');
        const pathInput = document.getElementById('mp-current-path');
        const btnUp = document.getElementById('btn-mp-up');
        
        pathInput.value = targetPath;
        container.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary"></div></div>'; // Loading state
        
        // Lógica de "Subir nivel"
        btnUp.onclick = () => {
            const parts = targetPath.split(/[/\\]/);
            parts.pop(); // Remove last segment
            // Manejar raíz de Windows C: o C:\
            if (parts.length === 1 && parts[0].includes(':')) parts[0] += '\\';
            const parent = parts.join('\\') || 'C:\\';
            this._loadPath(parent);
        };

        try {
            const data = await Api.post('system/list-files', { currentPath: targetPath });
            container.innerHTML = '';
            
            if (!data.items || data.items.length === 0) {
                container.innerHTML = '<div class="text-center p-4 text-muted"><i class="bi bi-inbox fs-1 d-block mb-2"></i>Carpeta vacía</div>';
                return;
            }

            // Ordenar: Carpetas primero
            const sorted = data.items.sort((a,b) => (a.isDirectory === b.isDirectory) ? 0 : a.isDirectory ? -1 : 1);

            sorted.forEach(item => {
                // Filtrado visual simple
                let icon = item.isDirectory ? 'folder-fill text-warning' : 'file-earmark text-secondary';
                
                // Si es modo 'folder', solo las carpetas son relevantes visualmente, pero se listan archivos para contexto
                if (!item.isDirectory) {
                    const ext = item.name.split('.').pop().toLowerCase();
                    if (this._currentFileType === 'executable') {
                        icon = 'file-earmark-binary';
                        if (ext === 'exe' || ext === 'bat') icon += ' text-success';
                    } else if (this._currentFileType === 'image') {
                        icon = 'file-earmark-image';
                        if (['jpg','jpeg','png','webp','gif'].includes(ext)) {
                            icon += ' text-primary';
                        }
                    }
                }

                const div = document.createElement('div');
                div.className = "list-group-item list-group-item-action d-flex align-items-center pointer border-0 border-bottom py-2";
                if (item.isDirectory) div.style.backgroundColor = 'rgba(0,0,0,0.01)';
                
                // Mute files in folder mode
                if (this._currentFileType === 'folder' && !item.isDirectory) {
                    div.style.opacity = '0.5';
                }

                div.innerHTML = `
                    <div class="me-3 fs-4"><i class="bi bi-${icon}"></i></div>
                    <div class="text-truncate flex-grow-1">
                        <div class="fw-medium text-dark">${item.name}</div>
                        ${!item.isDirectory ? `<small class="text-muted" style="font-size:0.75rem">${this._formatSize(item.size)}</small>` : ''}
                    </div>
                `;

                div.onclick = () => {
                    if (item.isDirectory) {
                        this._loadPath(item.path);
                    } else if (this._currentFileType !== 'folder') {
                        // Selección de archivo
                         this._confirmSelection(item.path);
                    }
                };
                container.appendChild(div);
            });

        } catch (e) {
            container.innerHTML = `<div class="alert alert-danger m-3"><i class="bi bi-exclamation-triangle me-2"></i>Error: ${e.message}</div>`;
        }
    },

    _confirmSelection(path) {
         if (this._currentSelectCallback) {
             this._currentSelectCallback(path);
         }
         const modal = bootstrap.Modal.getInstance(document.getElementById('mediaPickerModal'));
         modal.hide();
    },

    _formatSize(bytes) {
        if (!bytes) return '';
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * INYECCIÓN DEL MODAL EN EL DOM
     * Solo se ejecuta una vez.
     */
    _ensureFileBrowserModal() {
        if (document.getElementById('mediaPickerModal')) return;

        const modalHtml = `
        <div class="modal fade" id="mediaPickerModal" tabindex="-1" aria-hidden="true" style="z-index: 10060;">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content border-0 shadow-lg overflow-hidden" style="border-radius: 12px;">
                    <div class="modal-header bg-dark text-white py-3 border-0">
                        <h6 class="modal-title fw-bold text-uppercase fs-6 ls-1">Explorador</h6>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    
                    <!-- Barra de Dirección -->
                    <div class="bg-light p-2 border-bottom d-flex gap-2 align-items-center px-3 shadow-sm">
                        <button class="btn btn-sm btn-white border shadow-sm" id="btn-mp-up" title="Subir nivel">
                            <i class="bi bi-arrow-up-short fs-5"></i>
                        </button>
                        <div class="input-group input-group-sm">
                            <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-hdd-network"></i></span>
                            <input type="text" id="mp-current-path" class="form-control form-control-sm fw-bold border-start-0" readonly value="C:\\">
                        </div>
                    </div>

                    <div class="modal-body p-0">
                        <div id="mp-list" class="list-group list-group-flush overflow-auto custom-scrollbar" style="height: 400px; scroll-behavior: smooth;">
                           <!-- Items injected here -->
                        </div>
                    </div>

                    <div class="modal-footer py-2 bg-light border-top">
                        <small id="mp-help-text" class="text-muted me-auto small fw-bold">Selecciona un archivo</small>
                        <button type="button" class="btn btn-primary btn-sm px-3 rounded-pill d-none" id="btn-mp-select-folder"><i class="bi bi-check-lg me-1"></i>Seleccionar esta carpeta</button>
                        <button type="button" class="btn btn-outline-secondary btn-sm px-3 rounded-pill" data-bs-dismiss="modal">Cancelar</button>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
};

window.MediaPicker = MediaPicker; // Expose global
