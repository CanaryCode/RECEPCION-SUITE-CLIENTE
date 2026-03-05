import { Api } from '../core/Api.js';
import { Ui } from '../core/Ui.js';
import { Utils } from '../core/Utils.js';
import { APP_CONFIG } from '../core/Config.js';

/**
 * MÓDULO DE ASIGNACIÓN DE TURNOS (turnos.js) - v2 REFINADO
 */
export const TurnosManager = {
    currentDate: new Date(),
    receptionists: [],
    shifts: [],
    isEditing: false,
    selectedCell: null,
    currentView: 'cuadrante',
    charts: { persona: null, semana: null, zoom: null },
    modals: { pin: null, selector: null, zoom: null },
    sortConfig: { column: 'user', direction: 'asc' },

    /**
     * INICIALIZACIÓN
     */
    async inicializar() {
        console.log("TurnosManager.inicializar() CALLED");
        this.setupEventListeners();
        await this.loadData();
        this.render();
    },

    /**
     * CONFIGURAR EVENTOS
     */
    setupEventListeners() {
        // ... (existing listeners for navigations, view toggles)
        document.getElementById('prevWeekBtn')?.addEventListener('click', () => { this.currentDate.setDate(this.currentDate.getDate() - 7); this.render(); });
        document.getElementById('nextWeekBtn')?.addEventListener('click', () => { this.currentDate.setDate(this.currentDate.getDate() + 7); this.render(); });
        document.getElementById('btnExportWeek')?.addEventListener('click', () => this.difundirSemana());

        // Implementación de Toggle/Switch para Radios de Deuda
        document.querySelectorAll('input[name="debidoType"]').forEach(radio => {
            radio.addEventListener('click', (e) => {
                const wasChecked = radio.dataset.wasChecked === "true";
                
                if (wasChecked) {
                    radio.checked = false;
                    radio.dataset.wasChecked = "false";
                } else {
                    document.querySelectorAll('input[name="debidoType"]').forEach(r => r.dataset.wasChecked = "false");
                    radio.dataset.wasChecked = "true";
                }
                // Disparar evento de cambio manualmente para que updateCell se ejecute
                radio.dispatchEvent(new Event('change', { bubbles: true }));
            });
        });
        document.getElementById('weekPicker')?.addEventListener('input', (e) => {
            if (e.target.value) { this.currentDate = new Date(e.target.value); this.render(); }
        });

        document.getElementById('btnVistaCuadrante')?.addEventListener('click', () => this.cambiarVista('cuadrante'));
        document.getElementById('btnVistaAnual')?.addEventListener('click', () => this.cambiarVista('anual'));
        document.getElementById('btnVistaEstadisticas')?.addEventListener('click', () => this.cambiarVista('estadisticas'));

        document.getElementById('btnEditTurnos')?.addEventListener('click', () => this.handleEditRequest());
        document.getElementById('btnSaveTurnos')?.addEventListener('click', () => this.saveChanges());
        document.getElementById('btnCancelEdit')?.addEventListener('click', () => this.cancelEdit());
        document.getElementById('btnAutoAssign')?.addEventListener('click', () => this.autoAssignWeek());
        document.getElementById('btnManageUsers')?.addEventListener('click', () => this.abrirGestionPersonal());
        document.getElementById('btnAddReceptionist')?.addEventListener('click', () => this.añadirRecepcionista());

        // Eventos del Modal PIN
        document.getElementById('btnConfirmPinTurnos')?.addEventListener('click', () => this.verifyPin());
        document.getElementById('inputPinTurnos')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.verifyPin();
        });

        // Eventos de la vista anual y mensual (selectores)
        document.getElementById('selectAnualUser')?.addEventListener('change', () => this.renderAnnualView());
        document.getElementById('selectAnualYear')?.addEventListener('change', () => this.renderAnnualView());
        document.getElementById('selectMensualMonth')?.addEventListener('change', () => this.renderMonthlyView());
        document.getElementById('selectMensualYear')?.addEventListener('change', () => this.renderMonthlyView());

        // Modal de selección de turno (dentro del modal body)
        document.querySelectorAll('#shiftSelectorModal .list-group-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.selectedCell && btn.dataset.shift !== undefined) {
                    const shift = btn.dataset.shift;
                    this.updateCell(this.selectedCell, shift);
                    this.hideModal('shiftSelectorModal');
                }
            });
        });

        // Sincronización en tiempo real de marcadores desde el modal
        document.getElementById('checkShiftPedido')?.addEventListener('change', () => {
            if (this.selectedCell) this.updateCell(this.selectedCell, this.selectedCell.dataset.shift);
        });
        document.querySelectorAll('input[name="debidoType"]').forEach(r => {
            r.addEventListener('change', () => {
                if (this.selectedCell) this.updateCell(this.selectedCell, this.selectedCell.dataset.shift);
            });
        });

        this.setupDragPropagation();
        this.setupAnnualReordering();
    },

    setupAnnualReordering() {
        const container = document.getElementById('annual-heatmap-container');
        if (!container) return;

        container.addEventListener('dragstart', (e) => {
            const section = e.target.closest('.user-annual-section');
            if (section) {
                e.dataTransfer.setData('text/plain', section.dataset.user);
                section.classList.add('dragging');
            }
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            const section = e.target.closest('.user-annual-section');
            if (section && !section.classList.contains('dragging')) {
                section.classList.add('drag-over');
            }
        });

        container.addEventListener('dragleave', (e) => {
            const section = e.target.closest('.user-annual-section');
            if (section) section.classList.remove('drag-over');
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedUser = e.dataTransfer.getData('text/plain');
            const targetSection = e.target.closest('.user-annual-section');
            if (draggedUser && targetSection && draggedUser !== targetSection.dataset.user) {
                const targetUser = targetSection.dataset.user;
                const oldIdx = this.receptionists.indexOf(draggedUser);
                const newIdx = this.receptionists.indexOf(targetUser);
                
                if (oldIdx !== -1 && newIdx !== -1) {
                    this.receptionists.splice(oldIdx, 1);
                    this.receptionists.splice(newIdx, 0, draggedUser);
                    this.renderAnnualView();
                }
            }
            document.querySelectorAll('.user-annual-section').forEach(s => s.classList.remove('dragging', 'drag-over'));
        });
    },

    async loadData() {
        try {
            console.log("[Turnos] Cargando datos...");
            
            // Wait for APP_CONFIG to be ready if needed
            if (!APP_CONFIG.HOTEL?.RECEPCIONISTAS || APP_CONFIG.HOTEL.RECEPCIONISTAS.length === 0) {
                 await new Promise(r => setTimeout(r, 800)); // Brief pause for config load
            }

            this.receptionists = [...(APP_CONFIG.HOTEL?.RECEPCIONISTAS || [])];
            
            if (this.receptionists.length === 0) {
                console.warn("[Turnos] APP_CONFIG.HOTEL.RECEPCIONISTAS sigue vacío, pidiendo vía API...");
                const config = await Api.get('storage/config');
                this.receptionists = config?.HOTEL?.RECEPCIONISTAS || [];
            }

            const shiftsData = await Api.get('storage/turnos_empleados');
            console.log(`[Turnos] ${Array.isArray(shiftsData) ? shiftsData.length : 0} turnos recibidos.`);

            this.shifts = Array.isArray(shiftsData) ? shiftsData.map(s => ({
                ...s,
                fecha: Utils.parseDate(s.fecha)
            })) : [];
            
            if (this.shifts.length > 0) {
                console.log("[Turnos] Muestra de datos cargados:");
                console.table(this.shifts.slice(0, 5));
            }

            this.populateAnnualSelectors();
            this.populateMonthlySelectors();
        } catch (e) {
            console.error("[Turnos] Error en loadData:", e);
        }
    },

    populateAnnualSelectors() {
        const userSelect = document.getElementById('selectAnualUser');
        const yearSelect = document.getElementById('selectAnualYear');
        if (!userSelect || !yearSelect) return;

        // Users
        userSelect.innerHTML = '<option value="all">Todos los Empleados</option>';
        this.receptionists.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u; opt.innerText = u;
            userSelect.appendChild(opt);
        });

        // Years
        yearSelect.innerHTML = '';
        const currentYear = new Date().getFullYear();
        for (let i = currentYear; i >= currentYear - 2; i--) {
            const opt = document.createElement('option');
            opt.value = i; opt.innerText = i;
            yearSelect.appendChild(opt);
        }
    },

    populateMonthlySelectors() {
        const monthSelect = document.getElementById('selectMensualMonth');
        const yearSelect = document.getElementById('selectMensualYear');
        if (!monthSelect || !yearSelect) return;

        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        monthSelect.innerHTML = '';
        months.forEach((m, i) => {
            const opt = document.createElement('option');
            opt.value = i; opt.innerText = m;
            monthSelect.appendChild(opt);
        });
        monthSelect.value = this.currentDate.getMonth();

        yearSelect.innerHTML = '';
        const currentYear = new Date().getFullYear();
        for (let i = currentYear + 1; i >= currentYear - 2; i--) {
            const opt = document.createElement('option');
            opt.value = i; opt.innerText = i;
            yearSelect.appendChild(opt);
        }
        yearSelect.value = this.currentDate.getFullYear();
    },

    /**
     * CAMBIAR VISTA
     */
    cambiarVista(vista) {
        this.currentView = vista;
        const btnC = document.getElementById('btnVistaCuadrante');
        const btnM = document.getElementById('btnVistaMensual');
        const btnA = document.getElementById('btnVistaAnual');
        const btnS = document.getElementById('btnVistaEstadisticas');
        
        const viewC = document.getElementById('view-cuadrante');
        const viewM = document.getElementById('view-mensual');
        const viewA = document.getElementById('view-anual');
        const viewS = document.getElementById('view-stats');

        [btnC, btnM, btnA, btnS].forEach(b => b?.classList.remove('active'));
        [viewC, viewM, viewA, viewS].forEach(v => v?.classList.add('d-none'));

        if (vista === 'cuadrante') {
            btnC?.classList.add('active'); viewC?.classList.remove('d-none');
        } else if (vista === 'mensual') {
            btnM?.classList.add('active'); viewM?.classList.remove('d-none');
        } else if (vista === 'anual') {
            btnA?.classList.add('active'); viewA?.classList.remove('d-none');
        } else {
            btnS?.classList.add('active'); viewS?.classList.remove('d-none');
        }
        
        this.render();
    },

    /**
     * RENDERIZAR
     */
    render() {
        this.updateActionButtons(); // Asegurar visibilidad de botones según vista y modo
        if (this.currentView === 'cuadrante') {
            this.renderHeaderDates();
            this.renderTableBody();
        } else if (this.currentView === 'mensual') {
            this.renderMonthlyView();
        } else if (this.currentView === 'anual') {
            this.renderAnnualView();
        } else {
            this.renderStats();
        }
    },

    renderMonthlyView() {
        const container = document.getElementById('monthly-compact-container');
        if (!container) return;

        const monthSelect = document.getElementById('selectMensualMonth');
        const yearSelect = document.getElementById('selectMensualYear');
        
        const month = parseInt(monthSelect?.value ?? this.currentDate.getMonth());
        const year = parseInt(yearSelect?.value ?? this.currentDate.getFullYear());

        container.innerHTML = '';

        // Calcular todos los días que se mostrarán (calendario completo de 4-6 semanas)
        const firstDayOfMonth = new Date(year, month, 1);
        let firstDayWeekday = firstDayOfMonth.getDay() - 1; // Lunes=0
        if (firstDayWeekday < 0) firstDayWeekday = 6; // Domingo=6

        const startDate = new Date(year, month, 1 - firstDayWeekday);
        const endDate = new Date(year, month + 1, 0);
        let lastDayWeekday = endDate.getDay() - 1;
        if (lastDayWeekday < 0) lastDayWeekday = 6;
        const finalDate = new Date(year, month + 1, 6 - lastDayWeekday);

        // Agrupar días en semanas
        const weeks = [];
        let currentDay = new Date(startDate);
        while (currentDay <= finalDate) {
            const week = [];
            for (let i = 0; i < 7; i++) {
                week.push(new Date(currentDay));
                currentDay.setDate(currentDay.getDate() + 1);
            }
            weeks.push(week);
        }

        // Renderizar cada semana como una tabla compacta
        weeks.forEach((week, index) => {
            const weekBlock = document.createElement('div');
            weekBlock.className = 'monthly-week-block shadow-sm';
            
            const firstDate = week[0];
            const lastDate = week[6];
            weekBlock.innerHTML = `
                <div class="monthly-week-title d-flex justify-content-between">
                    <span>SEMANA ${index + 1}: ${Utils.formatDate(firstDate)} - ${Utils.formatDate(lastDate)}</span>
                </div>
                <table class="turnos-table-compact">
                    <thead>
                        <tr>
                            <th class="compact-user-cell">Empleado</th>
                            ${week.map(d => `
                                <th class="${d.getMonth() !== month ? 'text-muted opacity-50' : 'fw-bold'}">
                                    ${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'][d.getDay() === 0 ? 6 : d.getDay()-1]} ${d.getDate()}
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${this.receptionists.map(user => `
                            <tr>
                                <td class="compact-user-cell bg-light">${user}</td>
                                ${week.map(d => {
                                    const dateStr = Utils.parseDate(d);
                                    const shift = this.shifts.find(s => s.usuario === user && s.fecha === dateStr);
                                    const type = shift ? (shift.tipo_turno || '').trim() : '';
                                    const colorClass = type ? this.getShiftClass(type) : 'shift-none';
                                    const isOtherMonth = d.getMonth() !== month;
                                    const debidoVal = parseInt(shift?.es_debido || '0');
                                    return `
                                        <td class="calendar-day ${isOtherMonth ? 'other-month' : ''}" 
                                            onclick="TurnosManager.jumpToDate('${dateStr}')"
                                            title="${user} - ${Utils.formatDate(d)}: ${type || 'Sin turno'}">
                                            <div class="shift-cell ${colorClass}" style="height: 100%; border:0; font-size: 0.6rem; position: relative;">
                                                ${type ? type.substring(0, 3).toUpperCase() : ''}
                                                ${shift?.es_pedido ? '<span class="shift-marker-pedido" style="font-size: 6px;">P</span>' : ''}
                                                ${debidoVal !== 0 ? `<span class="shift-marker-debido" style="font-size: 6px; ${debidoVal < 0 ? 'background-color: #636e72 !important;' : ''}">D</span>` : ''}
                                            </div>
                                        </td>
                                    `;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            container.appendChild(weekBlock);
        });
    },

    jumpToDate(dateStr) {
        this.currentDate = new Date(dateStr);
        this.cambiarVista('cuadrante');
    },

    createMonthlyDayElement(day, dateStr, isOtherMonth) {
        // Redundante con el nuevo render, pero lo mantengo por si acaso o lo borro
        return document.createElement('div');
    },

    /**
     * RENDERIZAR CABECERA (FECHAS)
     */
    renderHeaderDates() {
        const dates = this.getWeekRange();
        const headerRow = document.getElementById('turnosTableHeader');
        if (!headerRow) return;

        while (headerRow.cells.length > 1) headerRow.deleteCell(1);

        const daysNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        dates.forEach((date, i) => {
            const th = document.createElement('th');
            // Show DD/MM/YYYY clearly
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            th.innerHTML = `<div class="days-name">${daysNames[i]}</div><div class="small text-muted fw-normal">${day}/${month}/${year}</div>`;
            headerRow.appendChild(th);
        });

        const rLabel = `${dates[0].getDate()}/${dates[0].getMonth()+1}/${dates[0].getFullYear()} - ${dates[6].getDate()}/${dates[6].getMonth()+1}/${dates[6].getFullYear()}`;
        Utils.setHtml('currentWeekRange', rLabel);
    },

    /**
     * RENDERIZAR CUERPO (GRILLA)
     */
    renderTableBody() {
        const tbody = document.getElementById('turnosTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const dates = this.getWeekRange();

        this.receptionists.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="user-cell shadow-sm">${user}</td>`;

            dates.forEach(date => {
                const td = document.createElement('td');
                const isoDate = Utils.parseDate(date);
                const shiftData = this.shifts.find(s => s.usuario === user && s.fecha === isoDate);
                const val = shiftData ? shiftData.tipo_turno : '';
                const isPedido = shiftData?.es_pedido || false;
                const debidoVal = parseInt(shiftData?.es_debido || '0');
                
                td.className = `shift-cell-wrapper`;
                td.innerHTML = `
                    <div class="shift-cell ${this.getShiftClass(val)}" 
                         data-user="${user}" data-date="${isoDate}" 
                         data-pedido="${isPedido}" data-debido="${debidoVal}"
                         data-shift="${val || ''}">
                         ${val || ''}
                         ${isPedido ? '<span class="shift-marker-pedido">P</span>' : ''}
                         ${debidoVal !== 0 ? `<span class="shift-marker-debido" ${debidoVal < 0 ? 'style="background-color: #636e72 !important;"' : ''}>D</span>` : ''}
                    </div>`;
                
                td.onclick = (e) => {
                    if (this.isEditing) {
                        this.handleCellClick(td.querySelector('.shift-cell'));
                    }
                };
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    },

    /**
     * RENDERIZAR VISTA ANUAL
     */
    renderAnnualView() {
        const container = document.getElementById('annual-heatmap-container');
        const userFilter = document.getElementById('selectAnualUser')?.value || 'all';
        const year = parseInt(document.getElementById('selectAnualYear')?.value || new Date().getFullYear());
        
        if (!container) return;
        container.innerHTML = '';

        const usersToRender = userFilter === 'all' ? this.receptionists : [userFilter];
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        usersToRender.forEach(user => {
            const userSection = document.createElement('div');
            userSection.className = 'user-annual-section mb-4 p-3 border rounded shadow-sm bg-white';
            userSection.dataset.user = user;
            userSection.draggable = true;
            userSection.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="fw-bold mb-0"><i class="bi bi-grip-vertical me-2 text-muted"></i>${user}</h6>
                    <span class="badge bg-light text-muted small">Arrastra para reordenar</span>
                </div>
            `;
            
            const monthGrid = document.createElement('div');
            monthGrid.className = 'd-flex flex-wrap gap-2';

            months.forEach((mName, mIdx) => {
                const mDiv = document.createElement('div');
                mDiv.className = 'month-box border p-1 rounded bg-light';
                mDiv.style.width = 'calc(25% - 8px)'; // 4 columns
                mDiv.style.minWidth = '220px';
                
                let daysHtml = `<div class="small fw-bold border-bottom mb-1 text-center">${mName}</div><div class="d-flex flex-wrap gap-1" style="font-size: 8px;">`;
                
                const daysInMonth = new Date(year, mIdx + 1, 0).getDate();
                for (let d = 1; d <= daysInMonth; d++) {
                    const isoDate = `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const shift = this.shifts.find(s => s.usuario === user && s.fecha === isoDate);
                    const colorClass = this.getShiftClass(shift?.tipo_turno);
                    const isPedido = shift?.es_pedido || false;
                    const isDebido = shift?.es_debido || false;

                    daysHtml += `<div class="day-dot ${colorClass} position-relative" title="${isoDate}: ${shift?.tipo_turno || 'Libre'}" 
                                  style="width:12px; height:12px; border-radius:2px; cursor:pointer;">
                                  ${isPedido ? '<div style="position:absolute; top:-2px; right:-2px; width:4px; height:4px; background:blue; border-radius:50%"></div>' : ''}
                                  ${isDebido ? '<div style="position:absolute; bottom:-2px; left:-2px; width:4px; height:4px; background:red; border-radius:50%"></div>' : ''}
                                  </div>`;
                }
                daysHtml += `</div>`;
                mDiv.innerHTML = daysHtml;
                monthGrid.appendChild(mDiv);
            });
            
            userSection.appendChild(monthGrid);
            container.appendChild(userSection);
        });
        
        Utils.setHtml('labelAnualYear', year);
    },

    /**
     * PROPAGACIÓN DE CELDAS (DRAG TO FILL)
     */
    isDragging: false,
    dragStartCell: null,

    setupDragPropagation() {
        const container = document.getElementById('turnosTableBody');
        if (!container) return;

        container.addEventListener('mousedown', (e) => {
            if (!this.isEditing) return;
            const cell = e.target.closest('.shift-cell');
            if (cell) {
                this.isDragging = true;
                this.dragStartCell = cell;
                cell.classList.add('drag-origin');
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                document.querySelectorAll('.shift-cell').forEach(c => c.classList.remove('drag-origin', 'drag-target'));
            }
        });

        container.addEventListener('mouseover', (e) => {
            if (!this.isDragging || !this.dragStartCell) return;
            const cell = e.target.closest('.shift-cell');
            if (cell && cell !== this.dragStartCell && !cell.classList.contains('drag-target')) {
                // Propagate value from start cell to this cell
                // PREVENCIÓN: Usamos el dataset para no arrastrar la 'P' o 'D' de los marcadores
                const val = this.dragStartCell.dataset.shift || ''; 
                this.updateCell(cell, val);
                cell.classList.add('drag-target');
            }
        });
    },

    /**
     * RENDERIZAR ESTADÍSTICAS
     */
    renderStats() {
        const stats = this.calculateStats();
        this.renderStatsTable(stats.users);
        this.renderStatsCharts(stats);
    },

    /**
     * CÁLCULO DE ESTADÍSTICAS GRANULARES
     */
    calculateStats() {
        const stats = {
            users: {},
            weekdays: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
            currentUser: (window.sessionService || { getUser: () => '---' }).getUser(),
            currentYear: new Date().getFullYear()
        };

        this.shifts.forEach(s => {
            const date = new Date(s.fecha);
            const isYTD = date.getFullYear() === stats.currentYear;
            const weekday = date.getDay();
            const user = s.usuario;
            const type = s.tipo_turno ? s.tipo_turno.trim().toLowerCase() : '';

            if (!stats.users[user]) {
                stats.users[user] = {
                    mananas: 0, tardes: 0, noches: 0, libres: 0, 
                    especial: 0, extra: 0, reservas: 0, // Added reservas
                    partidos: 0, vacaciones: 0, baja: 0,
                    pedidos: 0, debidos: 0,
                    trabajadoYTD: 0, trabajadoTotal: 0,
                    ytd: 0, total: 0,
                    wdays: [0, 0, 0, 0, 0, 0, 0] // Dom-Sab
                };
            }

            const u = stats.users[user];
            u.total++;
            if (isYTD) u.ytd++;

            if (type === 'mañana') u.mananas++;
            else if (type === 'tarde') u.tardes++;
            else if (type === 'noche') u.noches++;
            else if (type === 'libre') u.libres++;
            else if (type === 'horario partido' || type === 'h. partido') u.partidos++;
            else if (type === 'vacaciones') u.vacaciones++;
            else if (type === 'baja') u.baja++;
            else if (type === 'extra') u.extra++;
            else if (type === 'reservas') u.reservas++; // Handle reservas explicitly
            else if (type === 'especial') u.especial++;
            else if (type) u.especial++;

            if (s.es_pedido) u.pedidos++;
            
            // Balance de días debidos (sumamos numéricamente)
            if (s.es_debido !== undefined) {
                const valDeb = parseInt(s.es_debido);
                if (!isNaN(valDeb)) u.debidos += valDeb;
                else if (s.es_debido === true) u.debidos += 1; // Compatibilidad legacy
            }

            // Días trabajados (M, T, N, P, E, Esp, Reservas)
            const workTypes = ['mañana', 'tarde', 'noche', 'horario partido', 'h. partido', 'extra', 'especial', 'reservas']; // Added 'reservas'
            if (workTypes.includes(type)) {
                u.trabajadoTotal++;
                if (isYTD) u.trabajadoYTD++;
                u.wdays[weekday]++;
            }
        });

        return stats;
    },

    renderStatsTable(userStats) {
        const tbody = document.getElementById('statsTableBody');
        if (!tbody) return;
        
        // Convert to array for sorting
        let dataArray = Object.entries(userStats).map(([user, data]) => ({ user, ...data }));
        
        // Sorting logic
        dataArray.sort((a, b) => {
            let valA = a[this.sortConfig.column];
            let valB = b[this.sortConfig.column];
            
            if (typeof valA === 'string') {
                return this.sortConfig.direction === 'asc' 
                    ? valA.localeCompare(valB) 
                    : valB.localeCompare(valA);
            } else {
                return this.sortConfig.direction === 'asc' 
                    ? valA - valB 
                    : valB - valA;
            }
        });

        tbody.innerHTML = '';
        dataArray.forEach((data) => {
            const user = data.user;
            const tr = document.createElement('tr');
            const currentUser = (window.sessionService || { getUser: () => '---' }).getUser();
            const isMe = user === currentUser;
            if (isMe) tr.className = 'table-primary-subtle';

            tr.innerHTML = `
            <td class="ps-4 fw-bold ${isMe ? 'text-primary' : ''}">${user} ${isMe ? '<small class="badge bg-primary ms-1">Tú</small>' : ''}</td>
            <td><span class="badge shift-manana px-2 py-1">${data.mananas}</span></td>
            <td><span class="badge shift-tarde px-2 py-1">${data.tardes}</span></td>
            <td><span class="badge shift-noche px-2 py-1">${data.noches}</span></td>
            <td><span class="badge shift-partido px-2 py-1">${data.partidos}</span></td>
            <td><span class="badge shift-extra px-2 py-1">${data.extra}</span></td>
            <td><span class="badge shift-especial px-2 py-1">${data.especial}</span></td>
            <td><span class="badge shift-reservas px-2 py-1">${data.reservas}</span></td>
            <td><span class="badge shift-libre px-2 py-1 text-dark">${data.libres}</span></td>
            <td><span class="badge shift-vacaciones px-2 py-1">${data.vacaciones}</span></td>
            <td><span class="badge shift-baja px-2 py-1">${data.baja}</span></td>
            <td class="fw-bold text-primary">${data.trabajadoYTD}</td>
            <td><span class="badge bg-primary px-2 py-1">${data.pedidos}</span></td>
            <td class="fw-bold ${data.debidos < 0 ? 'text-danger' : (data.debidos > 0 ? 'text-success' : 'text-muted')}">${data.debidos > 0 ? '+' : ''}${data.debidos}</td>
            <td class="fw-bold text-success">${data.ytd}</td>
            <td class="text-end pe-4 text-muted small">${data.total}</td>
        `;
            tbody.appendChild(tr);
        });

        this.setupTableSorting();
        if (window.Ui && Ui.initTooltips) Ui.initTooltips();
    },

    setupTableSorting() {
        const headers = document.querySelectorAll('#view-stats th[data-sort]');
        headers.forEach(th => {
            th.onclick = () => {
                const col = th.dataset.sort;
                if (this.sortConfig.column === col) {
                    this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortConfig.column = col;
                    this.sortConfig.direction = 'asc';
                }
                
                // Update icons
                headers.forEach(h => {
                    const icon = h.querySelector('i');
                    if (icon) icon.remove();
                });
                const icon = document.createElement('i');
                icon.className = `bi bi-sort-${this.sortConfig.direction === 'asc' ? 'down' : 'up'} small ms-1 text-primary`;
                th.appendChild(icon);
                
                this.renderStats();
            };
        });
    },

    renderStatsCharts(stats) {
        if (typeof Chart === 'undefined') return;

        const users = Object.keys(stats.users);
        const data = Object.values(stats.users);

        // 1. Chart Comparativo de Turnos (Grouped Bars)
        const ctxP = document.getElementById('chartTurnosPersona')?.getContext('2d');
        if (ctxP) {
            if (this.charts.persona) this.charts.persona.destroy();
            this.charts.persona = new Chart(ctxP, {
                type: 'bar',
                data: {
                    labels: users,
                    datasets: [
                        { label: 'Mañanas', data: data.map(u => u.mananas), backgroundColor: '#ffd93d' },
                        { label: 'Tardes', data: data.map(u => u.tardes), backgroundColor: '#6bc1ff' },
                        { label: 'Noches', data: data.map(u => u.noches), backgroundColor: '#4d089a' },
                        { label: 'Partidos', data: data.map(u => u.partidos), backgroundColor: '#ff9f43' }
                    ]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { 
                        title: { display: true, text: 'Comparativa de Turnos por Persona' }
                    }
                }
            });
        }

        // 2. Chart Comparativo de Días de la Semana (Grouped Bars)
        const ctxS = document.getElementById('chartTurnosSemana')?.getContext('2d');
        if (ctxS) {
            if (this.charts.semana) this.charts.semana.destroy();
            const daysShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            
            // Creamos un dataset por cada usuario para comparar
            const datasets = users.map((user, idx) => ({
                label: user,
                data: stats.users[user].wdays,
                backgroundColor: this.getChartColor(idx, 0.7),
                borderColor: this.getChartColor(idx, 1),
                borderWidth: 1
            }));

            this.charts.semana = new Chart(ctxS, {
                type: 'bar',
                data: {
                    labels: daysShort,
                    datasets: datasets
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
                        title: { display: true, text: '¿Quién trabaja cada día? (Sábados, etc.)' }
                    },
                    scales: {
                        y: { beginAtZero: true, ticks: { Math: 0 } }
                    }
                }
            });
        }
    },

    getChartColor(idx, alpha = 1) {
        const colors = [
            `rgba(13, 110, 253, ${alpha})`, // Blue
            `rgba(102, 16, 242, ${alpha})`, // Indigo
            `rgba(111, 66, 193, ${alpha})`, // Purple
            `rgba(214, 33, 106, ${alpha})`, // Pink
            `rgba(220, 53, 69, ${alpha})`,  // Red
            `rgba(253, 126, 20, ${alpha})`, // Orange
            `rgba(255, 193, 7, ${alpha})`,  // Yellow
            `rgba(25, 135, 84, ${alpha})`,  // Green
            `rgba(32, 201, 151, ${alpha})`, // Teal
            `rgba(13, 202, 240, ${alpha})`  // Cyan
        ];
        return colors[idx % colors.length];
    },

    /**
     * DIFUNDIR SEMANA (CAPTURA DE PANTALLA)
     */
    async difundirSemana() {
        const target = document.querySelector('.turnos-table').closest('.card');
        if (!target) return;

        Ui.showToast("Generando imagen de difusión...", "info");

        try {
            // Cargar html2canvas dinámicamente si no está
            if (typeof html2canvas === 'undefined') {
                await Utils.loadScript('https://html2canvas.hertzen.com/dist/html2canvas.min.js');
            }

            // Preparar para la captura (quitar scrolls, sombras pesadas momentáneamente)
            const canvas = await html2canvas(target, {
                scale: 2, // Mayor calidad
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc) => {
                   const c = clonedDoc.querySelector('.turnos-table').closest('.card');
                   // Limpiar elementos que no queremos en la foto
                   clonedDoc.querySelectorAll('.no-print, .btn, .bi-pencil-fill, .bi-grip-vertical').forEach(el => el.style.display = 'none');
                   if (c) c.style.boxShadow = 'none';
                }
            });

            // Convertir a blob y compartir/descargar
            canvas.toBlob(async (blob) => {
                const date = new Date(this.currentDate);
                const weekNum = Utils.getWeekNumber(date);
                const year = date.getFullYear();
                const fileName = `Turnos_Semana_${weekNum}_${year}.png`;

                try {
                    const data = [new ClipboardItem({ [blob.type]: blob })];
                    await navigator.clipboard.write(data);
                    Ui.showToast("¡Copiado al portapapeles! Ya puedes pegarlo.", "success");
                    return;
                } catch (clipErr) {
                    console.warn("Clipboard failed, falling back to share/download:", clipErr);
                }

                try {
                    if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: 'image/png' })] })) {
                        await navigator.share({
                            files: [new File([blob], fileName, { type: 'image/png' })],
                            title: `Turnos Recepción - Semana ${weekNum}`,
                            text: `Aquí tenéis los turnos de la semana ${weekNum} (${year})`
                        });
                        return;
                    }
                } catch (shareErr) {
                    console.warn("Share failed:", shareErr);
                }

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
                Ui.showToast("Imagen generada y descargada.", "success");
                });
        } catch (error) {
            Ui.showToast("No se pudo generar la imagen. Inténtalo de nuevo.", "danger");
        } finally {
            Ui.hideLoading();
        }
    },

    /**
     * HELPERS UI
     */
    getWeekRange() {
        const curr = new Date(this.currentDate);
        const day = curr.getDay();
        const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
        const mon = new Date(curr.setDate(diff));
        return Array.from({length: 7}, (_, i) => {
            const d = new Date(mon);
            d.setDate(mon.getDate() + i);
            return d;
        });
    },

    getShiftClass(shift) {
        if (!shift) return 'shift-none';
        const s = String(shift).trim().toLowerCase();
        const map = {
            'mañana': 'shift-manana', 'tarde': 'shift-tarde', 'noche': 'shift-noche',
            'libre': 'shift-libre', 'vacaciones': 'shift-vacaciones', 'baja': 'shift-baja',
            'horario partido': 'shift-partido', 'h. partido': 'shift-partido',
            'extra': 'shift-extra', 'especial': 'shift-especial', 'reservas': 'shift-reservas'
        };
        return map[s] || 'shift-none';
    },

    handleCellClick(el) {
        if (!this.isEditing) return;
        this.selectedCell = el;
        
        // Sincronizar inputs del modal con el estado actual de la celda
        const isPedido = el.dataset.pedido === 'true';
        const debidoVal = parseInt(el.dataset.debido || '0');
        
        const checkPedido = document.getElementById('checkShiftPedido');
        if (checkPedido) checkPedido.checked = isPedido;

        document.querySelectorAll('input[name="debidoType"]').forEach(r => {
            const val = parseInt(r.value);
            r.checked = (val === debidoVal);
            r.dataset.wasChecked = (val === debidoVal) ? "true" : "false";
        });

        this.showModal('shiftSelectorModal');
    },
    updateCell(el, val, isPedidoInput = null, debidoInput = null) {
        if (!el) return;
        
        // Confiar 100% en los inputs del modal si no se pasan parámetros
        const isPedido = isPedidoInput !== null ? isPedidoInput : (document.getElementById('checkShiftPedido')?.checked || false);
        const selectedDebido = document.querySelector('input[name="debidoType"]:checked');
        const debidoVal = debidoInput !== null ? debidoInput : (selectedDebido ? parseInt(selectedDebido.value) : 0);

        // Guardar valores anteriores para detectar cambios
        const oldShift = el.dataset.shift || '';
        const oldPedido = el.dataset.pedido === 'true';
        const oldDebido = parseInt(el.dataset.debido || '0');

        // Actualizar dataset
        el.dataset.pedido = isPedido;
        el.dataset.debido = debidoVal;
        el.dataset.shift = val || ''; 
        el.innerText = val || '';
        el.className = `shift-cell ${this.getShiftClass(val)}`;
        
        // Limpiar marcadores previos
        el.querySelectorAll('.shift-marker-pedido, .shift-marker-debido').forEach(m => m.remove());

        // Renderizar nuevos marcadores
        if (isPedido) {
            const spanP = document.createElement('span');
            spanP.className = 'shift-marker-pedido';
            spanP.innerText = 'P';
            el.appendChild(spanP);
        }
        if (debidoVal !== 0) {
            const spanD = document.createElement('span');
            spanD.className = 'shift-marker-debido';
            if (debidoVal < 0) {
                spanD.style.setProperty('background-color', '#ff4d4d', 'important'); // Rojo más vivo para deudas
                spanD.innerText = '-1';
            } else {
                spanD.style.setProperty('background-color', '#27ae60', 'important'); // Verde para me deben
                spanD.innerText = '+1';
            }
            el.appendChild(spanD);
        }

        // Detectar cambios
        const hasShiftChanged = (oldShift !== (val || ''));
        const hasFlagsChanged = (oldPedido !== isPedido) || (oldDebido !== debidoVal);
        const safeOld = oldShift;
        const safeNew = val || '';

        if (hasShiftChanged || hasFlagsChanged) {
            if (safeNew || safeOld) {
                el.classList.add('bg-warning-subtle');
                
                // SINCRONIZAREMOS EN MEMORIA PARA ESTADÍSTICAS EN TIEMPO REAL
                const { user, date } = el.dataset;
                const idx = this.shifts.findIndex(s => s.usuario === user && s.fecha === date);
                if (idx !== -1) {
                    this.shifts[idx].tipo_turno = val;
                    this.shifts[idx].es_pedido = isPedido;
                    this.shifts[idx].es_debido = debidoVal;
                } else {
                    this.shifts.push({
                        usuario: user, fecha: date, tipo_turno: val,
                        es_pedido: isPedido, es_debido: debidoVal
                    });
                }

                // Actualizar estadísticas en tiempo real (saldo de días, etc.)
                this.renderStats();
            }
        }
    },

    /**
     * ACCIONES (PIN Protected)
     */
    async handleEditRequest() {
        const input = document.getElementById('inputPinTurnos');
        const error = document.getElementById('pin-error-turnos');
        
        if (input) input.value = '';
        if (error) error.classList.add('d-none');
        
        this.showModal('modalPinTurnos');
        setTimeout(() => input?.focus(), 500);
    },

    verifyPin() {
        const input = document.getElementById('inputPinTurnos');
        const error = document.getElementById('pin-error-turnos');
        const pin = input?.value;
        const correctPin = String(APP_CONFIG.SYSTEM?.ADMIN_PASSWORD || "1234");
        
        if (pin === correctPin) {
            this.isEditing = true;
            this.updateActionButtons();
            this.hideModal('modalPinTurnos');
            Ui.showToast("Modo edición activado", "info");
        } else {
            error?.classList.remove('d-none');
            if (input) { input.value = ''; input.focus(); }
        }
    },

    /**
     * MODAL HELPERS (Fix for UI Freeze)
     */
    showModal(id) {
        const el = document.getElementById(id);
        if (!el) return;
        
        // Ensure no previous backdrop remains
        this.hideModal(id);
        
        const inst = new bootstrap.Modal(el);
        this.modals[id] = inst;
        inst.show();
    },

    hideModal(id) {
        const el = document.getElementById(id);
        if (!el) return;
        
        const inst = bootstrap.Modal.getInstance(el) || this.modals[id];
        if (inst) {
            inst.hide();
            // Cleanup backdrop manually if BS fails
            setTimeout(() => {
                const backdrops = document.querySelectorAll('.modal-backdrop');
                if (backdrops.length > 0) {
                    backdrops.forEach(b => b.remove());
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = '';
                    document.body.style.paddingRight = '';
                }
            }, 500);
        }
    },

    updateActionButtons() {
        const btnEdit = document.getElementById('btnEditTurnos');
        const btnSave = document.getElementById('btnSaveTurnos');
        const btnCancel = document.getElementById('btnCancelEdit');
        const btnAuto = document.getElementById('btnAutoAssign');
        const btnReload = document.getElementById('btnReloadTurnos');
        const btnManage = document.getElementById('btnManageUsers');
        const infoLabel = document.getElementById('edit-info-label');

        // Solo visibles en vista 'cuadrante'
        const isCuadrante = this.currentView === 'cuadrante';
        
        if (btnEdit) btnEdit.classList.toggle('d-none', !isCuadrante || this.isEditing);
        if (btnSave) btnSave.classList.toggle('d-none', !isCuadrante || !this.isEditing);
        if (btnCancel) btnCancel.classList.toggle('d-none', !isCuadrante || !this.isEditing);
        if (btnAuto) btnAuto.classList.toggle('d-none', !isCuadrante || !this.isEditing);
        if (btnManage) btnManage.classList.toggle('d-none', !isCuadrante || !this.isEditing);
        if (btnReload) btnReload.classList.toggle('d-none', !isCuadrante);
        if (infoLabel) infoLabel.classList.toggle('d-none', !isCuadrante || this.isEditing);

        document.querySelectorAll('.shift-cell').forEach(c => {
            c.style.border = (this.isEditing && isCuadrante) ? '2px dashed #4a69bd' : 'none';
        });
    },

    cancelEdit() {
        this.isEditing = false;
        this.updateActionButtons();
        this.render();
    },

    async saveChanges() {
        try {
            const modified = document.querySelectorAll('.shift-cell.bg-warning-subtle');
            if (modified.length === 0) return this.cancelEdit();

            const newSet = [...this.shifts];
            modified.forEach(el => {
                const { user, date, pedido } = el.dataset;
                const debidoVal = parseInt(el.dataset.debido || '0');
                const val = (el.innerText || '').trim();
                const isPedido = pedido === 'true';
                const isDebido = debidoVal;
                const idx = newSet.findIndex(s => s.usuario === user && s.fecha === date);
                
                if (idx !== -1) {
                    if (val || isPedido || isDebido !== 0) {
                        newSet[idx].tipo_turno = val;
                        newSet[idx].es_pedido = isPedido;
                        newSet[idx].es_debido = isDebido;
                    } else newSet.splice(idx, 1);
                } else if (val || isPedido || isDebido !== 0) {
                    newSet.push({ 
                        usuario: user, 
                        fecha: date, 
                        tipo_turno: val,
                        es_pedido: isPedido,
                        es_debido: isDebido
                    });
                }
            });

            await Api.post('storage/turnos_empleados', newSet);
            this.shifts = newSet;
            this.cancelEdit();
            Ui.showToast("Cambios guardados", "success");
        } catch (e) {
            console.error(e);
            Ui.showToast("Error al guardar", "danger");
        }
    },

    /**
     * ZOOM DE GRÁFICAS
     */
    zoomChart(originalChartId, title) {
        const originalChart = this.charts[originalChartId === 'chartTurnosPersona' ? 'persona' : 'semana'];
        if (!originalChart) return;

        this.showModal('modalZoomChart');
        Utils.setHtml('zoomChartTitle', title);

        const ctxZ = document.getElementById('zoomChartCanvas').getContext('2d');
        if (this.charts.zoom) this.charts.zoom.destroy();

        this.charts.zoom = new Chart(ctxZ, {
            type: originalChart.config.type,
            data: JSON.parse(JSON.stringify(originalChart.config.data)),
            options: {
                ...originalChart.config.options,
                maintainAspectRatio: false,
                responsive: true,
                plugins: {
                    ...originalChart.config.options.plugins,
                    legend: { display: true, position: 'bottom' }
                }
            }
        });
    },

    /**
     * IMPRESIÓN DEL MÓDULO
     */
    /**
     * AUTO-ASIGNACIÓN DE TURNOS
     */
    /**
     * AUTO-ASIGNACIÓN DINÁMICA DE TURNOS
     * Implementa un sistema de pesos y variabilidad para evitar cuadrantes repetitivos.
     */
    autoAssignWeek() {
        if (!this.isEditing) return;
        
        console.log("[Algo] Iniciando auto-asignación dinámica (Regla 3-2-2)...");

        // Configuración de la Regla: 2 Mañanas, 2 Tardes, 2 Noches, 1 Reservas diarios
        const shiftsToManage = ['Mañana', 'Mañana', 'Tarde', 'Tarde', 'Noche', 'Noche', 'Reservas'];
        const weekDates = this.getWeekRange().map(d => Utils.parseDate(d));
        const stats = this.calculateStats();
        
        // Clonamos turnos actuales para simular
        let localShifts = JSON.parse(JSON.stringify(this.shifts));
        
        // Sincronizamos con el estado real del DOM (cambios manuales en vivo)
        document.querySelectorAll('.shift-cell').forEach(cell => {
            const { user, date } = cell.dataset;
            const type = (cell.dataset.shift || '').trim();
            if (!type) return;
            const idx = localShifts.findIndex(s => s.usuario === user && s.fecha === date);
            if (idx !== -1) localShifts[idx].tipo_turno = type;
            else localShifts.push({ usuario: user, fecha: date, tipo_turno: type, es_pedido: cell.dataset.pedido === 'true', es_debido: parseInt(cell.dataset.debido || '0') });
        });

        const modifiedCells = [];

        // Iteramos día por día de la semana
        weekDates.forEach((date, dIdx) => {
            const dayShifts = localShifts.filter(s => s.fecha === date);
            
            // 1. Identificar qué turnos de la regla faltan por cubrir hoy
            const missingShifts = [...shiftsToManage];
            dayShifts.forEach(s => {
                const idx = missingShifts.findIndex(ms => ms.toLowerCase() === s.tipo_turno.toLowerCase());
                if (idx !== -1) missingShifts.splice(idx, 1);
            });
            
            // 2. Candidatos que no tienen turno hoy ni están marcados como 'Libre' manualmente
            let candidates = this.receptionists.filter(u => {
                const hasShiftToday = dayShifts.some(s => s.usuario === u);
                const cell = document.querySelector(`.shift-cell[data-user="${u}"][data-date="${date}"]`);
                const isManuallyFree = cell && (cell.dataset.shift || '').trim().toLowerCase() === 'libre';
                return !hasShiftToday && !isManuallyFree;
            });

            // 3. Asignación de turnos faltantes usando sistema de pesos
            missingShifts.forEach(shiftType => {
                if (candidates.length === 0) return;

                // Calculamos puntuación para cada candidato (Menor puntuación = Mejor candidato para TRABAJAR)
                const scoredCandidates = candidates.map(user => {
                    const uStats = stats.users[user] || { trabajadoYTD: 0, wdays: [] };
                    const specificCount = uStats[this.getStatKey(shiftType)] || 0;
                    
                    // Peso 1: Total trabajado en el año (Balancear carga global)
                    const workloadScore = uStats.trabajadoYTD * 1.2;
                    
                    // Peso 2: Cuántos turnos de este tipo específico ha hecho (Variedad)
                    const varietyScore = specificCount * 2.5; 
                    
                    // Peso 3: Descanso consecutivo. Si ayer libró, penalizamos para TRABAJAR hoy (buscar bloques de 2 días libres)
                    let consecutiveRestPenalty = 0;
                    const prevDate = new Date(date);
                    prevDate.setDate(prevDate.getDate() - 1);
                    const prevDateStr = Utils.parseDate(prevDate);
                    const yShift = localShifts.find(s => s.usuario === user && s.fecha === prevDateStr);
                    
                    if (yShift && (yShift.tipo_turno.toLowerCase() === 'libre' || yShift.tipo_turno.toLowerCase() === 'vacaciones')) {
                        consecutiveRestPenalty = 15; // Gran penalización para interrumpir un descanso
                    }

                    // Peso 4: Penalización por repetitividad (Variety Fix)
                    // Si ayer hizo el MISMO turno, penalizamos para que cambie hoy
                    let repetitivePenalty = 0;
                    if (yShift && yShift.tipo_turno.toLowerCase() === shiftType.toLowerCase()) {
                        repetitivePenalty = 20; // Penalización fuerte para evitar "toda la semana de mañana"
                    }

                    // Peso 5: Variabilidad Aleatoria (Aumentada para más movimiento)
                    const jitter = Math.random() * 15;

                    // Peso 6: Balance semanal (evitar que uno trabaje 6 días y otro 2)
                    const daysWorkedThisWeek = weekDates.slice(0, dIdx).filter(wd => {
                        const s = localShifts.find(ls => ls.usuario === user && ls.fecha === wd);
                        return s && s.tipo_turno.toLowerCase() !== 'libre' && s.tipo_turno.toLowerCase() !== 'vacaciones';
                    }).length;
                    const weekBalanceScore = daysWorkedThisWeek * 8;

                    return {
                        user,
                        score: workloadScore + varietyScore + consecutiveRestPenalty + repetitivePenalty + jitter + weekBalanceScore
                    };
                });

                // Ordenar por puntuación (ascendente)
                scoredCandidates.sort((a, b) => a.score - b.score);

                // Filtrar por restricciones críticas (Ej: Tarde -> Mañana)
                let bestCandidate = null;
                for (let candObj of scoredCandidates) {
                    let failConstraint = false;
                    const cand = candObj.user;

                    if (shiftType === 'Mañana') {
                        const prevDate = new Date(date);
                        prevDate.setDate(prevDate.getDate() - 1);
                        const prevDateStr = Utils.parseDate(prevDate);
                        const prevShift = localShifts.find(s => s.usuario === cand && s.fecha === prevDateStr);
                        if (prevShift?.tipo_turno.toLowerCase().includes('tarde')) failConstraint = true;
                    }

                    if (!failConstraint) {
                        bestCandidate = cand;
                        break;
                    }
                }

                // Si nadie cumple el ideal, el que tenga menos peso
                if (!bestCandidate) bestCandidate = scoredCandidates[0].user;

                // Ejecutar asignación
                localShifts.push({ usuario: bestCandidate, fecha: date, tipo_turno: shiftType });
                modifiedCells.push({ user: bestCandidate, date: date, val: shiftType });
                
                // Actualizar listas para el siguiente turno del mismo día
                candidates = candidates.filter(u => u !== bestCandidate);
                dayShifts.push({ usuario: bestCandidate, fecha: date, tipo_turno: shiftType });
            });

            // 4. Los que sobran se marcan como 'Libre' si no tenían nada
            candidates.forEach(u => {
                const existing = localShifts.find(s => s.usuario === u && s.fecha === date);
                if (!existing) {
                    localShifts.push({ usuario: u, fecha: date, tipo_turno: 'Libre' });
                    modifiedCells.push({ user: u, date: date, val: 'Libre' });
                }
            });
        });

        // 5. Aplicar cambios visuales al DOM
        let fillCount = 0;
        modifiedCells.forEach(change => {
            const cell = document.querySelector(`.shift-cell[data-user="${change.user}"][data-date="${change.date}"]`);
            if (cell) {
                const currentVal = (cell.dataset.shift || '').trim();
                if (!currentVal || currentVal.toLowerCase() === 'libre') {
                    // Evitamos sobrescribir un 'Libre' con otro 'Libre' innecesariamente para no manchar de amarillo
                    if (currentVal.toLowerCase() === 'libre' && change.val.toLowerCase() === 'libre') return;
                    
                    this.updateCell(cell, change.val);
                    fillCount++;
                }
            }
        });

        if (fillCount > 0) {
            Ui.showToast(`Se han auto-asignado ${fillCount} turnos variados.`, "info");
            this.renderStatsTable(this.calculateStats()); // FIX CRASH: llama a renderStatsTable
        } else {
            Ui.showToast("No se encontraron huecos para auto-asignar.", "warning");
        }
    },

    getStatKey(type) {
        if (type === 'Mañana') return 'mananas';
        if (type === 'Tarde') return 'tardes';
        if (type === 'Noche') return 'noches';
        if (type === 'Reservas') return 'reservas';
        return 'especial';
    },

    getWeekRange() {
        const d = new Date(this.currentDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const start = new Date(d.setDate(diff));
        const week = [];
        for (let i = 0; i < 7; i++) {
            week.push(new Date(start));
            start.setDate(start.getDate() + 1);
        }
        return week;
    },

    getCurrentWeekDates() {
        return this.getWeekRange();
    },

    async imprimirTurnos() {
        if (!window.PrintService) {
            window.print();
            return;
        }

        const title = `Cuadrante de Turnos - ${this.currentView.toUpperCase()}`;
        let elementId = '';
        switch(this.currentView) {
            case 'mensual': elementId = 'view-mensual'; break;
            case 'anual': elementId = 'view-anual'; break;
            case 'estadisticas': elementId = 'view-stats'; break;
            default: elementId = 'view-cuadrante'; break;
        }

        const element = document.getElementById(elementId);
        if (!element) return;

        Ui.showToast("Generando vista de impresión...", "info");
        
        // 1. Capturar elemento como imagen para máxima fidelidad
        const imgData = await PrintService.captureElement(element);
        if (!imgData) return;

        // 2. Obtener datos de sesión para cabecera standard
        const session = window.sessionService || null;
        const user = session ? session.getUser() : null;
        const userName = user ? (typeof user === 'string' ? user : (user.nombre || user.usuario)) : "---";
        const dateStr = new Date().toLocaleDateString('es-ES', { 
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' 
        });

        // 3. Construir HTML con cabecera standard
        const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <link href="assets/vendor/bootstrap.min.css" rel="stylesheet" />
            <link rel="stylesheet" href="assets/vendor/bootstrap-icons.css" />
            <link rel="stylesheet" href="assets/css/styles.css" />
            <style>
                @page { margin: 10mm; size: A4 landscape; }
                body { 
                    font-family: 'Inter', sans-serif; 
                    margin: 0; padding: 20px; 
                    background: #fff; 
                    color: #333;
                }
                .print-header { 
                    border-bottom: 2px solid #0d6efd; 
                    margin-bottom: 20px; 
                    padding-bottom: 10px; 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: flex-end; 
                }
                .print-header h1 { margin: 0; font-size: 18pt; color: #0d6efd; text-transform: uppercase; }
                .print-header .meta { font-size: 9pt; text-align: right; color: #555; }
                
                .print-main-img {
                    width: 100%;
                    max-height: calc(100vh - 120px);
                    object-fit: contain;
                    display: block;
                    margin: 0 auto;
                    border: 1px solid #eee;
                }
                
                .print-footer {
                    margin-top: 20px;
                    font-size: 8pt;
                    color: #999;
                    text-align: center;
                    border-top: 1px solid #eee;
                    padding-top: 10px;
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <div>
                    <h1>${title}</h1>
                    <div style="font-size: 10pt; color: #777;">Reception Suite - Gestión de Personal</div>
                </div>
                <div class="meta">
                    <div>Impreso: ${dateStr}</div>
                    <div>Por: ${userName}</div>
                </div>
            </div>

            <div class="print-content">
                <img src="${imgData}" class="print-main-img" />
            </div>
            
            <div class="print-footer">
                Documento generado por Reception Suite • Sistema Integral de Gestión Hotelera
            </div>
        </body>
        </html>
        `;

        PrintService.printHTML(html);
    },
    /**
     * GESTIÓN DE PERSONAL DINÁMICA
     */
    abrirGestionPersonal() {
        this.renderReceptionistList();
        this.showModal('modalManageUsers');
    },

    renderReceptionistList() {
        const container = document.getElementById('receptionist-list-container');
        if (!container) return;
        container.innerHTML = '';
        
        this.receptionists.forEach(name => {
            const item = document.createElement('div');
            item.className = 'list-group-item d-flex justify-content-between align-items-center py-2';
            item.innerHTML = `
                <span>${name}</span>
                <button class="btn btn-sm btn-outline-danger border-0" onclick="TurnosManager.eliminarRecepcionista('${name}')">
                    <i class="bi bi-trash"></i>
                </button>
            `;
            container.appendChild(item);
        });
    },

    async añadirRecepcionista() {
        const input = document.getElementById('inputNewReceptionist');
        const name = input?.value?.trim();
        if (!name) return;
        
        if (this.receptionists.includes(name)) {
            return Ui.showToast("Esta persona ya está en la lista", "warning");
        }
        
        this.receptionists.push(name);
        await this.persistirConfiguracionPersonal();
        
        input.value = '';
        this.renderReceptionistList();
        this.render(); // Redibujar cuadrante para ver la nueva fila
        Ui.showToast(`Añadido: ${name}`, "success");
    },

    async eliminarRecepcionista(name) {
        if (!await Ui.showConfirm(`¿Estás seguro de eliminar a ${name} del cuadrante? No se borrarán sus turnos pasados, pero no aparecerá en el futuro.`)) return;
        
        this.receptionists = this.receptionists.filter(n => n !== name);
        await this.persistirConfiguracionPersonal();
        
        this.renderReceptionistList();
        this.render();
        Ui.showToast(`Eliminado: ${name}`, "info");
    },

    async persistirConfiguracionPersonal() {
        try {
            // Obtener config actual, actualizar solo recepccionistas
            const config = await Api.get('storage/config') || {};
            if (!config.HOTEL) config.HOTEL = {};
            config.HOTEL.RECEPCIONISTAS = this.receptionists;
            
            await Api.post('storage/config', config);
            // Actualizar APP_CONFIG global para que otros módulos lo vean
            if (window.APP_CONFIG) window.APP_CONFIG.HOTEL.RECEPCIONISTAS = this.receptionists;
        } catch (e) {
            console.error("Error al persistir personal:", e);
            Ui.showToast("Error al guardar cambios de personal", "danger");
        }
    }
};

window.TurnosManager = TurnosManager;
