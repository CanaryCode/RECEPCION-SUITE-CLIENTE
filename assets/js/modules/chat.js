import { Api } from "../core/Api.js";
import { Ui } from "../core/Ui.js";

/**
 * NATIVE CHAT MODULE
 * Real-time communication using WebSockets and individual persistence.
 */
class ChatModule {
    constructor() {
        this.container = null;
        this.toggleBtn = null;
        this.badge = null;
        this.list = null;
        this.input = null;
        this.recipientSelect = null;
        this.isOpen = false;
        this.unreadCount = 0;
        this.currentUser = sessionStorage.getItem('session_user') || 'Invitado';
        this.currentRecipient = null; // null means GLobal
        this.socket = null;
        this.onlineUsers = new Set();
        this.allUsers = [];
        this.isMuted = localStorage.getItem('chat_muted') === 'true';
        this.messagesByConversation = {
            'global': []
        };
        this.unreadCounts = {}; // user -> count
    }

    async init() {
        console.log("[CHAT] Initializing module...");
        
        this.container = document.getElementById('chat-container');
        this.toggleBtn = document.getElementById('chat-toggle-btn');
        this.badge = document.getElementById('chat-badge');
        this.list = document.getElementById('chat-messages-list');
        this.input = document.getElementById('chat-input');
        // El id se actualizó a chat-user-list
        this.userList = document.getElementById('chat-user-list');
        this.currentLabel = document.getElementById('chat-current-recipient-label');
        this.muteBtn = document.getElementById('chat-mute-btn');

        this.setupEventListeners();
        this.updateMuteIcon();
        await this.loadUnreadCounts();
        this.loadHistory(); // Load global initially

        // Listen for shared WebSocket messages
        window.addEventListener('sync:ws_message', (e) => {
            const data = e.detail;
            if (data.type === 'chat_message') {
                this.handleIncomingMessage(data.payload);
            } else if (data.type === 'chat_delete' || data.type === 'chat_delete_multiple') {
                const ids = data.type === 'chat_delete' ? [data.payload.id] : data.payload.ids;
                if (ids && Array.isArray(ids)) ids.forEach(id => this.handleDeletedMessage(id));
            } else if (data.type === 'user_connected') {
                this.handleUserPresence(data.payload);
            } else if (data.type === 'online_users') {
                this.handleOnlineUsersList(data.payload.users);
            } else if (data.type === 'messages_read') {
                this.handleMessagesRead(data.payload);
            } else if (data.type === 'chat_clear_conversation') {
                this.handleClearConversation(data.payload);
            }
        });

        this.toggleBtn.classList.remove('d-none');
        if (this.muteBtn) this.muteBtn.classList.remove('d-none');
        
        // Cargar lista completa de usuarios del sistema
        if (window.APP_CONFIG && window.APP_CONFIG.HOTEL && window.APP_CONFIG.HOTEL.RECEPCIONISTAS) {
            this.allUsers = window.APP_CONFIG.HOTEL.RECEPCIONISTAS.map(r => typeof r === 'string' ? r : r.nombre);
        }
        
        // Renderizar inmediatamente la lista de usuarios en el panel lateral
        this.updateRecipientList();
    }

