import { Ui } from '../core/Ui.js';

/**
 * MÓDULO CALCULADORA PREMIUM (calculadora.js)
 * -----------------------------------------
 * Implementa una calculadora científica inspirada en Windows 11.
 * Soporte para:
 * - Fluid Scaling (redimensionamiento que escala todo)
 * - Memoria Completa (MC, MR, M+, M-, MS)
 * - Operaciones Avanzadas (x2, sqrt, 1/x, CE)
 * - Guardado de operaciones con comentarios persistente (localStorage)
 */

let calcState = {
    display: '0',
    history: '',
    fullHistory: '', // Nueva: historial completo acumulado (ej: 3x3=9x10=90)
    equation: '',
    lastResult: null,
    memory: 0,
    isWaitingNext: false,
    openParentheses: 0 // Contador de paréntesis abiertos
};

const Calculadora = {
    isInitialized: false,
    savedOperations: [],

    async init(forceReload = false) {
        console.log('[Calculadora] Inicializando rediseño...', forceReload ? '(FORZADO)' : '');

        // 1. Remover calculadora existente si está cacheada o si se fuerza
        const existing = document.getElementById('calculadora-flotante');
        if (existing) {
            console.log('[Calculadora] Removiendo versión cacheada...');
            existing.remove();
            this.isInitialized = false;
        }

        // 2. Cargar Template fresco
        try {
            const timestamp = new Date().getTime();
            const response = await fetch(`assets/templates/calculadora.html?v=${timestamp}`);
            const html = await response.text();
            document.body.insertAdjacentHTML('beforeend', html);
            console.log('[Calculadora] Template cargado correctamente');
        } catch (err) {
            console.error('[Calculadora] Error al cargar template:', err);
            return;
        }

        // 3. Cargar Datos Guardados
        this.loadSavedOperations();

        // 4. Vincular Eventos
        this.setupDragAndDrop();
        this.setupResizing();
        this.attachEvents();
        this.updateMemoryButtons(); // Inicializar estado de botones de memoria

        this.isInitialized = true;
    },

    abrir() {
        if (!this.isInitialized) {
            this.init().then(() => this._abrirEfectivo());
        } else {
            this._abrirEfectivo();
        }
    },

    _abrirEfectivo() {
        const win = document.getElementById('calculadora-flotante');
        if (win) {
            win.classList.remove('d-none');
            win.classList.add('animate-pop-in');
            win.classList.add('active'); // Use classes, not inline styles
            this.updateDisplay();
        }
    },

    cerrar() {
        const win = document.getElementById('calculadora-flotante');
        if (win) {
            win.classList.add('d-none');
            win.classList.remove('active');
        }
    },

    attachEvents() {
        const win = document.getElementById('calculadora-flotante');
        if (!win) return;

        // Delegación de eventos TOTAL para rejilla de botones
        win.onclick = (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            // 1. Botones de Memoria (data-mem)
            if (btn.dataset.mem) {
                this.handleMemory(btn.dataset.mem);
                return;
            }

            // 2. Botón Igual (ID específico)
            if (btn.id === 'btn-calc-equal') {
                this.calculate();
                return;
            }

            // 3. Botones Estándar (data-val)
            const val = btn.dataset.val;
            if (val) {
                this.handleInput(val);
                return;
            }

            // 4. Acciones del Header / Otros
            if (btn.id === 'btn-calc-close') this.cerrar();
            if (btn.id === 'btn-calc-copy') this.copyToClipboard();
            if (btn.id === 'btn-calc-history') this.toggleSavedPane(true);
            if (btn.id === 'btn-calc-history-close') this.toggleSavedPane(false);
            if (btn.id === 'btn-calc-save') this.saveCurrentOperation();
            if (btn.id === 'btn-calc-clear-saved') this.clearAllSaved();
        };

        // Escucha global de teclado (solo si está activa)
        if (!this._keydownBound) {
            window.addEventListener('keydown', (e) => {
                const win = document.getElementById('calculadora-flotante');
                if (!win || win.classList.contains('d-none')) return;
                
                // Si el foco está en el input de comentario, no procesar como tecla de cálculo
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                
                this.handleKeyDown(e);
            });
            this._keydownBound = true;
        }
    },

    handleInput(val) {
        if (val === 'C') {
            this.resetState();
        } else if (val === 'CE') {
            calcState.display = '0';
            calcState.isWaitingNext = false;
        } else if (val === '(') {
            // Paréntesis de apertura
            // Solo agregar el display al historial si no estamos esperando siguiente número
            // y si el historial no termina en operador
            if (!calcState.isWaitingNext && calcState.display !== '0') {
                const lastChar = calcState.history.slice(-1);
                const operators = ['+', '-', '*', '/'];
                // Solo agregar el display si NO hay un operador al final
                if (!operators.includes(lastChar) && calcState.history !== '') {
                    // Aquí ponermos multiplicación implícita: 5( = 5*(
                    calcState.history += calcState.display + '*';
                } else {
                    // Ya hay un operador o no hay historial, solo agregar display si no hay operador
                    if (!operators.includes(lastChar) && calcState.history === '') {
                        calcState.history = calcState.display;
                    }
                }
            }
            calcState.history += '(';
            calcState.openParentheses++;
            calcState.display = '0';
            calcState.isWaitingNext = false;
        } else if (val === ')') {
            // Paréntesis de cierre
            if (calcState.openParentheses > 0) {
                // Agregar el número actual al historial antes de cerrar
                if (!calcState.isWaitingNext && calcState.display !== '0') {
                    calcState.history += calcState.display;
                }
                calcState.history += ')';
                calcState.openParentheses--;

                // Limpiar el display para evitar duplicaciones
                calcState.display = '0';
                calcState.isWaitingNext = true;
            }
        } else if (val === 'BACK') {
            if (calcState.openParentheses > 0) {
                // Si estamos dentro de paréntesis, borrar del historial
                const lastChar = calcState.history.slice(-1);
                if (lastChar === '(') {
                    calcState.openParentheses--;
                } else if (lastChar === ')') {
                    calcState.openParentheses++;
                }
                calcState.history = calcState.history.slice(0, -1);
            } else {
                // Si NO estamos en paréntesis, borrar del display
                if (calcState.history.endsWith('(') || calcState.history.endsWith(')')) {
                    const lastChar = calcState.history.slice(-1);
                    if (lastChar === '(') calcState.openParentheses--;
                    else if (lastChar === ')') calcState.openParentheses++;
                    calcState.history = calcState.history.slice(0, -1);
                } else {
                    calcState.display = calcState.display.length > 1 ? calcState.display.slice(0, -1) : '0';
                }
            }
        } else if (val === '+/-') {
            calcState.display = (parseFloat(calcState.display) * -1).toString();
        } else if (val === '%') {
            // Convertir el número actual a porcentaje (dividir entre 100)
            const currentVal = parseFloat(calcState.display);
            if (!isNaN(currentVal)) {
                calcState.display = (currentVal / 100).toString();
            }
        } else if (['x2', 'sqrt', '1/x'].includes(val)) {
            this.handleAdvanced(val);
        } else if (['+', '-', '*', '/'].includes(val)) {
            this.handleOperator(val);
        } else {
            // Números y punto
            if (calcState.isWaitingNext) {
                calcState.display = val === '.' ? '0.' : val;
                calcState.isWaitingNext = false;
            } else {
                if (calcState.display === '0' && val !== '.') {
                    calcState.display = val;
                } else {
                    if (val === '.' && calcState.display.includes('.')) return;
                    
                    // LIMIT: Max 16 digits to prevent overflow
                    const digitCount = calcState.display.replace(/[^0-9]/g, '').length;
                    if (digitCount >= 16 && val !== '.') {
                        console.warn('[Calculadora] Máximo de dígitos alcanzado (16)');
                        return;
                    }

                    calcState.display += val;
                }
            }
        }
        this.updateDisplay();
    },

    handleOperator(op) {
        if (calcState.display === 'Error') return;

        // Verificar si el último carácter del historial ya es un operador
        const lastChar = calcState.history.trim().slice(-1);
        const operators = ['+', '-', '*', '/'];

        if (operators.includes(lastChar) && calcState.isWaitingNext) {
            // Reemplazar operador si se pulsa otro seguido
            calcState.history = calcState.history.trim().slice(0, -1) + op;
        } else {
            // Agregar display + operador al historial
            if (!calcState.isWaitingNext && calcState.display !== '0') {
                calcState.history += calcState.display;
            }
            calcState.history += op;
        }

        calcState.isWaitingNext = true;
        this.updateDisplay();
    },

    handleAdvanced(op) {
        let val = parseFloat(calcState.display);
        if (isNaN(val)) return;
        
        let result = val;
        if (op === 'x2') result = val * val;
        else if (op === 'sqrt') {
            if (val < 0) { calcState.display = 'Error'; this.updateDisplay(); return; }
            result = Math.sqrt(val);
        }
        else if (op === '1/x') {
            if (val === 0) { calcState.display = 'Error'; this.updateDisplay(); return; }
            result = 1 / val;
        }
        
        calcState.display = this.formatResult(result);
        calcState.isWaitingNext = true;
        this.updateDisplay();
    },

    calculate() {
        if (!calcState.history && calcState.display === '0') return;

        try {
            let expression = calcState.history;

            // Si no estamos esperando y el historial no termina en paréntesis, agregar display
            if (!calcState.isWaitingNext && calcState.display !== '0') {
                if (!expression.endsWith(')')) {
                    expression += calcState.display;
                }
            }

            // Limpiar operadores al final si los hay
            expression = expression.trim();
            while (['+', '-', '*', '/'].includes(expression.slice(-1))) {
                expression = expression.slice(0, -1).trim();
            }

            // Si la expresión está vacía, usar solo el display
            if (!expression) {
                expression = calcState.display;
            }

            // Sanetizar para eval
            const safeExp = expression
                .replace(/×/g, '*')
                .replace(/÷/g, '/')
                .replace(/,/g, '.')
                .replace(/([0-9])\(/g, '$1*(')
                .replace(/\)([0-9])/g, ')*$1');

            console.log('[Calculadora] Calculando:', expression);
            const result = eval(safeExp);
            const formattedResult = this.formatResult(result);

            // Actualizar historial con el resultado
            calcState.history = `${expression}=${formattedResult}`;
            calcState.display = formattedResult;
            calcState.isWaitingNext = true;
        } catch (e) {
            console.error('[Calculadora] Math Error:', e, 'Expression:', calcState.history);
            calcState.display = 'Error';
        }
        this.updateDisplay();
    },

    formatResult(num) {
        if (isNaN(num) || !isFinite(num)) return 'Error';

        const absNum = Math.abs(num);

        // Solo usar notación científica para números REALMENTE extremos
        if (absNum >= 1e21 || (absNum > 0 && absNum < 1e-10)) {
            return num.toExponential(8).replace('+', '');
        }

        let s = num.toString();

        // Si tiene muchos decimales, limitar a 10 decimales
        if (s.includes('.')) {
            const parts = s.split('.');
            if (parts[1] && parts[1].length > 10) {
                s = parseFloat(num.toFixed(10)).toString();
            }
        }

        return s;
    },

    resetState() {
        calcState = {
            display: '0',
            history: '',
            fullHistory: '',
            equation: '',
            lastResult: null,
            memory: calcState.memory,
            isWaitingNext: false,
            openParentheses: 0
        };
    },

    updateDisplay() {
        const screen = document.getElementById('calc-screen');
        const history = document.getElementById('calc-history');
        if (screen) {
            const val = calcState.display;
            screen.innerText = val;

            // Ajuste de fuente basado en longitud (más simple y efectivo)
            const len = val.length;
            let fontSize;

            if (len <= 8) {
                fontSize = 3.5; // Grande
            } else if (len <= 10) {
                fontSize = 2.8; // Medio-grande
            } else if (len <= 12) {
                fontSize = 2.2; // Medio
            } else if (len <= 14) {
                fontSize = 1.8; // Medio-pequeño
            } else if (len <= 16) {
                fontSize = 1.5; // Pequeño
            } else if (len <= 18) {
                fontSize = 1.3; // Muy pequeño
            } else if (len <= 20) {
                fontSize = 1.1; // Extra pequeño
            } else {
                fontSize = 0.9; // Mínimo
            }

            screen.style.fontSize = fontSize + 'rem';
            console.log(`[Calculadora] Display: "${val}" (${len} chars) → ${fontSize}rem`);
        }
        if (history) history.innerText = calcState.history || '';
    },

    handleMemory(action) {
        const currentValue = parseFloat(calcState.display);

        switch(action) {
            case 'MC': // Memory Clear
                calcState.memory = 0;
                Ui.showToast('Memoria borrada', 'info');
                break;
            case 'MR': // Memory Recall
                calcState.display = calcState.memory.toString();
                calcState.isWaitingNext = false;
                break;
            case 'M+': // Memory Add
                calcState.memory += currentValue;
                Ui.showToast(`Memoria: ${calcState.memory}`, 'success');
                break;
            case 'M-': // Memory Subtract
                calcState.memory -= currentValue;
                Ui.showToast(`Memoria: ${calcState.memory}`, 'success');
                break;
            case 'MS': // Memory Store
                calcState.memory = currentValue;
                Ui.showToast(`Guardado en memoria: ${calcState.memory}`, 'success');
                break;
        }

        this.updateMemoryButtons();
        this.updateDisplay();
    },

    updateMemoryButtons() {
        const hasMem = calcState.memory !== 0;
        document.querySelectorAll('.btn-calc-mem').forEach(btn => {
            if (btn.dataset.mem === 'MC' || btn.dataset.mem === 'MR') {
                btn.disabled = !hasMem;
            }
        });
    },

    // --- PERSISTENCIA ---
    saveCurrentOperation() {
        const commentInput = document.getElementById('calc-save-comment');
        const comment = commentInput ? commentInput.value.trim() : '';
        const value = calcState.display;
        const history = calcState.history || '';
        
        if (value === 'Error') {
            Ui.showToast('No se puede guardar un error', 'warning');
            return;
        }

        const op = {
            id: Date.now(),
            comment: comment || 'Operación rápida',
            value: value,
            displayExpr: history ? `${history} ${value}` : value,
            date: new Date().toLocaleTimeString()
        };

        this.savedOperations.unshift(op);
        localStorage.setItem('calc_saved_ops', JSON.stringify(this.savedOperations));
        if (commentInput) commentInput.value = '';
        this.renderSavedList();
        Ui.showToast('Operación guardada', 'success');
    },

    loadSavedOperations() {
        const raw = localStorage.getItem('calc_saved_ops');
        if (raw) this.savedOperations = JSON.parse(raw);
        this.renderSavedList();
    },

    renderSavedList() {
        const container = document.getElementById('calc-saved-list');
        const quickContainer = document.getElementById('calc-quick-history');
        if (!container) return;
        
        // Populate Quick History (last 3)
        if (quickContainer) {
            const lastThree = this.savedOperations.slice(0, 3);
            quickContainer.innerHTML = lastThree.length > 0 
                ? lastThree.map(op => `<button class="btn btn-quick-val" title="${op.comment}" onclick="window.loadCalcOp(${op.id})">${op.value}</button>`).join('')
                : '';
        }

        if (this.savedOperations.length === 0) {
            container.innerHTML = '<div class="text-center p-4 text-muted small">No hay operaciones guardadas</div>';
            return;
        }

        container.innerHTML = this.savedOperations.map(op => `
            <div class="saved-item" onclick="window.loadCalcOp(${op.id})">
                <span class="title">${op.value}</span>
                <span class="text-muted small d-block" style="font-size: 0.7rem;">${op.displayExpr || op.history || ''}</span>
                <span class="comment">${op.comment}</span>
                <div class="d-flex justify-content-between mt-1" style="font-size: 0.6rem; opacity: 0.7;">
                    <span>${op.date}</span>
                    <i class="bi bi-trash text-danger" onclick="event.stopPropagation(); window.deleteCalcOp(${op.id})"></i>
                </div>
            </div>
        `).join('');
    },

    clearAllSaved() {
        if (confirm('¿Limpiar todo el historial?')) {
            this.savedOperations = [];
            localStorage.setItem('calc_saved_ops', '[]');
            this.renderSavedList();
        }
    },

    // --- UI HELPERS ---
    toggleSavedPane(show) {
        const pane = document.getElementById('calc-saved-pane');
        if (pane) {
            if (show) pane.classList.add('active');
            else pane.classList.remove('active');
        }
    },

    autoScale() {
        const win = document.getElementById('calculadora-flotante');
        if (!win) return;
        // Calcular escala base en relación a 350x700 (referencia definitiva)
        const scale = Math.max(0.85, Math.min(2.5, win.offsetWidth / 350));
        document.documentElement.style.setProperty('--calc-scale', scale);
    },

    setupDragAndDrop() {
        const win = document.getElementById('calculadora-flotante');
        const header = win.querySelector('.calculadora-header');
        let isDragging = false;
        let offset = { x: 0, y: 0 };

        header.onmousedown = (e) => {
            // No arrastrar si se hace click en un botón
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

            isDragging = true;

            // Obtener posición actual ANTES de cambiar positioning
            const rect = win.getBoundingClientRect();
            offset.x = e.clientX - rect.left;
            offset.y = e.clientY - rect.top;

            // Si NO está positioned, capturar posición actual y marcar como positioned
            if (!win.classList.contains('positioned')) {
                win.style.left = rect.left + 'px';
                win.style.top = rect.top + 'px';
                win.classList.add('positioned');
            }

            win.style.transition = 'none';
            e.preventDefault();
        };

        document.onmousemove = (e) => {
            if (!isDragging) return;

            const newLeft = e.clientX - offset.x;
            const newTop = e.clientY - offset.y;

            win.style.left = newLeft + 'px';
            win.style.top = newTop + 'px';
        };

        document.onmouseup = () => {
            if (isDragging) {
                isDragging = false;
            }
        };
    },

    setupResizing() {
        const win = document.getElementById('calculadora-flotante');
        const resizer = win.querySelector('.calculadora-resizer');
        if (!resizer) {
            console.error('[Calculadora] No se encontró el resizer');
            return;
        }

        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        const handleMouseMove = (e) => {
            if (!isResizing) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            const newWidth = Math.max(320, startWidth + deltaX);
            const newHeight = Math.max(500, startHeight + deltaY);

            win.style.width = newWidth + 'px';
            win.style.height = newHeight + 'px';

            this.autoScale();
        };

        const handleMouseUp = () => {
            if (isResizing) {
                isResizing = false;
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            }
        };

        resizer.addEventListener('mousedown', (e) => {
            console.log('[Calculadora] Resize iniciado');
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;

            // Obtener dimensiones y posición actuales
            const rect = win.getBoundingClientRect();
            startWidth = rect.width;
            startHeight = rect.height;

            // Si NO está positioned, capturar posición actual y marcar como positioned
            if (!win.classList.contains('positioned')) {
                win.style.left = rect.left + 'px';
                win.style.top = rect.top + 'px';
                win.classList.add('positioned');
            }

            win.style.transition = 'none';

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            e.preventDefault();
            e.stopPropagation();
        });
    },

    handleKeyDown(e) {
        const key = e.key;
        if (/[0-9\.]/.test(key)) this.handleInput(key);
        else if (key === '+') this.handleInput('+');
        else if (key === '-') this.handleInput('-');
        else if (key === '*') this.handleInput('*');
        else if (key === '/') this.handleInput('/');
        else if (key === 'Enter' || key === '=') this.calculate();
        else if (key === 'Escape') this.cerrar();
        else if (key === 'Backspace') this.handleInput('BACK');
        else if (key === 'Delete') this.handleInput('C');
    },

    copyToClipboard() {
        navigator.clipboard.writeText(calcState.display).then(() => {
            Ui.showToast('Copiado al portapapeles', 'success');
        });
    }
};

