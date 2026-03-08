/**
 * SISTEMA GLOBAL DE MODALES (Estilo Alarma)
 * -----------------------------------------
 * Este módulo sustituye los "alert()" feos del navegador por ventanas 
 * de diseño moderno basadas en Bootstrap. 
 * Permite mostrar mensajes de Éxito, Error, Advertencia o Confirmación.
 */

// Configuración de colores e iconos según el tipo de mensaje
const modalStyles = {
    error: { color: 'danger', icon: 'bi-exclamation-octagon-fill', title: 'ERROR' },
    success: { color: 'success', icon: 'bi-check-circle-fill', title: 'ÉXITO' },
    warning: { color: 'warning', icon: 'bi-exclamation-triangle-fill', title: 'ATENCIÓN' },
    info: { color: 'primary', icon: 'bi-info-circle-fill', title: 'INFORMACIÓN' },
    question: { color: 'primary', icon: 'bi-question-circle-fill', title: 'CONFIRMACIÓN' }
};

let systemModalInstance = null; // Instancia única del modal en el sistema
let toastContainer = null; // Contenedor para notificaciones rápidas (toasts)

// HTML base que se inyectará en la página al arrancar
const modalHTML = `
<div class="modal fade d-print-none" id="globalSystemModal" tabindex="-1" style="z-index: 10060;" data-bs-backdrop="static" data-bs-keyboard="false" aria-labelledby="globalModalTitle" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content shadow-lg border-0 overflow-hidden" id="globalModalContent">
            <div class="modal-header text-white border-0 py-2" id="globalModalHeader">
                <h5 class="modal-title fw-bold" id="globalModalTitle">AVISO</h5>
            </div>
            <div class="modal-body text-center p-4">
                <div class="display-1 mb-3" id="globalModalIcon"></div>
                <h4 class="fw-bold mb-2 text-dark" id="globalModalMessage"></h4>
                <div id="globalModalInputContainer" class="d-none mt-4">
                    <input type="text" id="globalModalInput" class="form-control form-control-lg text-center border-2" autocomplete="off">
                </div>
            </div>
            <div class="modal-footer justify-content-center border-0 pb-4 pt-0" id="globalModalFooter"></div>
        </div>
    </div>
</div>`;

/**
 * Función interna para asegurar que el HTML del modal existe en el body del documento.
 */
function ensureModalExists() {
    if (!document.getElementById('globalSystemModal')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        systemModalInstance = bootstrap.Modal.getOrCreateInstance(document.getElementById('globalSystemModal'));
    } else if (!systemModalInstance) {
        systemModalInstance = bootstrap.Modal.getOrCreateInstance(document.getElementById('globalSystemModal'));
    }
    return systemModalInstance;
}

/**
 * Configura la apariencia del modal (icono, color, texto) antes de mostrarlo.
 */
function setupModalUI(type, msg) {
    const style = modalStyles[type] || modalStyles.info;
    const header = document.getElementById('globalModalHeader');

    // Cambiar colores y clases
    header.className = `modal-header text-white border-0 py-2 bg-${style.color}`;
    document.getElementById('globalModalIcon').className = `display-1 mb-3 text-${style.color}`;

    document.getElementById('globalModalTitle').innerText = style.title;
    document.getElementById('globalModalIcon').innerHTML = `<i class="bi ${style.icon}"></i>`;
    document.getElementById('globalModalMessage').innerHTML = msg; // Soporta HTML para negritas, etc.
    document.getElementById('globalModalInputContainer').classList.add('d-none');
    document.getElementById('globalModalFooter').innerHTML = '';
}

