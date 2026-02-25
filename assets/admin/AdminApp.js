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
        sessionStorage.removeItem('admin_last_logs');

        this.localInd = document.getElementById('local-indicator');
        this.localTxt = document.getElementById('local-text');
        this.remoteInd = document.getElementById('remote-indicator');
        this.remoteTxt = document.getElementById('remote-text');
        this.dbRemoteInd = document.getElementById('db-remote-indicator');
        this.dbRemoteTxt = document.getElementById('db-remote-text');
        this.memBar = document.getElementById('mem-bar');
        this.memTxt = document.getElementById('mem-text');
        this.terminalLocal = document.getElementById('terminal-body-local');
        this.terminalRemote = document.getElementById('terminal-body-remote');
        this.localLogStatus = document.getElementById('local-log-status');
        this.remoteLogStatus = document.getElementById('remote-log-status');
        this.loginOverlay = document.getElementById('login-overlay');
        this.userInput = document.getElementById('admin-user-input');
        this.passInput = document.getElementById('admin-pass-input');
        this.loginBtn = document.getElementById('btn-login');
        this.loginError = document.getElementById('login-error');

        window.onerror = (msg, url, line) => {
            this.appendTerminal('JS ERROR', `${msg} (line ${line})`, 'danger');
        };

        this.init();
    }

    async init() {
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);
        this.setupEventListeners();
        document.getElementById('btn-reset-session')?.addEventListener('click', () => this.resetSession());

        this.appendTerminal('SISTEMA', 'Panel de Control Cargado.', 'success');
        console.log('[ADMIN] App initialized. Password stored:', !!this.adminPassword);

        if (this.adminPassword) {
            await this.refreshStatus();
            await this.refreshLogs();
            await this.refreshConnections();
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
        this.setStatusItem(this.localInd, this.localTxt, data.local.status === 'online', 'Local (3000)');
        this.setStatusItem(this.remoteInd, this.remoteTxt, data.remote.status === 'online', 'Tenerife (Cloud)');
        if (this.dbRemoteInd) this.setStatusItem(this.dbRemoteInd, this.dbRemoteTxt, data.database.remote === 'online', 'DB Remota');

        if (this.memBar && this.memTxt) {
            const memUsed = data.os.totalMem - data.os.freeMem;
            const memPerc = Math.round((memUsed / data.os.totalMem) * 100);
            this.memBar.style.width = `${memPerc}%`;
            this.memTxt.textContent = `RAM: ${memUsed} / ${data.os.totalMem} MB (${memPerc}%)`;
        }
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
        const statusEl = target === 'local' ? this.localLogStatus : this.remoteLogStatus;

        try {
            // Timeout más corto de 5s para logs
            const res = await this.secureFetch(url, { timeout: 5000 });
            if (res.ok) {
                const data = await res.json();
                this.renderLogs(data.lines || [], target);
                statusEl.textContent = `ACTIVO ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
                statusEl.className = 'badge bg-success ms-2';
            } else {
                if (res.status === 401) {
                    this.appendTerminal('AUTH', `${target.toUpperCase()}: Sesión expirada`, 'warning', target);
                    this.showLogin();
                } else {
                    this.appendTerminal('ERROR', `${target.toUpperCase()}: Código ${res.status}`, 'danger', target);
                }
                statusEl.textContent = 'ERROR';
                statusEl.className = 'badge bg-danger ms-2';
            }
        } catch (e) {
            console.warn(`[ADMIN] Error ${target}:`, e);
            statusEl.textContent = 'ERROR';
            statusEl.className = 'badge bg-danger ms-2';
            this.appendTerminal('ERROR', `${target.toUpperCase()}: ${e.message}`, 'danger', target);
        }
    }

    renderLogs(lines, target) {
        const term = target === 'local' ? this.terminalLocal : this.terminalRemote;
        const messages = target === 'local' ? this.localMessages : this.remoteMessages;
        if (!term) return;

        if (lines && lines.length > 0) {
            this.lastLogs[target] = lines;
            sessionStorage.setItem('admin_last_logs', JSON.stringify(this.lastLogs));
        } else if (!this.lastLogs[target] || this.lastLogs[target].length === 0) {
            this.lastLogs[target] = ['<span class="text-secondary opacity-50 italic">Esperando logs del servidor...</span>'];
        }

        const terminalContent = document.createElement('div');

        // 1. Mostrar primero los logs del archivo (Tail)
        const logsToRender = this.lastLogs[target] || [];
        logsToRender.forEach(line => {
            const div = document.createElement('div');
            div.className = 'log-entry py-0 px-1';

            // Format timestamps and tags more robustly
            const formatted = String(line)
                .replace(/\[(AGENT|ADMIN|SERVER|System Routes|STDOUT|STDERR|ACCION|OK|ERROR|AUTH|SISTEMA|TESTS?|DB|DB RESULT)\]/g,
                    (match, p1) => `<span class="badge bg-dark-subtle text-light-emphasis border border-secondary me-1" style="font-size:0.6rem;">${p1}</span>`)
                .replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/g,
                    (match) => `<span class="text-secondary small">[${new Date(match).toLocaleTimeString()}]</span>`);

            div.innerHTML = formatted;
            terminalContent.appendChild(div);
        });

        // 2. Mostrar mensajes del sistema (Eventos manuales) al FINAL
        if (messages.length > 0) {
            messages.forEach(m => {
                const div = document.createElement('div');
                div.className = `log-entry text-light bg-${m.type} bg-opacity-10 border-start border-4 border-${m.type} ms-1 mb-1 py-1 px-2`;
                div.innerHTML = `<span class="badge bg-${m.type} me-2" style="font-size:0.65rem;">${m.tag}</span> <span class="text-secondary small" style="font-size:0.7rem;">[${m.time}]</span> <span class="fw-bold small">${m.message}</span>`;
                terminalContent.appendChild(div);
            });
        }

        term.innerHTML = '';
        term.appendChild(terminalContent);
        // Asegurar scroll al final con varios reintentos para compensar renderizado lento
        const scrollToBottom = () => { term.scrollTop = term.scrollHeight; };
        requestAnimationFrame(() => {
            scrollToBottom();
            setTimeout(scrollToBottom, 50);
            setTimeout(scrollToBottom, 200);
            setTimeout(scrollToBottom, 500);
        });
    }

    appendTerminal(tag, message, type = 'secondary', target = 'local') {
        const entry = { tag, message, type, time: new Date().toLocaleTimeString() };
        console.log(`[TERMINAL ${target}]`, tag, message);
        if (target === 'local') {
            this.localMessages.push(entry);
            if (this.localMessages.length > 50) this.localMessages.shift();
            sessionStorage.setItem('admin_local_msgs', JSON.stringify(this.localMessages));
        } else {
            this.remoteMessages.push(entry);
            if (this.remoteMessages.length > 50) this.remoteMessages.shift();
            sessionStorage.setItem('admin_remote_msgs', JSON.stringify(this.remoteMessages));
        }
        this.renderLogs(this.lastLogs[target] || [], target);
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

        if (this.loginBtn) {
            this.loginBtn.onclick = () => this.handleLogin();
        }
        if (this.userInput) {
            this.userInput.onkeypress = (e) => { if (e.key === 'Enter') this.passInput.focus(); };
        }
        if (this.passInput) {
            this.passInput.onkeypress = (e) => { if (e.key === 'Enter') this.handleLogin(); };
        }

        bindAction('btn-copy-local', () => this.copyToClipboard('local'));
        bindAction('btn-copy-errors-local', () => this.copyOnlyErrors('local'));
        bindAction('btn-copy-remote', () => this.copyToClipboard('remote'));
        bindAction('btn-copy-errors-remote', () => this.copyOnlyErrors('remote'));
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

    async executeAction(action, target = 'local') {
        if (this.isExecuting) {
            this.appendTerminal('WAIT', 'Otra acción en curso...', 'warning', target);
            return;
        }
        this.isExecuting = true;

        const btnId = (action === 'start-server')
            ? (target === 'local' ? 'btn-start-server' : 'btn-start-remote')
            : (target === 'local'
                ? (action === 'stop-server' ? 'btn-stop-server' : (action === 'run-tests' ? 'btn-run-tests' : 'btn-logs-refresh'))
                : 'btn-stop-remote');

        const btn = document.getElementById(btnId);
        if (btn) { btn.disabled = true; btn.classList.add('btn-loading'); }

        this.appendTerminal('ACCION', `${action.toUpperCase()} en ${target.toUpperCase()}...`, 'primary', target);

        try {
            const res = await this.secureFetch('/api/admin/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, target })
            });

            if (res.status === 401) return this.showLogin();
            const data = await res.json();
            if (data.success) {
                this.appendTerminal('OK', data.message || 'Comando enviado', 'success', target);
                if (data.output) this.appendTerminal('STDOUT', data.output, 'secondary', target);
            } else {
                this.appendTerminal('ERROR', data.error || 'Fallo', 'danger', target);
                if (data.stderr) this.appendTerminal('STDERR', data.stderr, 'warning', target);
            }
        } catch (e) {
            this.appendTerminal('ERROR RED', e.message, 'danger', target);
        } finally {
            // Esperar un poco más para que el proceso tenga tiempo de levantar el puerto
            setTimeout(() => {
                this.isExecuting = false;
                if (btn) { btn.disabled = false; btn.classList.remove('btn-loading'); }
                // Forzar refresco inmediato de estado tras una acción
                this.refreshStatus();
                setTimeout(() => this.refreshLogs(true), 1500);
                setTimeout(() => this.refreshConnections(true), 2000);
            }, 2500);
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
