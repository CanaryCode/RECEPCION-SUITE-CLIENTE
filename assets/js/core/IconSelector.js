/**
 * ICON & EMOJI SELECTOR HD (IconSelector.js)
 * ----------------------------------------
 * Premium version with concept-based search.
 */

export const IconSelector = {
    targetId: null,
    onSelect: null,
    currentModal: null,

    /**
     * DICTIONARY FOR CONCEPT SEARCH (Keywords)
     * Maps popular terms to Emojis for "Smart Search"
     */
    emojiKeywords: {
        "vino": ['🍷', '🥂', '🍾', '🍇', '🍸'],
        "wine": ['🍷', '🥂', '🍾', '🍇', '🍸'],
        "cerveza": ['🍺', '🍻', '🍺'],
        "beer": ['🍺', '🍻', '🍺'],
        "cafe": ['☕', '🍵', '🍩', '🥐'],
        "coffee": ['☕', '🍵', '🍩', '🥐'],
        "comida": ['🍔', '🍕', '🥘', '🍖', '🌮', '🥗', '🍲'],
        "food": ['🍔', '🍕', '🥘', '🍖', '🌮', '🥗', '🍲'],
        "desayuno": ['🥐', '🥞', '🍳', '🥓', '🥛', '🥯'],
        "breakfast": ['🥐', '🥞', '🍳', '🥓', '🥛', '🥯'],
        "fruta": ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒'],
        "fruit": ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒'],
        "bebida": ['🥤', '🧃', '🧉', '🍹', '🍸', '🥃', '🍷'],
        "drink": ['🥤', '🧃', '🧉', '🍹', '🍸', '🥃', '🍷'],
        "playa": ['🏖️', '🌴', '🌊', '☀️', '🍹', '⛱️'],
        "beach": ['🏖️', '🌴', '🌊', '☀️', '🍹', '⛱️'],
        "ocio": ['🎮', '🎾', '🏊', '🚴', '🎭', '🎰'],
        "relax": ['🧖', '💆', '🧘', '🛀', '🛌'],
        "transporte": ['🚗', '🚀', '✈️', '🚢', '🚂', '🚕', '🚌'],
        "transport": ['🚗', '🚀', '✈️', '🚢', '🚂', '🚕', '🚌'],
        "hotel": ['🏨', '🛌', '🔑', '🛎️', '🚪', '🛎️'],
        "recepcion": ['🛎️', '👤', '🔑', '📅', '📞'],
        "reception": ['🛎️', '👤', '🔑', '📅', '📞'],
        "baño": ['🚽', '🚿', '🛁', '🧼', '🧻'],
        "bathroom": ['🚽', '🚿', '🛁', '🧼', '🧻'],
        "dinero": ['💰', '💳', '💎', '💵', '🪙'],
        "money": ['💰', '💳', '💎', '💵', '🪙'],
        "check": ['✅', '🆗', '✔️'],
        "delete": ['🗑️', '❌', '✖️'],
        "edit": ['✏️', '📝', '✒️']
    },

    open(targetId = null, onSelect = null) {
        this.targetId = targetId;
        this.onSelect = onSelect;
        
        this._ensureModal();
        this._renderIcons();
        this._renderEmojis();
        
        const modalEl = document.getElementById('iconSelectorModal');
        this.currentModal = bootstrap.Modal.getOrCreateInstance(modalEl);
        this.currentModal.show();
        
        const searchInput = document.getElementById('is-search-input');
        if (searchInput) {
            searchInput.value = '';
            setTimeout(() => searchInput.focus(), 500);
        }
    },

    select(value) {
        if (this.targetId) {
            const el = document.getElementById(this.targetId);
            if (el) {
                el.value = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const preview = document.getElementById('preview-' + this.targetId);
            if (preview) {
                const isImage = value && (value.startsWith('data:') || value.includes('.') || value.includes('/'));
                if (isImage) {
                    preview.innerHTML = `<img src="${value}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 6px;">`;
                } else {
                    const allVectorIcons = Object.values(this.iconLibrary).flat();
                    const isVectorIcon = allVectorIcons.includes(value) || value.includes('bi-');
                    if (isVectorIcon) {
                        const iconClass = value.includes('bi-') ? value : `bi-${value}`;
                        preview.innerHTML = `<i class="bi ${iconClass}" style="font-size: 2rem; color: #000; vertical-align: middle;"></i>`;
                    } else {
                        preview.innerHTML = `<span style="font-size: 2rem; vertical-align: middle;">${value}</span>`;
                    }
                }
            }
        }
        if (typeof this.onSelect === 'function') this.onSelect(value);
        this.currentModal?.hide();
    },

    async handleFileUpload(input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            try {
                const formData = new FormData();
                formData.append('image', file);
                formData.append('folder', 'resources/uploads/icons');
                const { Api } = await import('../core/Api.js');
                const response = await Api.post('/system/save-image', formData, { isFormData: true });
                if (response && response.path) this.select(response.path);
            } catch (error) {
                const reader = new FileReader();
                reader.onload = (e) => this.select(e.target.result);
                reader.readAsDataURL(file);
            }
        }
    },

    _ensureModal() {
        if (document.getElementById('iconSelectorModal')) return;
        const style = document.createElement('style');
        style.textContent = `
            #iconSelectorModal .modal-content { background: #fdfdfd !important; border-radius: 28px !important; }
            #iconSelectorModal .btn-icon-glass {
                width: 140px; height: 140px; background: #ffffff !important; border: 2px solid #e9ecef !important;
                border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); transition: all 0.2s ease;
                display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; overflow: hidden;
            }
            #iconSelectorModal .btn-icon-glass:hover { transform: scale(1.05); border-color: #0d6efd !important; box-shadow: 0 10px 25px rgba(13, 110, 253, 0.15); }
            #iconSelectorModal .btn-icon-glass i, #iconSelectorModal .btn-icon-glass i::before {
                font-family: "bootstrap-icons" !important; font-size: 4rem !important; color: #000 !important;
                -webkit-text-fill-color: #000 !important; display: block !important; line-height: 1 !important;
            }
            #iconSelectorModal .btn-icon-glass:hover i { color: #0d6efd !important; -webkit-text-fill-color: #0d6efd !important; }
            #iconSelectorModal .emoji-hd { font-size: 5rem !important; display: block; line-height: 1; margin-bottom: 5px; }
            #iconSelectorModal .icon-label { font-size: 0.7rem; font-weight: 700; color: #495057; text-transform: uppercase; }
            .nav-pills .nav-link.active { background-color: #000 !important; color: #fff !important; }
        `;
        document.head.appendChild(style);

        const html = `
        <div class="modal fade" id="iconSelectorModal" tabindex="-1" aria-hidden="true" style="z-index: 10070;">
            <div class="modal-dialog modal-dialog-centered modal-xl">
                <div class="modal-content border-0 shadow-lg">
                    <div class="modal-header border-0 bg-dark text-white p-4" style="background: #000 !important;">
                        <h5 class="modal-title fw-bold text-uppercase"><i class="bi bi-grid-3x3-gap-fill me-2 text-primary"></i>Buscador de Iconos & Emojis HD</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-0">
                        <div class="p-3 bg-white border-bottom">
                            <div class="input-group shadow-sm border rounded-pill overflow-hidden">
                                <span class="input-group-text bg-white border-0 ps-3"><i class="bi bi-search"></i></span>
                                <input type="text" id="is-search-input" class="form-control border-0 py-3" placeholder="Busca por concepto (vino, comida, playa, wifi...)" oninput="IconSelector.filter(this.value)">
                            </div>
                        </div>
                        <ul class="nav nav-pills nav-fill p-2 bg-light border-bottom gap-2" role="tablist">
                            <li class="nav-item"><button class="nav-link active py-2 fw-bold" id="is-tab-icons" data-bs-toggle="tab" data-bs-target="#is-pane-icons">Vectoriales</button></li>
                            <li class="nav-item"><button class="nav-link py-2 fw-bold" id="is-tab-emojis" data-bs-toggle="tab" data-bs-target="#is-pane-emojis">Emojis HD</button></li>
                            <li class="nav-item"><button class="nav-link py-2 fw-bold" id="is-tab-pc" data-bs-toggle="tab" data-bs-target="#is-pane-pc">Mis Imágenes</button></li>
                        </ul>
                        <div class="tab-content" style="height: 65vh; overflow-y: auto; background: #f8f9fa;">
                            <div class="tab-pane fade show active p-4" id="is-pane-icons">
                                <div id="is-icon-grid" class="d-flex flex-wrap gap-3 justify-content-center pb-5"></div>
                            </div>
                            <div class="tab-pane fade p-4" id="is-pane-emojis">
                                <div id="is-emoji-grid" class="d-flex flex-wrap gap-2 justify-content-center pb-5"></div>
                            </div>
                            <div class="tab-pane fade p-4 h-100" id="is-pane-pc">
                                <div class="h-100 d-flex flex-column align-items-center justify-content-center text-center">
                                    <i class="bi bi-cloud-arrow-up text-primary mb-4" style="font-size: 5rem;"></i>
                                    <label for="is-file-input" class="btn btn-dark btn-lg rounded-pill px-5 py-3 fw-bold">SUBIR IMAGEN DESDE PC</label>
                                    <input type="file" id="is-file-input" class="d-none" accept="image/*" onchange="IconSelector.handleFileUpload(this)">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    _renderEmojis(filteredItems = null) {
        const grid = document.getElementById('is-emoji-grid');
        if (!grid) return;
        
        const categories = filteredItems ? { "Resultados": filteredItems } : {
            "Giro & Esenciales": ['⭐', '🌟', '🏠', '👤', '🔔', '📅', '⚙️', '🔍', '💾', '🗑️', '✏️', '📍', '💡', '🔥', '✨', '💎', '💰', '💳', '✅', '❌', '⚠️', 'ℹ️', '🚀', '🌈'],
            "Habitaciones": ['🛌', '🚪', '🔑', '🚽', '🚿', '🛋️', '🪟', '🧹', '🧺', '🧼', '🪒', '🧴', '🧻', '🛁', '🌡️', '📺', '📻', '🔒', '🧊', '🪑'],
            "Vistas & Mar": ['🌊', '🌳', '🏨', '🏙️', '🏞️', '🌅', '🌇', '🌉', '🏔️', '🌋', '⛺', '⛲', '🏖️', '🌴', '🛳️', '⛵', '⚓'],
            "Gastronomía": ['🥐', '🥖', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🥗', '🥘', '🥣', '🍲', '🍜', '🍝', '🍣', '🍤', '🍥', '🍳', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯'],
            "Frutería": ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌽', '🥕', '🫑', '🥔'],
            "Bebidas & Alcohol": ['☕', '🍵', '🧉', '🥤', '🧋', '🧃', '🥛', '🍼', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🍾', '🧊'],
            "Ocio & Playa": ['🏊', '🏖️', '🎮', '🎾', '🏃', '🚲', '🚗', '🚕', '🚌', '🏁', '🎭', '🎪', '🎰', '🎳', '🎱', '🏄', '🏌️', '🏇', '🚴', '🧖', '💆', '🧘'],
            "Objetos & Ropa": ['👕', '👖', '👗', '👜', '🎒', '👞', '👠', '💄', '💍', '🎁', '🎈', '🧸', '📦', '👔', '👚', '👟', '👑', '👒', '🎩', '🌂', '🕶️', '🧴'],
            "Gestión & Otros": ['❤️', '⚡', '🔥', '💎', '💰', '💳', '✅', '❌', '🆗', '🆕', '🆓', '📶', '📳', '📴', '♻️', '📢', '📣', '🔔', '💬', '💭', '📝', '📂', '📁', '📌', '📍', '📎', '🔒', '🔑', '🔨', '🔧']
        };

        grid.innerHTML = Object.entries(categories).map(([cat, items]) => `
            <div class="w-100 mt-4 mb-2 d-flex align-items-center bg-white py-2 sticky-top" style="top: -1px; z-index: 10;">
                <div class="h-100 bg-warning me-2 rounded-pill" style="width: 5px; height: 26px;">&nbsp;</div>
                <span class="fw-bold text-dark text-uppercase small">${cat}</span>
            </div>
            ${items.map(e => `
                <button class="btn btn-icon-glass p-0" onclick="IconSelector.select('${e}')">
                    <span class="emoji-hd">${e}</span>
                    <span class="icon-label">HD</span>
                </button>
            `).join('')}
        `).join('');
    },

    _renderIcons(filteredIcons = null) {
        const grid = document.getElementById('is-icon-grid');
        if (!grid) return;
        const lib = filteredIcons ? { "Resultados": filteredIcons } : this.iconLibrary;
        grid.innerHTML = Object.entries(lib).map(([cat, icons]) => `
            <div class="w-100 mt-4 mb-2 d-flex align-items-center bg-white py-2 sticky-top" style="top: -1px; z-index: 10;">
                <div class="h-100 bg-primary me-2 rounded-pill" style="width: 5px; height: 26px;">&nbsp;</div>
                <span class="fw-bold text-dark text-uppercase small">${cat}</span>
            </div>
            ${icons.map(icon => `
                <button class="btn btn-icon-glass d-flex flex-column align-items-center justify-content-center p-0" onclick="IconSelector.select('${icon}')">
                    <i class="bi bi-${icon}"></i>
                    <span class="icon-label">${icon}</span>
                </button>
            `).join('')}
        `).join('');
    },

    filter(query) {
        const q = query.toLowerCase().trim();
        if (!q) { this._renderIcons(); this._renderEmojis(); return; }

        // Smart Search for Emojis
        let matchingEmojis = [];
        for (const [key, emojis] of Object.entries(this.emojiKeywords)) {
            if (key.includes(q)) matchingEmojis.push(...emojis);
        }
        // Remove duplicates
        matchingEmojis = [...new Set(matchingEmojis)];

        // Smart Search for Icons
        const allIcons = Object.values(this.iconLibrary).flat();
        const matchingIcons = allIcons.filter(i => i.includes(q));

        this._renderIcons(matchingIcons);
        this._renderEmojis(matchingEmojis);

        // Auto-switch tabs if results are empty in current
        const activeTab = document.querySelector('#iconPickerTabs .nav-link.active')?.id;
        if (matchingIcons.length === 0 && matchingEmojis.length > 0 && activeTab === 'is-tab-icons') {
            bootstrap.Tab.getOrCreateInstance(document.getElementById('is-tab-emojis')).show();
        } else if (matchingEmojis.length === 0 && matchingIcons.length > 0 && activeTab === 'is-tab-emojis') {
            bootstrap.Tab.getOrCreateInstance(document.getElementById('is-tab-icons')).show();
        }
    },

    iconLibrary: {
        "Esenciales": ['house', 'person', 'calendar', 'star', 'star-fill', 'heart', 'heart-fill', 'bell', 'gear', 'search', 'trash', 'pencil', 'save', 'check', 'x', 'plus', 'dash', 'info-circle', 'exclamation-triangle', 'lock', 'key', 'eye', 'camera', 'image', 'wifi', 'lightning', 'battery-full', 'plug'],
        "Hotel & Recepción": ['door-open', 'reception-4', 'briefcase', 'luggage', 'building', 'credit-card', 'wallet2', 'cash', 'coin', 'calculator', 'clipboard-check', 'journal-text', 'flag', 'bookmark', 'clock'],
        "Alimentación & Ocio": ['cup-hot', 'egg-fried', 'potted-plant', 'tree', 'flower1', 'cake2', 'gift', 'award', 'trophy', 'water', 'sun', 'moon', 'bicycle', 'car-front', 'airplane', 'ship-front', 'controller', 'beer', 'wine-glass'],
        "Sistemas & Datos": ['envelope', 'chat', 'telephone', 'phone', 'laptop', 'display', 'printer', 'cloud-arrow-up', 'link', 'share', 'bluetooth', 'broadcast', 'diagram-3', 'graph-up', 'clipboard-data', 'box', 'activity']
    }
};

window.IconSelector = IconSelector;
window.abrirSelectorIconos = (inputId) => IconSelector.open(inputId);
