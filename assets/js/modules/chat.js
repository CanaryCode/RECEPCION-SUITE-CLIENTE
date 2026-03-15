import { Api } from "../core/Api.js";
import { Ui } from "../core/Ui.js";
import { realTimeSync } from "../core/RealTimeSync.js";

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

        // LIMPIEZA: Eliminar :hotelId del username si existe (datos legacy)
        let currentUser = localStorage.getItem('session_user') || 'Invitado';
        if (currentUser.includes(':')) {
            currentUser = currentUser.split(':')[0];
            localStorage.setItem('session_user', currentUser);
        }
        this.currentUser = currentUser;

        this.currentRecipient = null; // null means GLobal
        this.socket = null;
        this.onlineUsers = new Set();
        this.allUsers = [];
        this.isMuted = localStorage.getItem('chat_muted') === 'true';
        this.messagesByConversation = {
            'global': []
        };
        this.unreadCounts = {}; // user -> count
        this.typingTimeout = null;
        this.isTyping = false;
        this.presenceInterval = null;
        this.isInitialized = false;
        this.userAvatars = null;
        this.presenceCache = {}; // Cache de presencia para evitar peticiones innecesarias
        this.presenceCacheTTL = 10000; // TTL de 10 segundos para el caché de presencia

        // Pre-load buzz audio to avoid browser autoplay restrictions
        // Using an attention-grabbing notification sound (like WhatsApp)
        this.buzzAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        this.buzzAudio.volume = 0.7;
        this.buzzAudio.load();

        // Unlock audio on first user interaction
        this.audioUnlocked = false;
        const unlockAudio = () => {
            if (!this.audioUnlocked) {
                this.buzzAudio.play().then(() => {
                    this.buzzAudio.pause();
                    this.buzzAudio.currentTime = 0;
                    this.audioUnlocked = true;
                    console.log("[CHAT] Audio unlocked for buzz notifications");
                }).catch(() => {});
                document.removeEventListener('click', unlockAudio);
            }
        };
        document.addEventListener('click', unlockAudio, { once: true });
    }

    async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        // Refresh current user from session just in case
        let currentUser = localStorage.getItem('session_user') || 'Invitado';
        if (currentUser.includes(':')) {
            currentUser = currentUser.split(':')[0];
            localStorage.setItem('session_user', currentUser);
        }
        this.currentUser = currentUser;

        console.log(`[CHAT] Initializing module for user: ${this.currentUser}...`);
        
        try {
            this.container = document.getElementById('chat-container');
            this.toggleBtn = document.getElementById('chat-toggle-btn');
            this.badge = document.getElementById('chat-badge');
            this.list = document.getElementById('chat-messages-list');
            this.input = document.getElementById('chat-input');
            this.userList = document.getElementById('chat-user-list');
            this.currentLabel = document.getElementById('chat-current-recipient-label');
            this.presenceStatus = document.getElementById('chat-presence-status');
            this.muteBtn = document.getElementById('chat-mute-btn');
            this.fileBtn = document.getElementById('chat-btn-attach');
            this.fileInput = document.getElementById('chat-file-input');
            this.emojiBtn = document.getElementById('chat-btn-emoji');
            this.buzzBtn = document.getElementById('chat-btn-buzz');

            if (!this.container || !this.toggleBtn) {
                console.warn("[CHAT] Essential DOM elements missing. Re-searching in 500ms...");
                this.isInitialized = false; // Allow retry
                setTimeout(() => this.init(), 500);
                return;
            }

            // CRITICAL: Show the toggle button IMMEDIATELY so the user sees it's working
            this.toggleBtn.classList.remove('d-none');
            this.toggleBtn.style.setProperty('display', 'flex', 'important');
            this.toggleBtn.style.setProperty('visibility', 'visible', 'important');
            this.toggleBtn.style.setProperty('opacity', '1', 'important');

            if (this.muteBtn) {
                this.muteBtn.classList.remove('d-none');
                this.muteBtn.style.setProperty('display', 'flex', 'important');
            }
            console.log("[CHAT] Toggle button shown and forced visible.");

            this.setupEventListeners();
            if (this.muteBtn) this.updateMuteIcon();
            
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
                } else if (data.type === 'message_delivered') {
                    this.handleMessageDelivered(data.payload);
                } else if (data.type === 'chat_clear_conversation') {
                    this.handleClearConversation(data.payload);
                } else if (data.type === 'chat_typing') {
                    this.handleRemoteTyping(data.payload);
                } else if (data.type === 'chat_buzz') {
                    this.handleIncomingBuzz(data.payload);
                } else if (data.type === 'chat_stop_typing') {
                    const stopPayload = { ...data.payload, stop: true };
                    this.handleRemoteTyping(stopPayload);
                }
            });

            // Start background tasks without blocking visibility
            this.allUsers = [];

            // Heavy data loading
            this.loadAllUsers().catch(e => console.warn("[CHAT] Error loading users:", e));
            this.loadUnreadCounts().catch(e => console.warn("[CHAT] Error loading counts:", e));
            this.loadHistory().catch(e => console.warn("[CHAT] Error loading history:", e));

            // Solicitar lista de usuarios online al inicializar (por si el evento ya llegó antes)
            setTimeout(() => {
                const sync = realTimeSync || window.realTimeSync;
                if (sync && sync.socket && sync.socket.readyState === WebSocket.OPEN) {
                    sync.socket.send(JSON.stringify({ type: 'request_online_users' }));
                    console.log("[CHAT] Requested online users list on init");
                } else {
                    console.warn("[CHAT] Socket not ready yet to request online users, will retry on 'online_users' event or next login");
                }
            }, 500);
            
        } catch (err) {
            console.error("[CHAT] Critical error during init:", err);
            this.isInitialized = false;
        }
    }

    setupEventListeners() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggleChat());
        }
        
        const closeBtn = document.getElementById('chat-btn-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.toggleChat());
        }

        const minBtn = document.getElementById('chat-btn-minimize');
        if (minBtn) {
            minBtn.addEventListener('click', () => {
                if (this.container) this.container.classList.toggle('minimized');
            });
        }

        if (this.muteBtn) {
            this.muteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMute();
            });
        }

        const form = document.getElementById('chat-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }

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

        if (this.fileBtn) {
            this.fileBtn.addEventListener('click', () => this.fileInput.click());
        }

        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        if (this.emojiBtn) {
            this.emojiBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleEmojiPicker();
            });
        }

        if (this.buzzBtn) {
            this.buzzBtn.addEventListener('click', () => this.sendBuzz());
        }

        window.addEventListener('user-updated', (e) => {
            const newName = (e.detail && e.detail.name) || (window.sessionService ? window.sessionService.getUser() : null) || 'Invitado';
            this.currentUser = newName || 'Invitado';
        });

        // Typing indicator and Enter to send
        if (this.input) {
            this.input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            this.input.addEventListener('input', () => {
                this.autoResizeInput();
                if (!this.currentRecipient) return;
                
                if (!this.isTyping) {
                    this.sendTypingStatus(true);
                }

                clearTimeout(this.typingTimeout);
                this.typingTimeout = setTimeout(() => {
                    this.sendTypingStatus(false);
                }, 2000);
            });
        }

        // Drag and Drop support
        if (this.container) {
            const dropArea = this.container;
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropArea.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                dropArea.addEventListener(eventName, () => {
                    dropArea.classList.add('drag-over');
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropArea.addEventListener(eventName, () => {
                    dropArea.classList.remove('drag-over');
                }, false);
            });

            dropArea.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                if (files && files.length > 0) {
                    this.handleFileSelect({ target: { files: files } });
                }
            }, false);
        }
    }

    autoResizeInput() {
        if (!this.input) return;
        this.input.style.height = 'auto';
        this.input.style.height = (this.input.scrollHeight) + 'px';
    }

    async loadHistory() {
        try {
            // NO usar transiciones de opacidad - causan flashazos visuales molestos
            const url = this.currentRecipient
                ? `/chat/history?sender=${this.currentUser}&recipient=${this.currentRecipient}`
                : `/chat/history`;

            const history = await Api.get(url);

            // Limpiar y reconstruir rápidamente
            this.list.innerHTML = '';

            if (history.length === 0) {
                this.list.innerHTML = '<div class="text-center text-secondary small my-4 opacity-50 italic">No hay mensajes previos</div>';
            } else {
                // Agregar todos los mensajes de una vez (más rápido)
                const fragment = document.createDocumentFragment();
                history.forEach(msg => {
                    if (!msg.id) return;
                    const div = this.createMessageElement(msg);
                    if (div) fragment.appendChild(div);
                });
                this.list.appendChild(fragment);
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

    createMessageElement(msg) {
        const isOwn = msg.sender === this.currentUser;
        const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const div = document.createElement('div');
        div.className = `message-entry ${isOwn ? 'own-message message-sent' : 'message-received'}`;
        div.dataset.id = msg.id;

        if (msg.is_system) {
            div.innerHTML = `<div class="system-message">${msg.message}</div>`;
        } else {
            let statusHTML = '';
            if (isOwn && msg.recipient) {
                let statusClass = 'bi-check';
                let title = 'Enviado';
                let colorClass = '';

                if (msg.is_read) {
                    statusClass = 'bi-check-all';
                    colorClass = 'text-primary';
                    const time = this.formatStatusTime(msg.read_at);
                    title = `Leído ${time}`;
                } else if (msg.is_delivered) {
                    statusClass = 'bi-check-all';
                    const time = this.formatStatusTime(msg.delivered_at);
                    title = `Entregado ${time}`;
                }

                statusHTML = `<i class="bi ${statusClass} ${colorClass} ms-1" title="${title}"></i>`;
            }

            // Handle images and files
            let contentHTML = '';
            const isPath = typeof msg.message === 'string' && (msg.message.startsWith('storage/') || msg.message.startsWith('http'));

            if (isPath) {
                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.message);
                if (isImage) {
                    contentHTML = `<img src="${msg.message}" class="chat-image-attachment" onclick="window.open('${msg.message}', '_blank')">`;
                } else {
                    const fileName = msg.message.split('/').pop().split('_').slice(1).join('_') || msg.message.split('/').pop();
                    contentHTML = `
                        <a href="${msg.message}" target="_blank" class="chat-attachment">
                            <i class="bi bi-file-earmark-arrow-down"></i>
                            <div class="chat-attachment-info">
                                <span class="chat-attachment-name">${fileName}</span>
                                <span class="chat-attachment-size">Archivo adjunto</span>
                            </div>
                        </a>`;
                }
            } else {
                contentHTML = `<div class="message-text">${this.escapeHtml(msg.message)}</div>`;
            }

            const isOnlyEmoji = !isPath && this.isOnlyEmoji(msg.message);
            const bubbleClass = isOnlyEmoji ? 'large-emoji-bubble' : '';

            div.innerHTML = `
                ${!isOwn ? `<div class="message-sender">${msg.sender}${msg.recipient ? ' (Privado)' : ''}</div>` : ''}
                <div class="message-bubble ${bubbleClass} shadow-sm">
                    ${isOwn ? `<button class="btn btn-delete-msg" onclick="chat.deleteMessage('${msg.id}')" title="Borrar mensaje"><i class="bi bi-trash"></i></button>` : ''}
                    ${contentHTML}
                    <div class="message-time">${time}${statusHTML}</div>
                </div>
            `;
        }

        return div;
    }

    async loadUnreadCounts() {
        try {
            const counts = await Api.get(`/chat/unread-counts?user=${this.currentUser}`);
            this.unreadCounts = counts || {};
            this.updateTotalUnreadBadge();
            this.updateRecipientList();
        } catch (err) {
            console.error("[CHAT] Failed to load unread counts:", err);
        }
    }

    async loadAllUsers() {
        try {
            console.log("[CHAT] Fetching all users from API...");
            const users = await Api.get('/chat/users');
            if (Array.isArray(users)) {
                // Store full objects for potential use (display_name, hotel_id)
                this._usersRaw = users;
                this.allUsers = users.map(u => u.nombre);

                // Cache avatars locally to avoid extra calls
                if (!this.userAvatars) this.userAvatars = {};
                users.forEach(u => {
                    if (u.avatar_url) this.userAvatars[u.nombre] = u.avatar_url;
                });
            }
            this.updateRecipientList(true); // Force rebuild on first load
        } catch (err) {
            console.warn("[CHAT] Failed to load users from API, falling back to local config:", err);
            if (window.APP_CONFIG?.HOTEL?.RECEPCIONISTAS) {
                this.allUsers = window.APP_CONFIG.HOTEL.RECEPCIONISTAS.map(r => typeof r === 'string' ? r : r.nombre);
            }
            this.updateRecipientList(true); // Force rebuild on first load
        }
    }

    updateTotalUnreadBadge() {
        this.unreadCount = Object.values(this.unreadCounts).reduce((a, b) => a + b, 0);
        this.updateBadge();
    }

    markConversationAsRead(sender) {
        if (!sender) return;

        // Solo actualizar si realmente hay mensajes no leídos
        const hadUnread = this.unreadCounts[sender] > 0;

        if (!hadUnread) {
            // No hay nada que marcar como leído
            return;
        }

        // Update local state
        delete this.unreadCounts[sender];
        this.updateTotalUnreadBadge();
        this.updateRecipientList(); // Solo actualizar estados, no reconstruir

        // Notify server
        const sync = realTimeSync || window.realTimeSync;
        if (sync && sync.socket && sync.socket.readyState === WebSocket.OPEN) {
            sync.socket.send(JSON.stringify({
                type: 'chat_read',
                payload: { sender: sender, recipient: this.currentUser }
            }));
        }
    }

    handleMessagesRead(payload) {
        // payload: { sender, recipient, read_at } (where sender is me, recipient is the one who read it)
        if (payload.recipient === this.currentRecipient && payload.sender === this.currentUser) {
            const timeStr = this.formatStatusTime(payload.read_at);
            // Update all grey checkmarks to blue checkmarks in the current view
            this.list.querySelectorAll('.bi-check, .bi-check-all:not(.text-primary)').forEach(el => {
                el.classList.remove('bi-check');
                el.classList.add('bi-check-all', 'text-primary');
                el.title = `Leído ${timeStr}`;
            });
        }
    }

    formatStatusTime(dateInput) {
        if (!dateInput) return '';
        try {
            const date = new Date(dateInput);
            if (isNaN(date.getTime())) return '';
            return 'hoy a las ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    }

    handleMessageDelivered(payload) {
        // payload: { messageId, sender, recipient, delivered_at }
        if (payload.sender === this.currentUser && payload.recipient === this.currentRecipient) {
            const el = this.list.querySelector(`[data-id="${payload.messageId}"]`);
            if (el) {
                const check = el.querySelector('.bi-check');
                if (check) {
                    check.classList.remove('bi-check');
                    check.classList.add('bi-check-all');
                    const timeStr = this.formatStatusTime(payload.delivered_at);
                    check.title = `Entregado ${timeStr}`;
                }
            }
        }
    }

    // WebSocket connection is now managed by RealTimeSync
    sendMessage(forceText = null) {
        const text = forceText !== null ? forceText : this.input.value.trim();
        if (!text) return;

        // Hide emoji picker if open
        this.hideEmojiPicker();

        const recipientInfo = this.currentRecipient ? (this._usersRaw || []).find(u => u.nombre === this.currentRecipient) : null;
        const recipientHotelId = recipientInfo ? recipientInfo.hotel_id : null;

        const payload = {
            sender: this.currentUser,
            senderHotelId: localStorage.getItem('session_hotel_id') || 1,
            recipient: this.currentRecipient,
            recipientHotelId: recipientHotelId,
            message: text,
            is_system: false
        };

        // Use the shared socket from realTimeSync if available
        const sync = realTimeSync || window.realTimeSync;
        if (sync && sync.socket && sync.socket.readyState === WebSocket.OPEN) {
            sync.socket.send(JSON.stringify({
                type: 'chat_message',
                payload: payload
            }));
        } else {
            Api.post('/chat/message', payload);
        }

        if (forceText === null) {
            this.input.value = '';
            this.autoResizeInput();
            this.sendTypingStatus(false);
        }
    }

    async handleFileSelect(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        for (const file of files) {
            try {
                const path = await this.uploadFile(file);
                if (path) {
                    this.sendMessage(path);
                }
            } catch (err) {
                console.error("[CHAT] Error uploading file:", err);
                Ui.showToast(`Error al subir ${file.name}`, 'error');
            }
        }
        this.fileInput.value = ''; // Reset input
    }

    async uploadFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const base64Data = reader.result;
                    const response = await Api.post('/storage/upload', {
                        fileName: `${Date.now()}_${file.name}`,
                        fileData: base64Data,
                        folder: 'chat'
                    });
                    if (response && response.success) {
                        resolve(response.path);
                    } else {
                        reject(new Error("Upload failed"));
                    }
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error("File read error"));
            reader.readAsDataURL(file);
        });
    }

    isOnlyEmoji(text) {
        if (!text) return false;
        // Basic emoji regex. WhatsApp uses a similar approach.
        // This covers most emojis but avoids plain text.
        const emojiRegex = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]|\s)+$/;
        return emojiRegex.test(text.trim());
    }

    toggleEmojiPicker() {
        if (this.emojiPicker) {
            this.hideEmojiPicker();
        } else {
            this.showEmojiPicker();
        }
    }

    showEmojiPicker() {
        if (this.emojiPicker) return;

        const emojiData = this.getEmojiData();
        
        this.emojiPicker = document.createElement('div');
        this.emojiPicker.className = 'emoji-picker';
        
        // Tab Navigation
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'emoji-picker-tabs';
        
        const contentContainer = document.createElement('div');
        contentContainer.className = 'emoji-picker-content';
        
        emojiData.forEach((category, index) => {
            const tab = document.createElement('div');
            tab.className = `emoji-tab ${index === 0 ? 'active' : ''}`;
            tab.innerHTML = category.icon;
            tab.title = category.name;
            tab.onclick = () => {
                this.emojiPicker.querySelectorAll('.emoji-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderEmojiCategory(category, contentContainer);
            };
            tabsContainer.appendChild(tab);
        });
        
        this.emojiPicker.appendChild(tabsContainer);
        this.emojiPicker.appendChild(contentContainer);

        // Initial render of first category
        this.renderEmojiCategory(emojiData[0], contentContainer);

        // Close on click outside
        const closeHandler = (e) => {
            if (this.emojiPicker && !this.emojiPicker.contains(e.target) && e.target !== this.emojiBtn) {
                this.hideEmojiPicker();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 10);

        this.container.appendChild(this.emojiPicker);
    }

    renderEmojiCategory(category, container) {
        container.innerHTML = '';
        const title = document.createElement('div');
        title.className = 'emoji-category-title';
        title.textContent = category.name;
        container.appendChild(title);
        
        category.emojis.forEach(emoji => {
            const span = document.createElement('span');
            span.className = 'emoji-item';
            span.textContent = emoji;
            span.onclick = (e) => {
                e.stopPropagation();
                this.input.value += emoji;
                this.input.focus();
                this.autoResizeInput();
            };
            container.appendChild(span);
        });
        container.scrollTop = 0;
    }

    getEmojiData() {
        return [
            {
                name: 'Emoticonos',
                icon: '😊',
                emojis: ['😀', '😃', '😄', '😁', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😋', '😛', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '🥵', '🥶', '🥳', '😵‍💫', '🥸', '👻', '💀', '👽', '🤖', '💩']
            },
            {
                name: 'Personas',
                icon: '👋',
                emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '🩸']
            },
            {
                name: 'Animales',
                icon: '🐶',
                emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦫', '🦔', '🐾', '🐉', '🐲']
            },
            {
                name: 'Comida',
                icon: '🍎',
                emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🥮', '🍡', '🥟', '🥠', '🥡', '🦀', '🦞', '🦐', '🦑', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '🫖', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🥤', '🧋', '🧃', '🧉', '🧊', '🥢', '🍽️', '🍴', '🥄']
            },
            {
                name: 'Viajes',
                icon: '🚗',
                emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏎️', '🏍️', '🛵', '🦽', '🦼', '🛺', '🚲', '🛴', '🛹', '🛼', '⛽', '🚨', '🚥', '🚦', '🛑', '🚧', '⚓', '⛵', '🛶', '🚤', '🛳️', '⛴️', '🚢', '✈️', '🛩️', '🛫', '🛬', '🪂', '💺', '🚁', '🚟', '🚠', '🚡', '🛰️', '🚀', '🛸', '🛎️', '🧳', '⌛', '⏳', '⌚', '⏰', '⏱️', '⏲️', '🕰️', '🌡️', '☀️', '🌝', '🌞', '🪐', '🌟', '🌠', '🌌', '☁️', '⛅', '⛈️', '🌤️', '🌥️', '🌦️', '🌧️', '🌨️', '🌩️', '🌪️', '🌫️', '🌬️', '🌀', '🌈', '🌂', '☂️', '☔', '⛱️', '⚡', '❄️', '☃️', '⛄', '☄️', '🔥', '💧', '🌊']
            },
            {
                name: 'Objetos',
                icon: '💡',
                emojis: ['⌚', '📱', '📲', '💻', '⌨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪝', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🪠', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞', '🪟', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷️', '🪧', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '📊', '📈', '📉', '🗒️', '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓']
            },
            {
                name: 'Símbolos',
                icon: '❤️',
                emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '盛', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧️', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏏️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '♾️', '💲', '💱', '™️', '©️', '®️', '👁️‍🗨️', '🔚', '🔙', '🔛', '🔝', '🔜', '〰️', '➰', '➿', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧']
            },
            {
                name: 'Banderas',
                icon: '🏁',
                emojis: ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯', '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇮🇴', '🇻🇬', '🇧🇳', '🇧🇬', '🇧🇫', '🇧🇮', '🇰🇭', '🇨🇲', '🇨🇦', '🇮🇨', '🇨🇻', '🇧🇶', '🇰🇾', '🇨🇫', '🇹🇩', '🇨🇱', '🇨🇳', '🇨🇽', '🇨🇨', '🇨🇴', '🇰🇲', '🇨🇬', '🇨🇩', '🇨🇰', '🇨🇷', '🇨🇮', '🇭🇷', '🇨🇺', '🇨🇼', '🇨🇾', '🇨🇿', '🇩🇰', '🇩🇯', '🇩🇲', '🇩🇴', '🇪🇨', '🇪🇬', '🇸🇻', '🇬🇶', '🇪🇷', '🇪🇪', '🇪🇹', '🇪🇺', '🇫🇰', '🇫🇴', '🇫🇯', '🇫🇮', '🇫🇷', '🇬🇫', '🇵🇫', '🇹🇫', '🇬🇦', '🇬🇲', '🇬🇪', '🇩🇪', '🇬🇭', '🇬🇮', '🇬🇷', '🇬🇱', '🇬🇩', '🇬🇵', '🇬🇺', '🇬🇹', '🇬🇬', '🇬🇳', '🇬🇼', '🇬🇾', '🇭🇹', '🇭🇳', '🇭🇰', '🇭🇺', '🇮🇸', '🇮🇳', '🇮🇩', '🇮🇷', '🇮🇶', '🇮🇪', '🇮🇲', '🇮🇱', '🇮🇹', '🇯🇲', '🇯🇵', '🇯🇪', '🇯🇴', '🇰🇿', '🇰🇪', '🇰🇮', '🇽🇰', '🇰🇼', '🇰🇬', '🇱🇦', '🇱🇻', '🇱🇧', '🇱🇸', '🇱🇷', '🇱🇾', '🇱🇮', '🇱🇹', '🇱🇺', '🇲🇴', '🇲🇰', '🇲🇬', '🇲🇼', '🇲🇾', '🇲🇻', '🇲🇱', '🇲🇹', '🇲🇭', '🇲🇶', '🇲🇷', '🇲🇺', '🇾🇹', '🇲🇽', '🇫🇲', '🇲🇩', '🇲🇨', '🇲🇳', '🇲🇪', '🇲🇸', '🇲🇦', '🇲🇿', '🇲🇲', '🇳🇦', '🇳🇷', '🇳🇵', '🇳🇱', '🇳🇨', '🇳🇿', '🇳🇮', '🇳🇪', '🇳🇬', '🇳🇺', '🇳🇫', '🇰🇵', '🇲🇵', '🇳🇴', '🇴🇲', '🇵🇰', '🇵🇼', '🇵🇸', '🇵🇦', '🇵🇬', '🇵🇾', '🇵🇪', '🇵🇭', '🇵🇳', '🇵🇱', '🇵🇹', '🇵🇷', '🇶🇦', '🇷🇪', '🇷🇴', '🇷🇺', '🇷🇼', '🇼🇸', '🇸🇲', '🇸🇹', '🇸🇦', '🇸🇳', '🇷🇸', '🇸🇨', '🇸🇱', '🇸🇬', '🇸🇽', '🇸🇰', '🇸🇮', '🇬🇸', '🇸🇧', '🇸🇴', '🇿🇦', '🇰🇷', '🇸🇸', '🇪🇸', '🇱🇰', '🇧🇱', '🇸🇭', '🇰🇳', '🇱🇨', '🇵🇲', '🇻🇨', '🇸🇩', '🇸🇷', '🇸🇿', '🇸🇪', '🇨🇭', '🇸🇾', '🇹🇼', '🇹🇯', '🇹🇿', '🇹🇭', '🇹🇱', '🇹🇬', '🇹🇰', '🇹🇴', '🇹🇹', '🇹🇳', '🇹🇷', '🇹🇲', '🇹🇨', '🇹🇻', '🇻🇮', '🇺🇬', '🇺🇦', '🇦🇪', '🇬🇧', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '🏴󠁧󠁢󠁷󠁬󠁳󠁿', '🇺🇸', '🇺🇾', '🇺🇿', '🇻🇺', '🇻🇦', '🇻🇪', '🇻🇳', '🇼🇫', '🇪🇭', '🇾🇪', '🇿🇲', '🇿🇼']
            }
        ];
    }

    hideEmojiPicker() {
        if (this.emojiPicker) {
            this.emojiPicker.classList.add('animate__fadeOutDown');
            setTimeout(() => {
                if (this.emojiPicker) {
                    this.emojiPicker.remove();
                    this.emojiPicker = null;
                }
            }, 300);
        }
    }


    handleOnlineUsersList(users) {
        console.log('[CHAT] Received online users list:', users);
        const previousOnlineUsers = new Set(this.onlineUsers);

        this.onlineUsers.clear();
        users.forEach(user => {
            if (user !== this.currentUser) this.onlineUsers.add(user);
        });

        // Detectar si REALMENTE hubo cambios
        let hasChanges = false;
        let currentRecipientChanged = false;

        // Detectar usuarios nuevos conectados
        users.forEach(user => {
            if (!previousOnlineUsers.has(user)) {
                hasChanges = true;
                // Invalidar caché de presencia
                const recipientInfo = (this._usersRaw || []).find(u => u.nombre === user);
                const hId = recipientInfo ? recipientInfo.hotel_id : '';
                const cacheKey = `${user}_${hId}`;
                delete this.presenceCache[cacheKey];

                if (user === this.currentRecipient) {
                    currentRecipientChanged = true;
                }
            }
        });

        // Detectar usuarios desconectados
        previousOnlineUsers.forEach(user => {
            if (!this.onlineUsers.has(user)) {
                hasChanges = true;
                // Invalidar caché de presencia
                const recipientInfo = (this._usersRaw || []).find(u => u.nombre === user);
                const hId = recipientInfo ? recipientInfo.hotel_id : '';
                const cacheKey = `${user}_${hId}`;
                delete this.presenceCache[cacheKey];

                if (user === this.currentRecipient) {
                    currentRecipientChanged = true;
                }
            }
        });

        // Si NO hubo cambios, NO hacer nada (evita reconstrucciones innecesarias)
        if (!hasChanges) {
            console.log('[CHAT] No changes in online users, skipping UI update');
            return;
        }

        // Si el destinatario actual cambió su estado, actualizar UI del header
        if (currentRecipientChanged && this.currentRecipient) {
            console.log('[CHAT] Current recipient online status changed, updating presence UI');
            this.updatePresenceUI(true);
        }

        // Solo actualizar estados de la lista (sin reconstruir HTML completo)
        this.updateRecipientList(false);
    }

    handleUserPresence(payload) {
        if (payload.username === this.currentUser) return;

        console.log('[CHAT] User presence event:', payload);

        const wasOnline = this.onlineUsers.has(payload.username);
        const statusChanged = wasOnline !== payload.online;

        // Si no hubo cambio de estado, ignorar (evita procesamiento innecesario)
        if (!statusChanged) {
            console.log('[CHAT] No status change, ignoring presence event');
            return;
        }

        if (payload.online) {
            this.onlineUsers.add(payload.username);
        } else {
            this.onlineUsers.delete(payload.username);
        }

        // Invalidar caché de presencia para este usuario
        const recipientInfo = (this._usersRaw || []).find(u => u.nombre === payload.username);
        const hId = recipientInfo ? recipientInfo.hotel_id : '';
        const cacheKey = `${payload.username}_${hId}`;
        delete this.presenceCache[cacheKey];

        // Si es el destinatario actual, actualizar UI del header
        if (this.currentRecipient === payload.username) {
            console.log(`[CHAT] ${payload.username} status changed to ${payload.online ? 'online' : 'offline'}, updating UI`);
            this.updatePresenceUI(true);
        }

        // Solo actualizar estados (sin reconstruir HTML completo)
        console.log('[CHAT] Updating user list states due to presence change');
        this.updateRecipientList(false);
    }

    async fetchUserAvatars() {
        // Redundant with loadAllUsers, so we just ensure loadAllUsers is called or uses the same data
        if (!this._usersRaw || this._usersRaw.length === 0) {
            await this.loadAllUsers();
        }
    }

    async updateRecipientList(forceRebuild = false) {
        if (!this.userList) return;

        // Cargar avatares si aún no los tenemos (solo una vez)
        if (!this.userAvatars) {
            await this.fetchUserAvatars();
        }

        // Si ya existe una lista y solo estamos actualizando estado, actualizar y reordenar
        const existingItems = this.userList.querySelectorAll('[data-user]:not([data-user="global"])');

        if (!forceRebuild && existingItems.length > 0) {
            // Actualizar estados primero
            const usersToReorder = [];

            existingItems.forEach(item => {
                const user = item.dataset.user;
                const isOnline = this.onlineUsers.has(user);

                // Actualizar estado activo
                if (this.currentRecipient === user) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }

                // Actualizar indicador online/offline
                const dotElement = item.querySelector('.position-absolute.rounded-circle');
                if (dotElement) {
                    dotElement.className = dotElement.className.replace(/bg-(success|secondary)/, `bg-${isOnline ? 'success' : 'secondary'}`);
                }

                // Actualizar badge de no leídos
                const unreadCount = this.unreadCounts[user] || 0;
                const existingBadge = item.querySelector('.badge');
                if (unreadCount > 0) {
                    if (existingBadge) {
                        existingBadge.textContent = unreadCount;
                    } else {
                        const badge = document.createElement('span');
                        badge.className = 'badge rounded-pill bg-danger ms-auto';
                        badge.style.fontSize = '0.6rem';
                        badge.textContent = unreadCount;
                        item.appendChild(badge);
                    }
                } else if (existingBadge) {
                    existingBadge.remove();
                }

                // Actualizar negrita para usuarios online
                const nameSpan = item.querySelector('.text-truncate');
                if (nameSpan) {
                    const userInfo = (this._usersRaw || []).find(u => u.nombre === user);
                    const displayName = userInfo?.display_name || user;
                    nameSpan.innerHTML = isOnline ? `<strong>${displayName}</strong>` : displayName;
                }

                // Guardar para reordenar
                usersToReorder.push({ user, isOnline, element: item });
            });

            // Reordenar: online primero, luego alfabético
            usersToReorder.sort((a, b) => {
                if (a.isOnline && !b.isOnline) return -1;
                if (!a.isOnline && b.isOnline) return 1;
                return a.user.localeCompare(b.user);
            });

            // Reordenar en el DOM (agregar al final en el orden correcto)
            usersToReorder.forEach(({ element }) => {
                this.userList.appendChild(element); // Mover al final
            });

            // Actualizar estado del global
            const globalItem = this.userList.querySelector('[data-user="global"]');
            if (globalItem) {
                if (this.currentRecipient === null) {
                    globalItem.classList.add('active');
                } else {
                    globalItem.classList.remove('active');
                }
            }

            return;
        }

        // Reconstruir completa solo si es necesario
        const isGlobalActive = this.currentRecipient === null ? 'active' : '';
        this.userList.innerHTML = `
            <div class="list-group-item list-group-item-action border-0 mb-1 rounded d-flex align-items-center ${isGlobalActive}" data-user="global">
                <div class="avatar-circle bg-primary-soft me-2 d-flex align-items-center justify-content-center">
                    <i class="bi bi-globe text-primary" style="font-size: 0.9rem;"></i>
                </div>
                <span>Chat Global</span>
            </div>
            <div class="px-2 pt-2 pb-1 text-uppercase text-secondary" style="font-size: 0.65rem; font-weight: 800; opacity: 0.7;">Usuarios</div>
        `;

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
            const unreadCount = this.unreadCounts[user] || 0;
            const avatarUrl = this.userAvatars && this.userAvatars[user];

            // Buscar info extra (display_name, hotel_id)
            const userInfo = (this._usersRaw || []).find(u => u.nombre === user);
            const displayName = userInfo?.display_name || user;
            const hotelId = userInfo?.hotel_id;
            const hotelLabel = hotelId ? (hotelId === 1 ? 'Garoe' : 'Ambassador') : '';

            const dotColor = isOnline ? 'success' : 'secondary';
            // NO usar Date.now() para versionar - causa recargas innecesarias
            const avatarHtml = avatarUrl
                ? `<img src="/${avatarUrl}" class="avatar-img shadow-sm" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user)}&background=random';">`
                : `<div class="avatar-circle bg-light d-flex align-items-center justify-content-center"><i class="bi bi-person text-secondary"></i></div>`;

            const badgeHTML = unreadCount > 0 ? `<span class="badge rounded-pill bg-danger ms-auto" style="font-size: 0.6rem;">${unreadCount}</span>` : '';

            this.userList.innerHTML += `
                <div class="list-group-item list-group-item-action border-0 px-2 py-2 mb-1 rounded d-flex align-items-center ${isActive}" data-user="${user}">
                    <div class="position-relative me-3">
                        ${avatarHtml}
                        <span class="position-absolute bottom-0 end-0 p-1 bg-${dotColor} border border-2 border-white rounded-circle" style="width: 10px; height: 10px;"></span>
                    </div>
                    <div class="d-flex flex-column" style="flex: 1; min-width: 0;">
                        <span class="text-truncate" style="font-size: 0.85rem;">${isOnline ? `<strong>${displayName}</strong>` : displayName}</span>
                        ${hotelLabel ? `<span class="text-muted tiny opacity-75" style="font-size: 0.65rem;">${hotelLabel}</span>` : ''}
                    </div>
                    ${badgeHTML}
                </div>
            `;
        });

        if (this.currentRecipient && !usersArray.includes(this.currentRecipient) && !this.onlineUsers.has(this.currentRecipient)) {
            this.setRecipient(null);
        }
    }

    setRecipient(user) {
        // Evitar recarga si ya estamos en el mismo destinatario
        if (this.currentRecipient === user) return;

        this.currentRecipient = user;

        // Update header label
        if (this.currentLabel) {
            if (user) {
                this.currentLabel.innerHTML = `<i class="bi bi-person-fill me-1 text-primary"></i> ${user}`;
            } else {
                this.currentLabel.innerHTML = `<i class="bi bi-globe me-1 text-primary"></i> Chat Global`;
            }
        }

        // Update list active state (solo cambiar clases, no recargar)
        if (this.userList) {
            this.userList.querySelectorAll('.list-group-item').forEach(el => el.classList.remove('active'));
            const selector = user ? `[data-user="${user}"]` : `[data-user="global"]`;
            const activeEl = this.userList.querySelector(selector);
            if (activeEl) activeEl.classList.add('active');
        }

        // Update UI info
        const deleteConvBtn = document.getElementById('chat-btn-delete-conversation');
        const globalNotice = document.getElementById('chat-global-notice');

        if (user) {
            if (globalNotice) globalNotice.classList.add('d-none');
            if (deleteConvBtn) deleteConvBtn.classList.remove('d-none');

            this.markConversationAsRead(user);
            this.updatePresenceUI();
            // Cargar historial solo cuando cambiamos de conversación
            this.loadHistory();
        } else {
            if (this.presenceStatus) this.presenceStatus.innerHTML = '';
            if (this.buzzBtn) {
                this.buzzBtn.classList.add('d-none');
                this.buzzBtn.style.setProperty('display', 'none', 'important');
            }
            const avatarContainer = document.getElementById('chat-header-avatar-container');
            if (avatarContainer) avatarContainer.classList.add('d-none');
            if (globalNotice) globalNotice.classList.remove('d-none');
            if (deleteConvBtn) deleteConvBtn.classList.add('d-none');

            // Cargar historial global
            this.loadHistory();
        }
    }

    async updatePresenceUI(skipCache = false) {
        console.log(`[CHAT] Updating presence UI for: ${this.currentRecipient}`);
        if (!this.presenceStatus) return;

        if (!this.currentRecipient) {
            this.presenceStatus.innerHTML = '';
            return;
        }

        try {
            const recipientInfo = this.currentRecipient ? (this._usersRaw || []).find(u => u.nombre === this.currentRecipient) : null;

            // Header Avatar
            const avatarContainer = document.getElementById('chat-header-avatar-container');
            const avatarImg = document.getElementById('chat-header-avatar');
            if (avatarContainer && avatarImg && recipientInfo) {
                const url = recipientInfo.avatar_url;
                const newSrc = url
                    ? (url.startsWith('http') ? url : `/${url}`)
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(this.currentRecipient)}&background=random&color=fff&size=100`;

                // Solo actualizar si cambió (evita flashazos)
                if (avatarImg.src !== newSrc) {
                    avatarImg.src = newSrc;
                }
                avatarContainer.classList.remove('d-none');
            }

            // PRIORIZAR onlineUsers (WebSocket en tiempo real) sobre la petición API
            const isOnlineRealTime = this.onlineUsers.has(this.currentRecipient);

            if (isOnlineRealTime) {
                // Usuario está online según WebSocket - información más confiable
                console.log(`[CHAT] ${this.currentRecipient} is ONLINE (from WebSocket)`);
                this.presenceStatus.innerHTML = '<span class="text-success fw-bold">en línea</span>';
                if (this.buzzBtn) {
                    this.buzzBtn.classList.remove('d-none');
                    this.buzzBtn.style.setProperty('display', 'flex', 'important');
                    this.buzzBtn.disabled = false;
                    this.buzzBtn.style.opacity = '1';
                }
            } else {
                // Usuario está offline, intentar obtener last_seen del servidor
                const hId = recipientInfo ? recipientInfo.hotel_id : '';
                const cacheKey = `${this.currentRecipient}_${hId}`;

                let presence = null;
                const now = Date.now();
                const cached = this.presenceCache[cacheKey];

                if (!skipCache && cached && (now - cached.timestamp) < this.presenceCacheTTL) {
                    console.log(`[CHAT] Using cached presence for ${this.currentRecipient}`);
                    presence = cached.data;
                } else {
                    console.log(`[CHAT] Fetching fresh presence for ${this.currentRecipient}`);
                    presence = await Api.get(`/chat/presence/${this.currentRecipient}${hId ? `?hotel_id=${hId}` : ''}`);
                    // Guardar en caché
                    this.presenceCache[cacheKey] = {
                        data: presence,
                        timestamp: now
                    };
                }

                // Mostrar buzz deshabilitado si está offline
                if (this.buzzBtn) {
                    this.buzzBtn.classList.remove('d-none');
                    this.buzzBtn.style.setProperty('display', 'flex', 'important');
                    this.buzzBtn.disabled = true;
                    this.buzzBtn.style.opacity = '0.4';
                }

                if (presence && presence.last_seen) {
                    const date = new Date(presence.last_seen);
                    const nowDate = new Date();
                    let timeStr = '';

                    if (date.toDateString() === nowDate.toDateString()) {
                        timeStr = 'hoy a las ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } else {
                        timeStr = 'el ' + date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }

                    this.presenceStatus.innerHTML = `Visto por última vez: ${timeStr}`;
                } else {
                    this.presenceStatus.innerHTML = 'desconectado';
                }
            }
        } catch (err) {
            console.warn("[CHAT] Failed to fetch presence:", err);
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
            if (isCurrentPrivate && msg.sender !== this.currentUser && this.isOpen) {
                this.markConversationAsRead(msg.sender);
            }
            
            // Ack delivery if it's a private message for me
            if (msg.recipient === this.currentUser && msg.sender !== this.currentUser) {
                import('../core/RealTimeSync.js').then(m => {
                    const sync = m.realTimeSync || window.realTimeSync;
                    if (sync && sync.socket && sync.socket.readyState === WebSocket.OPEN) {
                        sync.socket.send(JSON.stringify({
                            type: 'chat_delivered',
                            payload: { messageId: msg.id, sender: msg.sender, recipient: this.currentUser }
                        }));
                    }
                });
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
            setTimeout(() => {
                el.remove();
                if (this.list.children.length === 0) {
                    this.list.innerHTML = '<div class="text-center text-secondary small my-4 opacity-50 italic">No hay mensajes previos</div>';
                }
            }, 500);
        }
    }

    appendMessage(msg, scroll = true) {
        if (!msg.id) return; // Ignore messages without ID

        const div = this.createMessageElement(msg);
        if (!div) return;

        // Solo agregar animación a mensajes nuevos (no al cargar historial)
        if (scroll) {
            const bubble = div.querySelector('.message-bubble');
            if (bubble) {
                bubble.classList.add('animate__animated', 'animate__fadeInUp');
            }
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
                this.list.innerHTML = '<div class="text-center text-secondary small my-4 opacity-50 italic">Conversación borrada</div>';
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

    sendBuzz() {
        if (!this.currentRecipient) return;

        const recipientInfo = (this._usersRaw || []).find(u => u.nombre === this.currentRecipient);
        const recipientHotelId = recipientInfo ? recipientInfo.hotel_id : null;
        const senderHotelId = parseInt(localStorage.getItem('session_hotel_id')) || 1;

        console.log("[CHAT DEBUG] Sending buzz:", {
            currentRecipient: this.currentRecipient,
            recipientInfo: recipientInfo,
            recipientHotelId: recipientHotelId,
            senderHotelId: senderHotelId,
            usersRaw: this._usersRaw
        });

        if (!recipientHotelId) {
            console.warn("[CHAT] Cannot send buzz: recipient hotel ID not found");
            Ui.showToast("No se pudo enviar el zumbido: destinatario no encontrado.", "warning");
            return;
        }

        const payload = {
            sender: this.currentUser,
            senderHotelId: senderHotelId,
            recipient: this.currentRecipient,
            recipientHotelId: recipientHotelId
        };

        console.log("[CHAT] Sending buzz with payload:", payload);

        import('../core/RealTimeSync.js').then(m => {
            const sync = m.realTimeSync || window.realTimeSync;
            if (sync && sync.socket && sync.socket.readyState === WebSocket.OPEN) {
                sync.socket.send(JSON.stringify({
                    type: 'chat_buzz',
                    payload: payload
                }));
                Ui.showToast(`¡Zumbido enviado a ${this.currentRecipient}!`, 'info');

                // Visual feedback locally
                if (this.container) {
                    this.container.classList.add('chat-shake');
                    setTimeout(() => this.container.classList.remove('chat-shake'), 500);
                }

                // Debounce buzz button
                if (this.buzzBtn) {
                    this.buzzBtn.disabled = true;
                    setTimeout(() => { if(this.buzzBtn) this.buzzBtn.disabled = false; }, 5000);
                }
            } else {
                console.warn("[CHAT] No connection to send buzz.");
                Ui.showToast("No se pudo enviar el zumbido: Sin conexión al servidor.", "warning");
                if (sync && sync.reconnect) sync.reconnect();
            }
        }).catch(err => {
            console.error("[CHAT] Error importing RealTimeSync for Buzz:", err);
            Ui.showToast("Error al procesar el zumbido.", "danger");
        });
    }

    handleIncomingBuzz(payload) {
        // payload: { sender, senderHotelId, recipient, recipientHotelId }
        console.log("[CHAT] Incoming Buzz from:", payload.sender, "Hotel:", payload.senderHotelId);

        // Visual notification using window.showToast directly
        if (window.showToast) {
            window.showToast(`🔔 ¡${payload.sender} te ha enviado un zumbido!`, 'warning', 3000);
        }

        // Sound (pre-load audio in constructor to avoid autoplay block)
        if (!this.isMuted && this.buzzAudio) {
            this.buzzAudio.currentTime = 0;
            this.buzzAudio.play().catch(e => console.warn("[CHAT] Buzz sound failed:", e.message));
        }

        // Vibration
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate([200, 100, 200]);
        }

        // Visual feedback (shake)
        if (this.container) {
            this.container.classList.add('chat-shake');
            setTimeout(() => this.container.classList.remove('chat-shake'), 800);
        }
    }

    sendTypingStatus(isTyping) {
        if (!this.currentRecipient || this.isTyping === isTyping) return;
        this.isTyping = isTyping;

        const recipientInfo = (this._usersRaw || []).find(u => u.nombre === this.currentRecipient);
        const recipientHotelId = recipientInfo ? recipientInfo.hotel_id : null;
        const senderHotelId = parseInt(localStorage.getItem('session_hotel_id')) || 1;

        if (!recipientHotelId) return;

        import('../core/RealTimeSync.js').then(m => {
            const sync = m.realTimeSync || window.realTimeSync;
            if (sync && sync.socket && sync.socket.readyState === WebSocket.OPEN) {
                sync.socket.send(JSON.stringify({
                    type: isTyping ? 'chat_typing' : 'chat_stop_typing',
                    payload: {
                        sender: this.currentUser,
                        senderHotelId: senderHotelId,
                        recipient: this.currentRecipient,
                        recipientHotelId: recipientHotelId
                    }
                }));
            }
        });
    }

    handleRemoteTyping(payload) {
        // payload: { sender, recipient, stop }
        if (payload.sender === this.currentRecipient && payload.recipient === this.currentUser) {
            if (this.presenceStatus) {
                if (payload.stop) {
                    // Restore online/last-seen usando caché para evitar flashazos
                    this.updatePresenceUI(false); // usar caché
                } else {
                    this.presenceStatus.innerHTML = '<span class="text-info animate__animated animate__pulse animate__infinite">escribiendo...</span>';
                    // Auto-stop after 5 seconds if no stop event received
                    if (this.remoteTypingTimeout) clearTimeout(this.remoteTypingTimeout);
                    this.remoteTypingTimeout = setTimeout(() => this.updatePresenceUI(false), 5000);
                }
            }
        }
    }
}

export const chat = new ChatModule();
window.chat = chat;