// Global Exposure for UI actions
window.loadCalcOp = (id) => {
    const op = Calculadora.savedOperations.find(o => o.id === id);
    if (op) {
        // Smart load: if display is 0, replace. Otherwise append.
        if (calcState.display === '0') {
            calcState.display = op.value;
        } else {
            // If it ends in operator or parenthesis, just append value
            const lastChar = calcState.display.slice(-1);
            if (['+', '-', '*', '/', '(', ')'].includes(lastChar)) {
                calcState.display += op.value;
            } else {
                // If it's a number, maybe they want to replace it? 
                // For now, let's just replace if it's strictly '0', otherwise append with a +? 
                // Let's just append to create a longer expression.
                calcState.display += op.value;
            }
        }
        Calculadora.updateDisplay();
        Calculadora.toggleSavedPane(false);
    }
};

window.deleteCalcOp = (id) => {
    Calculadora.savedOperations = Calculadora.savedOperations.filter(o => o.id !== id);
    localStorage.setItem('calc_saved_ops', JSON.stringify(Calculadora.savedOperations));
    Calculadora.renderSavedList();
};

export const calculadora = Calculadora;
window.abrirCalculadora = () => Calculadora.abrir();

// Función de debug para forzar recarga
window.recargarCalculadora = async () => {
    console.log('[DEBUG] Forzando recarga de calculadora...');
    const existing = document.getElementById('calculadora-flotante');
    if (existing) existing.remove();
    Calculadora.isInitialized = false;
    await Calculadora.init(true);
    Calculadora.abrir();
    console.log('[DEBUG] Calculadora recargada.');
};