    setupEventListeners() {
        this.toggleBtn.addEventListener('click', () => this.toggleChat());
        document.getElementById('chat-btn-close').addEventListener('click', () => this.toggleChat());
        document.getElementById('chat-btn-minimize').addEventListener('click', () => {
            this.container.classList.toggle('minimized');
        });

        if (this.muteBtn) {
            this.muteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMute();
            });
        }

        document.getElementById('chat-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        // Event delegation para los clicks en la lista de usuarios
        if (this.userList) {
            this.userList.addEventListener('click', (e) => {
                const item = e.target.closest('.list-group-item');
                if (item) {
                    const recipient = item.dataset.user;
                    this.setRecipient(recipient === 'global' ? null : recipient);
                }
            });
        }

        window.addEventListener('user-updated', (e) => {
            this.currentUser = e.detail.name || 'Invitado';
            // Note: Re-identification is handled by RealTimeSync
        });
    }

    async loadHistory() {
        try {
            this.list.innerHTML = '<div class="text-center text-secondary small my-4 opacity-50 italic">Cargando...</div>';
            
            const url = this.currentRecipient 
                ? `/chat/history?sender=${this.currentUser}&recipient=${this.currentRecipient}`
                : `/chat/history`;
            
            const history = await Api.get(url);
            this.list.innerHTML = '';
            
            if (history.length === 0) {
                this.list.innerHTML = '<div class="text-center text-secondary small my-4 opacity-50 italic">No hay mensajes previos</div>';
            } else {
                history.forEach(msg => this.appendMessage(msg, false));
                this.scrollToBottom();
            }

            // If opening a private conversation, mark as read
            if (this.currentRecipient && this.isOpen) {
                this.markConversationAsRead(this.currentRecipient);
            }
        } catch (err) {
            console.error("[CHAT] Failed to load history:", err);
            this.list.innerHTML = '<div class="text-center text-danger small">Error al cargar historial</div>';
        }
    }

    async loadUnreadCounts() {
        try {
            const counts = await Api.get(`/chat/unread-counts?user=${this.currentUser}`);
            this.unreadCounts = counts;
            this.updateTotalUnreadBadge();
            this.updateRecipientList();
        } catch (err) {
            console.error("[CHAT] Failed to load unread counts:", err);
        }
    }

    updateTotalUnreadBadge() {
        this.unreadCount = Object.values(this.unreadCounts).reduce((a, b) => a + b, 0);
        this.updateBadge();
    }

    markConversationAsRead(sender) {
        if (!sender) return;
        
        // Update local state
        if (this.unreadCounts[sender]) {
            delete this.unreadCounts[sender];
            this.updateTotalUnreadBadge();
            this.updateRecipientList();
        }

        // Notify server
        import('../core/RealTimeSync.js').then(m => {
            if (m.realTimeSync && m.realTimeSync.socket && m.realTimeSync.socket.readyState === WebSocket.OPEN) {
                m.realTimeSync.socket.send(JSON.stringify({
                    type: 'chat_read',
                    payload: { sender: sender, recipient: this.currentUser }
                }));
            }
        });
    }

    handleMessagesRead(payload) {
        // payload: { sender, recipient } (where sender is me, recipient is the one who read it)
        if (payload.recipient === this.currentRecipient && payload.sender === this.currentUser) {
            // Update all grey checkmarks to blue checkmarks in the current view
            this.list.querySelectorAll('.bi-check:not(.text-primary)').forEach(el => {
                el.classList.remove('bi-check');
                el.classList.add('bi-check-all', 'text-primary');
            });
        }
    }

    // WebSocket connection is now managed by RealTimeSync
    sendMessage() {
        const text = this.input.value.trim();
        if (!text) return;

        const payload = {
            sender: this.currentUser,
            recipient: this.currentRecipient,
            message: text,
            is_system: false
        };

        // Use the shared socket from realTimeSync if available
        import('../core/RealTimeSync.js').then(m => {
            if (m.realTimeSync && m.realTimeSync.socket && m.realTimeSync.socket.readyState === WebSocket.OPEN) {
                m.realTimeSync.socket.send(JSON.stringify({
                    type: 'chat_message',
                    payload: payload
                }));
            } else {
                Api.post('/chat/message', payload);
            }
        });

        this.input.value = '';
    }

    handleOnlineUsersList(users) {
        users.forEach(user => {
            if (user !== this.currentUser) this.onlineUsers.add(user);
        });
        this.updateRecipientList();
    }

    handleUserPresence(payload) {
        if (payload.username === this.currentUser) return;

        if (payload.online) {
            this.onlineUsers.add(payload.username);
        } else {
            this.onlineUsers.delete(payload.username);
        }
        this.updateRecipientList();
    }

    updateRecipientList() {
        if (!this.userList) return;
        
        const isGlobalActive = this.currentRecipient === null ? 'active' : '';
        this.userList.innerHTML = `
            <div class="list-group-item list-group-item-action border-0 mb-1 rounded ${isGlobalActive}" data-user="global">
                <i class="bi bi-globe me-2 text-primary"></i>Chat Global
            </div>
            <div class="px-2 pt-2 pb-1 text-uppercase text-secondary" style="font-size: 0.65rem; font-weight: 800; opacity: 0.7;">Usuarios</div>
        `;
        
        // Unir usuarios del sistema y usuarios conectados loggeados
        const allPotentialUsers = new Set([...this.allUsers, ...Array.from(this.onlineUsers)]);
        const usersArray = Array.from(allPotentialUsers).filter(u => u !== this.currentUser).sort((a, b) => {
            const aOnline = this.onlineUsers.has(a);
            const bOnline = this.onlineUsers.has(b);
            if (aOnline && !bOnline) return -1;
            if (!aOnline && bOnline) return 1;
            return a.localeCompare(b);
        });

        usersArray.forEach(user => {
            const isOnline = this.onlineUsers.has(user);
            const isActive = this.currentRecipient === user ? 'active' : '';
            
            // Usar un punto verde o gris según el estado
            const dotColor = isOnline ? 'success' : 'secondary';
            const iconHTML = `<i class="bi bi-circle-fill text-${dotColor} me-2" style="font-size: 0.5rem; vertical-align: middle;"></i>`;
            const nameHTML = isOnline ? `<strong>${user}</strong>` : user;
            const unreadCount = this.unreadCounts[user] || 0;
            const badgeHTML = unreadCount > 0 ? `<span class="badge rounded-pill bg-danger ms-auto" style="font-size: 0.6rem;">${unreadCount}</span>` : '';

            this.userList.innerHTML += `
                <div class="list-group-item list-group-item-action border-0 px-2 py-2 mb-1 rounded d-flex align-items-center ${isActive}" data-user="${user}">
                    ${iconHTML} <span class="text-truncate" style="flex: 1;">${nameHTML}</span>
                    ${badgeHTML}
                </div>
            `;
        });

        // Actualizar label actual si el destinatario se desconectó
        if (this.currentRecipient && !usersArray.includes(this.currentRecipient) && !this.onlineUsers.has(this.currentRecipient)) {
            this.setRecipient(null);
        }
    }

    setRecipient(user) {
        this.currentRecipient = user;
        
        // Update header label
        if (this.currentLabel) {
            if (user) {
                this.currentLabel.innerHTML = `<i class="bi bi-person-fill me-1 text-primary"></i> ${user}`;
            } else {
                this.currentLabel.innerHTML = `<i class="bi bi-globe me-1 text-primary"></i> Chat Global`;
            }
        }
        
        // Update list active state
        if (this.userList) {
            this.userList.querySelectorAll('.list-group-item').forEach(el => el.classList.remove('active'));
            const selector = user ? `[data-user="${user}"]` : `[data-user="global"]`;
            const activeEl = this.userList.querySelector(selector);
            if (activeEl) activeEl.classList.add('active');
        }
        
        if (user) {
            this.markConversationAsRead(user);
        }

        // Update UI info
        const expirationText = document.getElementById('chat-expiration-text');
        const deleteConvBtn = document.getElementById('chat-btn-delete-conversation');
        
        if (expirationText) {
            expirationText.textContent = user ? 'Chat Privado (No se borra)' : 'Se borran en 30m';
        }
        if (deleteConvBtn) {
            if (user) {
                deleteConvBtn.classList.remove('d-none');
            } else {
                deleteConvBtn.classList.add('d-none');
            }
        }

        this.loadHistory();
    }

    handleIncomingMessage(msg) {
        // Decide if we show it now
        const isCurrentGlobal = !this.currentRecipient && !msg.recipient;
        const isCurrentPrivate = this.currentRecipient && 
            ((msg.sender === this.currentUser && msg.recipient === this.currentRecipient) ||
             (msg.sender === this.currentRecipient && msg.recipient === this.currentUser));

        if (isCurrentGlobal || isCurrentPrivate) {
            this.appendMessage(msg);
            if (isCurrentPrivate && msg.sender !== this.currentUser && this.isOpen) {
                this.markConversationAsRead(msg.sender);
            }
        }

        // Notification logic
        if (msg.sender !== this.currentUser) {
            this.playNotificationSound();
            if (!this.isOpen || (!isCurrentGlobal && !isCurrentPrivate)) {
                this.unreadCounts[msg.sender] = (this.unreadCounts[msg.sender] || 0) + 1;
                this.updateTotalUnreadBadge();
                this.updateRecipientList();
            }
        }
    }

    handleDeletedMessage(messageId) {
        console.log(`[CHAT] Removing deleted message: ${messageId}`);
        const el = this.list.querySelector(`[data-id="${messageId}"]`);
        if (el) {
            el.classList.add('animate__animated', 'animate__fadeOutRight');
            setTimeout(() => el.remove(), 500);
        }
    }

    appendMessage(msg, scroll = true) {
        if (!msg.id) return; // Ignore messages without ID

        const isOwn = msg.sender === this.currentUser;
        const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const div = document.createElement('div');
        div.className = `message-entry ${isOwn ? 'own-message message-sent' : 'message-received'}`;
        div.dataset.id = msg.id;

        if (msg.is_system) {
            div.innerHTML = `<div class="system-message">${msg.message}</div>`;
        } else {
            const checkIcon = msg.is_read 
                ? '<i class="bi bi-check-all text-primary ms-1" title="Leído"></i>' 
                : '<i class="bi bi-check ms-1" title="Enviado"></i>';
            const statusHTML = isOwn && msg.recipient ? checkIcon : '';

            div.innerHTML = `
                ${!isOwn ? `<div class="message-sender">${msg.sender}${msg.recipient ? ' (Privado)' : ''}</div>` : ''}
                <div class="message-bubble shadow-sm animate__animated animate__fadeInUp">
                    ${isOwn ? `<button class="btn btn-delete-msg" onclick="chat.deleteMessage('${msg.id}')" title="Borrar mensaje"><i class="bi bi-trash"></i></button>` : ''}
                    <div class="message-text">${this.escapeHtml(msg.message)}</div>
                    <div class="message-time">${time}${statusHTML}</div>
                </div>
            `;
        }

        this.list.appendChild(div);
        if (scroll) this.scrollToBottom();
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        this.container.classList.toggle('d-none');
        
        if (this.isOpen) {
            if (this.currentRecipient) {
                this.markConversationAsRead(this.currentRecipient);
            }
            this.scrollToBottom();
            setTimeout(() => this.input.focus(), 100);
        }
    }

    updateBadge() {
        if (this.unreadCount > 0) {
            this.badge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
            this.badge.classList.remove('d-none');
        } else {
            this.badge.classList.add('d-none');
        }
    }

    scrollToBottom() {
        requestAnimationFrame(() => {
            this.list.scrollTop = this.list.scrollHeight;
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('chat_muted', this.isMuted);
        this.updateMuteIcon();
    }

    updateMuteIcon() {
        if (!this.muteBtn) return;
        const icon = this.muteBtn.querySelector('i');
        if (icon) {
            icon.className = this.isMuted ? 'bi bi-volume-mute-fill text-danger' : 'bi bi-volume-up-fill text-secondary';
        }
    }

    playNotificationSound() {
        if (this.isMuted) return;
        
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
            audio.volume = 0.4;
            audio.play().catch(e => console.warn("Audio play failed:", e));
        } catch (e) {}
    }

    async deleteMessage(id) {
        try {
            const result = await Api.delete(`/chat/message/${id}`);
            if (result.success) {
                this.handleDeletedMessage(id);
            }
        } catch (err) {
            console.error("[CHAT] Error deleting message:", err);
            Ui.showToast("No se pudo borrar el mensaje", "danger");
        }
    }

    async deleteConversation() {
        if (!this.currentRecipient) return;
        
        const ok = await Ui.showConfirm(`¿Estás seguro de que quieres borrar TODA la conversación con ${this.currentRecipient}?`);
        if (!ok) return;

        try {
            const result = await Api.delete(`/chat/conversation?user1=${this.currentUser}&user2=${this.currentRecipient}`);
            if (result.success) {
                Ui.showToast("Conversación borrada", "success");
                // The broadcast will trigger handleClearConversation for all, including us
            }
        } catch (err) {
            console.error("[CHAT] Error deleting conversation:", err);
            Ui.showToast("No se pudo borrar la conversación", "danger");
        }
    }

    handleClearConversation(payload) {
        const { user1, user2 } = payload;
        // Check if the current open conversation matches
        const isCurrent = (user1 === this.currentUser && user2 === this.currentRecipient) ||
                          (user2 === this.currentUser && user1 === this.currentRecipient);
        
        if (isCurrent) {
            this.list.innerHTML = '<div class="text-center text-secondary small my-4 opacity-50 italic">Conversación borrada</div>';
        }
    }
}

export const chat = new ChatModule();
window.chat = chat;
