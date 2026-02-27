import { Utils } from '../core/Utils.js';
import { Ui } from '../core/Ui.js';

/**
 * MÓDULO OCR DATÁFONOS (ocr_datafonos.js)
 * --------------------------------------
 * Digitalización de tickets de POS (La Caixa / BBVA)
 */

let moduloInicializado = false;
let transacciones = [];
let tesseractWorker = null;

export async function inicializarOCR() {
    if (moduloInicializado) return;

    _setupEventListeners();
    moduloInicializado = true;
    console.log("Modulo OCR inicializado");
}

function _setupEventListeners() {
    const fileInput = document.getElementById('ocr-file-input');
    const dropzone = document.getElementById('ocr-dropzone');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => _handleFiles(e.target.files));
    }

    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('drag-active');
        });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-active'));
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-active');
            _handleFiles(e.dataTransfer.files);
        });
    }
}

async function _handleFiles(files) {
    if (!files || files.length === 0) return;

    for (const file of files) {
        if (file.type.startsWith('image/')) {
            await _procesarImagen(file);
        } else if (file.type === 'application/pdf') {
            Ui.showToast("El soporte para PDF estará disponible próximamente. Por ahora usa imágenes.", "warning");
        }
    }
}

async function _procesarImagen(file) {
    const statusList = document.getElementById('ocr-status-list');
    const itemId = `ocr-item-${Date.now()}`;

    // Añadimos item a la lista de progreso
    const itemHtml = `
        <div id="${itemId}" class="ocr-status-item animate-fade-in mb-2 p-2 border rounded shadow-sm bg-light">
            <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="small fw-bold text-truncate" style="max-width: 150px;">${file.name}</span>
                <span class="badge bg-primary ocr-percent">0%</span>
            </div>
            <div class="progress" style="height: 5px;">
                <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%"></div>
            </div>
        </div>
    `;
    statusList.insertAdjacentHTML('afterbegin', itemHtml);

    try {
        if (!tesseractWorker) {
            Ui.showToast("Cargando motor de reconocimiento...", "info");
            // Carga dinámica de Tesseract desde CDN
            if (typeof Tesseract === 'undefined') {
                await _loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
            }
            tesseractWorker = await Tesseract.createWorker('spa', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const percent = Math.floor(m.progress * 100);
                        const item = document.getElementById(itemId);
                        if (item) {
                            item.querySelector('.progress-bar').style.width = `${percent}%`;
                            item.querySelector('.ocr-percent').innerText = `${percent}%`;
                        }
                    }
                }
            });
        }

        const { data: { text } } = await tesseractWorker.recognize(file);
        console.log("OCR Text Result:", text);

        _parsearTexto(text);

        // Finalizar item
        const item = document.getElementById(itemId);
        if (item) {
            item.classList.remove('bg-light');
            item.classList.add('bg-success-soft');
            item.querySelector('.ocr-percent').className = 'badge bg-success';
            item.querySelector('.ocr-percent').innerText = 'Listo';
            setTimeout(() => item.remove(), 3000);
        }

    } catch (err) {
        console.error("OCR Error:", err);
        Ui.showToast("Error al procesar la imagen", "danger");
        const item = document.getElementById(itemId);
        if (item) item.remove();
    }
}

function _parsearTexto(text) {
    const banco = document.querySelector('input[name="ocrBank"]:checked').value;
    const lineas = text.split('\n');
    let nuevasTransacciones = [];

    // Algoritmo básico de extracción vía RegEx
    // Buscamos patrones de importes (X.XX o X,XX) y posibles tarjetas (****)
    const regexImporte = /([0-9]+[.,][0-9]{2})\s*€?/i;
    const regexTarjeta = /([0-9\*]{4,16})/i;

    lineas.forEach(linea => {
        const matchImporte = linea.match(regexImporte);
        if (matchImporte) {
            let importe = matchImporte[1].replace(',', '.');
            if (parseFloat(importe) > 0) {
                // Intentamos buscar tarjeta en la misma linea o cerca (simplificado)
                const matchTarjeta = linea.match(regexTarjeta);
                nuevasTransacciones.push({
                    id: Date.now() + Math.random(),
                    banco: banco.toUpperCase(),
                    fecha: Utils.getTodayLocale ? Utils.getTodayLocale() : Utils.formatDate(Utils.getTodayISO()),
                    tarjeta: matchTarjeta ? matchTarjeta[1] : '****',
                    importe: parseFloat(importe)
                });
            }
        }
    });

    if (nuevasTransacciones.length > 0) {
        transacciones = [...transacciones, ...nuevasTransacciones];
        _renderizarResultados();
        Ui.showToast(`Se detectaron ${nuevasTransacciones.length} posibles cobros`, "success");
    } else {
        Ui.showToast("No se detectaron transacciones claras. Intenta con otra foto.", "warning");
    }
}

