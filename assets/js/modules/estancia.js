import { APP_CONFIG } from "../core/Config.js";
import { Utils } from '../core/Utils.js';
import { estanciaService } from '../services/EstanciaService.js';
import { sessionService } from '../services/SessionService.js';
import { Ui } from '../core/Ui.js';

/**
 * MÓDULO DE CONTROL DE ESTANCIA (OCUPACIÓN) - ROUND 3
 */

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
let chartEstancia = null;

export async function inicializarEstancia() {
    await estanciaService.init();

    Ui.handleFormSubmission({
        formId: 'formEstancia',
        service: estanciaService,
        idField: 'estancia_fecha',
        mapData: (rawData) => {
            const ocupadas = parseInt(rawData.estancia_ocupadas) || 0;
            const th = 190; // Estándar
            return {
                fecha: rawData.estancia_fecha,
                ocupadas,
                vacias: th - ocupadas,
                totalHab: th
            };
        },
        onSuccess: () => {
            mostrarEstancia();
            const fechaInput = document.getElementById('estancia_fecha');
            if (fechaInput) {
                fechaInput.value = Utils.getTodayISO();
                fechaInput.setAttribute('readonly', true);
            }
            const icon = document.getElementById('iconLockFecha');
            if (icon) icon.className = 'bi bi-lock-fill';
        }
    });

    document.getElementById('btnToggleLockFecha')?.addEventListener('click', toggleLockFecha);

    const yearSelect = document.getElementById('filtroYearEstancia');
    const monthSelect = document.getElementById('filtroMonthEstancia');
    const typeSelect = document.getElementById('filtroTipoReporte');

    if (yearSelect) {
        yearSelect.innerHTML = '';
        const currentYear = new Date().getFullYear();
        for (let i = currentYear; i >= currentYear - 5; i--) {
            const opt = document.createElement('option');
            opt.value = i; opt.innerText = i;
            yearSelect.appendChild(opt);
        }
    }

    if (monthSelect) monthSelect.value = new Date().getMonth();

    yearSelect?.addEventListener('change', refreshEstanciaData);
    monthSelect?.addEventListener('change', refreshEstanciaData);
    typeSelect?.addEventListener('change', refreshEstanciaData);

    // Inicializar fecha
    const fechaInput = document.getElementById('estancia_fecha');
    if (fechaInput) {
        fechaInput.value = Utils.getTodayISO();
    }

    refreshEstanciaData();
}

function toggleLockFecha() {
    const input = document.getElementById('estancia_fecha');
    const icon = document.getElementById('iconLockFecha');
    if (input && icon) {
        const isReadonly = input.hasAttribute('readonly');
        if (isReadonly) {
            input.removeAttribute('readonly');
            icon.className = 'bi bi-unlock-fill text-warning';
        } else {
            input.setAttribute('readonly', true);
            icon.className = 'bi bi-lock-fill';
        }
    }
}

function cambiarVistaEstancia(vista) {
    const btnTrabajo = document.getElementById('btnVistaTrabajoEstancia');
    const btnGraficas = document.getElementById('btnVistaGraficasEstancia');
    const divTrabajo = document.getElementById('estancia-trabajo');
    const divGraficas = document.getElementById('estancia-graficas');
    const periodSelectors = document.getElementById('periodSelectors');

    if (vista === 'trabajo') {
        btnTrabajo?.classList.add('active'); 
        btnGraficas?.classList.remove('active');
        divTrabajo?.classList.remove('d-none'); 
        divGraficas?.classList.add('d-none');
        periodSelectors?.classList.add('d-none');
        periodSelectors?.classList.remove('d-flex');
        mostrarEstancia(); 
    } else {
        btnTrabajo?.classList.remove('active'); 
        btnGraficas?.classList.add('active');
        divTrabajo?.classList.add('d-none'); 
        divGraficas?.classList.remove('d-none');
        periodSelectors?.classList.remove('d-none');
        periodSelectors?.classList.add('d-flex');
        renderGraficaEstancia();
    }
}

function refreshEstanciaData() {
    const divGraficas = document.getElementById('estancia-graficas');
    const isGraficasVisible = divGraficas && !divGraficas.classList.contains('d-none');
    if (isGraficasVisible) renderGraficaEstancia();
    else mostrarEstancia();
}

