import { userService } from '../services/UserService.js';
import { sessionService } from '../services/SessionService.js';
import { Ui } from '../core/Ui.js';
import { Utils } from '../core/Utils.js';

export async function inicializarPerfil() {
    const container = document.getElementById('perfil-content');
    if (!container) return;

    try {
        await cargarDatosPerfil();
        setupEventListeners();
    } catch (err) {
        console.error('[Perfil] Error al inicializar:', err);
        Ui.showToast('Error al cargar datos de perfil', 'danger');
    }
}

async function cargarDatosPerfil() {
    const user = await userService.getCurrentProfile();
    if (!user) return;

    // Actualizar UI
    document.getElementById('profileDisplayNameHead').innerText = user.display_name || user.nombre;
    document.getElementById('profileUsernameHead').innerText = `@${user.nombre}`;
    document.getElementById('profileCreatedAt').innerText = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A';
    
    document.getElementById('profileDisplayNameInput').value = user.display_name || '';
    document.getElementById('profileEmailInput').value = user.email || '';
    
    if (user.avatar_url) {
        document.getElementById('profileAvatarPrew').src = user.avatar_url;
    }

    // Estado de contraseña
    const badge = document.getElementById('passwordStatusBadge');
    const btnRemove = document.getElementById('btnRemovePassword');
    const currentPassGroup = document.getElementById('currentPasswordGroup');
    const currentPassInput = document.getElementById('profilePasswordInput');

    if (user.hasPassword) {
        badge.innerText = 'Protegido con contraseña';
        badge.className = 'badge bg-success';
        btnRemove.classList.remove('d-none');
        currentPassGroup.classList.remove('d-none');
        currentPassInput.required = true;
    } else {
        badge.innerText = 'Sin contraseña (Acceso directo)';
        badge.className = 'badge bg-warning text-dark';
        btnRemove.classList.add('d-none');
        currentPassGroup.classList.add('d-none');
        currentPassInput.required = false;
    }
}

