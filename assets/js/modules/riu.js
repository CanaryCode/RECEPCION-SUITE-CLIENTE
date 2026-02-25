import { APP_CONFIG } from "../core/Config.js?v=V145_VAL_FIX";
import { riuService } from '../services/RiuService.js?v=V145_VAL_FIX';
import { Utils } from '../core/Utils.js?v=V145_VAL_FIX';
import { Ui } from '../core/Ui.js?v=V145_VAL_FIX';
import { sessionService } from '../services/SessionService.js?v=V145_VAL_FIX';
import { PdfService } from '../core/PdfService.js?v=V145_VAL_FIX';

/**
 * MÓDULO DE GESTIÓN RIU CLASS (riu.js)
 * -----------------------------------
 * Administra el programa de fidelización RIU Class dentro del hotel.
 * Permite registrar clientes, visualizar su ubicación en rack y generar 
 * reportes visuales (HTML rico) para enviar por email a dirección.
 */

let editId = null;
let riuChartInstance = null;

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================

export async function inicializarRiu() {
    riuService.init(); // Non-blocking init

    // 1. CONFIGURAR VISTAS (Conmutador)
    Ui.setupViewToggle({
        buttons: [
            { id: 'btnVistaTrabajoRiu', viewId: 'riu-trabajo', onShow: mostrarClientes },
            { id: 'btnVistaRackRiu', viewId: 'riu-rack', onShow: renderVistaRackRiu }
        ]
    });

    // 2. CONFIGURAR FORMULARIO (Asistente)
    Ui.handleFormSubmission({
        formId: 'formCliente',
        service: riuService,
        idField: 'riu_id_hidden', // This defaults to finding the hidden input
        serviceIdField: 'id',     // The Service stores key as 'id'
        mapData: (rawData) => {
            console.log("[Riu] MapData raw input:", rawData); // DEBUG: Identificar campos capturados
            const habInput = rawData.habitacion ? rawData.habitacion.trim().padStart(3, '0') : '000';
            const nHab = parseInt(habInput);

            // Validar si el usuario se equivocó de campo (Nombre tiene números, Habitación vacía)
            if (nHab === 0 && /^\d+$/.test(rawData.nombre.trim())) {
                 Ui.showToast(`Parece que escribiste el número (${rawData.nombre}) en el campo NOMBRE. Por favor, ponlo en el campo HABITACIÓN.`, 'warning', 6000);
                 return null;
            }

            // Validar existencia de la habitación
            const existe = APP_CONFIG?.HOTEL?.STATS_CONFIG?.RANGOS?.some(r => nHab >= r.min && nHab <= r.max);
            if (!existe) {
                if (nHab === 0) {
                     Ui.showToast(`El campo HABITACIÓN es obligatorio.`, 'danger');
                } else {
                      Ui.showToast(`Error: La habitación ${habInput} no existe en el hotel.`, 'danger');
                }
                return null;
            }

            // Validar duplicados (solo si es nuevo - idField vacio)
            const isEdit = !!rawData.riu_id_hidden;
            if (!isEdit) {
                const duplicada = riuService.getClientes().some(c => c.habitacion === habInput);
                if (duplicada) {
                    Ui.showToast(`Error: La habitación ${habInput} ya está registrada.`, 'warning');
                    return null;
                }
            }

            return {
                id: isEdit ? parseInt(rawData.riu_id_hidden) : Date.now(),
                nombre: rawData.nombre.trim(),
                habitacion: habInput,
                tipo_tarjeta: rawData.tipo_tarjeta, // Using name='tipo_tarjeta'
                fecha_entrada: rawData.fecha_entrada,
                fecha_salida: rawData.fecha_salida,
                comentarios: rawData.comentarios.trim()
            };
        },
        onSuccess: () => {
            const btn = document.getElementById('btnSubmitRiu');
            if (btn) btn.innerHTML = '<i class="bi bi-person-check-fill me-2"></i>Registrar Cliente';
            document.getElementById('riu_id_hidden').value = '';
            establecerFechasPorDefecto();
            mostrarClientes();
            Ui.showToast("Cliente RIU registrado.");
            // Si estamos en rack, actualizar (aunque handleViewToggle ya lo hace si está activo)
            if (!document.getElementById('riu-rack').classList.contains('d-none')) {
                renderVistaRackRiu();
            }
        }
    });

    // Botones extra
    document.getElementById('btnLimpiarSalidas')?.addEventListener('click', limpiarSalidasHoyManual);
    document.getElementById('btnEnviarReporte')?.addEventListener('click', enviarEmailDirecto);
    document.getElementById('btnImprimirRiu')?.addEventListener('click', imprimirRiu);

    // Cargar datos iniciales
    await limpiarClientesCaducados();
    establecerFechasPorDefecto();
}