async function mostrarEstancia() {
    const tabla = document.getElementById('tablaEstanciaCuerpo');
    const pie = document.getElementById('tablaEstanciaPie');
    const yearSelect = document.getElementById('filtroYearEstancia');
    const monthSelect = document.getElementById('filtroMonthEstancia');

    if (!tabla || !yearSelect || !monthSelect) return;
    
    const year = yearSelect.value;
    const month = monthSelect.value;
    const monthRegistros = estanciaService.getByMonth(year, month);

    const dataByDay = {};
    monthRegistros.forEach(r => {
        const d = parseInt(r.fecha.split('T')[0].split('-')[2]);
        dataByDay[d] = r;
    });

    let sumaOcupadas = 0, sumaVacias = 0, sumaTotal = 0, diasContados = 0;
    const diasEnMes = new Date(year, parseInt(month) + 1, 0).getDate();
    const listaDias = [];

    for (let d = 1; d <= diasEnMes; d++) {
        const r = dataByDay[d];
        const item = { d, data: r };
        if (r) {
            item.ocupadas = r.ocupadas || 0;
            item.vacias = r.vacias || 0;
            const th = r.totalHab || 190;
            item.libres = Math.max(0, th - item.ocupadas - item.vacias);
            item.porcentaje = parseFloat(((item.ocupadas / th) * 100).toFixed(1));
            sumaOcupadas += item.ocupadas;
            sumaVacias += item.vacias;
            sumaTotal += th;
            diasContados++;
        } else {
            item.ocupadas = -1; item.vacias = -1; item.libres = -1; item.porcentaje = -1;
        }
        listaDias.push(item);
    }

    const renderRow = (item) => {
        if (item.data) {
            return `<tr>
                <td class="fw-bold text-start ps-4">Día ${item.d}</td>
                <td>${item.ocupadas}</td>
                <td>${item.vacias}</td>
                <td>${item.libres}</td>
                <td><span class="badge bg-primary text-white">${item.porcentaje}%</span></td>
                <td class="text-end pe-4">
                    <button onclick="eliminarDiaEstancia('${item.data.fecha}')" class="btn btn-sm btn-link text-danger p-0"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
        }
        return `<tr class="text-muted opacity-50"><td class="text-start ps-4">Día ${item.d}</td><td colspan="5">Sin registro</td></tr>`;
    };

    Ui.renderTable('tablaEstanciaCuerpo', listaDias, renderRow);
    Ui.enableTableSorting('table-estancia', listaDias, (sorted) => Ui.renderTable('tablaEstanciaCuerpo', sorted, renderRow));

    if (diasContados > 0) {
        const prom = ((sumaOcupadas / sumaTotal) * 100).toFixed(1);
        pie.innerHTML = `<tr class="table-light fw-bold text-primary">
            <td class="text-start ps-4 text-uppercase">Promedio Mensual</td>
            <td>${(sumaOcupadas/diasContados).toFixed(0)}</td>
            <td>${(sumaVacias/diasContados).toFixed(0)}</td>
            <td>${((sumaTotal-sumaOcupadas-sumaVacias)/diasContados).toFixed(0)}</td>
            <td>${prom}%</td>
            <td></td>
        </tr>`;
        renderStatsAnual(year, prom, sumaOcupadas, diasContados);
    } else {
        pie.innerHTML = `<tr><td colspan="6" class="text-center py-3 text-muted">No hay datos para este periodo</td></tr>`;
        renderStatsAnual(year, 0, 0, 0);
    }
}

function renderStatsAnual(year, prom, total, dias) {
    const cont = document.getElementById('estancia_anual_stats');
    if (!cont) return;
    cont.innerHTML = `<div class="p-3 text-center">
        <div class="mb-4">
            <div class="small text-uppercase fw-bold text-muted">Ocupación Media</div>
            <div class="display-6 fw-bold text-primary">${prom}%</div>
        </div>
        <div class="mb-4">
            <div class="small text-uppercase fw-bold text-muted">Pernoctaciones</div>
            <div class="h3 fw-bold">${total}</div>
        </div>
        <div>
            <div class="small text-uppercase fw-bold text-muted">Días Activos</div>
            <div class="h5 fw-bold">${dias} registros</div>
        </div>
    </div>`;
}

function renderGraficaEstancia() {
    setTimeout(() => {
        const canvas = document.getElementById('chartEstanciaEvolucion');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const yearS = document.getElementById('filtroYearEstancia');
        const monthS = document.getElementById('filtroMonthEstancia');
        const typeS = document.getElementById('filtroTipoReporte');
        const monthCont = document.getElementById('monthSelectorContainer');
        const yearCont = document.getElementById('yearSelectorContainer');

        const type = typeS.value;
        const year = parseInt(yearS.value);
        const month = monthS.value;

        // Toggle visor de selectores
        if (type === 'mes') { monthCont.classList.remove('d-none'); yearCont.classList.remove('d-none'); }
        else if (type === 'año') { monthCont.classList.add('d-none'); yearCont.classList.remove('d-none'); }
        else { monthCont.classList.add('d-none'); yearCont.classList.remove('d-none'); }

        const title = document.getElementById('grafica-estancia-titulo');
        const labels = [], dataPoints = [];

        if (type === 'mes') {
            title.innerText = `Ocupación Diaria: ${MESES[month]} ${year}`;
            const regs = estanciaService.getByMonth(year, month);
            const dataMap = {}; regs.forEach(r => dataMap[parseInt(r.fecha.split('T')[0].split('-')[2])] = r);
            const days = new Date(year, parseInt(month)+1, 0).getDate();
            for (let d=1; d<=days; d++) {
                labels.push(d);
                const r = dataMap[d];
                dataPoints.push(r ? ((r.ocupadas / (r.totalHab || 190))*100).toFixed(1) : null);
            }
        } else if (type === 'año') {
            title.innerText = `Ocupación Mensual (Media): ${year}`;
            for (let m=0; m<12; m++) {
                labels.push(MESES[m].substring(0,3));
                const regs = estanciaService.getByMonth(year, m);
                if (regs.length > 0) {
                    let sum = 0, total = 0;
                    regs.forEach(r => { sum += (r.ocupadas / (r.totalHab || 190))*100; total++; });
                    dataPoints.push((sum/total).toFixed(1));
                } else dataPoints.push(null);
            }
        } else {
            title.innerText = `Comparativa 5 Años (${year-4} - ${year})`;
            for (let y = year-4; y <= year; y++) {
                labels.push(y);
                const yearRegs = estanciaService.getByYear(y);
                if (yearRegs.length > 0) {
                    let sum = 0, total = 0;
                    yearRegs.forEach(r => { sum += (r.ocupadas / (r.totalHab || 190))*100; total++; });
                    dataPoints.push((sum/total).toFixed(1));
                } else dataPoints.push(null);
            }
        }

        if (chartEstancia) chartEstancia.destroy();
        chartEstancia = new Chart(ctx, {
            type: type === 'mes' ? 'line' : 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Ocupación %',
                    data: dataPoints,
                    borderColor: '#0d6efd',
                    backgroundColor: type === 'mes' ? 'rgba(13, 110, 253, 0.1)' : 'rgba(13, 110, 253, 0.5)',
                    fill: type === 'mes',
                    tension: 0.3,
                    spanGaps: true
                }]
            },
            options: {
                maintainAspectRatio: false,
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, max: 100 } }
            }
        });
    }, 100);
}

export function exportarEstanciaExcel() {
    const yearSelect = document.getElementById('filtroYearEstancia');
    const monthSelect = document.getElementById('filtroMonthEstancia');
    if (!yearSelect || !monthSelect) return;
    const year = yearSelect.value, month = monthSelect.value;
    const regs = estanciaService.getByMonth(year, month);
    const dataMap = {}; regs.forEach(r => dataMap[parseInt(r.fecha.split('T')[0].split('-')[2])] = r);
    let csv = "\ufeffDia;Ocupadas;Vacias;Libres;Porcentaje\n";
    const days = new Date(year, parseInt(month)+1, 0).getDate();
    for (let d=1; d<=days; d++) {
        const r = dataMap[d];
        if (r) {
            const th = r.totalHab || 190;
            csv += `${d};${r.ocupadas};${r.vacias};${th-r.ocupadas-r.vacias};${((r.ocupadas/th)*100).toFixed(1)}%\n`;
        }
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Estancia_${MESES[month]}_${year}.csv`;
    link.click();
}

function imprimirEstancia() {
    const divGraf = document.getElementById('estancia-graficas');
    const isGr = divGraf && !divGraf.classList.contains('d-none');
    if (window.PrintService) {
        if (isGr) PrintService.printElementAsImage('estancia-graficas', 'Estadísticas de Ocupación');
        else PrintService.printElement('estancia-trabajo', 'Control de Estancia');
    } else window.print();
}

window.eliminarDiaEstancia = async (f) => {
    if (await Ui.showConfirm(`¿Eliminar registro ${f}?`)) {
        await estanciaService.removeRegistro(f);
        mostrarEstancia();
    }
};

window.mostrarEstancia = mostrarEstancia;
window.exportarEstanciaExcel = exportarEstanciaExcel;
window.cambiarVistaEstancia = cambiarVistaEstancia;
window.imprimirEstancia = imprimirEstancia;
