import { Ui } from '../core/Ui.js';

/**
 * MÓDULO CALCULADORA (calculadora.js)
 * -----------------------------------
 * Implementa una calculadora científica básica en una ventana flotante,
 * con soporte para arrastre, redimensionamiento y "always on top".
 */

let calcState = {
    display: '0',
    history: '',
    equation: '',
    lastResult: null
};

export const Calculadora = {
    init() {
        console.log('[Calculadora] Inicializando...');
        this.setupDragAndDrop();
        this.setupResizing();
        this.attachEvents();
    },

    abrir() {
        const win = document.getElementById('calculadora-flotante');
        if (!win) return;

        win.classList.remove('d-none');
        win.classList.add('animate-pop-in');
        this.updateDisplay();
    },

    cerrar() {
        const win = document.getElementById('calculadora-flotante');
        if (win) win.classList.add('d-none');
    },

    attachEvents() {
        // Botones numéricos y operadores
        document.querySelectorAll('.btn-calc-num, .btn-calc-action, .btn-calc-op').forEach(btn => {
            btn.onclick = () => this.handleInput(btn.dataset.val);
        });

        // Botón Igual
        const btnEqual = document.getElementById('btn-calc-equal');
        if (btnEqual) btnEqual.onclick = () => this.calculate();

        // Cerrar
        const btnClose = document.getElementById('btn-calc-close');
        if (btnClose) btnClose.onclick = () => this.cerrar();

        // Copiar
        const btnCopy = document.getElementById('btn-calc-copy');
        if (btnCopy) btnCopy.onclick = () => this.copyToClipboard();

        // Atajos de teclado
        window.addEventListener('keydown', (e) => {
            const win = document.getElementById('calculadora-flotante');
            if (win && !win.classList.contains('d-none')) {
                this.handleKeyDown(e);
            }
        });
    },

    handleInput(val) {
        if (val === 'C') {
            calcState = { display: '0', history: '', equation: '', lastResult: null };
        } else if (val === '%') {
            // Lógica simple de porcentaje: convierte el display actual a número / 100
            try {
                const num = parseFloat(calcState.display);
                const result = num / 100;
                calcState.display = result.toString();
                calcState.equation = result.toString();
            } catch (e) {
                calcState.display = 'Error';
            }
        } else {
            if (calcState.display === '0' || calcState.display === 'Error') {
                calcState.display = val;
                calcState.equation = val;
            } else {
                calcState.display += val;
                calcState.equation += val;
            }
        }
        this.updateDisplay();
    },

    calculate() {
        try {
            // Reemplazar símbolos visuales por matemáticos de JS
            let exp = calcState.equation.replace(/×/g, '*').replace(/÷/g, '/');
            
            // Eval es aceptable aquí por ser una calculadora aislada y controlada
            // aunque en producción se preferiría un parser matemático serio.
            // Para "operaciones de día a día" eval maneja paréntesis y jerarquía.
            let result = eval(exp);
            
            // Redondear a un máximo de 5 decimales si es necesario
            if (result.toString().includes('.')) {
                result = Math.round(result * 100000) / 100000;
            }

            calcState.history = calcState.equation + ' =';
            calcState.display = result.toString();
            calcState.equation = result.toString();
            calcState.lastResult = result;
        } catch (e) {
            console.error('[Calculadora] Error:', e);
            calcState.display = 'Error';
            calcState.history = '';
        }
        this.updateDisplay();
    },

    updateDisplay() {
        const screen = document.getElementById('calc-screen');
        const history = document.getElementById('calc-history');
        if (screen) screen.innerText = calcState.display;
        if (history) history.innerHTML = calcState.history || '&nbsp;';
    },

    copyToClipboard() {
        const text = calcState.display;
        if (text === 'Error' || text === '0') return;

        const performCopy = () => {
            return new Promise((resolve, reject) => {
                // Try modern API first
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(text).then(resolve).catch(reject);
                } else {
                    // Fallback using execCommand('copy')
                    try {
                        const textArea = document.createElement("textarea");
                        textArea.value = text;
                        textArea.style.position = "fixed";
                        textArea.style.left = "-9999px";
                        textArea.style.top = "0";
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        const successful = document.execCommand('copy');
                        document.body.removeChild(textArea);
                        if (successful) resolve();
                        else reject(new Error('Copy command failed'));
                    } catch (err) {
                        reject(err);
                    }
                }
            });
        };

        performCopy().then(() => {
            Ui.showToast("Resultado copiado al portapapeles", "info");
            
            // Feedback visual en el botón
            const btn = document.getElementById('btn-calc-copy');
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
            console.error('[Calculadora] Fallo al copiar:', err);
            Ui.showToast("Error al copiar al portapapeles", "danger");
        });
    },

    handleKeyDown(e) {
        const key = e.key;
        if (/[0-9\.\+\-\*\/\(\)]/.test(key)) {
            e.preventDefault();
            this.handleInput(key === '*' ? '×' : (key === '/' ? '÷' : key));
        } else if (key === 'Enter' || key === '=') {
            e.preventDefault();
            this.calculate();
        } else if (key === 'Escape') {
            this.cerrar();
        } else if (key === 'Backspace') {
            calcState.display = calcState.display.length > 1 ? calcState.display.slice(0, -1) : '0';
            calcState.equation = calcState.equation.length > 1 ? calcState.equation.slice(0, -1) : '';
            this.updateDisplay();
        }
    },

    /**
     * LÓGICA DE VENTANA FLOTANTE (DRAG)
     */
    setupDragAndDrop() {
        const win = document.getElementById('calculadora-flotante');
        const header = win.querySelector('.calculadora-header');
        let isDragging = false;
        let offset = { x: 0, y: 0 };

        header.onmousedown = (e) => {
            isDragging = true;
            offset.x = e.clientX - win.offsetLeft;
            offset.y = e.clientY - win.offsetTop;
            win.style.transition = 'none'; // Quitar animaciones mientras se arrastra
        };

        document.onmousemove = (e) => {
            if (!isDragging) return;
            win.style.left = (e.clientX - offset.x) + 'px';
            win.style.top = (e.clientY - offset.y) + 'px';
            win.style.right = 'auto'; // Una vez movida, deja de estar pegada a la derecha
        };

        document.onmouseup = () => {
            isDragging = false;
        };
    },

    /**
     * LÓGICA DE REDIMENSIONAMIENTO
     */
    setupResizing() {
        const win = document.getElementById('calculadora-flotante');
        const resizer = win.querySelector('.calculadora-resizer');
        let isResizing = false;

        resizer.onmousedown = (e) => {
            isResizing = true;
            e.preventDefault();
        };

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const newWidth = e.clientX - win.offsetLeft;
            const newHeight = e.clientY - win.offsetTop;
            
            if (newWidth > 200) win.style.width = newWidth + 'px';
            if (newHeight > 300) win.style.height = newHeight + 'px';
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    }
};

window.abrirCalculadora = () => Calculadora.abrir();