/**
 * Función global para facilitar el cambio programático
 */
window.cambiarVistaRiu = (vista) => {
    const btn = vista === 'trabajo' ? 'btnVistaTrabajoRiu' : 'btnVistaRackRiu';
    document.getElementById(btn)?.click();
};

// ==========================================
// 3. RENDERIZADO
// ==========================================

/**
 * Muestra la lista de clientes registrados en el rack de RIU Class.
 */
export async function mostrarClientes() {
    await riuService.init();
    const clientes = riuService.getClientes();
    
    // Filtro por habitación si se requiere (ej: desde el buscador del rack)
    const busqueda = document.getElementById('searchRiu')?.value.toLowerCase() || "";
    const filtered = busqueda 
        ? clientes.filter(c => c.habitacion.toLowerCase().includes(busqueda) || c.nombre.toLowerCase().includes(busqueda))
        : clientes;

    Ui.renderTable('tablaCuerpo', filtered, renderFilaRiu, 'No hay clientes RIU registrados hoy.');
    
    // Enable Sorting
    Ui.enableTableSorting('table-riu', filtered, (sortedData) => {
        Ui.renderTable('tablaCuerpo', sortedData, renderFilaRiu, 'No hay clientes RIU registrados hoy.');
    });

    actualizarEstadisticas(clientes);
}

/**
 * RENDERIZAR FILA RIU (Helper para renderTable)
 */
function renderFilaRiu(c) {
    let badgeClass = 'bg-riu-class';
    if (c.tipo_tarjeta === 'Oro') badgeClass = 'bg-riu-oro';
    else if (c.tipo_tarjeta === 'Diamante') badgeClass = 'bg-riu-diamante';

    return `
        <tr>
            <td class="fw-bold">${c.nombre}</td>
            <td><span class="badge bg-secondary">${c.habitacion}</span></td>
            <td><span class="badge ${badgeClass}">${c.tipo_tarjeta}</span></td>
            <td>${Utils.formatDate(c.fecha_salida)}</td>
            <td class="small text-muted">${c.comentarios}</td>
            <td class="text-end">
                <button onclick="prepararEdicionCliente(${c.id})" class="btn btn-sm btn-outline-primary border-0 me-1" data-bs-toggle="tooltip" data-bs-title="Editar"><i class="bi bi-pencil"></i></button>
                <button onclick="eliminarCliente(${c.id})" class="btn btn-sm btn-outline-danger border-0" data-bs-toggle="tooltip" data-bs-title="Eliminar"><i class="bi bi-trash"></i></button>
            </td>
        </tr>`;
}

/**
 * RENDER VISTA RACK RIU
 * Muestra el hotel planta por planta, coloreando las habitaciones según el tipo
 * de tarjeta (Class, Oro, Diamante) del cliente alojado.
 */
async function renderVistaRackRiu() {
    const rackCont = document.getElementById('rack-riu-habitaciones');
    if (!rackCont) return;

    const clientes = riuService.getClientes();
    const rangos = APP_CONFIG.HOTEL.STATS_CONFIG.RANGOS;

    rackCont.innerHTML = '';
    rangos.forEach(r => {
        const header = document.createElement('div');
        header.className = 'w-100 mt-3 mb-2 d-flex align-items-center';
        header.innerHTML = `<span class="badge bg-secondary me-2">Planta ${r.planta}</span><hr class="flex-grow-1 my-0 opacity-25">`;
        rackCont.appendChild(header);

        for (let i = r.min; i <= r.max; i++) {
            const num = i.toString().padStart(3, '0');
            const cliente = clientes.find(c => c.habitacion === num);

            let colorClass = 'bg-white text-muted border';
            let tooltip = 'Libre';
            let content = num;

            if (cliente) {
                tooltip = `${cliente.nombre} (${cliente.tipo_tarjeta})`;
                if (cliente.tipo_tarjeta === 'Class') colorClass = 'bg-riu-class text-white border-0';
                else if (cliente.tipo_tarjeta === 'Oro') colorClass = 'bg-riu-oro text-dark border-0';
                else if (cliente.tipo_tarjeta === 'Diamante') colorClass = 'bg-riu-diamante text-white border-0';
                // Añadir inicial del cliente para mejor visualización
                content = `<div>${num}</div><div style="font-size:0.6rem; overflow:hidden; white-space:nowrap; text-align:center; width:100%">${cliente.nombre.split(' ')[0]}</div>`;
            }

            const box = document.createElement('div');
            box.className = `d-flex flex-column align-items-center justify-content-center rounded rack-box ${colorClass}`;
            box.title = tooltip;
            box.innerHTML = content;

            // MODAL UNIVERSAL
            box.style.cursor = 'pointer';
            box.onclick = () => {
                if (window.RoomDetailModal) RoomDetailModal.open(num);
                else console.error("RoomDetailModal unavailable");
            };

            rackCont.appendChild(box);
        }
    });
    
    // Inicializar tooltips del rack
    Ui.initTooltips(rackCont);
    
    actualizarEstadisticas(clientes);
}