function _renderizarResultados() {
    const tbody = document.getElementById('tbody-ocr-resultados');
    const emptyState = document.getElementById('ocr-empty-state');

    if (transacciones.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('d-none');
        _actualizarTotales();
        return;
    }

    emptyState.classList.add('d-none');

    Ui.renderTable('tbody-ocr-resultados', transacciones, (item) => `
        <tr data-id="${item.id}" class="animate-fade-in">
            <td><span class="badge ${item.banco === 'CAIXA' ? 'bg-primary' : 'bg-info'}">${item.banco}</span></td>
            <td><input type="text" class="form-control form-control-sm border-0 bg-transparent" value="${item.fecha}" onchange="window.ocrUpdateField('${item.id}', 'fecha', this.value)"></td>
            <td><input type="text" class="form-control form-control-sm border-0 bg-transparent" value="${item.tarjeta}" onchange="window.ocrUpdateField('${item.id}', 'tarjeta', this.value)"></td>
            <td>
                <div class="input-group input-group-sm">
                    <input type="number" step="0.01" class="form-control border-0 bg-transparent fw-bold" value="${item.importe}" onchange="window.ocrUpdateField('${item.id}', 'importe', this.value)">
                    <span class="input-group-text border-0 bg-transparent">€</span>
                </div>
            </td>
            <td class="text-end">
                <button class="btn btn-sm btn-link text-danger" onclick="window.ocrEliminarFila('${item.id}')">
                    <i class="bi bi-x-circle"></i>
                </button>
            </td>
        </tr>
    `);

    _actualizarTotales();
}

function _actualizarTotales() {
    const total = transacciones.reduce((sum, t) => sum + (parseFloat(t.importe) || 0), 0);
    const montoEl = document.getElementById('ocr-total-monto');
    if (montoEl) montoEl.innerText = Utils.formatCurrency(total);
}

// --- GLOBAL EXPOSURE ---

window.ocrUpdateField = (id, field, value) => {
    const idx = transacciones.findIndex(t => t.id == id);
    if (idx !== -1) {
        if (field === 'importe') value = parseFloat(value) || 0;
        transacciones[idx][field] = value;
        _actualizarTotales();
    }
};

window.ocrEliminarFila = (id) => {
    transacciones = transacciones.filter(t => t.id != id);
    _renderizarResultados();
};

window.ocrAnadirFila = () => {
    const banco = document.querySelector('input[name="ocrBank"]:checked').value;
    transacciones.push({
        id: Date.now(),
        banco: banco.toUpperCase(),
        fecha: Utils.formatDate(Utils.getTodayISO()),
        tarjeta: '****',
        importe: 0
    });
    _renderizarResultados();
};

window.limpiarOCR = async () => {
    if (await Ui.showConfirm("¿Estás seguro de que quieres borrar todos los datos leídos?")) {
        transacciones = [];
        _renderizarResultados();
        const statusList = document.getElementById('ocr-status-list');
        if (statusList) statusList.innerHTML = '';
    }
};

window.imprimirOCR = () => {
    const user = Utils.validateUser();
    if (!user) return;

    const printDate = document.getElementById('print-date-ocr');
    if (printDate) printDate.textContent = Utils.formatDate(Utils.getTodayISO());

    window.print();
};

// Helper para carga de scripts
function _loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
