/**
 * UNIFIED ADMIN CONSOLE | AdminApp.js
 * ----------------------------------
 * Logic for monitoring local/remote servers and executing management actions.
 * Optimized for robustness and verbose logging.
 */

class AdminApp {
    constructor() {
        this.statusInterval = null;
        this.logInterval = null;
        this.isExecuting = false;
        this.adminPassword = sessionStorage.getItem('admin_pass') || '';

        // Limpiar todo el estado anterior para asegurar una consola "fresca" y evitar logs trabados
        this.localMessages = [];
        this.remoteMessages = [];
        this.lastLogs = { local: [], remote: [] };

        sessionStorage.removeItem('admin_local_msgs');
        sessionStorage.removeItem('admin_remote_msgs');
        this.adminPassword = sessionStorage.getItem('admin_pass') || '';
        this.ws = null;
        this.shellOutputBuffer = { local: '', remote: '' };
        
        this.localInd = document.getElementById('local-indicator');
        this.localTxt = document.getElementById('local-text');
        this.remoteInd = document.getElementById('remote-indicator');
        this.remoteTxt = document.getElementById('remote-text');
        this.dbRemoteInd = document.getElementById('db-remote-indicator');
        this.dbRemoteTxt = document.getElementById('db-remote-text');
        this.cpuBar = document.getElementById('cpu-bar');
        this.cpuTxt = document.getElementById('cpu-text');
        this.memBar = document.getElementById('mem-bar');
        this.memTxt = document.getElementById('mem-text');
        this.netRx = document.getElementById('net-rx');
        this.netTx = document.getElementById('net-tx');
        this.terminalUnified = document.getElementById('terminal-body-unified');
        this.inputUnified = document.getElementById('input-command-unified');
        this.termTargetToggle = document.getElementsByName('termTarget');
        this.termPrompt = document.getElementById('terminal-prompt');
        this.userInput = document.getElementById('admin-user-input');
        this.passInput = document.getElementById('admin-pass-input');
        this.loginBtn = document.getElementById('btn-login');
        this.loginError = document.getElementById('login-error');
        this.loginOverlay = document.getElementById('login-overlay');

        window.onerror = (msg, url, line) => {
            this.appendTerminal('JS ERROR', `${msg} (line ${line})`, 'danger');
        };

        this.init();
    }

    async init() {
        if (window.location.port === '3001') {
            try {
                this.appendTerminal('RESCUE', 'Comprobando si el servidor principal (3000) está online...', 'info');
                // Intentar contactar el health del 3000
                const res = await fetch('https://www.desdetenerife.com:3000/api/health', { method: 'GET', mode: 'cors' });
                if (res.ok) {
                    this.appendTerminal('RESCUE', 'Servidor principal online. Redirigiendo automáticamente...', 'success');
                    window.location.href = 'https://www.desdetenerife.com:3000/admin';
                    return;
                }
            } catch (e) {
                this.appendTerminal('RESCUE', 'Servidor principal OFFLINE. Estás en Modo Rescate.', 'warning');
            }
        }
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);
        this.setupEventListeners();
        document.getElementById('btn-reset-session')?.addEventListener('click', () => this.resetSession());

        this.appendTerminal('SISTEMA', 'Panel de Control Cargado.', 'success');
        console.log('[ADMIN] App initialized. Password stored:', !!this.adminPassword);