function actualizarEstadisticas(clientes) {
    const rangos = APP_CONFIG.HOTEL.STATS_CONFIG.RANGOS;
    const totalHab = rangos.reduce((acc, r) => acc + (r.max - r.min + 1), 0);

    // Contadores
    const counts = {
        'Class': 0,
        'Oro': 0,
        'Diamante': 0
    };

    clientes.forEach(c => {
        if (counts[c.tipo_tarjeta] !== undefined) counts[c.tipo_tarjeta]++;
    });

    const ocupadas = clientes.length;
    const libres = totalHab - ocupadas;
    const porcentaje = ((ocupadas / totalHab) * 100).toFixed(1);

    const textEl = document.getElementById('totalOcupacionText');
    if (textEl) textEl.innerText = `${porcentaje}%`;

    // Actualizar etiquetas visuales
    const statsLabels = document.getElementById('statsLabels');
    if (statsLabels) {
        const tipos = [
            { nombre: 'Class', count: counts['Class'], color: 'bg-riu-class' },
            { nombre: 'Oro', count: counts['Oro'], color: 'bg-riu-oro' },
            { nombre: 'Diamante', count: counts['Diamante'], color: 'bg-riu-diamante' },
            { nombre: 'Libres', count: libres, color: 'bg-secondary text-white' }
        ];

        statsLabels.innerHTML = tipos.map(t => `
            <div class="col-6 col-md-3">
                <div class="p-2 border rounded bg-white shadow-sm h-100">
                    <div class="small text-muted mb-1 fw-bold text-uppercase" style="font-size: 0.65rem;">${t.nombre}</div>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="h5 mb-0 fw-bold">${t.count}</span>
                        <span class="badge ${t.color}" style="font-size: 0.6rem;">
                            ${((t.count / totalHab) * 100).toFixed(1)}%
                        </span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Chart.js
    const ctx = document.getElementById('riuChart')?.getContext('2d');
    if (ctx) {
        if (riuChartInstance) riuChartInstance.destroy();
        riuChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Class', 'Oro', 'Diamante', 'Libres'],
                datasets: [{
                    data: [counts['Class'], counts['Oro'], counts['Diamante'], libres],
                    backgroundColor: ['#0d6efd', '#ffc107', '#212529', '#dee2e6'],
                    borderWidth: 1
                }]
            },
            options: { cutout: '75%', plugins: { legend: { display: false } } }
        });
    }
}

// ==========================================
// 4. ACCIONES GLOBALES
// ==========================================

export async function prepararEdicionCliente(id) {
    const c = riuService.getByKey(id);
    if (c) {
        cambiarVistaRiu('trabajo');
        Utils.setVal('riu_id_hidden', c.id);
        Utils.setVal('nombre', c.nombre);
        Utils.setVal('habitacion', c.habitacion);
        Utils.setVal('tipo_tarjeta', c.tipo_tarjeta);
        Utils.setVal('fecha_entrada', c.fecha_entrada);
        Utils.setVal('fecha_salida', c.fecha_salida);
        Utils.setVal('comentarios', c.comentarios);
        
        const btn = document.getElementById('btnSubmitRiu');
        if (btn) btn.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Actualizar Cliente';
        document.getElementById('formCliente')?.scrollIntoView({ behavior: 'smooth' });
    }
}

export async function eliminarCliente(id) {
    const cliente = riuService.getByKey(id);
    if (cliente && await Ui.showConfirm(`¿Eliminar registro de la habitación ${cliente.habitacion} (${cliente.nombre})?`)) {
        await riuService.removeCliente(id);
        Ui.showToast("Cliente eliminado.");
        mostrarClientes();
    }
};

export async function limpiarClientesCaducados() {
    riuService.limpiarSalidas();
}

export async function limpiarSalidasHoyManual() {
    if (await Ui.showConfirm('¿Deseas eliminar del listado a todos los clientes que tienen salida hoy?')) {
        const hoy = Utils.getTodayISO();
        const clientes = riuService.getClientes();
        const filtrados = clientes.filter(c => c.fecha_salida !== hoy);
        riuService.saveAll(filtrados);
        mostrarClientes();
    }
}

/**
 * REPORTE EMAIL (Copiado Rico)
 * Genera un reporte formateado con tablas y colores, lo copia al portapapeles 
 * como HTML y abre el cliente de correo predeterminado del sistema.
 */
export async function enviarEmailDirecto() {
    const clientes = riuService.getClientes();
    const rangos = APP_CONFIG.HOTEL.STATS_CONFIG.RANGOS;
    const totalHab = rangos.reduce((acc, r) => acc + (r.max - r.min + 1), 0);
    const ocupacion = ((clientes.length / totalHab) * 100).toFixed(1);

    // Generar cuerpo para copiar al portapapeles (HTML Rico)
    const htmlReporte = generarReporteHTML(clientes, ocupacion, totalHab);

    try {
        if (typeof ClipboardItem !== 'undefined') {
            const blobHtml = new Blob([htmlReporte], { type: "text/html" });
            const blobText = new Blob([htmlReporte.replace(/<[^>]*>/g, '')], { type: "text/plain" });
            const data = [new ClipboardItem({ "text/html": blobHtml, "text/plain": blobText })];
            await navigator.clipboard.write(data);
            alert("¡Reporte copiado! Pégalo en el cuerpo del correo.");
        } else {
            // Fallback
            throw new Error("ClipboardItem no soportado");
        }
    } catch (err) {
        // Fallback texto plano
        const textoPlano = `REPORTE RIU CLASS - ${Utils.formatDate(new Date())}\nOcupación: ${ocupacion}%\n\n` +
            clientes.map(c => `${c.habitacion} - ${c.nombre} (${c.tipo_tarjeta})`).join('\n');
        navigator.clipboard.writeText(textoPlano);
        alert("Reporte copiado como texto plano (Navegador no soporta copiado rico automátic).");
    }

    // Abrir mailto
    const asunto = `Reporte RIU Class - ${Utils.formatDate(new Date())}`;
    const cuerpoMail = `Buenos días,\n\nAdjunto reporte RIU Class.\n\n[PEGAR REPORTE AQUÍ]\n\nSaludos.`;
    window.location.href = `mailto:direccion@hotelgaroe.com?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpoMail)}`;
}

function generarReporteHTML(clientes, ocupacion, totalHab) {
    // Generación del HTML para el reporte (simplificado del original para mayor claridad)
    const counts = { 'Class': 0, 'Oro': 0, 'Diamante': 0 };
    clientes.forEach(c => { if (counts[c.tipo_tarjeta] !== undefined) counts[c.tipo_tarjeta]++ });

    return `
        <div style="font-family: Arial, sans-serif; color: #333;">
            <h2 style="color: #0d6efd;">REPORTE DIARIO RIU CLASS</h2>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Ocupación:</strong> ${ocupacion}% (${clientes.length}/${totalHab})</p>
            <p>Class: ${counts['Class']} | Oro: ${counts['Oro']} | Diamante: ${counts['Diamante']}</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top:10px;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="border:1px solid #ddd; padding:8px;">Hab</th>
                        <th style="border:1px solid #ddd; padding:8px;">Nombre</th>
                        <th style="border:1px solid #ddd; padding:8px;">Tarjeta</th>
                        <th style="border:1px solid #ddd; padding:8px;">Salida</th>
                    </tr>
                </thead>
                <tbody>
                    ${clientes.map(c => `
                        <tr>
                            <td style="border:1px solid #ddd; padding:6px;">${c.habitacion}</td>
                            <td style="border:1px solid #ddd; padding:6px;">${c.nombre}</td>
                            <td style="border:1px solid #ddd; padding:6px;">
                                <span style="font-weight:bold; color:${c.tipo_tarjeta === 'Oro' ? '#d39e00' : (c.tipo_tarjeta === 'Diamante' ? '#000' : '#0d6efd')}">${c.tipo_tarjeta}</span>
                            </td>
                            <td style="border:1px solid #ddd; padding:6px;">${Utils.formatDate(c.fecha_salida)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * IMPRIMIR REPORTE RIU CLASS (PdfService)
 * Genera un informe PDF profesional con el estado actual de la ocupación RIU.
 */
/**
 * GENERAR CONTENIDO LIMPIO PARA REPORTE
 * Crea un clon del listado RIU sin formularios ni botones para impresión/PDF.
 */
function generarContenidoLimpioRiu() {
    const reportHeader = document.querySelector('.report-header-print');
    const workView = document.getElementById('riu-trabajo');
    const user = sessionService.getUser();
    
    const printContainer = document.createElement('div');
    
    // 1. Clonar cabecera de reporte
    if (reportHeader) {
        const headerClone = reportHeader.cloneNode(true);
        headerClone.classList.remove('d-none', 'd-print-block');
        headerClone.style.display = 'block';
        headerClone.style.marginBottom = '20px';
        headerClone.style.borderBottom = '2px solid #0d6efd';
        headerClone.style.paddingBottom = '10px';
        
        const pDate = headerClone.querySelector('#print-date-riu');
        const pName = headerClone.querySelector('#print-repc-nombre-riu');
        const now = new Date();
        if (pDate) pDate.textContent = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (pName) pName.textContent = user;
        
        printContainer.appendChild(headerClone);
    }

    // 2. Clonar la tabla (excluyendo lo innecesario)
    if (workView) {
        const workClone = workView.cloneNode(true);
        const form = workClone.querySelector('#formCliente');
        if (form) form.style.display = 'none';
        workClone.querySelectorAll('.btn, .no-print, .module-toolbar').forEach(el => el.style.display = 'none');
        printContainer.appendChild(workClone);
    }
    
    return printContainer;
}

/**
 * IMPRIMIR REPORTE RIU CLASS (PrintService)
 * Abre el diálogo de impresión estándar del navegador.
 */
async function imprimirRiu() {
    const isRack = document.getElementById('btnVistaRackRiu')?.classList.contains('active');
    
    if (isRack) {
        if (window.PrintService) {
            PrintService.printElementAsImage('riu-rack', `Rack RIU Class - ${Utils.getTodayISO()}`);
        } else {
            window.print();
        }
        return;
    }

    if (window.PrintService) {
        const contenido = generarContenidoLimpioRiu();
        PrintService.printHTML(contenido.innerHTML, `Informe RIU Class - ${Utils.getTodayISO()}`);
    } else {
        window.print();
    }
}

/**
 * GUARDAR PDF RIU CLASS (PdfService)
 * Genera y descarga un archivo PDF profesional.
 */
async function guardarRiuPDF() {
    const user = sessionService.getUser();
    if (!user) {
        Ui.showToast("⚠️ No hay usuario seleccionado.", "warning");
        return;
    }

    const contenido = generarContenidoLimpioRiu();

    const pdfExito = await PdfService.generateReport({
        title: "INFORME DE CONTROL RIU CLASS",
        author: user,
        element: contenido,
        filename: `REPORT_RIU_${Utils.getTodayISO()}.pdf`
    });

    if (pdfExito) {
        Ui.showToast("PDF generado correctamente.", "success");
    } else {
        Ui.showToast("Error al generar PDF.", "danger");
    }
}


/**
 * ESTABLECER FECHAS POR DEFECTO
 * Pre-rellena los campos de fecha de entrada (hoy) y salida (mañana).
 */
function establecerFechasPorDefecto() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const fmt = (d) => d.toISOString().split('T')[0];

    Utils.setVal('fecha_entrada', fmt(today));
    Utils.setVal('fecha_salida', fmt(tomorrow));
}

// Exportar funciones para uso en HTML (OnClicks)
window.prepararEdicionCliente = prepararEdicionCliente;
window.eliminarCliente = eliminarCliente;
window.limpiarSalidasHoyManual = limpiarSalidasHoyManual;
window.enviarEmailDirecto = enviarEmailDirecto;
window.cambiarVistaRiu = cambiarVistaRiu;
window.imprimirRiu = imprimirRiu;
window.guardarRiuPDF = guardarRiuPDF;