function setupEventListeners() {
    // Formulario de Datos
    const formDatos = document.getElementById('formPerfilDatos');
    if (formDatos) {
        formDatos.onsubmit = async (e) => {
            e.preventDefault();
            const displayName = document.getElementById('profileDisplayNameInput').value.trim();
            const email = document.getElementById('profileEmailInput').value.trim();

            try {
                await userService.updateProfile({ 
                    display_name: displayName, 
                    email: email 
                });
                Ui.showToast('Perfil actualizado correctamente', 'success');
                await cargarDatosPerfil();
                
                // Disparar evento global para que la UI (header) se actualice
                window.dispatchEvent(new CustomEvent('user-updated', { detail: { name: displayName || sessionService.getUser() } }));
                
                // Actualizar nombre global si cambió
                const globalNameEl = document.getElementById('globalUserName');
                if (globalNameEl) globalNameEl.innerText = displayName || sessionService.getUser();
            } catch (err) {
                Ui.showToast(err.message, 'danger');
            }
        };
    }

    // Formulario de Seguridad
    const formSeguridad = document.getElementById('formPerfilSeguridad');
    const btnRemove = document.getElementById('btnRemovePassword');

    if (formSeguridad) {
        formSeguridad.onsubmit = async (e) => {
            e.preventDefault();
            const currentPass = document.getElementById('profilePasswordInput').value;
            const newPass = document.getElementById('profileNewPasswordInput').value;
            const confirmPass = document.getElementById('profileConfirmPasswordInput').value;

            if (newPass && newPass !== confirmPass) {
                Ui.showToast('Las nuevas contraseñas no coinciden', 'warning');
                return;
            }

            if (!newPass) {
                Ui.showToast('Introduce una nueva contraseña o usa el botón "Quitar"', 'info');
                return;
            }

            try {
                await userService.updateProfile({
                    current_password: currentPass,
                    new_password: newPass
                });
                Ui.showToast('Seguridad actualizada', 'success');
                formSeguridad.reset();
                await cargarDatosPerfil();
                window.dispatchEvent(new CustomEvent('user-updated'));
            } catch (err) {
                Ui.showToast(err.message, 'danger');
            }
        };
    }

    if (btnRemove) {
        btnRemove.onclick = async () => {
            const currentPass = document.getElementById('profilePasswordInput').value;
            const user = await userService.getCurrentProfile();
            
            if (user.hasPassword && !currentPass) {
                Ui.showToast('Ingresa tu contraseña actual para quitarla', 'warning');
                document.getElementById('profilePasswordInput').focus();
                return;
            }

            if (!confirm('¿Estás seguro de que quieres quitar tu contraseña? Cualquier persona podrá entrar en tu sesión.')) {
                return;
            }

            try {
                await userService.updateProfile({
                    current_password: currentPass,
                    new_password: null
                });
                Ui.showToast('Contraseña eliminada correctamente', 'success');
                formSeguridad.reset();
                await cargarDatosPerfil();
                window.dispatchEvent(new CustomEvent('user-updated', { detail: { name: sessionService.getUser() } }));
            } catch (err) {
                Ui.showToast(err.message, 'danger');
            }
        };
    }

    // Cambio de Avatar con Recorte
    const inputAvatar = document.getElementById('inputAvatar');
    const modalCrop = new bootstrap.Modal(document.getElementById('modalCropAvatar'));
    const cropImg = document.getElementById('cropPreviewImage');
    const cropContainer = document.getElementById('cropPreviewContainer');
    const zoomRange = document.getElementById('cropZoomRange');
    const btnSaveCrop = document.getElementById('btnSaveCrop');

    let currentFile = null;
    let offset = { x: 0, y: 0 };
    let isDragging = false;
    let startPos = { x: 0, y: 0 };
    let zoom = 1;

    if (inputAvatar) {
        inputAvatar.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) { // Subimos el límite a 5MB para el recorte local
                Ui.showToast('La imagen es demasiado grande (máx 5MB)', 'warning');
                return;
            }

            currentFile = file;
            const reader = new FileReader();
            reader.onload = (event) => {
                cropImg.src = event.target.result;
                cropImg.style.display = 'block';
                cropImg.onload = () => {
                    // Resetear estado
                    zoom = 1;
                    offset = { x: 0, y: 0 };
                    zoomRange.value = 1;
                    updateCropPreview();
                    modalCrop.show();
                };
            };
            reader.readAsDataURL(file);
        };
    }

    function updateCropPreview() {
        const rect = cropContainer.getBoundingClientRect();
        const imgWidth = cropImg.naturalWidth;
        const imgHeight = cropImg.naturalHeight;
        
        // Calcular escala base para cubrir el contenedor (250x250)
        const scaleBase = Math.max(250 / imgWidth, 250 / imgHeight);
        const finalScale = scaleBase * zoom;
        
        const w = imgWidth * finalScale;
        const h = imgHeight * finalScale;
        
        // Limitar offset para que no se vea el fondo
        const maxOffsetX = Math.max(0, (w - 250) / 2);
        const maxOffsetY = Math.max(0, (h - 250) / 2);
        
        offset.x = Math.max(-maxOffsetX, Math.min(maxOffsetX, offset.x));
        offset.y = Math.max(-maxOffsetY, Math.min(maxOffsetY, offset.y));

        cropImg.style.width = `${w}px`;
        cropImg.style.height = `${h}px`;
        cropImg.style.left = `calc(50% - ${w/2}px + ${offset.x}px)`;
        cropImg.style.top = `calc(50% - ${h/2}px + ${offset.y}px)`;
    }

    // Eventos de Arrastre (Mouse)
    cropContainer.onmousedown = (e) => {
        isDragging = true;
        startPos = { x: e.clientX - offset.x, y: e.clientY - offset.y };
        cropContainer.style.cursor = 'grabbing';
    };

    const handleMove = (e) => {
        if (!isDragging) return;
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        offset.x = clientX - startPos.x;
        offset.y = clientY - startPos.y;
        updateCropPreview();
    };

    const handleEnd = () => {
        isDragging = false;
        cropContainer.style.cursor = 'move';
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    // Soporte para Táctil (Móvil)
    cropContainer.ontouchstart = (e) => {
        isDragging = true;
        const touch = e.touches[0];
        startPos = { x: touch.clientX - offset.x, y: touch.clientY - offset.y };
    };

    // Zoom
    zoomRange.oninput = (e) => {
        zoom = parseFloat(e.target.value);
        updateCropPreview();
    };

    // Guardar Recorte
    btnSaveCrop.onclick = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 400; // Resolución final
        canvas.height = 400;
        const ctx = canvas.getContext('2d');

        const rect = cropContainer.getBoundingClientRect();
        const imgWidth = cropImg.naturalWidth;
        const imgHeight = cropImg.naturalHeight;
        const scaleBase = Math.max(250 / imgWidth, 250 / imgHeight);
        const finalScale = scaleBase * zoom;

        // Calcular qué parte de la imagen original estamos viendo
        // El factor de conversión de preview (250px) a canvas (400px) es 400/250 = 1.6
        const renderScale = 400 / 250;
        
        const w = imgWidth * finalScale * renderScale;
        const h = imgHeight * finalScale * renderScale;
        const ox = offset.x * renderScale;
        const oy = offset.y * renderScale;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 400, 400);
        ctx.drawImage(cropImg, (400 - w) / 2 + ox, (400 - h) / 2 + oy, w, h);

        canvas.toBlob(async (blob) => {
            try {
                btnSaveCrop.disabled = true;
                btnSaveCrop.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
                
                const croppedFile = new File([blob], currentFile.name, { type: 'image/jpeg' });
                const path = await userService.uploadAvatar(croppedFile);
                await userService.updateProfile({ avatar_url: path });
                
                document.getElementById('profileAvatarPrew').src = path;
                Ui.showToast('Foto de perfil actualizada', 'success');
                window.dispatchEvent(new CustomEvent('user-updated', { detail: { name: sessionService.getUser() } }));
                modalCrop.hide();
            } catch (err) {
                Ui.showToast('Error al guardar imagen', 'danger');
            } finally {
                btnSaveCrop.disabled = false;
                btnSaveCrop.innerHTML = 'Guardar Cambios';
            }
        }, 'image/jpeg', 0.9);
    };
}
