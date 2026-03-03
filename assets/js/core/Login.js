import { APP_CONFIG } from './Config.js';
import { sessionService } from '../services/SessionService.js';
import { Api } from './Api.js';

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
            users = Array.isArray(data) ? data.map(u => typeof u === 'string' ? u : u.nombre) : [];
        } catch (e) {
            console.error('[Login] Error fetching users, falling back to config:', e);
            users = APP_CONFIG.HOTEL?.RECEPCIONISTAS || [];
        }
        
        console.log(`[Login] Found ${users.length} receptionists:`, users);
        return new Promise((resolve) => {
            
            // Create overlay
            const overlay = document.createElement('div');
            overlay.id = 'login-overlay';
            overlay.className = 'login-overlay animate__animated animate__fadeIn';
            
            const content = `
                <div class="login-container">
                    <h1 class="login-title animate__animated animate__slideInDown">¿Quién eres hoy?</h1>
                    <div class="login-users-grid">
                        ${users.map((user, index) => `
                            <button class="login-user-card animate__animated animate__zoomIn" 
                                    style="animation-delay: ${index * 0.05}s"
                                    data-username="${user}">
                                <div class="login-user-avatar">
                                    <i class="bi bi-person-fill"></i>
                                </div>
                                <span class="login-user-name">${user}</span>
                            </button>
                        `).join('')}
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

    static handleLogin(username, overlay, resolve) {
        console.log(`[Login] Selected user: ${username}`);
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
    }
}
