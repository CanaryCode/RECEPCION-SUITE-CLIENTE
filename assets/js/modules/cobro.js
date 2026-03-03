/**
 * MÓDULO DE CALCULADORA DE COBROS (cobro.js)
 * ----------------------------------------
 * Facilita el cálculo de cambio para el recepcionista.
 * Permite introducir el total a cobrar, desglosar el dinero recibido y 
 * sugiere el cambio óptimo (billetes y monedas) a entregar al cliente.
 */

import { Utils } from '../core/Utils.js';
import { APP_CONFIG } from "../core/Config.js";
import { Ui } from '../core/Ui.js';

export function inicializarCobro() {
    const valores = APP_CONFIG.COBRO.VALORES;
    const rBil = document.getElementById('recibido-billetes');
    const rMon = document.getElementById('recibido-monedas');
    const eBil = document.getElementById('entregado-billetes');
    const eMon = document.getElementById('entregado-monedas');

    if (!rBil || !rMon || !eBil || !eMon) return;

    valores.forEach(v => {
        const label = Utils.formatCurrency(v);
        const isBill = v >= 5;
        const styleClass = isBill ? 'bill-label' : 'coin-label';
        const iconClass = isBill ? 'bi-cash' : 'bi-coin';

        const html = `
            <div class="input-group input-group-sm mb-1">
                <span class="input-group-text ${styleClass} px-1" style="width: 55px; font-size: 0.75rem;"><i class="bi ${iconClass} me-1"></i>${v}€</span>
                <input type="number" min="0" class="form-control ${isBill ? 'input-cobro-recibido' : 'input-cobro-recibido'} p-1 text-center" style="font-size: 0.85rem;" data-val="${v}" placeholder="0">
            </div>`;

        // RECONSTRUCCIÓN: Usar clases específicas para facilitar el querySelector posterior si es necesario, 
        // pero manteniendo las clases originales para no romper calcularCobro()
        
        const inputHtml = (prefix) => `
            <div class="input-group mb-2">
                <span class="input-group-text ${styleClass} px-2 fw-bold" style="min-width: 60px; font-size: 1rem;"><i class="bi ${iconClass} me-2"></i>${valLabel(v)}</span>
                <input type="text" class="form-control input-cobro-${prefix} p-2 text-center fw-bold" style="font-size: 1.1rem;" data-val="${v}" placeholder="0">
            </div>`;

        function valLabel(num) {
            return num >= 1 ? num + '€' : (num * 100) + 'c';
        }

        if (isBill) {
            rBil.innerHTML += inputHtml('recibido');
            eBil.innerHTML += inputHtml('entregado');
        } else {
            rMon.innerHTML += inputHtml('recibido');
            eMon.innerHTML += inputHtml('entregado');
        }
    });

    const cobroContent = document.getElementById('cobro-content');
    if (cobroContent) {
        // Inyectar contenedor - Eliminado (HTML estático)
        cobroContent.addEventListener('input', calcularCobro);
    }
    calcularCobro();
}

/**
 * CÁLCULO DE ARQUEO RÁPIDO
 * Compara lo recibido con lo entregado y determina si falta dinero o si el 
 * cambio es correcto.
 */
