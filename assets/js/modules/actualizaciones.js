/**
 * Módulo de Actualizaciones del Sistema
 * Permite verificar e instalar actualizaciones del Agent
 */

import { Api } from '../core/Api.js';
import { Modal } from '../core/Modal.js';

const Actualizaciones = {
    checking: false,
    installing: false,
    statusCheckInterval: null,

    /**
     * Inicializa el módulo de actualizaciones
     */
    init() {
        console.log('[ACTUALIZACIONES] Módulo inicializado');
        this.attachEventListeners();

        // NO cargar la versión automáticamente - esperar a que el usuario abra el panel
        // Esto mejora significativamente el tiempo de carga
    },

    /**
     * Carga la versión actual (lazy loading)
     */
    async loadVersion() {
        if (this._versionLoaded) return;
        this._versionLoaded = true;

        try {
            const versionData = await Api.get('/api/updates/version');
            const currentVersionEl = document.getElementById('current-version');
            if (currentVersionEl) {
                currentVersionEl.textContent = versionData.version || '1.0.0';
            }
        } catch (error) {
            console.warn('[ACTUALIZACIONES] No se pudo cargar la versión actual:', error);
            const currentVersionEl = document.getElementById('current-version');
            if (currentVersionEl) {
                currentVersionEl.textContent = 'No disponible';
            }
        }
    },

    /**
     * Asocia event listeners a los botones
     */
    attachEventListeners() {
        const checkButton = document.getElementById('btn-check-updates');
        const installButton = document.getElementById('btn-install-updates');

        if (checkButton) {
            checkButton.addEventListener('click', () => this.checkForUpdates());
        }

        if (installButton) {
            installButton.addEventListener('click', () => this.installUpdate());
        }

        // Detectar cuando el usuario abre el panel de actualizaciones
        // Buscar el collapse del acordeón
        const updateSection = document.querySelector('[data-bs-target="#collapse-actualizaciones"]');
        if (updateSection) {
            updateSection.addEventListener('click', () => {
                // Cargar la versión cuando el usuario abra el panel
                setTimeout(() => this.loadVersion(), 100);
            });
        }
    },

    /**
     * Verifica si hay actualizaciones disponibles
     */
    async checkForUpdates() {
        if (this.checking) return;

        this.checking = true;
        this.updateUI({
            checking: true,
            message: 'Verificando actualizaciones...'
        });

        try {
            const versionData = await Api.get('/api/updates/version');
            const currentVersionEl = document.getElementById('current-version');
            if (currentVersionEl) {
                currentVersionEl.textContent = versionData.version || '1.0.0';
            }

            const serverCheck = await Api.get('/api/updates/check?version=' + versionData.version);
            console.log('[ACTUALIZACIONES]', serverCheck);

            // Actualizar fecha de última verificación
            const lastCheckEl = document.getElementById('last-check');
            if (lastCheckEl) {
                const now = new Date();
                lastCheckEl.textContent = now.toLocaleString('es-ES');
            }

            if (serverCheck.updateAvailable) {
                this.showUpdateAvailable(serverCheck, agentVersion.version);
            } else {
                this.showNoUpdates(agentVersion.version);
            }

        } catch (error) {
            console.error('[ACTUALIZACIONES] Error verificando actualizaciones:', error);
            Modal.error(
                'Error al verificar actualizaciones',
                error.message || 'No se pudo conectar con el servidor de actualizaciones'
            );
        } finally {
            this.checking = false;
            this.updateUI({ checking: false });
        }
    },

    /**
     * Muestra información de actualización disponible
     */
    showUpdateAvailable(updateInfo, currentVersion) {
        // Crear modal personalizado usando la infraestructura existente
        const modalEl = document.getElementById('globalSystemModal');
        if (!modalEl) {
            console.error('[ACTUALIZACIONES] Modal no disponible');
            return;
        }

        const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);

        // Configurar contenido del modal
        const header = document.getElementById('globalModalHeader');
        header.className = 'modal-header text-white border-0 py-2 bg-success';

        document.getElementById('globalModalTitle').innerText = '¡ACTUALIZACIÓN DISPONIBLE!';
        document.getElementById('globalModalIcon').className = 'display-1 mb-3 text-success';
        document.getElementById('globalModalIcon').innerHTML = '<i class="bi bi-arrow-up-circle-fill"></i>';

        const messageHtml = `
            <div style="text-align: left;">
                <p><strong>Versión actual:</strong> ${currentVersion}</p>
                <p><strong>Nueva versión:</strong> ${updateInfo.latestVersion}</p>
                <p><strong>Fecha:</strong> ${updateInfo.buildDate}</p>
                <br>
                <p><strong>Cambios:</strong></p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    ${updateInfo.changelog.map(item => `<li>${item}</li>`).join('')}
                </ul>
                <br>
                <div style="background: #e3f2fd; padding: 10px; border-left: 4px solid #2196F3; margin: 10px 0;">
                    <p style="margin: 0; color: #1976D2;"><strong>💡 Modo de Prueba:</strong></p>
                    <p style="margin: 5px 0 0 0; color: #555; font-size: 0.9em;">
                        Puedes probar el sistema de actualización sin modificar archivos.
                    </p>
                </div>
                <p style="color: #ff9800;">⚠️ El sistema se reiniciará después de la actualización real.</p>
            </div>`;

        document.getElementById('globalModalMessage').innerHTML = messageHtml;
        document.getElementById('globalModalInputContainer').classList.add('d-none');

        // Crear botones personalizados
        const footer = document.getElementById('globalModalFooter');
        footer.innerHTML = `
            <button class="btn btn-outline-secondary btn-lg px-4 fw-bold me-2" data-action="cancel">Más Tarde</button>
            <button class="btn btn-info btn-lg px-4 fw-bold me-2" data-action="test">Probar (sin cambios)</button>
            <button class="btn btn-success btn-lg px-4 fw-bold" data-action="install">Instalar Ahora</button>
        `;

        // Asignar eventos a los botones
        const btnCancel = footer.querySelector('[data-action="cancel"]');
        const btnTest = footer.querySelector('[data-action="test"]');
        const btnInstall = footer.querySelector('[data-action="install"]');

        btnCancel.onclick = () => modalInstance.hide();
        btnTest.onclick = () => {
            modalInstance.hide();
            this.installUpdate(true);
        };
        btnInstall.onclick = () => {
            modalInstance.hide();

            // Advertir que la actualización real está en desarrollo
            setTimeout(() => {
                Modal.confirm(
                    'Actualización Real',
                    '⚠️ La actualización real está actualmente en fase de pruebas y puede fallar debido a validaciones de hash.\n\n' +
                    '¿Prefieres usar el <strong>Modo de Prueba</strong> que simula el proceso sin riesgos?\n\n' +
                    'Solo continúa si entiendes que puede haber errores.',
                    () => this.installUpdate(false),
                    () => {},
                    'Continuar de todas formas',
                    'Cancelar'
                );
            }, 300);
        };

        // Mostrar modal
        modalEl.removeAttribute('aria-hidden');
        modalInstance.show();
    },

    /**
     * Muestra mensaje cuando no hay actualizaciones
     */
    showNoUpdates(currentVersion) {
        Modal.success(
            'Sistema Actualizado',
            `Ya tienes la última versión instalada (${currentVersion}).`
        );
    },

    /**
     * Instala la actualización
     * @param {boolean} testMode - Si es true, ejecuta en modo de prueba
     */
    async installUpdate(testMode = false) {
        if (this.installing) return;

        this.installing = true;

        // Mostrar progreso
        const progressModal = this.showProgressModal();

        try {
            // Iniciar instalación en el agent (con modo de prueba si está activado)
            const endpoint = testMode
                ? '/api/agent/updates/install?mode=test'
                : '/api/agent/updates/install';

            const response = await Api.postToAgent(endpoint, {});

            if (!response.success) {
                throw new Error('No se pudo iniciar la actualización');
            }

            if (testMode) {
                console.log('[ACTUALIZACIONES] Modo de prueba activado - No se modificarán archivos');
            }

            // Monitorear progreso
            this.startStatusMonitoring(progressModal);

        } catch (error) {
            console.error('[ACTUALIZACIONES] Error instalando actualización:', error);
            this.closeProgressModal(progressModal);
            Modal.error(
                'Error en la Actualización',
                error.message || 'No se pudo instalar la actualización'
            );
            this.installing = false;
        }
    },

    /**
     * Muestra modal de progreso
     */
    showProgressModal() {
        const modal = document.createElement('div');
        modal.className = 'update-progress-modal';
        modal.innerHTML = `
            <div class="modal-overlay" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            ">
                <div class="modal-content" style="
                    background: white;
                    padding: 30px;
                    border-radius: 8px;
                    min-width: 400px;
                    max-width: 600px;
                    text-align: center;
                ">
                    <h2 style="margin-top: 0;">Actualizando Sistema</h2>

                    <div class="progress-bar-container" style="
                        width: 100%;
                        height: 30px;
                        background: #f0f0f0;
                        border-radius: 15px;
                        overflow: hidden;
                        margin: 20px 0;
                    ">
                        <div class="progress-bar" style="
                            height: 100%;
                            background: linear-gradient(90deg, #4CAF50, #8BC34A);
                            width: 0%;
                            transition: width 0.3s ease;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-weight: bold;
                        ">
                            <span class="progress-text">0%</span>
                        </div>
                    </div>

                    <div class="status-message" style="
                        margin: 15px 0;
                        color: #666;
                        min-height: 20px;
                    ">
                        Preparando actualización...
                    </div>

                    <div class="current-file" style="
                        margin: 10px 0;
                        color: #999;
                        font-size: 0.9em;
                        min-height: 20px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    "></div>

                    <div class="spinner" style="
                        margin: 20px auto;
                        border: 3px solid #f3f3f3;
                        border-top: 3px solid #4CAF50;
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 1s linear infinite;
                    "></div>
                </div>
            </div>

            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        document.body.appendChild(modal);
        return modal;
    },

    /**
     * Actualiza el modal de progreso
     */
    updateProgressModal(modal, status) {
        const progressBar = modal.querySelector('.progress-bar');
        const progressText = modal.querySelector('.progress-text');
        const statusMessage = modal.querySelector('.status-message');
        const currentFile = modal.querySelector('.current-file');

        if (progressBar && progressText) {
            progressBar.style.width = `${status.progress || 0}%`;
            progressText.textContent = `${status.progress || 0}%`;
        }

        if (statusMessage) {
            let message = 'Preparando actualización...';

            if (status.downloading) {
                message = 'Descargando archivos...';
            } else if (status.installing) {
                message = 'Instalando actualización...';
            } else if (status.progress >= 100) {
                message = '¡Actualización completada!';
            }

            statusMessage.textContent = message;
        }

        if (currentFile && status.currentFile) {
            currentFile.textContent = status.currentFile;
        }
    },

    /**
     * Cierra el modal de progreso
     */
    closeProgressModal(modal) {
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    },

    /**
     * Monitorea el estado de la actualización
     */
    startStatusMonitoring(modal) {
        let checkCount = 0;
        const maxChecks = 120; // 2 minutos máximo

        this.statusCheckInterval = setInterval(async () => {
            try {
                checkCount++;

                if (checkCount > maxChecks) {
                    throw new Error('Tiempo de espera agotado');
                }

                const status = await Api.getFromAgent('/api/agent/updates/status');
                console.log('[ACTUALIZACIONES] Estado:', status);

                this.updateProgressModal(modal, status);

                // Si hay error
                if (status.error) {
                    this.stopStatusMonitoring();
                    this.closeProgressModal(modal);

                    // Resetear el estado del updater
                    await Api.postToAgent('/api/agent/updates/reset', {});

                    Modal.error(
                        'Error en la Actualización',
                        `La actualización falló: ${status.error}\n\n` +
                        '💡 <strong>Recomendación:</strong> Usa el "Modo de Prueba" para verificar el sistema sin modificar archivos.\n\n' +
                        'El estado del updater ha sido reseteado automáticamente.'
                    );
                    this.installing = false;
                    return;
                }

                // Si completó
                if (status.progress >= 100 && !status.downloading && !status.installing) {
                    this.stopStatusMonitoring();
                    this.closeProgressModal(modal);
                    this.showUpdateComplete();
                }

            } catch (error) {
                console.error('[ACTUALIZACIONES] Error monitoreando estado:', error);
                this.stopStatusMonitoring();
                this.closeProgressModal(modal);

                // Intentar resetear el estado
                try {
                    await Api.postToAgent('/api/agent/updates/reset', {});
                } catch (e) {
                    console.error('[ACTUALIZACIONES] No se pudo resetear el estado:', e);
                }

                Modal.error(
                    'Error en la Actualización',
                    (error.message || 'No se pudo completar la actualización') + '\n\n' +
                    '💡 <strong>Recomendación:</strong> Usa el "Modo de Prueba" para verificar el sistema sin modificar archivos.'
                );
                this.installing = false;
            }
        }, 1000); // Cada segundo
    },

    /**
     * Detiene el monitoreo de estado
     */
    stopStatusMonitoring() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
    },

    /**
     * Muestra mensaje de actualización completada
     */
    showUpdateComplete() {
        Modal.success(
            '¡Actualización Completada!',
            'El sistema se ha actualizado correctamente. Se recomienda reiniciar la aplicación para aplicar todos los cambios.',
            () => {
                // Ofrecer reiniciar
                Modal.confirm(
                    'Reiniciar Aplicación',
                    '¿Deseas reiniciar la aplicación ahora?',
                    () => this.restartApplication(),
                    () => {},
                    'Reiniciar',
                    'Más Tarde'
                );
            }
        );

        this.installing = false;
    },

    /**
     * Reinicia la aplicación
     */
    async restartApplication() {
        try {
            // Intentar cerrar procesos vía API del agent
            await Api.postToAgent('/api/system/restart', {});
        } catch (error) {
            console.log('[ACTUALIZACIONES] No se pudo reiniciar automáticamente');
        }

        // Recargar la página
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    },

    /**
     * Actualiza la UI del módulo
     */
    updateUI(state) {
        const checkButton = document.getElementById('btn-check-updates');
        const statusText = document.getElementById('update-status-text');

        if (checkButton) {
            checkButton.disabled = state.checking || this.installing;
            checkButton.textContent = state.checking ? 'Verificando...' : 'Buscar Actualizaciones';
        }

        if (statusText && state.message) {
            statusText.textContent = state.message;
        }
    },

    /**
     * Renderiza el HTML del módulo
     */
    render() {
        return `
            <div class="actualizaciones-module">
                <div class="module-header">
                    <h2>
                        <i class="fas fa-sync-alt"></i>
                        Actualizaciones del Sistema
                    </h2>
                </div>

                <div class="module-content">
                    <div class="update-info-card">
                        <div class="info-section">
                            <label>Versión Actual:</label>
                            <span id="current-version">Cargando...</span>
                        </div>

                        <div class="info-section">
                            <label>Última Verificación:</label>
                            <span id="last-check">Nunca</span>
                        </div>

                        <div class="info-section">
                            <label>Estado:</label>
                            <span id="update-status-text" class="status-text">Listo</span>
                        </div>
                    </div>

                    <div class="actions-section">
                        <button
                            id="btn-check-updates"
                            class="btn btn-primary btn-large"
                        >
                            <i class="fas fa-search"></i>
                            Buscar Actualizaciones
                        </button>
                    </div>

                    <div class="update-notes">
                        <h3>Información</h3>
                        <ul>
                            <li>Las actualizaciones se descargan automáticamente del servidor central</li>
                            <li>Se realiza un backup automático antes de actualizar</li>
                            <li>Si algo falla, el sistema se restaura automáticamente</li>
                            <li>Se recomienda cerrar otras aplicaciones antes de actualizar</li>
                        </ul>
                    </div>
                </div>
            </div>

            <style>
                .actualizaciones-module {
                    padding: 20px;
                }

                .module-header {
                    border-bottom: 2px solid #4CAF50;
                    padding-bottom: 15px;
                    margin-bottom: 25px;
                }

                .module-header h2 {
                    margin: 0;
                    color: #333;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .update-info-card {
                    background: #f9f9f9;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 25px;
                }

                .info-section {
                    display: flex;
                    justify-content: space-between;
                    padding: 10px 0;
                    border-bottom: 1px solid #eee;
                }

                .info-section:last-child {
                    border-bottom: none;
                }

                .info-section label {
                    font-weight: 600;
                    color: #555;
                }

                .info-section span {
                    color: #333;
                }

                .status-text {
                    font-weight: 600;
                    color: #4CAF50;
                }

                .actions-section {
                    text-align: center;
                    margin: 30px 0;
                }

                .btn-large {
                    padding: 15px 40px;
                    font-size: 16px;
                    font-weight: 600;
                }

                .update-notes {
                    background: #fff3cd;
                    border: 1px solid #ffc107;
                    border-radius: 8px;
                    padding: 15px;
                    margin-top: 25px;
                }

                .update-notes h3 {
                    margin-top: 0;
                    color: #856404;
                }

                .update-notes ul {
                    margin: 10px 0;
                    padding-left: 25px;
                }

                .update-notes li {
                    color: #856404;
                    margin: 8px 0;
                }
            </style>
        `;
    }
};

export default Actualizaciones;
