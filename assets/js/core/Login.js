import { APP_CONFIG } from './Config.js';
import { sessionService } from '../services/SessionService.js';
import { Api } from './Api.js';
import { Ui } from './Ui.js';

/**
 * LOGIN COMPONENT
 * ---------------
 * Displays a full-screen overlay to select the current receptionist.
 */
export class Login {
    static async showSelector() {
        console.log('[Login] Fetching receptionists from DB...');
        let users = [];
        try {
            const data = await Api.get('storage/recepcionistas');
            // 'data' ahora puede ser un array de objetos { nombre, avatar_url, ... }
            users = Array.isArray(data) ? data : [];
        } catch (e) {
            console.error('[Login] Error fetching users, falling back to config:', e);
            const fallback = APP_CONFIG.HOTEL?.RECEPCIONISTAS || [];
            users = fallback.map(u => typeof u === 'string' ? { nombre: u } : u);
        }
        
        console.log(`[Login] Found ${users.length} receptionists.`);
        return new Promise((resolve) => {
            
            // Create overlay
            const overlay = document.createElement('div');
            overlay.id = 'login-overlay';
            overlay.className = 'login-overlay animate__animated animate__fadeIn';
            
            const content = `
                <div class="login-container">
                    <h1 class="login-title animate__animated animate__slideInDown">¿Quién eres hoy?</h1>
                    <div class="login-users-grid">
                        ${users.map((user, index) => {
                            const name = typeof user === 'string' ? user : user.nombre;
                            const avatar = user.avatar_url ? `/${user.avatar_url}` : null;
                            const avatarHtml = avatar 
                                ? `<img src="${avatar}" class="login-user-img shadow-sm">`
                                : `<i class="bi bi-person-fill"></i>`;

                            return `
                                <button class="login-user-card animate__animated animate__zoomIn" 
                                        style="animation-delay: ${index * 0.05}s"
                                        data-username="${name}">
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
            
            // Add click events
            overlay.addEventListener('click', (e) => {
                const card = e.target.closest('.login-user-card');
                if (card) {
                    const username = card.dataset.username;
                    this.handleLogin(username, overlay, resolve);
                }
            });
        });
    }

    static async handleLogin(username, overlay, resolve) {
        console.log(`[Login] Selected user: ${username}`);

        try {
            // 1. Verificar si el usuario requiere contraseña
            const user = await Api.get(`users/info/${username}`);
            
            if (user.hasPassword) {
                const password = await this.showPasswordPrompt(username, overlay);
                if (password === null) return; // Cancelado

                // 2. Validar contraseña
                const auth = await Api.post('users/login-check', { username, password });
                if (!auth.success) {
                    Ui.showToast('Contraseña incorrecta', 'danger');
                    return;
                }
            }

            // 3. Proceder con el login
            sessionService.setUser(username);
            
            // Success animation
            overlay.classList.remove('animate__fadeIn');
            overlay.classList.add('animate__fadeOut');
            
            setTimeout(() => {
                overlay.remove();
                resolve(username);
                
                // Dispatch event for UI updates
                window.dispatchEvent(new CustomEvent('app:login-success', { detail: { username } }));
            }, 500);

        } catch (err) {
            console.error('[Login] Error during auth:', err);
            Ui.showToast('Error al iniciar sesión: ' + err.message, 'danger');
        }
    }

    static showPasswordPrompt(username, overlay) {
        const grid = overlay.querySelector('.login-users-grid');
        const originalContent = overlay.innerHTML;
        
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
                overlay.innerHTML = originalContent;
                // Re-attach grid click events because we replaced innerHTML
                overlay.addEventListener('click', (e) => {
                    const card = e.target.closest('.login-user-card');
                    if (card) {
                        const uname = card.dataset.username;
                        this.handleLogin(uname, overlay, (val) => {
                            // This part is tricky because of the original resolve from showSelector
                            // But usually handleLogin will eventually resolve the top-level promise
                        });
                    }
                });
                // Effectively we just need to re-render the selector.
                // Shortcut: reload selector logic or just resolve null to stop current flow
                resolve(null);
                this.showSelector(); // Re-trigger selector cleanly
                overlay.remove();
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
