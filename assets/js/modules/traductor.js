import { Ui } from '../core/Ui.js';

/**
 * MÓDULO TRADUCTOR NATIVO FLOTANTE
 * Implementa una ventana emergente nativa (DOM) que consulta a Google Translate API de forma gratuita.
 */

let typingTimer;
const doneTypingInterval = 500; // ms
let activeUtterance = null; 
let lastCharIndex = 0;
let watchdogTimer = null;
let sliderThrottleTimer = null; 
let audioPlayer = null; // Instancia global para el HTML5 Audio de Google TTS

const Traductor = {
    async init() {
        console.log('[Traductor] Inicializando módulo nativo...');
        
        // Cargar CSS si no existe
        if (!document.getElementById('traductor-css')) {
            const link = document.createElement('link');
            link.id = 'traductor-css';
            link.rel = 'stylesheet';
            link.href = '/assets/css/modules/traductor.css';
            document.head.appendChild(link);
        }

        // Cargar template si no existe
        if (!document.getElementById('traductor-flotante')) {
            const html = await fetch('/assets/templates/traductor.html').then(r => r.text());
            document.body.insertAdjacentHTML('beforeend', html);
        }

        this.setupDragAndDrop();
        this.setupResizing();
        this.attachEvents();
    },

    abrir() {
        const win = document.getElementById('traductor-flotante');
        if (!win) {
            this.init().then(() => this._abrirEfectivo());
            return;
        }
        this._abrirEfectivo();
    },

    _abrirEfectivo() {
        const win = document.getElementById('traductor-flotante');
        
        // Posicionar en el centro si es la primera vez (left/top no definidos inline aún)
        if (!win.style.left) {
            win.style.left = (window.innerWidth / 2 - 190) + 'px'; // width/2
            win.style.top = (window.innerHeight / 2 - 200) + 'px'; // height/2
            win.style.transform = 'none'; // Eliminar transform del CSS para permitir drag suave
        }

        win.classList.remove('d-none');
        win.classList.add('animate-pop-in');
        
        // Foco inmediato en el input
        setTimeout(() => {
            const input = document.getElementById('trad-input');
            if(input) input.focus();
        }, 100);
    },

    cerrar() {
        const win = document.getElementById('traductor-flotante');
        if (win) {
            win.classList.add('d-none');
            win.classList.remove('animate-pop-in');
        }
    },

    attachEvents() {
        // Cerrar, Copiar, y Leer
        const btnClose = document.getElementById('btn-trad-close');
        if (btnClose) btnClose.onclick = () => this.cerrar();

        const btnCopy = document.getElementById('btn-trad-copy');
        if (btnCopy) btnCopy.onclick = () => this.copyToClipboard();
        
        const btnSpeak = document.getElementById('btn-trad-speak');
        if (btnSpeak) btnSpeak.onclick = () => this.readAloud();

        const btnStop = document.getElementById('btn-trad-stop');
        if (btnStop) btnStop.onclick = () => this.stopAudio();

        // Swap idiomas
        const btnSwap = document.getElementById('btn-trad-swap');
        const selSource = document.getElementById('trad-source-lang');
        const selTarget = document.getElementById('trad-target-lang');
        
        if (btnSwap && selSource && selTarget) {
            btnSwap.onclick = () => {
                const s = selSource.value;
                const t = selTarget.value;
                if (s !== 'auto') {
                    selSource.value = t;
                    selTarget.value = s;
                } else {
                    // Si es auto, poner español a ingles, es util.
                    selSource.value = t;
                    selTarget.value = 'en'; 
                }
                this.triggerTranslation();
            };
        }

        // Cambio manual de selects
        if(selSource) selSource.onchange = () => this.triggerTranslation();
        if(selTarget) selTarget.onchange = () => this.triggerTranslation();

        // Limpiar
        const btnClear = document.getElementById('btn-trad-clear');
        const input = document.getElementById('trad-input');
        
        if (btnClear && input) {
            btnClear.onclick = () => {
                input.value = '';
                document.getElementById('trad-output').value = '';
                btnClear.style.display = 'none';
                input.focus();
            };
        }

        // Evento de escritura
        if (input) {
            input.addEventListener('input', () => {
                clearTimeout(typingTimer);
                if (input.value.trim().length > 0) {
                    btnClear.style.display = 'block';
                    typingTimer = setTimeout(() => this.triggerTranslation(), doneTypingInterval);
                } else {
                    btnClear.style.display = 'none';
                    document.getElementById('trad-output').value = '';
                }
            });
        }

        // Sliders de Audio
        const volInput = document.getElementById('trad-volume');
        const speedInput = document.getElementById('trad-speed');
        const volVal = document.getElementById('trad-vol-val');
        const speedVal = document.getElementById('trad-speed-val');

        if (volInput && volVal) {
            volInput.oninput = () => {
                const v = Math.round(volInput.value * 100);
                volVal.textContent = `${v}%`;
                
                // Cambio en tiempo real CON DEBOUNCE (200ms)
                if (audioPlayer && !audioPlayer.paused) {
                    audioPlayer.volume = volInput.value;
                }
            };
        }

        if (speedInput && speedVal) {
            speedInput.oninput = () => {
                const val = parseFloat(speedInput.value).toFixed(1);
                speedVal.textContent = `x${val}`;
                
                // Cambio en tiempo real
                if (audioPlayer && !audioPlayer.paused) {
                    audioPlayer.playbackRate = val;
                }
            };
        }

        // --- RELIABILITY FIX ---
        // Pre-cargar voces si es posible (ya no se usa native TTS, pero lo dejamos por si acaso)
        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
        }
    },

    async triggerTranslation() {
        const input = document.getElementById('trad-input');
        const output = document.getElementById('trad-output');
        const sourceLang = document.getElementById('trad-source-lang').value;
        const targetLang = document.getElementById('trad-target-lang').value;
        const loading = document.getElementById('trad-loading');

        const text = input.value.trim();
        if (!text) {
            output.value = '';
            return;
        }

        loading.classList.remove('d-none');

        try {
            // Free public endpoint used by extensions and simple widgets
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            const response = await window.fetch(url);
            
            if (!response.ok) throw new Error('Network error');
            
            const data = await response.json();
            
            // data[0] contains array of translated sentences
            let translatedText = '';
            if (data && data[0]) {
                data[0].forEach(item => {
                    if (item[0]) translatedText += item[0];
                });
            }
            
            output.value = translatedText;
            
        } catch (error) {
            console.error('[Traductor] Error:', error);
            output.value = 'Error al traducir verifique su conexión.';
        } finally {
            loading.classList.add('d-none');
        }
    },

    copyToClipboard() {
        const text = document.getElementById('trad-output').value.trim();
        if (!text) return;

        navigator.clipboard.writeText(text).then(() => {
            // Feedback visual silencioso en el botón
            const btn = document.getElementById('btn-trad-copy');
            if (btn) {
                const icon = btn.querySelector('i');
                if (icon) {
                    const originalClass = icon.className;
                    icon.className = 'bi bi-check-lg text-success';
                    setTimeout(() => {
                        icon.className = originalClass;
                    }, 2000);
                }
            }
        }).catch(err => {
            console.error('[Traductor] Fallo al copiar:', err);
        });
    },

    resetUI() {
        const btn = document.getElementById('btn-trad-speak');
        const btnStop = document.getElementById('btn-trad-stop');
        const icon = btn ? btn.querySelector('i') : null;
        const originalClass = 'bi bi-play-circle-fill fs-5';

        if (icon) icon.className = originalClass;
        if (btnStop) btnStop.classList.add('d-none');
        
        activeUtterance = null;
        if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
        if (sliderThrottleTimer) { clearTimeout(sliderThrottleTimer); sliderThrottleTimer = null; }
        
        // Limpiamos el keepalive
        if (window._tradKeepAlive) { clearInterval(window._tradKeepAlive); window._tradKeepAlive = null; }
    },

    // --- NUEVO MOTOR DE LECTURA BASADO EN GOOGLE TTS (HTML5 AUDIO) ---
    // Resuelve bugs crónicos de Edge/Linux con SpeechSynthesis nativo.
    readAloud(startIndex = 0) {
        const textToRead = document.getElementById('trad-output').value.trim();
        if (!textToRead) return;

        // --- PREPARACIÓN ---
        this.resetUI();

        const currentText = (startIndex > 0) ? textToRead.substring(startIndex).trim() : textToRead;
        if (!currentText) return;

        // Configuración de idioma (necesitamos código corto tipo 'en', 'es', etc)
        const targetLang = document.getElementById('trad-target-lang').value;
        const volInput = document.getElementById('trad-volume');
        const speedInput = document.getElementById('trad-speed');
        
        const volume = volInput ? (parseFloat(volInput.value) || 1.0) : 1.0;
        const rate = speedInput ? (parseFloat(speedInput.value) || 1.0) : 1.0;

        // --- UI ESTADO CARGA ---
        const btn = document.getElementById('btn-trad-speak');
        const btnStop = document.getElementById('btn-trad-stop');
        const icon = btn ? btn.querySelector('i') : null;

        if (icon) icon.className = 'bi bi-hourglass-split text-muted animate-spin';
        if (btnStop) btnStop.classList.remove('d-none');

        // Construir URL al backend propio para evitar bloqueos CORS o de formato de Google
        const chunk = currentText.substring(0, 190);
        const url = `/api/tts?text=${encodeURIComponent(chunk)}&lang=${targetLang}`;

        audioPlayer = new Audio(url);
        audioPlayer.volume = volume;
        audioPlayer.playbackRate = rate;

        // Watchdog por si la carga de red falla o se atasca
        watchdogTimer = setTimeout(() => {
            console.warn('[Traductor] Watchdog timeout preventivo cancelando (audio de Google no cargó)');
            this.stopAudio();
            Ui.showToast("Error de red cargando el audio.", "danger");
        }, 10000);

        audioPlayer.onplay = () => {
             if (watchdogTimer) clearTimeout(watchdogTimer);
             if (icon) icon.className = 'bi bi-soundwave text-primary animate-pulse-fast';
        };

        audioPlayer.onended = () => {
             // TODO: Si hay textos de más de 190 caracteres, aquí habría que mandar el siguiente chunk.
             // Para esta solución robusta inicial de traducción rápida, servirá.
             this.resetUI();
        };

        audioPlayer.onerror = (e) => {
             console.error('[Traductor] Error HTML5 Audio Google TTS:', e);
             this.resetUI();
             Ui.showToast("Error reproduciendo el audio online.", "danger");
        };

        // Reproducir nativamente
        audioPlayer.play().catch(err => {
             console.error("Autoplay bloqueado o error en play():", err);
             this.resetUI();
        });
    },

    stopAudio() {
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            audioPlayer = null;
        }
        this.resetUI();
    },

    /**
     * LÓGICA DE VENTANA FLOTANTE (DRAG) Idéntica a Calculadora
     */
    setupDragAndDrop() {
        const win = document.getElementById('traductor-flotante');
        const header = win.querySelector('.traductor-header');
        let isDragging = false;
        let offset = { x: 0, y: 0 };

        header.onmousedown = (e) => {
            isDragging = true;
            offset.x = e.clientX - win.offsetLeft;
            offset.y = e.clientY - win.offsetTop;
            win.style.transition = 'none'; // Quitar animaciones
            
            // Bring to front
            const cal = document.getElementById('calculadora-flotante');
            win.style.zIndex = '1046';
            if(cal) cal.style.zIndex = '1040';
        };

        document.onmousemove = (e) => {
            if (!isDragging) return;
            win.style.left = (e.clientX - offset.x) + 'px';
            win.style.top = (e.clientY - offset.y) + 'px';
        };

        document.onmouseup = () => {
            isDragging = false;
        };
    },

    /**
     * LÓGICA DE REDIMENSIONAMIENTO
     */
    setupResizing() {
        const win = document.getElementById('traductor-flotante');
        const resizer = win.querySelector('.traductor-resizer');
        let isResizing = false;

        resizer.onmousedown = (e) => {
            isResizing = true;
            e.preventDefault();
        };

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const newWidth = e.clientX - win.offsetLeft;
            const newHeight = e.clientY - win.offsetTop;
            
            if (newWidth > 300) win.style.width = newWidth + 'px';
            if (newHeight > 300) win.style.height = newHeight + 'px';
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    }
};

export const traductor = Traductor;
window.abrirTraductor = () => Traductor.abrir();
