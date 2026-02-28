import { APP_CONFIG } from "../core/Config.js?v=V153_DB_CONFIG";
import { Utils } from '../core/Utils.js';
import { Ui } from '../core/Ui.js';
import { reservasInstalacionesService } from '../services/ReservasInstalacionesService.js';

let moduloInicializado = false;
let currentView = 'form';
let infiniteScrollInstance = null;

/**
 * MÓDULO DE RESERVAS DE INSTALACIONES (reservas_instalaciones.js)
 */
export const ReservasInstalaciones = {
    /**
     * INICIALIZAR EL MÓDULO
     */
    async init() {
        if (moduloInicializado) {
            this.render();
            return;
        }

        this.configurarDatePicker();
        this.configurarSelectsInstalaciones();
        this.configurarFormulario();
        
        // Resetear filtros para asegurar que empiecen en "Todas"
        ['filtro-lista-inst', 'filtro-horarios-inst'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        
        moduloInicializado = true;
        Ui.attachRoomValidator('res_habitacion', { allowEmpty: false });
        this.showView('form');
    },

    configurarDatePicker() {
        const today = Utils.getTodayISO();
        ['res_fecha', 'filtro-lista-fecha', 'filtro-horarios-fecha'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = today;
        });
    },

    configurarSelectsInstalaciones() {
        const instalaciones = APP_CONFIG.HOTEL.INSTALACIONES || [];
        const selects = [
            { id: 'res_instalacion', placeholder: 'Seleccionar...' },
            { id: 'filtro-lista-inst', placeholder: 'Todas las instalaciones' },
            { id: 'filtro-horarios-inst', placeholder: 'Todas las instalaciones' }
        ];

        selects.forEach(sel => {
            const el = document.getElementById(sel.id);
            if (el) {
                const isFormSelect = sel.id === 'res_instalacion';
                el.innerHTML = `<option value="" ${isFormSelect ? 'disabled selected' : 'selected'}>${sel.placeholder}</option>` + 
                    instalaciones.map(inst => `<option value="${inst.nombre}">${inst.icono || '🏢'} ${inst.nombre}</option>`).join('');
            }
        });
    },

    configurarFormulario() {
        Ui.handleFormSubmission({
            formId: 'formReservaInstalacion',
            service: reservasInstalacionesService,
            idField: 'id',
            validate: async (data, isEdit) => {
                const { id, instalacion, fecha, hora_inicio, hora_fin, habitacion, nombre_cliente, externo_switch } = data;
                console.log(`[ReservasInstalaciones] Validando reserva. ID Formulario: ${id}, EsEdicion: ${isEdit}`);

                if (!instalacion || !fecha || !hora_inicio || !hora_fin) return "Faltan campos obligatorios.";
                if (externo_switch && !nombre_cliente) return "Indique el nombre del cliente externo.";
                if (!externo_switch && !habitacion) return "Indique el número de habitación.";
                
                if (hora_inicio >= hora_fin) return "La hora de inicio debe ser anterior a la de fin.";

                const configInst = APP_CONFIG.HOTEL.INSTALACIONES?.find(i => i.nombre === instalacion);
                if (configInst) {
                    if (hora_inicio < configInst.apertura || hora_fin > configInst.cierre) {
                        return `Horario fuera de rango: ${instalacion} abre de ${configInst.apertura} a ${configInst.cierre}.`;
                    }
                }

                const reservas = reservasInstalacionesService.getByInstalacionYFecha(instalacion, fecha);
                const solapada = reservas.find(r => {
                    // CRÍTICO: Usar == para comparar ID (Number de DB vs String de Form)
                    const isSelf = r.id == id;
                    if (isSelf) return false;
                    return Utils.checkOverlap(hora_inicio, hora_fin, r.hora_inicio, r.hora_fin);
                });

                if (solapada) {
                    return `Conflicto: Ya existe una reserva de ${solapada.hora_inicio} a ${solapada.hora_fin} (${solapada.externo ? 'Externo' : 'Hab ' + solapada.habitacion}).`;
                }

                return true;
            },
            mapData: (data) => {
                const now = Date.now();
                const esExterno = !!data.externo_switch;
                // Extraemos explícitamente cada campo para garantizar tipos correctos
                // (los inputs de tipo time a veces se pasan como objetos en lugar de strings)
                const toStr = (v) => (v && typeof v === 'object' && v.value !== undefined) ? v.value : String(v || '');
                return {
                    id: data.id || `RES-${now}`,
                    instalacion: toStr(data.instalacion),
                    habitacion: esExterno ? 'EXTERNO' : toStr(data.habitacion).padStart(3, '0'),
                    fecha: toStr(data.fecha),
                    hora_inicio: toStr(data.hora_inicio),
                    hora_fin: toStr(data.hora_fin),
                    pax: parseInt(data.pax) || 1,
                    nombre_cliente: toStr(data.nombre_cliente),
                    observaciones: toStr(data.observaciones),
                    externo: esExterno,
                    timestamp: now,
                };
            },
            onSuccess: () => {
                this.limpiarFormulario();
                this.render();
                Ui.showToast("Reserva guardada correctamente.", "success");
            }
        });

        ['res_instalacion', 'res_fecha', 'res_hora_inicio', 'res_hora_fin', 'res_externo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.renderPreviewStatus());
        });
    },

    showView(view) {
        currentView = view;
        const buttons = { form: 'btnReservasForm', lista: 'btnReservasLista', horarios: 'btnReservasHorarios' };
        Object.entries(buttons).forEach(([v, id]) => {
            const btn = document.getElementById(id);
            if (btn) btn.classList.toggle('active', v === view);
        });

        const containers = { form: 'view-reserva-form', lista: 'view-reserva-lista', horarios: 'view-reserva-horarios' };
        Object.entries(containers).forEach(([v, id]) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('d-none', v !== view);
        });

        const labelPrint = document.getElementById('label-print-view');
        if (labelPrint) {
            const labels = { 'form': 'Reserva', 'lista': 'Listado', 'horarios': 'Disponibilidad' };
            labelPrint.textContent = labels[view] || 'Reserva';
        }

        if (view === 'lista') this.renderLista();
        if (view === 'horarios') this.renderHorarios();

        this.render();
    },

    render() {
        if (currentView === 'lista') this.renderLista();
        else if (currentView === 'horarios') this.renderHorarios();
        else this.renderPreviewStatus();
    },

    toggleExterno(active) {
        const wrapHab = document.getElementById('wrap-input-hab');
        const wrapNombre = document.getElementById('wrap-input-nombre');
        const inputHab = document.getElementById('res_habitacion');
        const inputNombre = document.getElementById('res_nombre_cliente');

        if (active) {
            wrapHab?.classList.add('d-none');
            wrapNombre?.classList.remove('d-none');
            inputHab.required = false;
            inputNombre.required = true;
            inputHab.value = '';
        } else {
            wrapHab?.classList.remove('d-none');
            wrapNombre?.classList.add('d-none');
            inputHab.required = true;
            inputNombre.required = false;
            inputNombre.value = '';
        }
        this.renderPreviewStatus();
    },

    imprimirActual() {
        if (currentView === 'form') {
            return this.imprimirTicket();
        }

        const user = Utils.validateUser() || 'Recepción';
        const title = currentView === 'lista' ? 'Reporte de Reservas de Instalaciones' : 'Reporte de Disponibilidad de Instalaciones';
        
        if (window.PrintService) {
            // Determinar ID del contenedor a imprimir
            const containerId = currentView === 'lista' ? 'view-reserva-lista' : 'view-reserva-horarios';
            PrintService.printElement(containerId, title);
        } else {
            window.print();
        }
    },

    imprimirTicket(id = null) {
        let data;
        if (id) {
            data = reservasInstalacionesService.getById(id, 'id');
        } else {
            data = Ui.getFormData('formReservaInstalacion');
            // Si el form está vacío intentamos ver si hay un ID activo
            const activeId = document.getElementById('res_id')?.value;
            if (!data.instalacion && activeId) {
                data = reservasInstalacionesService.getById(activeId, 'id');
            }
        }

        if (!data || !data.instalacion || !data.fecha || !data.hora_inicio) {
            Ui.showToast("Complete los datos de la reserva o seleccione una válida.", "warning");
            return;
        }

        const esExterno = !!data.externo;
        const autor = data.autor || Utils.validateUser() || 'Recepción';
        
        // Generar Código de Verificación (Algoritmo simple pero visual)
        const hash = (data.id || Date.now()).toString().slice(-4);
        const code = `RS-${data.instalacion.substring(0,2).toUpperCase()}-${hash}`;

        const nombreCliente = esExterno ? (data.nombre_cliente || 'EXTERNO') : `Habitación ${data.habitacion || '000'}`;
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Reserva ${code}</title>
                <style>
                    @page { size: A4; margin: 20mm; }
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; }
                    .header { text-align: center; border-bottom: 2px solid #0d6efd; padding-bottom: 20px; margin-bottom: 30px; }
                    .header h1 { margin: 0; color: #0d6efd; font-size: 24px; text-transform: uppercase; }
                    .header p { margin: 5px 0 0; color: #666; font-size: 14px; }
                    
                    .reserva-box { border: 1px solid #ddd; border-radius: 8px; padding: 20px; background: #f9f9f9; margin-bottom: 30px; }
                    .row { display: flex; margin-bottom: 15px; border-bottom: 1px dashed #eee; padding-bottom: 5px; }
                    .label { width: 140px; font-weight: bold; color: #555; }
                    .value { flex: 1; font-weight: 500; }
                    
                    .big-code { text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 2px; color: #333; border: 2px dashed #ccc; padding: 10px; margin: 20px 0; background: #fff; }
                    
                    .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Comprobante de Reserva</h1>
                    <p>Instalaciones y Servicios - Hotel Garoé</p>
                </div>

                <div class="reserva-box">
                    <div class="row">
                        <div class="label">Instalación:</div>
                        <div class="value" style="font-size: 18px; color: #0d6efd;">${data.instalacion}</div>
                    </div>
                    <div class="row">
                        <div class="label">Titular:</div>
                        <div class="value">${nombreCliente}</div>
                    </div>
                    <div class="row">
                        <div class="label">Fecha:</div>
                        <div class="value">${Utils.formatDate(data.fecha)}</div>
                    </div>
                    <div class="row">
                        <div class="label">Horario:</div>
                        <div class="value">${data.hora_inicio} - ${data.hora_fin}</div>
                    </div>
                    <div class="row">
                        <div class="label">Pax:</div>
                        <div class="value">${data.pax || 1} Personas</div>
                    </div>
                    <div class="row" style="border:0;">
                        <div class="label">Observaciones:</div>
                        <div class="value" style="font-style: italic;">${data.observaciones || 'Sin observaciones.'}</div>
                    </div>
                </div>

                <div class="big-code">${code}</div>

                <div style="margin-top: 40px; display: flex; justify-content: space-between;">
                    <div style="width: 40%; border-top: 1px solid #000; padding-top: 5px; text-align: center; font-size: 12px;">Firma Recepcionista<br>(${autor})</div>
                    <div style="width: 40%; border-top: 1px solid #000; padding-top: 5px; text-align: center; font-size: 12px;">Firma Cliente</div>
                </div>

                <div class="footer">
                    <p>Gracias por utilizar nuestras instalaciones.</p>
                    <p>Reception Suite v2 - Generado el ${new Date().toLocaleString()}</p>
                </div>
            </body>
            </html>
        `;

        if (window.PrintService) {
            PrintService.printHTML(html);
        } else {
            console.warn("PrintService no disponible.");
            alert("No se puede imprimir: PrintService inactivo.");
        }
    },

    /**
     * VISTA LISTADO (Paginación Infinita)
     */
    renderLista() {
        const tbody = document.getElementById('reservas-instalaciones-table-body');
        if (!tbody) return;

        const instFiltro = document.getElementById('filtro-lista-inst')?.value;
        const fechaFiltro = document.getElementById('filtro-lista-fecha')?.value;

        let data = reservasInstalacionesService.getAll();
        
        console.log(`[ReservasInstalaciones] Filtrando lista. Inst: "${instFiltro}", Fecha: "${fechaFiltro}"`);

        if (instFiltro && instFiltro.trim() !== "") {
            data = data.filter(r => r.instalacion === instFiltro);
        }
        if (fechaFiltro && fechaFiltro.trim() !== "") {
            data = data.filter(r => r.fecha === fechaFiltro);
        }

        // Default Sort: Sort by date and time descending
        data.sort((a, b) => `${b.fecha} ${b.hora_inicio}`.localeCompare(`${a.fecha} ${a.hora_inicio}`));

        // Initial Render
        Ui.renderTable('reservas-instalaciones-table-body', data, (res) => this.renderFila(res), 'No hay reservas para los filtros seleccionados.');

        // Enable Table Sorting
        Ui.enableTableSorting('table-reservas-instalaciones', data, (sortedData) => {
            Ui.renderTable('reservas-instalaciones-table-body', sortedData, (res) => this.renderFila(res), 'No hay reservas para los filtros seleccionados.');
        });
    },

    renderFila(r) {
        const autor = r.autor || 'N/A';
        const horaFmt = `<span class="fw-bold text-primary">${r.hora_inicio}</span> <span class="text-muted small">a ${r.hora_fin}</span>`;
        
        return `
            <tr>
                <td class="ps-4 fw-bold">
                    <span class="badge bg-light text-dark border">${r.habitacion}</span>
                </td>
                <td>
                    <div class="fw-bold">${r.instalacion}</div>
                    <div class="text-muted small" style="font-size: 0.65rem;"><i class="bi bi-person me-1"></i>${autor}</div>
                </td>
                <td>
                    <div class="small">${Utils.formatDate(r.fecha)}</div>
                    <div>${horaFmt}</div>
                </td>
                <td><span class="badge rounded-pill bg-light text-dark border">${r.pax} <i class="bi bi-people-fill ms-1"></i></span></td>
                <td><span class="badge bg-success-subtle text-success border border-success-subtle">Confirmada</span></td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-dark border-0 me-1" onclick="ReservasInstalaciones.imprimirTicket('${r.id}')" data-bs-toggle="tooltip" title="Imprimir Ticket">
                        <i class="bi bi-printer-fill"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-primary border-0 me-1" onclick="ReservasInstalaciones.editar('${r.id}')" data-bs-toggle="tooltip" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger border-0" onclick="ReservasInstalaciones.eliminar('${r.id}')" data-bs-toggle="tooltip" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    },

    /**
     * VISTA HORARIOS (Timeline Gráfica)
     */
    renderHorarios() {
        const grid = document.getElementById('reservas-grid-container');
        if (!grid) return;

        const instFiltro = document.getElementById('filtro-horarios-inst')?.value;
        const fechaFiltro = document.getElementById('filtro-horarios-fecha')?.value || Utils.getTodayISO();
        
        if (!instFiltro) {
            grid.innerHTML = `
                <div class="text-center py-5 text-muted animate-fade-in">
                    <i class="bi bi-funnel d-block fs-1 mb-3 opacity-25"></i>
                    <h5>Seleccione una instalación para ver su disponibilidad</h5>
                    <p class="small">Utilice el selector de la parte superior derecha.</p>
                </div>
            `;
            this.renderOccupancyChart([], fechaFiltro);
            return;
        }

        let instalaciones = (APP_CONFIG.HOTEL.INSTALACIONES || []).filter(i => i.nombre === instFiltro);

        grid.innerHTML = instalaciones.map(inst => {
            const reservas = reservasInstalacionesService.getByInstalacionYFecha(inst.nombre, fechaFiltro)
                .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

            const minApertura = this.toMin(inst.apertura);
            const totalMinutos = this.toMin(inst.cierre) - minApertura;

            // Marcadores de horas
            const markers = [];
            for (let h = Math.ceil(minApertura/60); h <= Math.floor(this.toMin(inst.cierre)/60); h++) {
                const pos = ((h * 60 - minApertura) / totalMinutos) * 100;
                markers.push(`<div class="hour-marker" style="left: ${pos}%"><span>${h}:00</span></div>`);
            }

            const renderReservaBlock = (res) => {
                const start = this.toMin(res.hora_inicio);
                const end = this.toMin(res.hora_fin);
                const left = ((start - minApertura) / totalMinutos) * 100;
                const width = ((end - start) / totalMinutos) * 100;

                return `
                    <div class="timeline-reserve-block animate-fade-in" 
                         style="left: ${left}%; width: ${width}%;"
                         data-bs-toggle="tooltip" 
                         data-bs-title="${res.externo ? res.nombre_cliente : 'Hab ' + res.habitacion}: ${res.hora_inicio}-${res.hora_fin}"
                         onclick="event.stopPropagation(); ReservasInstalaciones.editar('${res.id}')">
                        <span class="block-label">${res.externo ? 'EXT' : res.habitacion}</span>
                    </div>
                `;
            };

            return `
                <div class="instalacion-timeline-row animate-fade-in mb-3">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <h6 class="mb-0 fw-bold small text-uppercase text-primary">
                            <i class="bi bi-${inst.icono || 'geo-fill'} me-2"></i>${inst.nombre} 
                            <span class="badge bg-light text-muted fw-normal ms-2 border">${inst.apertura} - ${inst.cierre}</span>
                        </h6>
                    </div>
                    <div class="timeline-visual-wrapper">
                        <div class="timeline-axis">${markers.join('')}</div>
                        <div class="timeline-track shadow-sm" onclick="ReservasInstalaciones.reaccionarTimelineClick(event, '${inst.nombre}', ${minApertura}, ${totalMinutos})">
                            ${reservas.map(r => renderReservaBlock(r)).join('')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.renderOccupancyChart(instalaciones, fechaFiltro);
        if (window.initTooltips) window.initTooltips();
    },

    renderOccupancyChart(instalaciones, fecha) {
        const chart = document.getElementById('reservas-occupancy-chart');
        if (!chart) return;

        chart.innerHTML = instalaciones.map(inst => {
            const reservas = reservasInstalacionesService.getByInstalacionYFecha(inst.nombre, fecha);
            const minApertura = this.toMin(inst.apertura);
            const maxCierre = this.toMin(inst.cierre);
            const totalMinutosDisp = maxCierre - minApertura;
            
            let minutosOcupados = 0;
            reservas.forEach(r => {
                const start = Math.max(minApertura, this.toMin(r.hora_inicio));
                const end = Math.min(maxCierre, this.toMin(r.hora_fin));
                if (end > start) minutosOcupados += (end - start);
            });

            const pct = totalMinutosDisp > 0 ? Math.round((minutosOcupados / totalMinutosDisp) * 100) : 0;
            const color = pct > 80 ? '#dc3545' : pct > 50 ? '#ffc107' : '#20c997';
            
            return `
                <div class="occupancy-bar-item shadow-sm" style="flex: 1; height: 100%; border-radius: 6px 6px 0 0;" title="${inst.nombre}: ${pct}% ocupado">
                    <div class="occupancy-percentage" style="color: ${color}">${pct}%</div>
                    <div class="occupancy-bar-fill" style="height: ${pct}%; background: ${color}"></div>
                    <div class="occupancy-bar-label">${inst.nombre.substring(0, 8)}..</div>
                </div>
            `;
        }).join('');
    },

    reaccionarTimelineClick(event, instalacion, minApertura, totalMinutos) {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const percent = x / rect.width;
        
        const minutosClick = minApertura + (totalMinutos * percent);
        const h = Math.floor(minutosClick / 60);
        const m = Math.floor(minutosClick % 60);
        
        const mRounded = Math.floor(m / 15) * 15;
        const horaStr = `${h.toString().padStart(2, '0')}:${mRounded.toString().padStart(2, '0')}`;

        this.prepararNueva(instalacion, horaStr);
    },

    prepararNueva(instalacion, hora) {
        this.limpiarFormulario();
        this.showView('form');
        const titleEl = document.getElementById('form-title-reserva');
        if (titleEl) titleEl.innerHTML = '<i class="bi bi-calendar-plus me-2"></i>Nueva Reserva';
        
        Utils.setVal('res_instalacion', instalacion);
        Utils.setVal('res_hora_inicio', hora);
        
        const [h, m] = hora.split(':').map(Number);
        let totalMin = h * 60 + m + 30;
        const nextH = Math.floor(totalMin / 60).toString().padStart(2, '0');
        const nextM = (totalMin % 60).toString().padStart(2, '0');
        Utils.setVal('res_hora_fin', `${nextH}:${nextM}`);
        
        setTimeout(() => {
            const inputHab = document.getElementById('res_habitacion');
            if (inputHab) inputHab.focus();
        }, 150);
        this.renderPreviewStatus();
    },

    renderPreviewStatus() {
        const statusBox = document.getElementById('res-preview-status');
        if (!statusBox) return;

        const data = Ui.getFormData('formReservaInstalacion');
        const { instalacion, fecha, hora_inicio, hora_fin } = data;

        if (!instalacion || !fecha || !hora_inicio || !hora_fin) {
            statusBox.innerHTML = `
                <div class="alert alert-light border text-muted small text-center py-3">
                    <i class="bi bi-info-circle d-block fs-4 mb-1 opacity-50"></i>
                    Complete los campos para verificar disponibilidad.
                </div>`;
            return;
        }

        const configInst = APP_CONFIG.HOTEL.INSTALACIONES?.find(i => i.nombre === instalacion);
        if (configInst) {
            if (hora_inicio < configInst.apertura || hora_fin > configInst.cierre) {
                statusBox.innerHTML = `
                    <div class="alert alert-danger border-0 shadow-sm animate-shake py-2 small">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        <strong>Horario no válido:</strong> ${instalacion} abre de ${configInst.apertura} a ${configInst.cierre}.
                    </div>`;
                return;
            }
        }

        const reservas = reservasInstalacionesService.getByInstalacionYFecha(instalacion, fecha);
        const conflicto = reservas.find(r => r.id != data.id && Utils.checkOverlap(hora_inicio, hora_fin, r.hora_inicio, r.hora_fin));

        if (conflicto) {
            statusBox.innerHTML = `
                <div class="alert alert-warning border-0 shadow-sm animate-shake py-2 small">
                    <i class="bi bi-dash-circle-fill me-2"></i>
                    <strong>OCUPADO:</strong> De ${conflicto.hora_inicio} a ${conflicto.hora_fin} (${conflicto.externo ? 'Externo' : 'Hab ' + conflicto.habitacion}).
                </div>`;
        } else {
            statusBox.innerHTML = `
                <div class="alert alert-success border-0 shadow-sm animate-pulse py-2 small">
                    <i class="bi bi-check-circle-fill me-2"></i>
                    <strong>DISPONIBLE:</strong> Horario libre.
                </div>`;
        }
    },

    editar(id) {
        const res = reservasInstalacionesService.getById(id, 'id');
        if (!res) return;

        this.showView('form');
        const titleEl = document.getElementById('form-title-reserva');
        if (titleEl) titleEl.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Editar Reserva';

        Utils.setVal('res_id', res.id);
        Utils.setVal('res_instalacion', res.instalacion);
        Utils.setVal('res_fecha', res.fecha);
        Utils.setVal('res_hora_inicio', res.hora_inicio);
        Utils.setVal('res_hora_fin', res.hora_fin);
        Utils.setVal('res_pax', res.pax);
        Utils.setVal('res_observaciones', res.observaciones);

        const toggle = document.getElementById('res_externo');
        if (toggle) {
            const esExterno = !!res.externo;
            toggle.checked = esExterno;
            this.toggleExterno(esExterno);
            if (esExterno) Utils.setVal('res_nombre_cliente', res.nombre_cliente);
            else Utils.setVal('res_habitacion', res.habitacion);
        }
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.renderPreviewStatus();
    },

    async eliminar(id) {
        if (await Ui.showConfirm("¿Estás seguro de que deseas eliminar esta reserva?")) {
            await reservasInstalacionesService.delete(id, 'id');
            this.render();
            Ui.showToast("Reserva eliminada.", "info");
        }
    },

    limpiarFormulario() {
        Utils.setVal('res_id', '');
        const titleEl = document.getElementById('form-title-reserva');
        if (titleEl) titleEl.innerHTML = '<i class="bi bi-calendar-plus me-2"></i>Nueva Reserva';

        const form = document.getElementById('formReservaInstalacion');
        if (form) form.reset();
        
        const toggle = document.getElementById('res_externo');
        if (toggle) {
            toggle.checked = false;
            this.toggleExterno(false);
        }

        this.configurarDatePicker();
        this.renderPreviewStatus();
    },

    toMin(t) {
        if (!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + (m || 0);
    }
};

window.ReservasInstalaciones = ReservasInstalaciones;