        if (this.adminPassword) {
            this.setupWebSocket();
            await this.refreshStatus();
            await this.refreshLogs();
            await this.refreshConnections();
            await this.refreshActiveSessions();
            this.startPolling();
        } else {
            this.showLogin();
        }
    }

    startPolling() {
        if (this.statusInterval) clearInterval(this.statusInterval);
        if (this.logInterval) clearInterval(this.logInterval);
        if (this.connInterval) clearInterval(this.connInterval);

        this.statusInterval = setInterval(() => this.refreshStatus(), 8000);
        this.logInterval = setInterval(() => this.refreshLogs(), 8000);
        this.connInterval = setInterval(() => this.refreshConnections(), 10000);
        this.sessionInterval = setInterval(() => this.refreshActiveSessions(), 10000);
    }

    updateClock() {
        if (document.getElementById('clock')) {
            document.getElementById('clock').textContent = new Date().toLocaleTimeString();
        }
    }

    async refreshStatus() {
        try {
            const res = await this.secureFetch('/api/admin/status');
            if (res.status === 401) {
                return this.showLogin();
            }

            const data = await res.json();
            this.updateStatusUI(data);
        } catch (e) {
            this.setDisconnectedUI();
        }
    }

    updateStatusUI(data) {
        if (!data) return;

        // Indicadores de Estado
        this.setStatusItem(this.localInd, this.localTxt, data.local && data.local.status === 'online', 'Local (3000)');
        this.setStatusItem(this.remoteInd, this.remoteTxt, data.remote && data.remote.status === 'online', 'Tenerife (Cloud)');
        if (this.dbRemoteInd) this.setStatusItem(this.dbRemoteInd, this.dbRemoteTxt, data.database.remote === 'online', 'DB Remota');

        // CPU
        if (this.cpuBar && this.cpuTxt && data.os.hasOwnProperty('cpuUsage')) {
            const cpuVal = data.os.cpuUsage;
            this.cpuBar.style.width = `${cpuVal}%`;
            this.cpuTxt.textContent = `${cpuVal}%`;

            // Cambiar color según carga
            if (cpuVal > 80) this.cpuBar.className = 'progress-bar bg-danger';
            else if (cpuVal > 50) this.cpuBar.className = 'progress-bar bg-warning';
            else this.cpuBar.className = 'progress-bar bg-info';
        }

        // MEMORIA RAM
        if (this.memBar && this.memTxt && data.os.totalMem) {
            const memUsed = data.os.totalMem - data.os.freeMem;
            const memPerc = Math.round((memUsed / data.os.totalMem) * 100);
            this.memBar.style.width = `${memPerc}%`;
            this.memTxt.textContent = `RAM: ${memUsed} / ${data.os.totalMem} MB (${memPerc}%)`;
        }

        // RED / TRÁFICO
        if (this.netRx && this.netTx && data.os.netUsage) {
            this.netRx.textContent = data.os.netUsage.rx;
            this.netTx.textContent = data.os.netUsage.tx;
        }

        // POTENCIA Y UPTIME (NEWS)
        const pwrEl = document.getElementById('pwr-text');
        if (pwrEl && data.os.power !== undefined) {
            pwrEl.textContent = `${data.os.power} W`;
            const pwrBar = document.getElementById('pwr-bar');
            if (pwrBar) {
                const pwrPerc = Math.min(100, Math.round((data.os.power / 65) * 100)); // Relativo a 65W
                pwrBar.style.width = `${pwrPerc}%`;
            }
        }

        const uptimeEl = document.getElementById('uptime-text');
        if (uptimeEl && data.os.uptime) {
            uptimeEl.textContent = this.formatUptime(data.os.uptime);
        }
    }

    formatUptime(seconds) {
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor(seconds % (3600 * 24) / 3600);
        const m = Math.floor(seconds % 3600 / 60);
        const s = Math.floor(seconds % 60);

        if (d > 0) return `${d}d, ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    setStatusItem(ind, txt, isOnline, label) {
        if (!ind || !txt) return;
        if (isOnline) {
            ind.className = 'indicator online';
            txt.textContent = `${label}: Online`;
            txt.className = 'text-success small fw-bold';
        } else {
            ind.className = 'indicator offline';
            txt.textContent = `${label}: Offline`;
            txt.className = 'text-danger small';
        }
    }

    setDisconnectedUI() {
        if (this.localInd) this.localInd.className = 'indicator offline';
        if (this.remoteInd) this.remoteInd.className = 'indicator offline';
        if (this.dbRemoteInd) this.dbRemoteInd.className = 'indicator offline';
    }

    async refreshLogs(manual = false) {
        if (this.isRefreshingLogs) return;
        this.isRefreshingLogs = true;

        const btn = document.getElementById('btn-logs-refresh');
        if (manual) {
            this.appendTerminal('SISTEMA', 'Refrescando logs...', 'info');
            if (btn) btn.classList.add('btn-loading');
        }

        try {
            // Esperar a que ambas peticiones terminen (paralelo)
            await Promise.allSettled([
                this.fetchLogSource('local'),
                this.fetchLogSource('remote')
            ]);

            if (manual) {
                this.appendTerminal('OK', 'Logs actualizados.', 'success');
            }
        } catch (e) {
            console.warn('[ADMIN] Error en ciclo de logs:', e);
            if (manual) this.appendTerminal('ERROR', 'Fallo al refrescar.', 'danger');
        } finally {
            if (btn) btn.classList.remove('btn-loading');
            this.isRefreshingLogs = false;
        }
    }

    async fetchLogSource(target) {
        const url = target === 'local' ? '/api/admin/logs' : '/api/admin/logs?target=remote';

        try {
            const res = await this.secureFetch(url, { timeout: 5000 });
            if (res.ok) {
                const data = await res.json();
                this.renderLogs(data.lines || [], target);
            } else {
                if (res.status === 401) {
                    this.appendTerminal('AUTH', `${target.toUpperCase()}: Sesión expirada`, 'warning', target);
                    this.showLogin();
                } else {
                    this.appendTerminal('ERROR', `${target.toUpperCase()}: Código ${res.status}`, 'danger', target);
                }
            }
        } catch (e) {
            console.warn(`[ADMIN] Error ${target}:`, e);
            this.appendTerminal('ERROR', `${target.toUpperCase()}: ${e.message}`, 'danger', target);
        }
    }

    renderLogs(lines, target) {
        if (!lines || lines.length === 0) return;
        
        // Append historic logs to unified terminal
        lines.reverse().forEach(line => {
            this.appendInteractiveOutput(target, line, line.toLowerCase().includes('error'));
        });
    }

    appendTerminal(tag, message, type = 'secondary', target = 'local') {
        const entry = { tag, message, type, time: new Date().toLocaleTimeString() };
        console.log(`[TERMINAL ${target}]`, tag, message);

        // For system messages, we now append to the unified terminal
        const prefix = target.toUpperCase();
        const prefixClass = target === 'local' ? 'text-success' : 'text-primary';
        const formattedMessage = `<span class="badge bg-${type} me-2" style="font-size:0.65rem;">${tag}</span> <span class="text-secondary small" style="font-size:0.7rem;">[${entry.time}]</span> <span class="fw-bold small">${message}</span>`;
        
        this.appendInteractiveOutput(target, formattedMessage, type === 'danger' || type === 'warning', true);
    }

    setupEventListeners() {
        const bindAction = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.onclick = () => fn();
        };

        bindAction('btn-start-server', () => this.executeAction('start-server', 'local'));
        bindAction('btn-stop-server', () => this.executeAction('stop-server', 'local'));
        bindAction('btn-start-remote', () => this.executeAction('start-server', 'remote'));
        bindAction('btn-stop-remote', () => this.executeAction('stop-server', 'remote'));
        bindAction('btn-db-remote-check', () => this.checkDatabase('remote'));
        bindAction('btn-run-tests', () => this.executeAction('run-tests', 'local'));
        bindAction('btn-logs-refresh', () => this.refreshLogs(true));
        bindAction('btn-connections-refresh', () => this.refreshConnections(true));
        bindAction('btn-sessions-refresh', () => this.refreshActiveSessions(true));
        bindAction('btn-force-reload-clients', () => this.forceReloadClients());
        bindAction('btn-send-global-alert', () => this.sendGlobalAlert());
        
        // These clear buttons will now clear the unified terminal
        bindAction('btn-clear-local', () => { if (this.terminalUnified) this.terminalUnified.innerHTML = ''; });
        bindAction('btn-clear-remote', () => { if (this.terminalUnified) this.terminalUnified.innerHTML = ''; });

        this.termTargetToggle.forEach(radio => {
            radio.onchange = () => {
                const isLocal = radio.value === 'local';
                this.termPrompt.textContent = isLocal ? '$' : '#';
                this.termPrompt.className = `input-group-text bg-transparent border-0 fw-bold ${isLocal ? 'text-success' : 'text-primary'}`;
                this.inputUnified.placeholder = isLocal ? 'Escribe un comando local...' : 'Escribe un comando remoto...';
            };
        });
        const btnClear = document.getElementById('btn-clear-unified');
        if (btnClear) {
            btnClear.onclick = () => {
                if (this.terminalUnified) this.terminalUnified.innerHTML = '';
            };
        }

        const btnCopy = document.getElementById('btn-copy-unified');
        if (btnCopy) {
            btnCopy.onclick = () => this.copyUnifiedToClipboard();
        }

        const btnCopyErrors = document.getElementById('btn-copy-errors');
        if (btnCopyErrors) {
            btnCopyErrors.onclick = () => this.copyUnifiedErrorsToClipboard();
        }

        if (this.userInput) {
            this.userInput.onkeypress = (e) => { if (e.key === 'Enter') this.passInput.focus(); };
        }
        if (this.passInput) {
            this.passInput.onkeypress = (e) => { if (e.key === 'Enter') this.handleLogin(); };
        }
        if (this.loginBtn) {
            this.loginBtn.onclick = () => this.handleLogin();
        }

        if (this.inputUnified) {
            this.inputUnified.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    const cmd = this.inputUnified.value.trim();
                    if (cmd) {
                        const target = Array.from(this.termTargetToggle).find(r => r.checked)?.value || 'local';
                        this.sendShellInput(cmd, target);
                        this.inputUnified.value = '';
                    }
                }
            };
        }
    }

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/agent-tunnel`; // El endpoint del websocket
        
        console.log('[WS] Conectando a terminal interactiva...');
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('[WS] Conectado.');
            // Autenticar ante el túnel (aunque RS usa auth por socket en app.js)
            // Para el admin, ya estamos validados por IP/Session si el servidor nos deja entrar en app.js
        };

        this.ws.onmessage = (msg) => {
            try {
                const data = JSON.parse(msg.data);
                if (data.type === 'shell_output') {
                    this.appendInteractiveOutput(data.payload.target, data.payload.output, data.payload.isError);
                }
            } catch (e) { }
        };

        this.ws.onclose = () => {
            setTimeout(() => this.setupWebSocket(), 5000);
        };
    }

    sendShellInput(command, target) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.appendTerminal('WS ERROR', 'Conexión perdida. Reintentando...', 'danger', target);
            return;
        }
        this.ws.send(JSON.stringify({
            type: 'shell_input',
            payload: { command, target }
        }));
    }

    appendInteractiveOutput(target, output, isError = false, isHtml = false) {
        if (!this.terminalUnified) return;

        const prefix = target.toUpperCase();
        const prefixClass = target === 'local' ? 'text-success' : 'text-primary';
        
        const div = document.createElement('div');
        div.className = `log-entry py-0 px-1 font-monospace ${isError ? 'text-danger' : 'text-light'}`;
        div.style.whiteSpace = 'pre-wrap';
        
        const spanPrefix = document.createElement('span');
        spanPrefix.className = `${prefixClass} fw-bold me-2`;
        spanPrefix.textContent = `[${prefix}]`;
        
        div.appendChild(spanPrefix);
        
        if (isHtml) {
            const spanContent = document.createElement('span');
            spanContent.innerHTML = output;
            div.appendChild(spanContent);
        } else {
            div.appendChild(document.createTextNode(output));
        }
        
        this.terminalUnified.appendChild(div);
        this.terminalUnified.scrollTop = this.terminalUnified.scrollHeight;
    }

    copyUnifiedToClipboard() {
        if (!this.terminalUnified) return;
        const text = this.terminalUnified.innerText;
        navigator.clipboard.writeText(text).then(() => {
            alert('Copiado al portapapeles');
        });
    }

    copyUnifiedErrorsToClipboard() {
        if (!this.terminalUnified) return;
        const errors = Array.from(this.terminalUnified.querySelectorAll('.text-danger'))
            .map(el => el.innerText)
            .join('\n');
        navigator.clipboard.writeText(errors).then(() => {
            alert('Errores copiados al portapapeles');
        });
    }

    async copyToClipboard(target) {
        const term = target === 'local' ? this.terminalLocal : this.terminalRemote;
        if (!term) return;
        const text = term.innerText;
        try {
            await navigator.clipboard.writeText(text);
            this.appendTerminal('COPIADO', 'Logs copiados al portapapeles.', 'success', target);
        } catch (err) {
            this.appendTerminal('ERROR', 'No se pudo copiar (CORS/HTTP).', 'danger', target);
        }
    }

    async copyOnlyErrors(target) {
        const term = target === 'local' ? this.terminalLocal : this.terminalRemote;
        if (!term) return;

        this.appendTerminal('COPIA', `Analizando consola ${target}...`, 'info', target);

        // Filter elements that are errors or have danger/warning classes
        const entries = Array.from(term.querySelectorAll('.log-entry'));
        const errorLines = entries
            .filter(el => {
                const text = el.innerText.toUpperCase();
                const hasErrorClass = el.classList.contains('bg-danger') || el.classList.contains('border-danger') ||
                    el.classList.contains('bg-warning') || el.classList.contains('border-warning');
                const hasErrorBadge = el.querySelector('.bg-danger') || el.querySelector('.bg-warning');

                return text.includes('ERROR') || text.includes('STDERR') || text.includes('FAIL') ||
                    text.includes('WARN') || text.includes('FALLO') || hasErrorClass || hasErrorBadge;
            })
            .map(el => el.innerText)
            .join('\n');

        if (!errorLines) {
            this.appendTerminal('AVISO', 'No se encontraron errores o advertencias para copiar.', 'warning', target);
            alert('No se encontraron líneas de error en la consola ' + target);
            return;
        }

        try {
            await navigator.clipboard.writeText(errorLines);
            this.appendTerminal('EXITO', `Copiadas ${errorLines.split('\n').length} líneas al portapapeles.`, 'success', target);
            alert('Se han copiado los errores de ' + target + ' al portapapeles.');
        } catch (err) {
            console.error('Clipboard Error:', err);
            this.appendTerminal('ERROR', `Error al copiar: ${err.message}. Asegúrese de usar HTTPS.`, 'danger', target);
            // Fallback: mostrar en un prompt para que el usuario pueda copiar manualmente
            window.prompt("Error al usar el portapapeles. Copie los errores manualmente de este cuadro:", errorLines);
        }
    }

    async checkDatabase(target) {
        if (this.isExecuting) return;
        this.isExecuting = true;
        this.appendTerminal('DB', `Chequeando base de datos ${target}...`, 'info', target);
        try {
            const res = await this.secureFetch(`/api/admin/db-check?target=${target}`);
            if (res.status === 401) return this.showLogin();
            const data = await res.json();
            const type = (data.status === 'connected' || data.status === 'online' || data.status === 'ok') ? 'success' : 'warning';
            this.appendTerminal('DB RESULT', data.message || 'Sin respuesta', type, target);
        } catch (e) {
            this.appendTerminal('DB ERROR', `Fallo: ${e.message}`, 'danger', target);
        } finally {
            this.isExecuting = false;
        }
    }

    clearTerminal(target) {
        if (target === 'local') {
            this.localMessages = [];
            sessionStorage.removeItem('admin_local_msgs');
        } else {
            this.remoteMessages = [];
            sessionStorage.removeItem('admin_remote_msgs');
        }
        this.renderLogs(this.lastLogs[target] || [], target);
    }

    async runTests() {
        if (this.isExecuting) return;
        this.isExecuting = true;
        this.appendTerminal('TESTS', 'Iniciando pruebas de arquitectura...', 'warning');
        try {
            const res = await this.secureFetch('/api/admin/run-tests', { method: 'POST' });
            if (res.status === 401) return this.showLogin();
            const data = await res.json();
            if (data.output) {
                data.output.split('\n').filter(l => l.trim()).forEach(line => {
                    const type = line.includes('✅') ? 'success' : (line.includes('❌') ? 'danger' : 'secondary');
                    this.appendTerminal('PRUEBA', line, type);
                });
            }
            this.appendTerminal('TEST END', data.success ? 'EXITO' : 'FALLO', data.success ? 'success' : 'danger');
        } catch (e) {
            this.appendTerminal('TEST ERROR', `Fallo de red: ${e.message}`, 'danger');
        } finally {
            this.isExecuting = false;
        }
    }

    async executeAction(action, target = 'local', params = {}) {
        if (this.isExecuting && action !== 'shell') {
            this.appendTerminal('WAIT', 'Otra acción en curso...', 'warning', target);
            return;
        }
        
        // Limpiar mensajes previos del sistema si es una nueva acción principal (evita acumulación)
        if (action !== 'shell') {
            this.isExecuting = true;
            if (target === 'local') this.localMessages = [];
            else this.remoteMessages = [];
        }

        let btnId = null;
        if (action === 'start-server') {
            btnId = (target === 'local' ? 'btn-start-server' : 'btn-start-remote');
        } else if (action === 'stop-server') {
            btnId = (target === 'local' ? 'btn-stop-server' : 'btn-stop-remote');
        } else if (action === 'run-tests') {
            btnId = 'btn-run-tests';
        } else if (action === 'logs-refresh') {
            btnId = 'btn-logs-refresh';
        }

        const btn = btnId ? document.getElementById(btnId) : null;
        if (btn) { btn.disabled = true; btn.classList.add('btn-loading'); }

        const logMsg = action === 'shell' ? `> ${params.command}` : `${action.toUpperCase()} en ${target.toUpperCase()}...`;
        this.appendTerminal(action === 'shell' ? 'SHELL' : 'ACCION', logMsg, action === 'shell' ? 'info' : 'primary', target);

        try {
            const body = { action, target, ...params };
            const res = await this.secureFetch('/api/admin/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.status === 401) return this.showLogin();
            const data = await res.json();
            if (data.success) {
                if (action !== 'shell') {
                    this.appendTerminal('OK', data.message || 'Comando enviado', 'success', target);
                }
                if (data.output) {
                    data.output.split('\n').forEach(line => {
                        if (line.trim()) this.appendTerminal('OUT', line, 'secondary', target);
                    });
                }
            } else {
                this.appendTerminal('ERROR', data.error || 'Fallo', 'danger', target);
                if (data.stderr) {
                    data.stderr.split('\n').forEach(line => {
                        if (line.trim()) this.appendTerminal('STDERR', line, 'warning', target);
                    });
                }
            }
        } catch (e) {
            this.appendTerminal('ERROR RED', e.message, 'danger', target);
        } finally {
            if (action !== 'shell') {
                setTimeout(() => {
                    this.isExecuting = false;
                    if (btn) { btn.disabled = false; btn.classList.remove('btn-loading'); }
                    this.refreshStatus();
                    setTimeout(() => this.refreshLogs(true), 1500);
                }, 2500);
            }
        }
    }

    async showConfirm(message, title = "Confirmar Acción") {
        return new Promise(resolve => {
            const modalId = 'adminConfirmModal' + Date.now();
            const modalHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content bg-dark text-light border-secondary shadow-lg">
                        <div class="modal-header border-secondary text-warning">
                            <h6 class="modal-title fw-bold"><i class="bi bi-exclamation-triangle-fill me-2"></i>${title}</h6>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p class="mb-0">${message}</p>
                        </div>
                        <div class="modal-footer border-secondary">
                            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal" id="btnCancel${modalId}">Cancelar</button>
                            <button type="button" class="btn btn-warning btn-sm fw-bold" id="btnOk${modalId}">Confirmar</button>
                        </div>
                    </div>
                </div>
            </div>`;
            const div = document.createElement('div');
            div.innerHTML = modalHtml;
            document.body.appendChild(div);
            
            const modalEl = document.getElementById(modalId);
            const modal = new bootstrap.Modal(modalEl);
            let resolved = false;
            
            document.getElementById(`btnOk${modalId}`).onclick = () => {
                resolved = true;
                modal.hide();
                resolve(true);
            };
            
            document.getElementById(`btnCancel${modalId}`).onclick = () => {
                resolved = true;
                modal.hide();
                resolve(false);
            };
            
            modalEl.addEventListener('hidden.bs.modal', () => {
                if (!resolved) resolve(false);
                div.remove();
            });
            modal.show();
        });
    }

    async showAlert(message, title = "Aviso del Sistema", type = "info") {
        return new Promise(resolve => {
            const modalId = 'adminAlertModal' + Date.now();
            const icon = type === 'danger' ? 'bi-x-octagon-fill text-danger' : 
                         type === 'success' ? 'bi-check-circle-fill text-success' : 
                         'bi-info-circle-fill text-info';
            const modalHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content bg-dark text-light border-secondary shadow-lg">
                        <div class="modal-header border-secondary">
                            <h6 class="modal-title fw-bold"><i class="bi ${icon} me-2"></i>${title}</h6>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p class="mb-0">${message}</p>
                        </div>
                        <div class="modal-footer border-secondary">
                            <button type="button" class="btn btn-primary btn-sm px-4" data-bs-dismiss="modal">OK</button>
                        </div>
                    </div>
                </div>
            </div>`;
            const div = document.createElement('div');
            div.innerHTML = modalHtml;
            document.body.appendChild(div);
            
            const modalEl = document.getElementById(modalId);
            const modal = new bootstrap.Modal(modalEl);
            
            modalEl.addEventListener('hidden.bs.modal', () => {
                div.remove();
                resolve();
            });
            modal.show();
        });
    }

    async forceReloadClients() {
        const ok = await this.showConfirm("¿Estás seguro de que quieres forzar a TODOS los clientes conectados a recargar la página remotamente?", "Alerta de Difusión");
        if (!ok) return;
        
        try {
            const res = await this.secureFetch('/api/admin/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'force_reload' })
            });
            const data = await res.json();
            
            if (res.ok) {
                this.appendTerminal('BROADCAST', 'Señal de recarga enviada a todos.', 'success');
                await this.showAlert("Señal de recarga enviada con éxito a todos los clientes conectados.", "Operación Exitosa", "success");
            } else {
                this.appendTerminal('BROADCAST ERROR', data.error || 'No autorizado', 'danger');
                await this.showAlert("Error: " + (data.error || "No autorizado"), "Error de Difusión", "danger");
            }
        } catch (e) {
            this.appendTerminal('BROADCAST ERROR', e.message, 'danger');
            await this.showAlert("Error de red: " + e.message, "Error Crítico", "danger");
        }
    }

    async sendGlobalAlert() {
        const inputEl = document.getElementById('input-global-alert');
        const msg = inputEl?.value?.trim();
        
        if (!msg) {
            await this.showAlert("El mensaje no puede estar vacío.", "Campo Requerido", "info");
            return;
        }

        const ok = await this.showConfirm("¿Quieres enviar esta alerta global a todas las pantallas conectadas?", "Alerta Global");
        if (!ok) return;

        try {
            const res = await this.secureFetch('/api/admin/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'global_alert', payload: { message: msg } })
            });
            const data = await res.json();
            
            if (res.ok) {
                this.appendTerminal('BROADCAST', `Mensaje enviado: "${msg}"`, 'success');
                inputEl.value = ''; // Limpiar
                await this.showAlert("Alerta enviada correctamente a todos los clientes.", "Enviado", "success");
            } else {
                this.appendTerminal('BROADCAST ERROR', data.error || 'No autorizado', 'danger');
                await this.showAlert("Error: " + (data.error || "No autorizado"), "Error", "danger");
            }
        } catch (e) {
            this.appendTerminal('BROADCAST ERROR', e.message, 'danger');
            await this.showAlert("Error de red: " + e.message, "Error Crítico", "danger");
        }
    }

    async refreshActiveSessions(manual = false) {
        if (this.isRefreshingSessions) return;
        this.isRefreshingSessions = true;

        const btn = document.getElementById('btn-sessions-refresh');
        if (manual && btn) btn.classList.add('btn-loading');

        try {
            const res = await this.secureFetch('/api/admin/active-sessions-v2', { timeout: 8000 });
            if (res.ok) {
                const data = await res.json();
                this.renderActiveSessions(data.sessions || []);
            }
        } catch (e) {
            console.warn('[ADMIN] Error refreshing active sessions:', e);
        } finally {
            if (btn) btn.classList.remove('btn-loading');
            this.isRefreshingSessions = false;
        }
    }

    renderActiveSessions(sessions) {
        const body = document.getElementById('sessions-table-body');
        const countEl = document.getElementById('active-sessions-count');
        if (!body) return;

        if (countEl) countEl.textContent = `${sessions.length} DISPOSITIVOS`;

        if (sessions.length === 0) {
            body.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-secondary italic">No hay sesiones activas en este momento.</td></tr>';
            return;
        }

        body.innerHTML = sessions.map(s => {
            const time = new Date(s.timestamp).toLocaleTimeString();
            const date = new Date(s.timestamp).toLocaleDateString();
            
            // User Agent Parser simplificado
            let browser = 'Unknown';
            let icon = 'bi-window';
            if (s.ua.includes('Firefox')) { browser = 'Firefox'; icon = 'bi-browser-firefox'; }
            else if (s.ua.includes('Edg/')) { browser = 'Edge'; icon = 'bi-browser-edge'; }
            else if (s.ua.includes('Chrome')) { browser = 'Chrome'; icon = 'bi-browser-chrome'; }
            else if (s.ua.includes('Safari')) { browser = 'Safari'; icon = 'bi-browser-safari'; }
            else if (s.ua.includes('node')) { browser = 'Node Agent'; icon = 'bi-cpu'; }
            
            const isGuest = s.username.toLowerCase() === 'invitado' || s.username === 'Guest';
            const isAgent = s.isAgent === true;
            
            const countBadge = s.count > 1 
                ? `<span class="badge bg-dark text-info border border-info border-opacity-25 ms-2" style="font-size: 0.65rem;">${s.count} sockets</span>` 
                : '';

            let userDisplay = '';
            if (isAgent) {
                userDisplay = `<div class="text-warning fw-bold"><i class="bi bi-robot me-2"></i>SISTEMA (AGENTE)</div>`;
                browser = 'Internal Agent';
                icon = 'bi-cpu-fill';
            } else if (isGuest) {
                userDisplay = `<div class="text-secondary"><i class="bi bi-person me-2"></i>Invitado</div>`;
            } else {
                userDisplay = `<div class="text-primary fw-bold"><i class="bi bi-person-check-fill me-2"></i>${s.username}${countBadge}</div>`;
            }

            const safeUsername = (s.username || '').replace(/'/g, "\\'");
            const actions = isAgent ? '---' : `
                <button class="btn btn-xs btn-outline-info p-1" onclick="window.app.showVisitorActivity('${s.ip}', '${safeUsername}')" title="Ver actividad">
                    <i class="bi bi-eye-fill"></i>
                </button>
            `;

            return `
                <tr class="animate__animated animate__fadeIn">
                    <td class="ps-4">${userDisplay}</td>
                    <td><code class="text-info small">${s.ip}</code></td>
                    <td><span class="badge bg-dark border border-secondary fw-normal"><i class="bi bi-geo-alt-fill text-danger me-1"></i>${s.location}</span></td>
                    <td>
                        <div class="d-flex align-items-center">
                            <i class="bi ${icon} me-2 text-info"></i>
                            <div class="small">
                                <div class="fw-bold">${browser}</div>
                                <div class="text-secondary" style="font-size: 0.7rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${s.ua}">${s.ua}</div>
                            </div>
                        </div>
                    </td>
                    <td class="text-center">${actions}</td>
                    <td class="text-end pe-4">
                        <div class="fw-bold text-light">${time}</div>
                        <div class="text-secondary" style="font-size: 0.7rem;">${date}</div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async showVisitorActivity(ip, username) {
        const modal = new bootstrap.Modal(document.getElementById('activityModal'));
        const body = document.getElementById('activity-table-body');
        const info = document.getElementById('activity-user-info');
        
        body.innerHTML = '<tr><td colspan="4" class="text-center p-4">Cargando historial...</td></tr>';
        info.textContent = `Usuario: ${username} | IP: ${ip}`;
        modal.show();

        try {
            const res = await this.secureFetch(`/api/admin/visitor-history/${encodeURIComponent(ip)}`);
            const data = await res.json();
            
            if (data.success && data.history.length > 0) {
                body.innerHTML = data.history.map(h => {
                    const time = new Date(h.time).toLocaleTimeString();
                    const statusClass = h.status >= 400 ? 'text-danger' : (h.status >= 300 ? 'text-warning' : 'text-success');
                    return `
                        <tr>
                            <td class="ps-3"><span class="badge bg-secondary opacity-50">${h.method}</span></td>
                            <td class="text-center fw-bold ${statusClass}">${h.status}</td>
                            <td class="text-info font-monospace" style="word-break: break-all;">${h.path}</td>
                            <td class="text-end pe-3 text-secondary">${time}</td>
                        </tr>
                    `;
                }).join('');
            } else {
                body.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-secondary">No hay historial reciente para este usuario.</td></tr>';
            }
        } catch (e) {
            body.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-danger">Error: ${e.message}</td></tr>`;
        }
    }

    async refreshConnections(manual = false) {
        if (this.isRefreshingConns) return;
        this.isRefreshingConns = true;

        const btn = document.getElementById('btn-connections-refresh');
        if (manual && btn) btn.classList.add('btn-loading');

        try {
            await Promise.allSettled([
                this.fetchConnections('local'),
                this.fetchConnections('remote')
            ]);
        } catch (e) {
            console.warn('[ADMIN] Error refreshing connections:', e);
        } finally {
            if (btn) btn.classList.remove('btn-loading');
            this.isRefreshingConns = false;
        }
    }

    async fetchConnections(target) {
        const url = target === 'local' ? '/api/admin/connections' : '/api/admin/connections?target=remote';
        const bodyEl = document.getElementById(`connections-body-${target}`);
        const statusEl = document.getElementById(`conn-status-${target}`);

        try {
            const res = await this.secureFetch(url, { timeout: 7000 });
            if (res.ok) {
                const data = await res.json();
                this.renderConnections(data.connections || [], target);
                if (statusEl) {
                    statusEl.textContent = `${data.connections.length} RECIENTES`;
                    statusEl.className = 'badge bg-success';
                }
            } else {
                if (statusEl) {
                    statusEl.textContent = 'FAIL';
                    statusEl.className = 'badge bg-danger';
                }
            }
        } catch (e) {
            if (statusEl) {
                statusEl.textContent = 'OFFLINE';
                statusEl.className = 'badge bg-secondary opacity-50';
            }
        }
    }

    renderConnections(connections, target) {
        const body = document.getElementById(`connections-body-${target}`);
        if (!body) return;

        if (connections.length === 0) {
            body.innerHTML = '<tr><td colspan="4" class="text-center text-secondary p-4 italic">No hay conexiones recientes registradas.</td></tr>';
            return;
        }

        body.innerHTML = connections.map(c => {
            // Simplify User-Agent
            let ua = c.ua || 'Unknown';
            if (ua.includes('Mozilla/5.0')) {
                if (ua.includes('Chrome')) ua = 'Chrome/Edge';
                else if (ua.includes('Firefox')) ua = 'Firefox';
                else if (ua.includes('Safari') && !ua.includes('Chrome')) ua = 'Safari';
            }
            if (ua.length > 25) ua = ua.substring(0, 22) + '...';

            return `
                <tr>
                    <td class="text-secondary opacity-75">${new Date(c.timestamp).toLocaleTimeString()}</td>
                    <td class="fw-bold ${target === 'local' ? 'text-success' : 'text-info'}">${c.ip}</td>
                    <td class="text-info">${c.methodUrl}</td>
                    <td class="text-secondary small" title="${c.ua}">${ua}</td>
                </tr>
            `;
        }).join('');
    }

    async handleLogin() {
        const username = this.userInput.value;
        const password = this.passInput.value;
        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            let data;
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                data = await res.json();
            } else {
                const text = await res.text();
                throw new Error(text || `Error ${res.status}`);
            }

            if (data.success) {
                this.adminPassword = password;
                sessionStorage.setItem('admin_pass', password);
                this.loginOverlay.classList.add('d-none');
                this.appendTerminal('AUTH', `Bienvenido, ${username}.`, 'success');
                this.refreshStatus();
                this.refreshLogs();
                this.refreshConnections();
                this.startPolling();
            } else {
                this.loginError.textContent = data.message || 'Error';
                this.loginError.classList.remove('d-none');
            }
        } catch (e) {
            alert('Error de conexión con el agente: ' + e.message);
        }
    }

    showLogin() {
        if (this.loginOverlay) {
            this.loginOverlay.classList.remove('d-none');
            this.passInput.focus();
        }
    }

    async secureFetch(url, options = {}) {
        if (!options.headers) options.headers = {};
        options.headers['x-admin-password'] = this.adminPassword;

        const timeout = options.timeout || 10000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        options.signal = controller.signal;

        try {
            const res = await fetch(url, options);
            clearTimeout(timeoutId);

            // Si el status es 401, forzamos re-login antes de intentar parsear nada
            if (res.status === 401) {
                this.showLogin();
                // Devolvemos el response original para que el llamador vea el fallo pero no rompa el flujo
                return res;
            }

            return res;
        } catch (e) {
            clearTimeout(timeoutId);
            if (e.name === 'AbortError') throw new Error(`Timeout tras ${timeout}ms`);
            throw e;
        }
    }

    resetSession() {
        sessionStorage.clear();
        location.reload();
    }
}

// Iniciar aplicación
window.addEventListener('load', () => { window.app = new AdminApp(); });
