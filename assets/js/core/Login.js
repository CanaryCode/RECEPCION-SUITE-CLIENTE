import { APP_CONFIG } from './Config.js';
import { sessionService } from '../services/SessionService.js';
import { Api } from './Api.js';
import { Ui } from './Ui.js';

/**
 * LOGIN COMPONENT
 * ---------------
 * Displays a two-step full-screen overlay to select hotel and receptionist.
 */
export class Login {
    static async showSelector() {
        return this.showHotelSelector();
    }

    static async showHotelSelector() {
        console.log('[Login] Fetching hotels...');
        let hotels = [];
        try {
            const data = await Api.get('storage/hoteles');
            hotels = Array.isArray(data) ? data : [];
            if (hotels.length === 0) throw new Error('No hotels found');
        } catch (e) {
            console.error('[Login] Error fetching hotels:', e);
            hotels = [{ id: 1, nombre: 'Garoé', logo_url: 'assets/img/hotel_garoe.png' }];
        }

        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.id = 'login-overlay';
            overlay.className = 'login-overlay animate__animated animate__fadeIn';

            const content = `
                <div class="login-container">
                    <h1 class="login-title animate__animated animate__slideInDown">Selecciona tu Hotel</h1>
                    <div class="login-users-grid">
                        ${hotels.map((hotel, index) => {
                            const logo = hotel.logo_url || 'assets/img/hotel-default.png';
                            return `
                                <button class="login-hotel-card animate__animated animate__zoomIn" 
                                        style="animation-delay: ${index * 0.1}s"
                                        data-hotel-id="${hotel.id}"
                                        data-hotel-name="${hotel.nombre}">
                                    <div class="login-hotel-logo">
                                        <img src="${logo}" class="img-fluid rounded shadow-sm">
                                    </div>
                                    <span class="login-user-name mt-3">${hotel.nombre}</span>
                                </button>
                            `;
                        }).join('')}
                    </div>
                    <div class="mt-5 text-center animate__animated animate__fadeIn" style="animation-delay: 1s">
                        <div class="d-flex justify-content-center gap-4">
                            <button id="login-open-config" class="btn btn-link text-white-50 text-decoration-none small">
                                <i class="bi bi-gear-fill me-1"></i> Configuración de Módulos
                            </button>
                            <button id="login-open-admin" class="btn btn-link text-white-50 text-decoration-none small">
                                <i class="bi bi-shield-lock-fill me-1"></i> Consola de Administración
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            overlay.innerHTML = content;
            document.body.appendChild(overlay);

            overlay.addEventListener('click', async (e) => {
                const adminBtn = e.target.closest('#login-open-admin');
                if (adminBtn) {
                    if (window.openWebViewer) {
                        window.openWebViewer('/assets/admin/index.html', 'Consola de Administración', false);
                    } else {
                        alert('Consola de administración no disponible en este momento.');
                    }
                    return;
                }

                const configBtn = e.target.closest('#login-open-config');
                if (configBtn) {
                    if (window.openWebViewer) {
                        window.openWebViewer('/assets/admin/modulos.html', 'Configuración de Módulos', false);
                    } else {
                        window.open('/assets/admin/modulos.html', '_blank');
                    }
                    return;
                }

                const card = e.target.closest('.login-hotel-card');
                if (card) {
                    const hotelId = card.dataset.hotelId;
                    const hotelName = card.dataset.hotelName;
                    overlay.classList.add('animate__fadeOut');
                    setTimeout(async () => {
                        overlay.remove();
                        await this.showUserSelector(hotelId, hotelName, resolve);
                    }, 500);
                }
            });
        });
    }

    static async showUserSelector(hotelId, hotelName, resolve) {
        console.log(`[Login] Fetching users for hotel ${hotelId}...`);
        let users = [];
        try {
            const data = await Api.get('storage/recepcionistas', { 
                headers: { 'x-hotel-id': hotelId } 
            });
            users = Array.isArray(data) ? data : [];
        } catch (e) {
            console.error('[Login] Error fetching users:', e);
        }

        const overlay = document.createElement('div');
        overlay.id = 'login-overlay';
        overlay.className = 'login-overlay animate__animated animate__fadeIn';

        const content = `
            <div class="login-container">
                <div class="mb-4 animate__animated animate__fadeIn">
                    <span class="badge bg-primary px-3 py-2 rounded-pill shadow-sm" style="cursor:pointer" id="login-back-to-hotels">
                        <i class="bi bi-arrow-left me-2"></i> Cambiar de Hotel (${hotelName})
                    </span>
                </div>
                <h1 class="login-title animate__animated animate__slideInDown">¿Quién eres hoy?</h1>
                <div class="login-users-grid">
                    ${users.length === 0 ? '<p class="text-white">Lo sentimos, no hay usuarios en este hotel.</p>' : ''}
                    ${users.map((user, index) => {
                        const name = user.nombre;
                        const avatar = user.avatar_url ? `/${user.avatar_url}` : null;
                        const avatarHtml = avatar 
                            ? `<img src="${avatar}" class="login-user-img shadow-sm">`
                            : `<i class="bi bi-person-fill"></i>`;

                        return `
                            <button class="login-user-card animate__animated animate__zoomIn" 
                                    style="animation-delay: ${index * 0.05}s"
                                    data-username="${name}"
                                    data-hotel-id="${hotelId}">
                                <div class="login-user-avatar">
                                    ${avatarHtml}
                                </div>
                                <span class="login-user-name">${name}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        
        overlay.innerHTML = content;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target.closest('#login-back-to-hotels')) {
                overlay.remove();
                this.showHotelSelector().then(resolve);
                return;
            }
            const card = e.target.closest('.login-user-card');
            if (card) {
                const username = card.dataset.username;
                this.handleLogin(username, hotelId, overlay, resolve);
            }
        });
    }

    static async handleLogin(username, hotelId, overlay, resolve) {
        console.log(`[Login] Selected user: ${username} for hotel ${hotelId}`);

        try {
            const user = await Api.get(`users/info/${username}`, { headers: { 'x-hotel-id': hotelId } });
            
            if (user.hasPassword) {
                const password = await this.showPasswordPrompt(username, hotelId, overlay);
                if (password === null) return; 

                const auth = await Api.post('users/login-check', { username, password, hotelId });
                if (!auth.success) {
                    Ui.showToast('Contraseña incorrecta', 'danger');
                    return;
                }
            }

            sessionService.setUser(username);
            localStorage.setItem('current_hotel_id', hotelId);
            
            overlay.classList.remove('animate__fadeIn');
            overlay.classList.add('animate__fadeOut');
            
            setTimeout(() => {
                overlay.remove();
                resolve(username);
                window.dispatchEvent(new CustomEvent('app:login-success', { detail: { username, hotelId } }));
                location.reload(); 
            }, 500);

        } catch (err) {
            console.error('[Login] Error during auth:', err);
            Ui.showToast('Error al iniciar sesión: ' + err.message, 'danger');
        }
    }

    static showPasswordPrompt(username, hotelId, overlay) {
        return new Promise((resolve) => {
            const modalContent = `
                <div class="login-container d-flex flex-column align-items-center justify-content-center h-100">
                    <div class="login-password-modal animate__animated animate__zoomIn">
                        <h2 class="mb-4 text-white">Hola, ${username}</h2>
                        <p class="text-white-50 mb-4">Introduce tu contraseña para entrar</p>
                        <input type="password" id="login-pwd-input" class="form-control login-password-input" placeholder="••••••••" autofocus>
                        <button id="login-pwd-confirm" class="login-password-btn">ENTRAR</button>
                        <button id="login-pwd-cancel" class="login-password-cancel">No soy yo, volver atrás</button>
                    </div>
                </div>
            `;
            
            overlay.innerHTML = modalContent;
            
            const input = overlay.querySelector('#login-pwd-input');
            const confirmBtn = overlay.querySelector('#login-pwd-confirm');
            const cancelBtn = overlay.querySelector('#login-pwd-cancel');
            
            const handleConfirm = () => {
                const password = input.value;
                if (!password) {
                    input.classList.add('animate__animated', 'animate__headShake');
                    setTimeout(() => input.classList.remove('animate__animated', 'animate__headShake'), 500);
                    return;
                }
                resolve(password);
            };
            
            const handleCancel = () => {
                resolve(null);
                overlay.remove();
                this.showUserSelector(hotelId, "Volviendo...", resolve);
            };
            
            confirmBtn.onclick = handleConfirm;
            cancelBtn.onclick = handleCancel;
            
            input.onkeydown = (e) => {
                if (e.key === 'Enter') handleConfirm();
                if (e.key === 'Escape') handleCancel();
            };
            
            setTimeout(() => input.focus(), 100);
        });
    }
}
