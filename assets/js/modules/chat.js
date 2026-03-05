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
        this.messagesByConversation = {
            'global': []
        };
    }

    async init() {
        console.log("[CHAT] Initializing module...");
        
        this.container = document.getElementById('chat-container');
        this.toggleBtn = document.getElementById('chat-toggle-btn');
        this.badge = document.getElementById('chat-badge');
        this.list = document.getElementById('chat-messages-list');
        this.input = document.getElementById('chat-input');
        this.recipientSelect = document.getElementById('chat-recipient-select');

        this.setupEventListeners();
        this.connectWebSocket();
        this.loadHistory(); // Load global initially

        this.toggleBtn.classList.remove('d-none');
    }

    setupEventListeners() {
        this.toggleBtn.addEventListener('click', () => this.toggleChat());
        document.getElementById('chat-btn-close').addEventListener('click', () => this.toggleChat());
        document.getElementById('chat-btn-minimize').addEventListener('click', () => {
            this.container.classList.toggle('minimized');
        });

        document.getElementById('chat-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        this.recipientSelect.addEventListener('change', (e) => {
            this.currentRecipient = e.target.value || null;
            this.loadHistory(); // Reload history for the new selection
        });

        window.addEventListener('user-updated', (e) => {
            const oldUser = this.currentUser;
            this.currentUser = e.detail.name;
            if (oldUser !== this.currentUser) {
                // Re-login to WS with new identity
                this.login();
            }
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
        } catch (err) {
            console.error("[CHAT] Failed to load history:", err);
            this.list.innerHTML = '<div class="text-center text-danger small">Error al cargar historial</div>';
        }
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log("[CHAT] WS Connected");
            this.login();
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'chat_message') {
                    this.handleIncomingMessage(data.payload);
                } else if (data.type === 'chat_delete') {
                    this.handleDeletedMessage(data.payload.id);
                } else if (data.type === 'chat_delete_multiple') {
                    if (data.payload.ids && Array.isArray(data.payload.ids)) {
                        data.payload.ids.forEach(id => this.handleDeletedMessage(id));
                    }
                } else if (data.type === 'user_connected') {
                    this.handleUserPresence(data.payload);
                } else if (data.type === 'online_users') {
                    this.handleOnlineUsersList(data.payload.users);
                }
            } catch (e) {}
        };

        this.socket.onclose = () => {
            console.warn("[CHAT] WS Disconnected. Retrying in 5s...");
            setTimeout(() => this.connectWebSocket(), 5000);
        };
    }

    login() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'chat_login',
                payload: { username: this.currentUser }
            }));
        }
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
        const currentVal = this.recipientSelect.value;
        this.recipientSelect.innerHTML = '<option value="">Chat Global</option>';
        
        Array.from(this.onlineUsers).sort().forEach(user => {
            const option = document.createElement('option');
            option.value = user;
            option.textContent = `Privado: ${user}`;
            this.recipientSelect.appendChild(option);
        });

        // Restore value if still online
        if (this.onlineUsers.has(currentVal)) {
            this.recipientSelect.value = currentVal;
        } else if (currentVal !== "") {
            // Recipient went offline
            this.recipientSelect.value = "";
            this.currentRecipient = null;
            this.loadHistory();
        }
    }

    handleIncomingMessage(msg) {
        // Decide if we show it now
        const isCurrentGlobal = !this.currentRecipient && !msg.recipient;
        const isCurrentPrivate = this.currentRecipient && 
            ((msg.sender === this.currentUser && msg.recipient === this.currentRecipient) ||
             (msg.sender === this.currentRecipient && msg.recipient === this.currentUser));

        if (isCurrentGlobal || isCurrentPrivate) {
            this.appendMessage(msg);
        }

        // Notification logic
        if (msg.sender !== this.currentUser) {
            if (!this.isOpen || (!isCurrentGlobal && !isCurrentPrivate)) {
                this.unreadCount++;
                this.updateBadge();
                this.playNotificationSound();
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

    sendMessage() {
        const text = this.input.value.trim();
        if (!text) return;

        const payload = {
            sender: this.currentUser,
            recipient: this.currentRecipient,
            message: text,
            is_system: false
        };

        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'chat_message',
                payload: payload
            }));
        } else {
            Api.post('/chat/message', payload);
        }

        this.input.value = '';
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
            div.innerHTML = `
                ${!isOwn ? `<div class="message-sender">${msg.sender}${msg.recipient ? ' (Privado)' : ''}</div>` : ''}
                <div class="message-bubble shadow-sm animate__animated animate__fadeInUp">
                    ${isOwn ? `<button class="btn btn-delete-msg" onclick="chat.deleteMessage('${msg.id}')" title="Borrar mensaje"><i class="bi bi-trash"></i></button>` : ''}
                    <div class="message-text">${this.escapeHtml(msg.message)}</div>
                    <div class="message-time">${time}</div>
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
            this.unreadCount = 0;
            this.updateBadge();
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

    playNotificationSound() {
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
            audio.volume = 0.4;
            audio.play();
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
}

export const chat = new ChatModule();
window.chat = chat;
