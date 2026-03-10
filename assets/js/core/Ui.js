/**
 * UI CORE API (Ui.js)
 * -------------------
 * Centraliza patrones de interfaz de usuario reutilizables para garantizar consistencia y rendimiento.
 * 
 * Funcionalidades principales:
 * - Infinite Scroll (Intersection Observer Wrapper)
 * - Generación de Sentinels (Spinners de carga)
 */

export const Ui = {
    /**
     * INICIALIZACIÓN GLOBAL DE UI
     */
    init() {
        // Escuchar cambios de usuario para actualizar la UI global
        window.addEventListener('user-updated', () => {
            this.updateUserUi();
        });
    },

    /**
     * ACTUALIZAR UI DE USUARIO (Avatar y Nombre)
     * Sincroniza los indicadores de usuario en la barra de navegación.
     */
    updateUserUi: async () => {
        const { sessionService } = await import('../services/SessionService.js');
        const { userService } = await import('../services/UserService.js');
        
        const username = sessionService.getUser();
        if (!username) {
            document.getElementById('globalUserName').innerText = 'Usuario';
            document.getElementById('globalUserAvatar')?.classList.add('d-none');
            document.getElementById('globalUserIcon')?.classList.remove('d-none');
            return;
        }

        try {
            const user = await userService.getCurrentProfile();
            const displayName = user?.display_name || username;
            
            document.getElementById('globalUserName').innerText = displayName;
            
            const avatarImg = document.getElementById('globalUserAvatar');
            const userIcon = document.getElementById('globalUserIcon');
            
            if (user?.avatar_url && avatarImg) {
                avatarImg.src = user.avatar_url;
                avatarImg.classList.remove('d-none');
                userIcon?.classList.add('d-none');
            } else if (avatarImg) {
                avatarImg.classList.add('d-none');
                userIcon?.classList.remove('d-none');
            }
        } catch (e) {
            console.warn('[Ui] Error al actualizar UI de usuario:', e);
            document.getElementById('globalUserName').innerText = username;
        }
    },

    /**
     * CONFIGURAR SCROLL INFINITO
     * Crea y gestiona un IntersectionObserver para cargar datos automáticamente al hacer scroll.
     * 
     * @param {Object} config Configuración del scroll
     * @param {Function} config.onLoadMore Función a ejecutar cuando se llega al final
     * @param {string} [config.sentinelId='sentinel-loader'] ID del elemento centinela
     * @param {string} [config.rootMargin='100px'] Margen de anticipación antes de cargar
     * @returns {Object} Controlador con métodos disconnect() y reconnect()
     */
    infiniteScroll: ({ onLoadMore, sentinelId = 'sentinel-loader', rootMargin = '100px' }) => {
        let observer = null;

        const connect = () => {
            const sentinel = document.getElementById(sentinelId);
            if (!sentinel) return; // Si no hay sentinel, no observamos nada (lista vacía o fin de datos)

            if (observer) observer.disconnect();

            observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        onLoadMore();
                    }
                });
            }, {
                root: null,
                rootMargin: rootMargin,
                threshold: 0.1
            });

            observer.observe(sentinel);
        };

        const disconnect = () => {
            if (observer) observer.disconnect();
            observer = null;
        };

        // Auto-conectar inicial si existe el sentinel
        setTimeout(connect, 100);

        return {
            disconnect,
            reconnect: connect
        };
    },

    /**
     * CREAR O OBTENER ELEMENTO SENTINEL (SPINNER ROW)
     * Genera la fila HTML con el spinner para indicar carga.
     * 
     * @param {string} id ID del elemento
     * @param {string} text Texto a mostrar junto al spinner
     * @param {number} colspan Número de columnas que ocupará en la tabla
     * @returns {HTMLElement} Elemento TR listo para insertar
     */
    createSentinelRow: (id, text = 'Cargando más registros...', colspan = 5) => {
        const tr = document.createElement('tr');
        tr.id = id;
        tr.innerHTML = `<td colspan="${colspan}" class="text-center py-2 text-muted small"><span class="spinner-border spinner-border-sm me-2"></span>${text}</td>`;
        return tr;
    },

    /**
     * RENDERIZAR TABLA ESTÁNDAR
     * Genera el HTML del cuerpo de una tabla dado un array de datos y una configuración de columnas.
     * 
     * @param {string} tbodyId - ID del elemento TBODY
     * @param {Array} data - Lista de datos
     * @param {Function} rowRenderer - Función (item, index) => String HTML (TR)
     * @param {string} emptyMessage - Mensaje si no hay datos
     * @param {boolean} append - Si es true, añade los datos al final sin borrar lo existente
     */
    renderTable: (tbodyId, data, rowRenderer, emptyMessage = 'No hay registros.', append = false) => {
        const container = document.getElementById(tbodyId);
        if (!container) {
            console.warn(`[Ui] renderTable: Container '${tbodyId}' not found.`);
            return;
        }

        // Detectar si es una tabla para usar TR/TD o DIV
        const isTable = container.tagName === 'TBODY' || container.tagName === 'TABLE';

        // Si no estamos añadiendo y no hay datos, mostramos mensaje
        if (!append && (!data || data.length === 0)) {
            if (isTable) {
                container.innerHTML = `<tr><td colspan="100%" class="text-center py-4 text-muted">${emptyMessage}</td></tr>`;
            } else {
                container.innerHTML = `<div class="text-center py-3 text-muted w-100 small"><em>${emptyMessage}</em></div>`;
            }
            return;
        }

        // Si estamos añadiendo y no hay datos nuevos, no hacemos nada
        if (append && (!data || data.length === 0)) return;

        const html = data.map((item, index) => rowRenderer(item, index)).join('');

        if (append) {
            // Eliminar sentinels viejos antes de añadir
            const oldLoader = container.querySelector('[id^="sentinel-"]');
            if (oldLoader) oldLoader.remove();
            container.insertAdjacentHTML('beforeend', html);
        } else {
            container.innerHTML = html;
        }
    },

    /**
     * ACTUALIZAR WIDGET DASHBOARD
     * Estandariza la actualización de mini-tablas en el dashboard principal.
     * 
     * @param {string} moduleName - Nombre del módulo (usado para IDs: dash-col-{name}, dash-count-{name}, dash-tabla-{name})
     * @param {Array} data - Datos a mostrar
     * @param {Function} rowRenderer - Función (item) => String HTML (TR)
     * @param {number} limit - (Opcional) Límite de items a mostrar (default 5)
     */
    updateDashboardWidget: (moduleName, data, rowRenderer, limit = 5) => {
        const col = document.getElementById(`dash-col-${moduleName}`);
        const count = document.getElementById(`dash-count-${moduleName}`);
        const table = document.getElementById(`dash-tabla-${moduleName}`);

        const hasData = data && data.length > 0;

        if (col) col.classList.toggle('d-none', !hasData);
        if (count) count.innerText = hasData ? data.length : 0;

        if (table && hasData) {
            // Usamos slice para limitar items en el dashboard
            const slice = data.slice(0, limit);
            table.innerHTML = slice.map(item => rowRenderer(item)).join('');
        } else if (table) {
            table.innerHTML = '';
        }
    },

    /**
     * INICIALIZAR AUTOCOMPLETE DE HABITACIONES
     * Popula un datalist con todas las habitaciones del hotel.
     * 
     * @param {string} datalistId 
     */
    initRoomAutocomplete: async (datalistId) => {
        const datalist = document.getElementById(datalistId);
        if (!datalist) return;

        const { Utils } = await import('./Utils.js');
        const habs = Utils.getHabitaciones();

        datalist.innerHTML = habs.map(h => `<option value="${h.num}">`).join('');
    },

    /**
     * ADJUNTAR VALIDADOR DE HABITACIÓN (Visual & Logic)
     * Proporciona feedback visual (Bootstrap is-valid/is-invalid) en tiempo real.
     * 
     * @param {string} inputId - ID del input de habitación
     * @param {Object} options - { onValidate: (isValid, room) => void, allowEmpty: boolean }
     */
    attachRoomValidator: async (inputId, { onValidate, allowEmpty = true } = {}) => {
        const input = document.getElementById(inputId);
        if (!input) return;

        const { Utils } = await import('./Utils.js');
        const validRooms = Utils.getHabitaciones().map(h => h.num);

        const validate = () => {
            const val = input.value.trim().padStart(3, '0');
            const isEmpty = input.value.trim() === '';
            
            let isValid = false;
            if (isEmpty) {
                isValid = allowEmpty;
            } else {
                isValid = validRooms.includes(val);
            }

            // Aplicar clases de Bootstrap
            input.classList.toggle('is-valid', isValid && !isEmpty);
            input.classList.toggle('is-invalid', !isValid && !isEmpty);

            if (onValidate) onValidate(isValid, isEmpty ? '' : val);
        };

        input.addEventListener('input', validate);
        // Validar inicialmente si hay valor
        if (input.value) validate();
    },

    /**
     * CONFIGURAR CONMUTADOR DE VISTAS (Tabs/Panels)
     * Automatiza el cambio entre vista de Lista, Formulario o Rack.
     * 
     * @param {Object} config
     * @param {Array} config.buttons - [{ id, viewId, onShow }]
     * @param {string} config.activeClass - Clase para el botón activo (default 'active')
     */
    setupViewToggle: ({ buttons, activeClass = 'active' }) => {
        // 0. Determinar cuál debe ser el botón activo inicialmente
        // Prioridad: 1. El que ya tenga la clase active en el HTML, 2. El primero de la lista
        const activeButton = buttons.find(b => document.getElementById(b.id)?.classList.contains(activeClass)) || buttons[0];

        buttons.forEach(btnConfig => {
            const btn = document.getElementById(btnConfig.id);
            if (!btn) return;

            // 1. SINCRONIZACIÓN INICIAL: Aseguramos que el DOM refleje el estado lógico
            const view = document.getElementById(btnConfig.viewId);
            if (view) {
                if (btnConfig.id === activeButton.id) {
                    view.classList.remove('d-none');
                    btn.classList.add(activeClass);
                    // Ejecutar el onShow inicial si existe (ej para renderizar el rack)
                    if (btnConfig.onShow) btnConfig.onShow();
                } else {
                    view.classList.add('d-none');
                    btn.classList.remove(activeClass);
                }
            }

            btn.addEventListener('click', () => {
                // 1. LIMPIEZA GLOBAL DE TOOLTIPS (Evita tooltips "pegados" al cambiar de sección)
                if (window.hideAllTooltips) window.hideAllTooltips();

                // 2. Desactivar todos los botones y ocultar vistas
                buttons.forEach(b => {
                    document.getElementById(b.id)?.classList.remove(activeClass);
                    document.getElementById(b.viewId)?.classList.add('d-none');
                });

                // 3. Activar actual
                btn.classList.add(activeClass);
                const currentView = document.getElementById(btnConfig.viewId);
                if (currentView) {
                    currentView.classList.remove('d-none');
                    // Forzar limpieza de tooltips que puedan haber quedado huerfanos en este contenedor
                    currentView.querySelectorAll('.tooltip').forEach(t => t.remove());
                }

                // 4. Callback opcional (Ej: renderizar el rack)
                if (btnConfig.onShow) btnConfig.onShow();
            });
        });
    },

    /**
     * INICIALIZAR TODOS LOS TOOLTIPS DE UN CONTENEDOR
     * @param {string|HTMLElement} container - Selector o elemento padre
     */
    initTooltips: (container = document) => {
        const parent = typeof container === 'string' ? document.querySelector(container) : container;
        if (!parent || !window.bootstrap?.Tooltip) return;

        const tooltips = parent.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltips.forEach(el => {
            // Limpiar instancia previa si existe
            const old = bootstrap.Tooltip.getInstance(el);
            if (old) {
                try { old.hide(); } catch (e) {}
                old.dispose();
            }

            new bootstrap.Tooltip(el, {
                trigger: 'hover',
                boundary: 'window'
            });
        });
    },

    /**
     * EXTRAER DATOS DE UN FORMULARIO
     * Devuelve un objeto con los valores de todos los inputs, selects y textareas.
     * 
     * @param {HTMLElement|string} formEl - Elemento form o su ID
     * @returns {Object}
     */
    getFormData: (formEl) => {
        const form = typeof formEl === 'string' ? document.getElementById(formEl) : formEl;
        if (!form) {
            console.warn(`[Ui] getFormData: Element or ID '${formEl}' not found.`);
            return {};
        }

        // Defensive check: if form.id is '[object HTMLInputElement]', it's a bug elsewhere
        if (form.id === '[object HTMLInputElement]') {
            console.error('[Ui] CRITICAL: Form ID is "[object HTMLInputElement]". This indicates an element was assigned to an .id property somewhere.');
        }

        if (form.tagName !== 'FORM' && form.tagName !== 'DIV') {
            console.warn(`[Ui] getFormData: Extracting from a non-form element (${form.tagName}). ID: ${form.id || 'unknown'}`);
        }

        console.log(`[Ui] Extracting data from form: ${form.id || 'unknown'}`);
        const data = {};
        form.querySelectorAll('input, select, textarea').forEach(el => {
            const key = el.name || el.id;
            if (!key) return;

            if (el.type === 'checkbox') {
                const val = el.value === 'on' ? true : el.value;
                const isSwitch = form.querySelectorAll(`input[type="checkbox"][name="${key}"], input[type="checkbox"][id="${key}"]`).length === 1;

                if (isSwitch) {
                    data[key] = el.checked;
                } else {
                    if (!data[key]) data[key] = [];
                    if (el.checked) data[key].push(val);
                }
            } else if (el.type === 'radio') {
                if (el.checked) data[key] = el.value;
            } else {
                data[key] = el.value;
            }
        });
        return data;
    },

    /**
     * ASISTENTE DE ENVÍO DE FORMULARIOS OPERATIVOS
     */
    handleFormSubmission: ({ formId, service, idField, onSuccess, mapData, serviceIdField, validate }) => {
        const form = document.getElementById(formId);
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 1. Validar Usuario (Core Logic)
            const { Utils } = await import('./Utils.js');
            const autor = Utils.validateUser();
            if (!autor) return;

            // 2. Extraer Datos
            const rawData = Ui.getFormData(form);

            console.log(`[Ui] Form '${formId}' raw data:`, rawData);

            // 3. Validación Personalizada (Opcional)
            if (validate) {
                const validationResult = await validate(rawData);
                if (validationResult !== true) {
                    Ui.showToast(validationResult || "Error de validación.", "warning");
                    return;
                }
            }

            let idValue = idField ? rawData[idField] : null;

            // FIX: Prevent crash if idValue is undefined/null
            if (idValue === undefined || idValue === null) {
                idValue = '';
            } else {
                idValue = String(idValue).trim();
            }


            // 3. Validar Habitación si aplica (Solo si el ID de campo es exactamente 'habitacion' o termina en '_hab')
            const isHabField = idField && (idField === 'habitacion' || idField === 'hab' || idField.endsWith('_hab'));
            if (isHabField) {
                idValue = idValue.toString().trim().padStart(3, '0');
                const validHabs = Utils.getHabitaciones().map(h => h.num);
                if (!validHabs.includes(idValue)) {
                    Ui.showToast(`Error: La habitación ${idValue} no existe.`, "danger");
                    return;
                }
            }

            // 4. Mapear datos (Añadir autor por defecto)
            let finalData = mapData ? mapData(rawData) : rawData;
            if (!finalData) return; // Validación interna fallida

            // FIX: Ensure pax is a number if present
            if ('pax' in finalData) {
                finalData.pax = parseInt(finalData.pax) || 0;
                if (finalData.pax < 0) finalData.pax = 0;
            }

            finalData.autor = autor;
            finalData.actualizadoEn = new Date().toISOString();

            try {
                // 5. Guardar en el Servicio
                // Si no hay idValue (ej: nueva novedad), se usa Date.now()
                const finalId = idValue || Date.now();
                // Usamos serviceIdField si existe, sino idField (comportamiento legacy), sino 'id' (default BaseService)
                const targetKeyField = serviceIdField || idField;

                // CRITICAL: Handle Edit/Rename logic (Delete Old -> Create New)
                // Usamos dataset.originalId para saber si estamos editando
                const originalId = form.dataset.originalId;

                if (originalId) {
                    // Borrado forzoso del registro anterior para asegurar limpieza total
                    // especialmente si la clave (hab) ha cambiado.
                    await service.removeByKey(originalId.toString().trim(), targetKeyField);
                }

                // Guardar el registro NUEVO (o actualizado)
                await service.setByKey(finalId, finalData, targetKeyField);

                // Cleanup dataset
                delete form.dataset.originalId;

                // 6. Feedback
                Ui.showToast("Registro guardado correctamente.", "success");
                form.reset();

                // Limpiar campos ocultos o visuales especiales
                const hiddenId = form.querySelector(`input[type="hidden"]#${idField}`);
                if (hiddenId) hiddenId.value = '';

                // 7. Success logic (ej: mostrarLista)
                if (onSuccess) onSuccess(finalId, finalData);
            } catch (err) {
                console.error('[Ui] Form Submission Error:', err);
                Ui.showToast(`Error al guardar: ${err.message}`, "danger");
            }
        });
    },

    /**
     * PREPARAR REPORTE DE IMPRESIÓN
     * Centraliza la asignación de metadatos (fecha, autor) en la sección de impresión.
     */
    preparePrintReport: ({ dateId, memberId, memberName, extraMappings = {} }) => {
        const now = new Date();
        const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (dateId) {
            const el = document.getElementById(dateId);
            if (el) el.innerText = dateStr;
        }

        if (memberId && memberName) {
            const el = document.getElementById(memberId);
            if (el) el.innerText = memberName;
        }

        // Mapeos extra (ej: nombres para firmas)
        Object.keys(extraMappings).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = extraMappings[id];
        });
    },

    /**
     * MOSTRAR NOTIFICACIÓN (Toast)
     */
    showToast: (message, type = 'success') => {
        if (window.showToast) {
            window.showToast(message, type);
        } else if (window.showAlert) {
            window.showAlert(message, type);
        } else {
            // Fallback simple si no hay sistema de alertas cargado
            alert(`${type.toUpperCase()}: ${message}`);
        }
    },

    /**
     * MOSTRAR CONFIRMACIÓN
     */
    showConfirm: async (message) => {
        if (window.showConfirm) {
            return await window.showConfirm(message);
        }
        return confirm(message);
    },

    /**
     * OCULTAR TODOS LOS TOOLTIPS
     * Útil antes de imprimir o abrir modales para evitar que se queden "pegados".
     */
    /**
     * OCULTAR TODOS LOS TOOLTIPS
     * Útil antes de imprimir o abrir modales para evitar que se queden "pegados".
     */
    hideAllTooltips: () => {
        try {
            // 1. Cerrar y destruir instancias de Bootstrap PRIMERO
            const triggers = document.querySelectorAll('[data-bs-toggle="tooltip"]');
            triggers.forEach(trigger => {
                try {
                    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
                        const instance = bootstrap.Tooltip.getInstance(trigger);
                        if (instance && typeof instance.dispose === 'function') {
                            instance.dispose();
                        }
                    }
                } catch (e) { /* Ignore individual tooltip errors */ }
            });

            // 2. Eliminar elementos visuales del DOM (Tooltips huérfanos)
            const tooltips = document.querySelectorAll('.tooltip');
            tooltips.forEach(t => t.remove());
        } catch (err) {
            console.error("Error hiding tooltips:", err);
        }
    },

    /**
     * CHECK IF CONFIRM IS AVAILABLE
     * Helper to check if showConfirm is globally available
     */
    hasConfirm: () => {
        return typeof window.showConfirm === 'function';
    },

    /**
     * ENABLE TABLE SORTING
     * Adds sorting functionality to a table based on its headers.
     * 
     * @param {string} tableId - The ID of the table element.
     * @param {Array} data - The array of objects to sort.
     * @param {Function} renderCallback - Function to re-render the table body with sorted data.
     * @param {Object} options - Optional settings (e.g., initialSortColumn, initialSortDirection).
     */
    enableTableSorting: (tableId, data, renderCallback, options = {}) => {
        const table = document.getElementById(tableId);
        if (!table) return;

        const thead = table.querySelector('thead');
        if (!thead) return;

        let currentSortColumn = options.initialSortColumn || null;
        let currentSortDirection = options.initialSortDirection || 'asc';

        // Helper to update arrow icons
        const updateIcons = () => {
            thead.querySelectorAll('th[data-sort]').forEach(th => {
                const col = th.dataset.sort;
                const icon = th.querySelector('.sort-icon');
                if (!icon) {
                    // Create icon if missing
                    const i = document.createElement('i');
                    i.className = 'sort-icon ms-1 text-muted small bi bi-arrow-down-up opacity-25';
                    th.appendChild(i);
                } else {
                    // Reset
                    icon.className = 'sort-icon ms-1 text-muted small bi bi-arrow-down-up opacity-25';
                    if (col === currentSortColumn) {
                        icon.className = `sort-icon ms-1 small bi bi-arrow-${currentSortDirection === 'asc' ? 'down' : 'up'} text-primary`;
                    }
                }
            });
        };

        // Attach click handlers
        thead.querySelectorAll('th[data-sort]').forEach(th => {
            // Ensure cursor pointer
            th.style.cursor = 'pointer';

            // Add icon initially
            if (!th.querySelector('.sort-icon')) {
                const i = document.createElement('i');
                i.className = 'sort-icon ms-1 text-muted small bi bi-arrow-down-up opacity-25';
                th.appendChild(i);
            }

            // Remove old listeners (cloning is a quick way, but might break other listeners. 
            // Better to check if already initialized or use a specific class).
            // For now, we assume this is called once per table init.

            th.onclick = () => {
                const column = th.dataset.sort;

                if (currentSortColumn === column) {
                    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSortColumn = column;
                    currentSortDirection = 'asc';
                }

                // Sort Data
                const sortedData = [...data].sort((a, b) => {
                    let valA = a[column];
                    let valB = b[column];

                    // Handle nulls
                    if (valA == null) valA = "";
                    if (valB == null) valB = "";

                    // Numeric check
                    if (!isNaN(valA) && !isNaN(valB) && valA !== "" && valB !== "") {
                        return currentSortDirection === 'asc' ? valA - valB : valB - valA;
                    }

                    // String Compare
                    valA = valA.toString().toLowerCase();
                    valB = valB.toString().toLowerCase();

                    if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
                    if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
                    return 0;
                });

                updateIcons();
                renderCallback(sortedData);
            };
        });

        // Initial Icon State
        updateIcons();
    },

    /**
     * MOSTRAR LOADING GLOBAL
     */
    showLoading: (message = "Cargando...") => {
        let loader = document.getElementById('global-ui-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'global-ui-loader';
            loader.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(255,255,255,0.7); display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:9999; backdrop-filter:blur(3px);';
            loader.innerHTML = `
                <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;"></div>
                <h5 class="fw-bold text-primary animate__animated animate__pulse animate__infinite" id="loader-msg">${message}</h5>
            `;
            document.body.appendChild(loader);
        } else {
            const msgEl = loader.querySelector('#loader-msg');
            if (msgEl) msgEl.innerText = message;
            loader.style.display = 'flex';
        }
    },

    /**
     * OCULTAR LOADING GLOBAL
     */
    hideLoading: () => {
        const loader = document.getElementById('global-ui-loader');
        if (loader) loader.style.display = 'none';
    },

    /**
     * MOSTRAR PROMPT (Entrada de texto)
     */
    showPrompt: async (message, type = 'text') => {
        if (window.showPrompt) {
            return await window.showPrompt(message, type);
        }
        return prompt(message);
    }
};