function calcularCobro() {
    const totalACobrar = parseFloat(document.getElementById('cobro_total_a_cobrar').value) || 0;

    let totalRecibido = 0;
    document.querySelectorAll('.input-cobro-recibido').forEach(input => {
        totalRecibido += parseFloat(input.dataset.val) * (parseInt(input.value) || 0);
    });

    let totalEntregado = 0;
    document.querySelectorAll('.input-cobro-entregado').forEach(input => {
        totalEntregado += parseFloat(input.dataset.val) * (parseInt(input.value) || 0);
    });

    const cambioQueDebo = Math.max(0, totalRecibido - totalACobrar);
    const diferenciaFinal = cambioQueDebo - totalEntregado;

    // Actualizar UI
    if (document.getElementById('cobro_total_recibido')) document.getElementById('cobro_total_recibido').innerText = Utils.formatCurrency(totalRecibido);
    if (document.getElementById('cobro_total_entregado')) document.getElementById('cobro_total_entregado').innerText = Utils.formatCurrency(totalEntregado);
    if (document.getElementById('cobro_cambio_deber')) document.getElementById('cobro_cambio_deber').innerText = Utils.formatCurrency(cambioQueDebo);

    // Calcular y mostrar sugerencia de desglose óptimo
    mostrarSugerenciaCambio(Math.max(0, diferenciaFinal));

    const diffEl = document.getElementById('cobro_diferencia_final');
    if (diffEl) diffEl.innerText = Utils.formatCurrency(Math.abs(diferenciaFinal));

    const statusMsg = document.getElementById('cobro_status_msg');

    if (totalACobrar <= 0) {
        statusMsg.innerHTML = '<span class="text-muted">Introduce el total a cobrar</span>';
        diffEl.className = "display-5 fw-bold mb-0";
    } else if (totalRecibido < totalACobrar) {
        const falta = totalACobrar - totalRecibido;
        statusMsg.innerHTML = `<span class="text-warning">Faltan ${Utils.formatCurrency(falta)} por recibir</span>`;
        diffEl.className = "display-5 fw-bold mb-0 text-warning";
    } else if (Math.abs(diferenciaFinal) < 0.001) {
        statusMsg.innerHTML = '<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>¡Cambio Exacto!</span>';
        diffEl.className = "display-5 fw-bold mb-0 text-success";
    } else if (diferenciaFinal > 0) {
        statusMsg.innerHTML = `<span class="text-danger">Faltan ${Utils.formatCurrency(diferenciaFinal)} por devolver</span>`;
        diffEl.className = "display-5 fw-bold mb-0 text-danger";
    } else {
        statusMsg.innerHTML = `<span class="text-info">Has devuelto ${Utils.formatCurrency(Math.abs(diferenciaFinal))} de más</span>`;
        diffEl.className = "display-5 fw-bold mb-0 text-info";
    }
}

function mostrarSugerenciaCambio(cantidad) {
    const container = document.getElementById('sugerencia-cambio-container');
    if (!container) return;

    if (cantidad <= 0.009) { // Tolerancia mínima
        container.classList.add('d-none');
        container.innerHTML = '';
        return;
    }

    // Algoritmo Greedy para cambio óptimo
    // Trabajamos con céntimos (enteros) para evitar errores de punto flotante
    let restante = Math.round(cantidad * 100);
    const valores = APP_CONFIG.COBRO.VALORES.slice().sort((a, b) => b - a); // Asegurar orden descendente

    let html = '<div class="fw-bold mb-2 small text-uppercase"><i class="bi bi-lightbulb-fill me-2 text-warning"></i>Sugerencia de Cambio:</div><div class="d-flex flex-wrap gap-2">';
    let haySugerencia = false;

    valores.forEach(val => {
        const valCentimos = Math.round(val * 100);
        if (restante >= valCentimos) {
            const count = Math.floor(restante / valCentimos);
            restante = restante % valCentimos;

            if (count > 0) {
                haySugerencia = true;
                const isBill = val >= 5;
                const bgClass = isBill ? 'bg-success' : 'bg-secondary';
                const iconClass = isBill ? 'bi-cash' : 'bi-coin';

                html += `
                    <div class="badge ${bgClass} p-2 d-flex align-items-center" style="font-size: 0.9rem;">
                        <span class="fw-bold me-2 border-end border-white border-opacity-50 pe-2">${count}</span>
                        <i class="bi ${iconClass} me-1"></i>
                        <span>${Utils.formatCurrency(val)}</span>
                    </div>
                `;
            }
        }
    });

    html += '</div>';
    container.innerHTML = html;
    container.classList.toggle('d-none', !haySugerencia);
}

async function resetearCobro() {
    if (await Ui.showConfirm("¿Deseas limpiar la operación actual?")) {
        document.getElementById('cobro_total_a_cobrar').value = '';
        document.querySelectorAll('.input-cobro-recibido, .input-cobro-entregado').forEach(i => i.value = '');
        calcularCobro();
    }
}

