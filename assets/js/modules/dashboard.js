import { Ui } from '../core/Ui.js';

let chartOccupancy = null;
let chartMovements = null;

export const Dashboard = {
    async init() {
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        // Renderizar estructura base
        container.innerHTML = `
            <div class="row g-4 animate-fade-in">
                <!-- COLUMNA IZQUIERDA: KPIs y Gráficos -->
                <div class="col-lg-8">
                    <!-- Tarjetas Superiores -->
                    <div class="row g-3 mb-4">
                        <div class="col-md-4">
                            <div class="card border-0 shadow-sm h-100 bg-primary text-white overflow-hidden">
                                <div class="card-body position-relative">
                                    <h6 class="text-uppercase text-white-50 small fw-bold ls-1 mb-2">Ocupación</h6>
                                    <div class="d-flex align-items-end">
                                        <h2 class="display-5 fw-bold mb-0" id="dash-occupancy-val">--%</h2>
                                        <span class="ms-2 fs-5 opacity-75 mb-2" id="dash-occupancy-detail">--/--</span>
                                    </div>
                                    <i class="bi bi-building position-absolute end-0 bottom-0 text-white opacity-10" style="font-size: 5rem; margin-right: -10px; margin-bottom: -10px;"></i>
                                </div>
                            </div>
                        </div>
                         <div class="col-md-4">
                            <div class="card border-0 shadow-sm h-100 bg-white overflow-hidden">
                                <div class="card-body">
                                    <h6 class="text-uppercase text-muted small fw-bold ls-1 mb-2">Movimientos Hoy</h6>
                                    <div class="d-flex justify-content-between align-items-center mt-3">
                                        <div class="text-center">
                                            <div class="text-success fw-bold fs-4"><i class="bi bi-box-arrow-in-right me-1"></i><span id="dash-in">0</span></div>
                                            <small class="text-muted">Llegadas</small>
                                        </div>
                                        <div class="vr bg-light"></div>
                                        <div class="text-center">
                                            <div class="text-danger fw-bold fs-4"><span id="dash-out">0</span><i class="bi bi-box-arrow-right ms-1"></i></div>
                                            <small class="text-muted">Salidas</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card border-0 shadow-sm h-100 bg-white overflow-hidden">
                                <div class="card-body">
                                     <h6 class="text-uppercase text-muted small fw-bold ls-1 mb-2">Pendientes</h6>
                                     <ul class="list-unstyled mb-0 mt-3">
                                        <li class="d-flex justify-content-between mb-2">
                                            <span><i class="bi bi-alarm me-2 text-warning"></i>Despertadores</span>
                                            <span class="badge bg-warning text-dark pill" id="dash-pending-wake">0</span>
                                        </li>
                                        <li class="d-flex justify-content-between">
                                            <span><i class="bi bi-exclamation-octagon me-2 text-danger"></i>Alarmas Sist.</span>
                                            <span class="badge bg-danger pill" id="dash-active-alarms">0</span>
                                        </li>
                                        <li class="d-flex justify-content-between mb-2" id="dash-transfers-wrapper">
                                            <span><i class="bi bi-car-front-fill me-2 text-info"></i>Transfers Hoy</span>
                                            <span class="badge bg-info text-light pill" id="dash-pending-transfers">0</span>
                                        </li>
                                        <li class="d-flex justify-content-between mb-2" id="dash-events-wrapper">
                                            <span><i class="bi bi-calendar-event-fill me-2 text-primary"></i>Eventos Hoy</span>
                                            <span class="badge bg-primary text-light pill" id="dash-pending-events">0</span>
                                        </li>
                                     </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Gráficos -->
                    <div class="row g-3">
                        <div class="col-md-6">
                            <div class="card border-0 shadow-sm h-100">
                                <div class="card-header bg-white border-0 py-3">
                                    <h6 class="fw-bold mb-0"><i class="bi bi-pie-chart-fill me-2 text-primary"></i>Distribución Ocupación</h6>
                                </div>
                                <div class="card-body position-relative" style="height: 250px;">
                                    <canvas id="chartOccupancy"></canvas>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="card border-0 shadow-sm h-100">
                                <div class="card-header bg-white border-0 py-3">
                                    <h6 class="fw-bold mb-0"><i class="bi bi-bar-chart-fill me-2 text-primary"></i>Actividad Semanal</h6>
                                </div>
                                <div class="card-body position-relative" style="height: 250px;">
                                    <div class="d-flex align-items-center justify-content-center h-100 text-muted bg-light rounded border border-dashed">
                                        <small>Próximamente: Histórico</small> <!-- Placeholder para futura expansión -->
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- COLUMNA DERECHA: Feed de Actividad -->
                <div class="col-lg-4">
                    <div class="card border-0 shadow-sm h-100">
                         <div class="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                            <h6 class="fw-bold mb-0"><i class="bi bi-activity me-2 text-primary"></i>Últimas Novedades</h6>
                            <button class="btn btn-sm btn-light rounded-circle" onclick="Dashboard.refresh()"><i class="bi bi-arrow-clockwise"></i></button>
                        </div>
                        <div class="card-body p-0">
                            <div class="list-group list-group-flush" id="dash-feed-list">
                                <!-- Feed Items -->
                            </div>
                        </div>
                        <div class="card-footer bg-white border-0 text-center py-3">
                            <button class="btn btn-outline-primary btn-sm rounded-pill px-4" onclick="document.getElementById('m-novedades-tab').click()">Ver Libro Completo</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // El Dashboard ya no tiene refresh porque los widgets se actualizan desde cada módulo
    },

    renderCharts(stats) {
        const ctxOcc = document.getElementById('chartOccupancy');
        
        if (ctxOcc) {
            if (chartOccupancy) chartOccupancy.destroy();
            
            Chart.defaults.font.family = "'Inter', sans-serif";
            
            chartOccupancy = new Chart(ctxOcc, {
                type: 'doughnut',
                data: {
                    labels: ['Ocupado', 'Libre'],
                    datasets: [{
                        data: [stats.occupancy.current, stats.occupancy.total - stats.occupancy.current],
                        backgroundColor: ['#0d6efd', '#f8f9fa'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: {
                        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }
                    }
                }
            });
        }
    },

    animateValue(id, end, suffix = '') {
        const obj = document.getElementById(id);
        if(!obj) return;
        let start = 0;
        if (start === end) return;
        let range = end - start;
        let current = start;
        let increment = end > start ? 1 : -1;
        let stepTime = Math.abs(Math.floor(2000 / range)); // 2s duration
        if (stepTime < 10) stepTime = 10; // min 10ms

        let timer = setInterval(function() {
            current += increment;
            obj.innerHTML = current + suffix;
            if (current == end) {
                clearInterval(timer);
            }
        }, stepTime);
        // Fast finish for consistency
        obj.innerHTML = end + suffix;
    }
};

window.Dashboard = Dashboard;