export const Modal = {
    /**
     * INICIALIZACIÓN
     * Prepara el modal y sobrescribe el alert() nativo de JavaScript.
     */
    init: () => {
        ensureModalExists();
        window.systemModal = systemModalInstance;

        // Ahora, cada vez que el código use alert("hola"), saldrá nuestro modal bonito.
        window.alert = (msg) => Modal.showAlert(msg, 'error');
        
        // Exponer helpers globalmente
        window.showAlert = Modal.showAlert;
        window.showConfirm = Modal.showConfirm;
        window.showPrompt = Modal.showPrompt;
        window.showToast = Modal.showToast;
    },

    /**
     * MUESTRA UNA NOTIFICACIÓN RÁPIDA (Toast) QUE SE CIERRA SOLA
     */
    showToast: (msg, type = 'success', duration = 2500) => {
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'globalToastContainer';
            toastContainer.style = 'position:fixed; bottom:20px; left:20px; z-index:10070; pointer-events:none;';
            document.body.appendChild(toastContainer);
        }

        const style = modalStyles[type] || modalStyles.info;
        const toast = document.createElement('div');
        toast.className = `animate__animated animate__fadeInUp bg-${style.color} text-white px-4 py-2 rounded-pill shadow-lg mb-2 d-flex align-items-center`;
        toast.style = 'pointer-events: auto; min-width: 200px; cursor: pointer;';
        toast.innerHTML = `
            <i class="bi ${style.icon} me-3 fs-5"></i>
            <div class="fw-bold">${msg}</div>
        `;

        toastContainer.appendChild(toast);

        // Auto-eliminar
        const hide = () => {
            toast.classList.replace('animate__fadeInUp', 'animate__fadeOutDown');
            setTimeout(() => toast.remove(), 500);
        };

        const timer = setTimeout(hide, duration);
        toast.onclick = () => { clearTimeout(timer); hide(); };
    },

    /**
     * MUESTRA UNA ALERTA SIMPLE
     */
    showAlert: (msg, type = 'error') => {
        return new Promise(resolve => {
            ensureModalExists();
            setupModalUI(type, msg);

            const footer = document.getElementById('globalModalFooter');
            footer.innerHTML = `<button class="btn btn-${modalStyles[type]?.color || 'primary'} btn-lg px-5 fw-bold shadow-sm" onclick="systemModal.hide()">ENTENDIDO</button>`;

            const el = document.getElementById('globalSystemModal');
            const onHide = () => {
                el.removeEventListener('hidden.bs.modal', onHide);
                resolve();
            };
            el.addEventListener('hidden.bs.modal', onHide);

            // FIX: Asegurar visibilidad para tecnologías de asistencia
            el.removeAttribute('aria-hidden');
            
            systemModalInstance.show();
        });
    },

    /**
     * MUESTRA UNA VENTANA DE CONFIRMACIÓN (SÍ/NO)
     */
    showConfirm: (msg) => {
        return new Promise(resolve => {
            ensureModalExists();
            setupModalUI('question', msg);

            const footer = document.getElementById('globalModalFooter');
            footer.innerHTML = `
                <button class="btn btn-outline-secondary btn-lg px-4 fw-bold me-2" onclick="this.dataset.res='false'; systemModal.hide()">CANCELAR</button>
                <button class="btn btn-primary btn-lg px-4 fw-bold" onclick="this.dataset.res='true'; systemModal.hide()">CONFIRMAR</button>
            `;

            const el = document.getElementById('globalSystemModal');
            let result = false;

            const btns = footer.querySelectorAll('button');
            btns.forEach(b => b.addEventListener('click', (e) => {
                result = e.currentTarget.dataset.res === 'true';
            }));

            const onHide = () => {
                el.removeEventListener('hidden.bs.modal', onHide);
                resolve(result);
            };
            el.addEventListener('hidden.bs.modal', onHide);

            // FIX
            el.removeAttribute('aria-hidden');

            systemModalInstance.show();
        });
    },

    /**
     * MUESTRA UN CAMPO PARA INTRODUCIR TEXTO
     */
    showPrompt: (msg, inputType = 'text') => {
        return new Promise(resolve => {
            ensureModalExists();
            setupModalUI('question', msg);

            const inputDiv = document.getElementById('globalModalInputContainer');
            const input = document.getElementById('globalModalInput');
            inputDiv.classList.remove('d-none');
            input.type = inputType;
            input.value = '';

            const footer = document.getElementById('globalModalFooter');
            footer.innerHTML = `
                <button class="btn btn-outline-secondary btn-lg px-4 fw-bold me-2" onclick="this.dataset.res='null'; systemModal.hide()">CANCELAR</button>
                <button class="btn btn-primary btn-lg px-4 fw-bold" onclick="this.dataset.res='ok'; systemModal.hide()">ACEPTAR</button>
            `;

            const el = document.getElementById('globalSystemModal');
            let value = null;

            const submit = () => { value = input.value; systemModalInstance.hide(); };
            const cancel = () => { value = null; systemModalInstance.hide(); };

            const btns = footer.querySelectorAll('button');
            btns[0].onclick = cancel;
            btns[1].onclick = submit;

            // Enviar con la tecla Enter
            input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };

            const onHide = () => {
                el.removeEventListener('hidden.bs.modal', onHide);
                input.onkeydown = null;
                resolve(value);
            };
            el.addEventListener('hidden.bs.modal', onHide);

            // Poner el foco en el campo de texto automáticamente al abrir
            el.addEventListener('shown.bs.modal', () => input.focus(), { once: true });

            // FIX
            el.removeAttribute('aria-hidden');

            systemModalInstance.show();
        });
    },

    /**
     * HELPERS ESPECÍFICOS PARA MENSAJES
     */
    error: (title, message, onClose) => {
        return Modal.showAlert(`<strong>${title}</strong><br><br>${message}`, 'error').then(() => {
            if (onClose) onClose();
        });
    },

    success: (title, message, onClose) => {
        return Modal.showAlert(`<strong>${title}</strong><br><br>${message}`, 'success').then(() => {
            if (onClose) onClose();
        });
    },

    warning: (title, message, onClose) => {
        return Modal.showAlert(`<strong>${title}</strong><br><br>${message}`, 'warning').then(() => {
            if (onClose) onClose();
        });
    },

    info: (title, message, onClose) => {
        return Modal.showAlert(`<strong>${title}</strong><br><br>${message}`, 'info').then(() => {
            if (onClose) onClose();
        });
    },

    confirm: (title, message, onConfirm, onCancel, confirmText = 'Confirmar', cancelText = 'Cancelar') => {
        return new Promise(resolve => {
            ensureModalExists();
            setupModalUI('question', `<strong>${title}</strong><br><br>${message}`);

            const footer = document.getElementById('globalModalFooter');
            footer.innerHTML = `
                <button class="btn btn-outline-secondary btn-lg px-4 fw-bold me-2" data-action="cancel">${cancelText}</button>
                <button class="btn btn-primary btn-lg px-4 fw-bold" data-action="confirm">${confirmText}</button>
            `;

            const el = document.getElementById('globalSystemModal');
            let result = false;
            let buttonClicked = false;

            const btns = footer.querySelectorAll('button');
            btns.forEach(b => b.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (buttonClicked) return; // Evitar doble clic
                buttonClicked = true;

                result = e.currentTarget.dataset.action === 'confirm';
                console.log('[Modal.confirm] Botón clickeado:', e.currentTarget.dataset.action, 'result:', result);

                // Ejecutar callback ANTES de cerrar el modal
                if (result && onConfirm) {
                    console.log('[Modal.confirm] Ejecutando onConfirm...');
                    onConfirm();
                } else if (!result && onCancel) {
                    console.log('[Modal.confirm] Ejecutando onCancel...');
                    onCancel();
                }

                resolve(result);
                systemModal.hide();
            }));

            const onHide = () => {
                el.removeEventListener('hidden.bs.modal', onHide);
                // Si el modal se cerró sin hacer clic en botones (ej: ESC), ejecutar onCancel
                if (!buttonClicked) {
                    console.log('[Modal.confirm] Modal cerrado sin botón. Ejecutando onCancel...');
                    if (onCancel) onCancel();
                    resolve(false);
                }
            };
            el.addEventListener('hidden.bs.modal', onHide);

            el.removeAttribute('aria-hidden');
            systemModalInstance.show();
        });
    }
};
