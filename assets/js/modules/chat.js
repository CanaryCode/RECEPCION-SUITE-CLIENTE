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
        this.typingTimeout = null;
        this.isTyping = false;
        this.presenceInterval = null;
        this.isInitialized = false;
        this.userAvatars = null;
    }

    async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        
        // Refresh current user from session just in case
        this.currentUser = sessionStorage.getItem('session_user') || 'Invitado';
        
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
                } else if (data.type === 'chat_stop_typing') {
                    const stopPayload = { ...data.payload, stop: true };
                    this.handleRemoteTyping(stopPayload);
                }
            });

            // Start background tasks without blocking visibility
            this.allUsers = [];
            if (window.APP_CONFIG?.HOTEL?.RECEPCIONISTAS) {
                this.allUsers = window.APP_CONFIG.HOTEL.RECEPCIONISTAS.map(r => typeof r === 'string' ? r : r.nombre);
            }
            
            this.updateRecipientList();
            
            // Heavy data loading
            this.loadUnreadCounts().catch(e => console.warn("[CHAT] Error loading counts:", e));
            this.loadHistory().catch(e => console.warn("[CHAT] Error loading history:", e));
            
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
            this.unreadCounts = counts || {};
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
            const sync = m.realTimeSync || window.realTimeSync;
            if (sync && sync.socket && sync.socket.readyState === WebSocket.OPEN) {
                sync.socket.send(JSON.stringify({
                    type: 'chat_read',
                    payload: { sender: sender, recipient: this.currentUser }
                }));
            }
            // Force a refresh of unread counts from server to be safe
            this.loadUnreadCounts();
        });
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

        const payload = {
            sender: this.currentUser,
            recipient: this.currentRecipient,
            message: text,
            is_system: false
        };

        // Use the shared socket from realTimeSync if available
        import('../core/RealTimeSync.js').then(m => {
            const sync = m.realTimeSync || window.realTimeSync;
            if (sync && sync.socket && sync.socket.readyState === WebSocket.OPEN) {
                sync.socket.send(JSON.stringify({
                    type: 'chat_message',
                    payload: payload
                }));
            } else {
                Api.post('/chat/message', payload);
            }
        });

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

        const emojis = [
            '😊', '😂', '🥰', '😍', '😒', '😭', '😘', '😩', '😔', '👌', '👍', '🙏', '❤️', '✨', '🔥', '✔️', '❌', '🚀', '⭐', '🏨', '🛌', '🛎️', '🧹', '🍽️',
            '😀', '😃', '😄', '😁', '😅', '🤣', '😇', '🙂', '🙃', '😉', '😌', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😞', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧',
            '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '🤜', '🤛', '👊', '✊', '🤛', '🤜', '🤚', '👋', '🤟', '🤘', '🤙',
            '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟',
            '💥', '💢', '💨', '💦', '💧', '💤'
        ];
        
        this.emojiPicker = document.createElement('div');
        this.emojiPicker.className = 'emoji-picker animate__animated animate__fadeInUp';
        
        emojis.forEach(emoji => {
            const span = document.createElement('span');
            span.className = 'emoji-item';
            span.textContent = emoji;
            span.addEventListener('click', () => {
                this.input.value += emoji;
                this.input.focus();
                this.hideEmojiPicker();
            });
            this.emojiPicker.appendChild(span);
        });

        // Close on click outside
        const closeHandler = (e) => {
            if (this.emojiPicker && !this.emojiPicker.contains(e.target) && e.target !== this.emojiBtn) {
                this.hideEmojiPicker();
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);

        this.container.appendChild(this.emojiPicker);
    }

    hideEmojiPicker() {
        if (this.emojiPicker) {
            this.emojiPicker.remove();
            this.emojiPicker = null;
        }
    }


    handleOnlineUsersList(users) {
        this.onlineUsers.clear();
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
        
        if (this.currentRecipient === payload.username) {
            this.updatePresenceUI();
        }
        
        this.updateRecipientList();
    }

    async fetchUserAvatars() {
        try {
            const data = await Api.get('storage/recepcionistas');
            this.userAvatars = {};
            if (Array.isArray(data)) {
                data.forEach(u => {
                    const name = typeof u === 'string' ? u : u.nombre;
                    const avatar = typeof u === 'object' ? u.avatar_url : null;
                    if (avatar) this.userAvatars[name] = avatar;
                });
            }
        } catch (e) {
            console.warn("[CHAT] Could not fetch user avatars:", e);
        }
    }

    async updateRecipientList() {
        if (!this.userList) return;
        
        // Cargar avatares si aún no los tenemos
        if (!this.userAvatars) {
            await this.fetchUserAvatars();
        }

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
            
            const dotColor = isOnline ? 'success' : 'secondary';
            const avatarHtml = avatarUrl 
                ? `<img src="/${avatarUrl}" class="avatar-img shadow-sm">`
                : `<div class="avatar-circle bg-light d-flex align-items-center justify-content-center"><i class="bi bi-person text-secondary"></i></div>`;

            const badgeHTML = unreadCount > 0 ? `<span class="badge rounded-pill bg-danger ms-auto" style="font-size: 0.6rem;">${unreadCount}</span>` : '';

            this.userList.innerHTML += `
                <div class="list-group-item list-group-item-action border-0 px-2 py-2 mb-1 rounded d-flex align-items-center ${isActive}" data-user="${user}">
                    <div class="position-relative me-3">
                        ${avatarHtml}
                        <span class="position-absolute bottom-0 end-0 p-1 bg-${dotColor} border border-2 border-white rounded-circle" style="width: 10px; height: 10px;"></span>
                    </div>
                    <span class="text-truncate" style="flex: 1; font-size: 0.85rem;">${isOnline ? `<strong>${user}</strong>` : user}</span>
                    ${badgeHTML}
                </div>
            `;
        });

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
            this.updatePresenceUI();
        } else {
            if (this.presenceStatus) this.presenceStatus.innerHTML = '';
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

    async updatePresenceUI() {
        console.log(`[CHAT] Updating presence UI for: ${this.currentRecipient}`);
        if (!this.presenceStatus) return;
        
        if (!this.currentRecipient) {
            this.presenceStatus.innerHTML = '';
            return;
        }

        try {
            const presence = await Api.get(`/chat/presence/${this.currentRecipient}`);
            if (presence.is_online) {
                this.presenceStatus.innerHTML = '<span class="text-success fw-bold">en línea</span>';
            } else if (presence.last_seen) {
                const date = new Date(presence.last_seen);
                const now = new Date();
                let timeStr = '';
                
                if (date.toDateString() === now.toDateString()) {
                    timeStr = 'hoy a las ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } else {
                    timeStr = 'el ' + date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
                
                this.presenceStatus.innerHTML = `Visto por última vez: ${timeStr}`;
            } else {
                this.presenceStatus.innerHTML = '';
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
                <div class="message-bubble ${bubbleClass} shadow-sm animate__animated animate__fadeInUp">
                    ${isOwn ? `<button class="btn btn-delete-msg" onclick="chat.deleteMessage('${msg.id}')" title="Borrar mensaje"><i class="bi bi-trash"></i></button>` : ''}
                    ${contentHTML}
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

    sendTypingStatus(isTyping) {
        if (!this.currentRecipient || this.isTyping === isTyping) return;
        this.isTyping = isTyping;

        import('../core/RealTimeSync.js').then(m => {
            const sync = m.realTimeSync || window.realTimeSync;
            if (sync && sync.socket && sync.socket.readyState === WebSocket.OPEN) {
                sync.socket.send(JSON.stringify({
                    type: isTyping ? 'chat_typing' : 'chat_stop_typing',
                    payload: { sender: this.currentUser, recipient: this.currentRecipient }
                }));
            }
        });
    }

    handleRemoteTyping(payload) {
        // payload: { sender, recipient, stop }
        if (payload.sender === this.currentRecipient && payload.recipient === this.currentUser) {
            if (this.presenceStatus) {
                if (payload.stop) {
                    this.updatePresenceUI(); // Restore online/last-seen
                } else {
                    this.presenceStatus.innerHTML = '<span class="text-info animate__animated animate__pulse animate__infinite">escribiendo...</span>';
                    // Auto-stop after 5 seconds if no stop event received
                    if (this.remoteTypingTimeout) clearTimeout(this.remoteTypingTimeout);
                    this.remoteTypingTimeout = setTimeout(() => this.updatePresenceUI(), 5000);
                }
            }
        }
    }
}

export const chat = new ChatModule();
window.chat = chat;