window.resetearCobro = resetearCobro;
window.calcularCobro = calcularCobro;

window.imprimirCobro = () => {
    // 1. Limpiar tooltips
    if (Ui.hideAllTooltips) Ui.hideAllTooltips();

    // 2. Definir contenido a imprimir
    // Como el cobro es dinámico (inputs), PrintService.printElement podría no capturar los valores de los inputs.
    // Generaremos un reporte HTML estático basado en los valores actuales.
    
    const totalCobrar = document.getElementById('cobro_total_a_cobrar')?.value || "0";
    
    // Recalcular totales directamente de los inputs
    let sumaRecibido = 0;
    document.querySelectorAll('.input-cobro-recibido').forEach(input => {
        sumaRecibido += parseFloat(input.dataset.val) * (parseInt(input.value) || 0);
    });
    const totalRecibido = Utils.formatCurrency(sumaRecibido);

    let sumaEntregado = 0;
    document.querySelectorAll('.input-cobro-entregado').forEach(input => {
        sumaEntregado += parseFloat(input.dataset.val) * (parseInt(input.value) || 0);
    });
    const totalEntregado = Utils.formatCurrency(sumaEntregado);

    const cambio = document.getElementById('cobro_cambio_deber')?.innerText || "0";
    const diferencia = document.getElementById('cobro_diferencia_final')?.innerText || "0";

    const receivedBills = Array.from(document.querySelectorAll('.input-cobro-recibido')).filter(i => i.value > 0).map(i => `${i.value}x ${i.dataset.val}€`).join(', ');
    const givenBills = Array.from(document.querySelectorAll('.input-cobro-entregado')).filter(i => i.value > 0).map(i => `${i.value}x ${i.dataset.val}€`).join(', ');

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Recibo de Cobro</title>
            <link href="assets/vendor/bootstrap.min.css" rel="stylesheet" />
            <link rel="stylesheet" href="assets/css/styles.css" />
            <style>
                body { padding: 40px; background: white; font-family: 'Segoe UI', sans-serif; }
                .recibo-container { max-width: 600px; margin: 0 auto; border: 2px solid #000; padding: 20px; }
                h1 { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                .row { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px dashed #ccc; padding-bottom: 5px; }
                .label { font-weight: bold; }
                .value { font-size: 1.2em; }
                .total-row { border-top: 2px solid #000; border-bottom: none; margin-top: 20px; padding-top: 10px; font-size: 1.5em; }
                .footer { text-align: center; margin-top: 30px; font-size: 0.8em; color: #555; }
            </style>
        </head>
        <body>
            <div class="recibo-container">
                <h1>RECIBO DE COBRO</h1>
                
                <div class="row">
                    <span class="label">Total a Cobrar:</span>
                    <span class="value">${Utils.formatCurrency(parseFloat(totalCobrar))}</span>
                </div>
                
                <div class="row">
                    <span class="label">Total Recibido:</span>
                    <span class="value">${totalRecibido}</span>
                </div>
                <div style="font-size: 0.9em; color: #666; margin-bottom: 15px; padding-left: 10px;">
                    Desglose: ${receivedBills || 'Sin detalle'}
                </div>

                <div class="row">
                    <span class="label">Total Entregado:</span>
                    <span class="value">${totalEntregado}</span>
                </div>
                <div style="font-size: 0.9em; color: #666; margin-bottom: 15px; padding-left: 10px;">
                    Desglose: ${givenBills || 'Sin detalle'}
                </div>

                <div class="row total-row">
                    <span class="label">CAMBIO A DEVOLVER:</span>
                    <span class="value fw-bold">${cambio}</span>
                </div>

                <div class="footer">
                    <div>Emisión: ${new Date().toLocaleString()}</div>
                    <div>Hotel Garoé - Recepción</div>
                </div>
            </div>
        </body>
        </html>
    `;

    // Usar PrintService para imprimir este contenido generado
    if (window.PrintService) {
        PrintService.printHTML(htmlContent);
    } else {
        window.print();
    }
};
