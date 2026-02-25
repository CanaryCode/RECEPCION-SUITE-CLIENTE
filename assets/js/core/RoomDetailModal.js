import { rackService } from '../services/RackService.js';
import { riuService } from '../services/RiuService.js';
import { Ui } from './Ui.js';

/**
 * ROOM DETAIL MODAL (V8 - NATIVE STYLES)
 * -------------------------------------------
 * Uses standard App classes (Bootstrap + components.css) to ensure 
 * 100% visual consistency (Zero custom CSS).
 * Keeps the wrapper strategy for 100% visibility guarantee.
 */
export const RoomDetailModal = {
    currentRoomNum: null,

    open: async (roomNum) => {
        RoomDetailModal.currentRoomNum = roomNum;

        // 1. Clean previous instances
        const existing = document.getElementById('forced-room-detail-native');
        if (existing) existing.remove();

        // 2. Create Wrapper (High Z-Index Overlay)
        // We simulate the Bootstrap .modal-backdrop + .modal container behavior manually
        const overlay = document.createElement('div');
        overlay.id = 'forced-room-detail-native';
        overlay.className = 'modal fade show'; // Bootstrap classes for correct font handling
        overlay.style.cssText = `
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0, 0, 0, 0.75) !important;
            z-index: 20000 !important; /* Fixed: Higher than Navbar */
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            backdrop-filter: blur(2px);
        `;

        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        // 3. Inject Standard Bootstrap Structure with HIGH CONTRAST OVERRIDES
        overlay.innerHTML = `
            <style>
                /* OVERRIDES FOR MODAL INPUT VISIBILITY */
                #forced-room-detail-native .form-check-input {
                    border: 2px solid #6c757d !important; /* Dark grey border ALWAYS */
                    background-color: white !important;
                    opacity: 1 !important;
                    cursor: pointer !important;
                    width: 1.2em; height: 1.2em;
                }
                #forced-room-detail-native .form-check-input:checked {
                    background-color: #0d6efd !important;
                    border-color: #0d6efd !important;
                }
                #forced-room-detail-native .form-check-input:disabled {
                    opacity: 0.6 !important;
                    background-color: #e9ecef !important;
                    cursor: not-allowed !important;
                }
                #forced-room-detail-native .form-control:disabled, 
                #forced-room-detail-native .form-select:disabled {
                    background-color: #e9ecef !important;
                    opacity: 1 !important; /* Prevent bootstrap fade */
                    cursor: not-allowed;
                }
            </style>
            <div class="modal-dialog modal-dialog-centered" style="max-width: 500px;">
                <div class="modal-content shadow-lg border-0" style="border-radius: 16px; overflow: hidden;">
                    
                    <!-- HEADER -->
                    <div class="modal-header bg-primary text-white border-0 py-3">
                        <h5 class="modal-title fw-bold">
                            <i class="bi bi-door-open-fill me-2"></i>Habitación ${roomNum}
                        </h5>
                        <button type="button" class="btn-close btn-close-white" onclick="RoomDetailModal.close()"></button>
                    </div>

                    <!-- BODY -->
                    <div class="modal-body bg-light p-4">
                        
                        <!-- SECURITY SECTION -->
                        <div id="native-sec-container" class="card border-danger mb-4 shadow-sm">
                            <div class="card-header bg-danger bg-opacity-10 text-danger fw-bold border-bottom-0 py-2 small">
                                <i class="bi bi-shield-lock-fill me-1"></i> ACCESO PROTEGIDO
                            </div>
                            <div class="card-body p-3">
                                <div class="input-group">
                                    <input type="password" id="native-pin-input" class="form-control font-monospace text-center fw-bold" placeholder="****">
                                    <button class="btn btn-danger fw-bold" onclick="RoomDetailModal.unlock()">
                                        DESBLOQUEAR
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- GUEST INFO (RIU CLASS) -->
                        <div id="native-guest-info" class="card border-0 shadow-sm mb-4 d-none" style="border-left: 5px solid #0d6efd !important;">
                            <div class="card-body p-3">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <div class="small text-muted fw-bold text-uppercase mb-1">Huésped Actual</div>
                                        <h5 id="native-guest-name" class="fw-bold text-dark mb-0">--</h5>
                                    </div>
                                    <span id="native-guest-level" class="badge bg-primary rounded-pill px-3 py-2">--</span>
                                </div>
                                <div class="d-flex align-items-center text-muted small mt-2">
                                    <i class="bi bi-calendar-event me-2"></i>
                                    Salida: <span id="native-guest-out" class="fw-bold text-dark ms-1">--</span>
                                </div>
                                <div id="native-guest-comments" class="alert alert-secondary mt-2 mb-0 py-2 px-3 small fst-italic border-0"></div>
                            </div>
                        </div>

                        <!-- EDIT FORM -->
                        <div id="native-form-container" class="transition-all">
                            <div class="row g-3 mb-3">
                                <div class="col-6">
                                    <label class="form-label small fw-bold text-secondary">Estado</label>
                                    <select id="native-room-status" class="form-select fw-bold">
                                        <option value="DISPONIBLE" class="text-success">DISPONIBLE</option>
                                        <option value="SUCIA" class="text-warning">SUCIA</option>
                                        <option value="BLOQUEADA" class="text-danger">BLOQUEADA</option>
                                        <option value="OCUPADA" class="text-primary">OCUPADA</option>
                                    </select>
                                </div>
                                <div class="col-6">
                                    <label class="form-label small fw-bold text-secondary">Tipo</label>
                                    <input type="text" id="native-room-type" class="form-control bg-white" readonly>
                                </div>
                            </div>

                            <div class="mb-3">
                                <label class="form-label small fw-bold text-secondary">Vista / Ubicación</label>
                                <div class="input-group">
                                    <span class="input-group-text bg-white"><i class="bi bi-geo-alt"></i></span>
                                    <input type="text" id="native-room-view" class="form-control bg-white" readonly>
                                </div>
                            </div>

                            <div class="card bg-white border mb-3">
                                <div class="card-body p-3">
                                    <label class="small fw-bold text-secondary d-block mb-2">Equipamiento</label>
                                    <div class="row g-2 small">
                                        <div class="col-6">
                                            <div class="form-check">
                                                <input class="form-check-input" type="checkbox" id="v8-check-sofa">
                                                <label class="form-check-label" for="v8-check-sofa">Sofá</label>
                                            </div>
                                        </div>
                                        <div class="col-6">
                                            <div class="form-check">
                                                <input class="form-check-input" type="checkbox" id="v8-check-sofaCama">
                                                <label class="form-check-label" for="v8-check-sofaCama">Sofá Cama</label>
                                            </div>
                                        </div>
                                        <div class="col-6">
                                            <div class="form-check">
                                                <input class="form-check-input" type="checkbox" id="v8-check-cheslong">
                                                <label class="form-check-label" for="v8-check-cheslong">Cheslong</label>
                                            </div>
                                        </div>
                                        <div class="col-6">
                                            <div class="form-check">
                                                <input class="form-check-input" type="checkbox" id="v8-check-ruidosa">
                                                <label class="form-check-label text-danger" for="v8-check-ruidosa">Ruidosa</label>
                                            </div>
                                        </div>
                                        <div class="col-6">
                                            <div class="form-check">
                                                <input class="form-check-input" type="checkbox" id="v8-check-tranquila">
                                                <label class="form-check-label text-success" for="v8-check-tranquila">Tranquila</label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="mb-0">
                                <label class="form-label small fw-bold text-secondary">Notas Internas</label>
                                <textarea id="v8-room-comments" class="form-control" rows="3" placeholder="Sin observaciones..."></textarea>
                            </div>
                        </div>
                    </div>

                    <!-- FOOTER -->
                    <div class="modal-footer bg-light border-top-0 py-3">
                        <button type="button" class="btn btn-outline-secondary" onclick="RoomDetailModal.close()">Cancelar</button>
                        <button type="button" id="native-btn-save" class="btn btn-primary px-4 fw-bold shadow-sm" onclick="RoomDetailModal.save()" disabled>
                            <i class="bi bi-save me-2"></i>Guardar
                        </button>
                    </div>

                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        // 4. Populate Data
        try {
            const roomData = await rackService.getRoomDetails(roomNum);
            const guestData = await riuService.getHab(roomNum);
            
            if (roomData) {
                const setText = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
                const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
                const setCheck = (id, val) => { const el = document.getElementById(id); if(el) el.checked = !!val; };

                setVal('native-room-status', roomData.status || 'DISPONIBLE');
                setVal('native-room-type', roomData.tipo || 'ESTANDAR');
                setVal('native-room-view', roomData.vista || 'CALLE');
                setVal('v8-room-comments', roomData.comments || '');

                if (roomData.extras) {
                    setCheck('v8-check-sofa', roomData.extras.sofa);
                    setCheck('v8-check-sofaCama', roomData.extras.sofaCama);
                    setCheck('v8-check-cheslong', roomData.extras.cheslong);
                    setCheck('v8-check-ruidosa', roomData.extras.ruidosa);
                    setCheck('v8-check-tranquila', roomData.extras.tranquila);
                }

                if (guestData) {
                    const guestInfo = document.getElementById('native-guest-info');
                    if (guestInfo) {
                        guestInfo.classList.remove('d-none');
                        guestInfo.classList.add('d-block');
                    } 
                    setText('native-guest-name', guestData.nombre);
                    setText('native-guest-out', guestData.fecha_salida || '--');
                    
                    const badge = document.getElementById('native-guest-level');
                    if (badge) {
                        badge.innerText = guestData.tipo_tarjeta || 'Estándar';
                        badge.className = 'badge rounded-pill px-3 py-2';
                        
                        if (guestData.tipo_tarjeta === 'Oro') badge.classList.add('bg-warning', 'text-dark');
                        else if (guestData.tipo_tarjeta === 'Diamante') badge.classList.add('bg-dark');
                        else badge.classList.add('bg-primary');
                    }
                    setText('native-guest-comments', guestData.comentarios || 'Sin observaciones.');
                }
            }
        } catch (e) {
            console.error("Error populating native modal:", e);
        }

        // Focus PIN
        const pinInput = document.getElementById('native-pin-input');
        if (pinInput) {
            pinInput.focus();
            pinInput.onkeypress = (e) => { if (e.key === 'Enter') RoomDetailModal.unlock(); };
        }
        
        // Ensure form starts disabled
        RoomDetailModal.toggleForm(false);
    },

    close: () => {
        const overlay = document.getElementById('forced-room-detail-native');
        if (overlay) {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 150);
        }
        document.body.style.overflow = '';
    },

    unlock: () => {
        const pin = document.getElementById('native-pin-input')?.value.trim();
        if (pin === '1234') {
            RoomDetailModal.toggleForm(true);
            const sc = document.getElementById('native-sec-container');
            if (sc) sc.classList.add('d-none');
            const sv = document.getElementById('native-btn-save');
            if (sv) sv.disabled = false;
        } else {
            Ui.showToast("PIN Incorrecto", "warning");
            document.getElementById('native-pin-input').value = '';
            document.getElementById('native-pin-input').focus();
        }
    },

    toggleForm: (enable) => {
        const ids = [
            'native-room-status', 
            'v8-room-comments', 
            'v8-check-sofa', 
            'v8-check-sofaCama', 
            'v8-check-cheslong', 
            'v8-check-ruidosa', 
            'v8-check-tranquila'
        ];
        
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.disabled = !enable;
                if(enable) {
                    el.classList.remove('disabled');
                    el.style.pointerEvents = 'auto';
                    el.removeAttribute('disabled');
                } else {
                    el.style.pointerEvents = 'none';
                    el.setAttribute('disabled', 'true');
                }
            }
        });
    },

    save: async () => {
        const val = (id) => document.getElementById(id)?.value;
        const checked = (id) => document.getElementById(id)?.checked;

        const updates = {
            status: val('native-room-status'),
            comments: val('v8-room-comments'),
            extras: {
                sofa: checked('v8-check-sofa'),
                sofaCama: checked('v8-check-sofaCama'),
                cheslong: checked('v8-check-cheslong'),
                ruidosa: checked('v8-check-ruidosa'),
                tranquila: checked('v8-check-tranquila')
            }
        };

        try {
            await rackService.saveRoomData(RoomDetailModal.currentRoomNum, updates);
            Ui.showToast("Cambios guardados", "success");
            RoomDetailModal.close();
            if (window.renderRack) window.renderRack();
        } catch (e) {
            alert("Error al guardar: " + e.message);
        }
    }
};

window.RoomDetailModal = RoomDetailModal;
