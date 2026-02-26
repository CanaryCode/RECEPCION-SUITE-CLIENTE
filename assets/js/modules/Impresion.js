import { APP_CONFIG } from "../core/Config.js?v=V153_DB_CONFIG";
import { Utils } from "../core/Utils.js?v=V145_VAL_FIX";
import { Ui } from "../core/Ui.js?v=V145_VAL_FIX";

/**
 * MÓDULO DE IMPRESIÓN DINÁMICA - ISOLATED WINDOW ENGINE
 * -----------------------------------------------------------
 * Re-diseño total: Usa una ventana independiente para garantizar
 * el renderizado y la orientación horizontal (Landscape) de 14x11cm.
 */

const TEMPLATE_CONFIGS = {
  tarjetero: {
    id: "tarjetero",
    label: "Tarjetero Cliente",
    width: 140,
    height: 110,
    coordinates: {
      nombre: { x: 75, y: 12, h: 10, w: 60, label: "Nombre" },
      habitacion: { x: 75, y: 25, h: 10, w: 60, label: "Habitación" },
      pax: { x: 75, y: 38, h: 10, w: 60, label: "Reservas" },
      regime: { x: 75, y: 51, h: 10, w: 60, label: "Régimen" },
      entrada: { x: 75, y: 65, h: 10, w: 60, label: "Llegadas" },
      salida: { x: 75, y: 78, h: 10, w: 60, label: "Salida" },
      agencia: { x: 75, y: 91, h: 5, w: 60, label: "Agencia" },
    },
  },
  cocktail: {
    id: "cocktail",
    label: "Invitación Cocktail",
    width: 165,
    height: 100,
    coordinates: {
      nombre_invitado: { x: 15, y: 40, h: 12, w: 145, label: "Nombre" },
      hora_cocktail: { x: 74, y: 52, h: 10, w: 15, label: "Hora" },
      fecha_cocktail: { x: 89, y: 52, h: 10, w: 16, label: "Fecha" },
      lugar_cocktail: { x: 110, y: 52, h: 10, w: 53, label: "Lugar" },
    },
  },
};

let currentTemplateId =
  localStorage.getItem("impresion_current_template") || "tarjetero";
let currentCoordinates = { ...TEMPLATE_CONFIGS[currentTemplateId].coordinates };
let cocktailMetadata = {
  fecha: "",
  hora: "",
  lugar: "",
};
let lastParsedData = []; // Store data for session editing
let dragSubject = null; // { key, startX, startY, initialX, initialY }
let currentRotation = parseInt(
  localStorage.getItem("impresion_rotation") || "0",
);
let activeFieldKey = null;

export async function inicializarImpresion() {
  const root = document.getElementById("impresion-root");
  if (!root) return;

  // Si ya está inicializado, solo refrescamos elementos dependientes de la config
  if (window.__impresion_initialized) {
    refreshConfigDependentElements();
    return;
  }
  if (!root) {
    const tab = document.getElementById("impresion-content");
    if (tab) {
      root = document.createElement("div");
      root.id = "impresion-root";
      tab.appendChild(root);
    }
  }

  if (!root) return;

  try {
    loadCoordinates();

    const response = await fetch(
      `assets/templates/impresion.html?v=${Date.now()}`,
    );
    if (!response.ok) throw new Error("Plantilla no encontrada");
    root.innerHTML = await response.text();

    inyectarEstilosBase();

    Ui.setupViewToggle({
      buttons: [
        { id: "btnImpresionTrabajo", viewId: "impresion-trabajo" },
        { id: "btnImpresionVista", viewId: "impresion-tarjetero" },
      ],
    });

    document
      .getElementById("btnProcesarWord")
      ?.addEventListener("click", () => procesarDatosWord());

    // Listeners para cocktail metadata
    document
      .getElementById("cocktail-fecha")
      ?.addEventListener("input", (e) => {
        cocktailMetadata.fecha = e.target.value;
        syncCocktailMetadata();
      });
    document.getElementById("cocktail-hora")?.addEventListener("input", (e) => {
      cocktailMetadata.hora = e.target.value;
      syncCocktailMetadata();
    });
    document
      .getElementById("cocktail-lugar")
      ?.addEventListener("change", (e) => {
        cocktailMetadata.lugar = e.target.value;
        syncCocktailMetadata();
      });
    // Initial state
    refreshConfigDependentElements();
    setTemplateType(currentTemplateId, true);

    window.ejecutarImpresionIframe = ejecutarImpresionAislada;

    window.resetCoordinate = resetCoordinate;
    window.updateCoordinateValue = updateCoordinateValue;
    window.updateActiveFieldCoord = updateActiveFieldCoord;
    window.resetActiveField = resetActiveField;
    window.setTemplateType = setTemplateType;
    window.setRotation = setRotation;
    window.updateNacionalidad = updateNacionalidad;
    window.imprimirLote = imprimirLote;

    refreshConfigDependentElements();

    // Global mouse events for dragging
    document.addEventListener("mousemove", handleFieldMouseMove);
    document.addEventListener("mouseup", handleFieldMouseUp);

    window.__impresion_initialized = true;
    console.log(
      "%c[Impresion] ISOLATED WINDOW ENGINE LOADED",
      "color: #ff00ff; font-weight: bold;",
    );

    Ui.initTooltips?.();
  } catch (error) {
    console.error("[Impresion] Error:", error);
    root.innerHTML = `<div class="alert alert-danger m-3">Error v1.40: ${error.message}</div>`;
  }
}

function loadCoordinates() {
  const storageKey = `impresion_coords_${currentTemplateId}`;
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      currentCoordinates = JSON.parse(saved);
    } catch (e) {
      currentCoordinates = JSON.parse(
        JSON.stringify(TEMPLATE_CONFIGS[currentTemplateId].coordinates),
      );
    }
  } else {
    currentCoordinates = JSON.parse(
      JSON.stringify(TEMPLATE_CONFIGS[currentTemplateId].coordinates),
    );
  }
}

function saveCoordinates() {
  const storageKey = `impresion_coords_${currentTemplateId}`;
  localStorage.setItem(storageKey, JSON.stringify(currentCoordinates));
}

function updateCoordinateValue(key, axis, value) {
  if (!currentCoordinates[key]) return;
  currentCoordinates[key][axis] = parseFloat(value) || 0;
  saveCoordinates();

  document.querySelectorAll(`.f-${key}`).forEach((el) => {
    if (axis === "x") el.style.left = value + "mm";
    if (axis === "y") el.style.top = value + "mm";
    if (axis === "h") el.style.height = value + "mm";
    if (axis === "w") el.style.width = value + "mm";
  });

  // Sincronizar con la barra de calibración si es el campo activo
  if (activeFieldKey === key) {
    const input = document.getElementById(`calib-${axis}`);
    if (input && document.activeElement !== input) {
      input.value = currentCoordinates[key][axis];
    }
  }
}

function updateActiveFieldCoord(axis, value) {
  if (!activeFieldKey) return;
  updateCoordinateValue(activeFieldKey, axis, value);
}

function resetActiveField() {
  if (!activeFieldKey) return;
  resetCoordinate(activeFieldKey);
  seleccionarCampo(activeFieldKey); // Refrescar UI
}

function seleccionarCampo(key) {
  activeFieldKey = key;
  const bar = document.getElementById("calibration-bar");
  const label = document.getElementById("calib-field-name");
  const inputX = document.getElementById("calib-x");
  const inputY = document.getElementById("calib-y");
  const inputH = document.getElementById("calib-h");
  const inputW = document.getElementById("calib-w");

  if (!bar || !label) return;

  if (key) {
    bar.classList.remove("opacity-50");
    bar.style.pointerEvents = "auto";
    label.textContent = `Campo: ${currentCoordinates[key].label}`;
    inputX.value = currentCoordinates[key].x;
    inputY.value = currentCoordinates[key].y;
    inputH.value = currentCoordinates[key].h;
    inputW.value = currentCoordinates[key].w || 50;

    // Resaltar visualmente en el tarjetero
    document
      .querySelectorAll(".card-field")
      .forEach((el) => el.classList.remove("active-field"));
    document
      .querySelectorAll(`.f-${key}`)
      .forEach((el) => el.classList.add("active-field"));
  } else {
    bar.classList.add("opacity-50");
    bar.style.pointerEvents = "none";
    label.textContent = "Campo: ---";
    inputX.value = "";
    inputY.value = "";
    inputH.value = "";
    inputW.value = "";
    document
      .querySelectorAll(".card-field")
      .forEach((el) => el.classList.remove("active-field"));
  }
}

function handleFieldMouseDown(e, key) {
  const fieldEl = e.currentTarget;
  const rect = fieldEl.getBoundingClientRect();

  dragSubject = {
    key: key,
    startX: e.clientX,
    startY: e.clientY,
    initialX: currentCoordinates[key].x,
    initialY: currentCoordinates[key].y,
  };

  seleccionarCampo(key);

  document.body.style.cursor = "grabbing";
  fieldEl.classList.add("dragging");
  e.preventDefault();
}

function handleFieldMouseMove(e) {
  if (!dragSubject) return;

  // Calcular escala real: 140mm es el ancho de la tarjeta
  const card = document.querySelector(".customer-card");
  if (!card) return;
  const pxToMm = TEMPLATE_CONFIGS[currentTemplateId].width / card.offsetWidth;

  const deltaX = (e.clientX - dragSubject.startX) * pxToMm;
  const deltaY = (e.clientY - dragSubject.startY) * pxToMm;

  const newX = Math.round((dragSubject.initialX + deltaX) * 2) / 2; // 0.5mm step
  const newY = Math.round((dragSubject.initialY + deltaY) * 2) / 2;

  updateCoordinateValue(dragSubject.key, "x", newX);
  updateCoordinateValue(dragSubject.key, "y", newY);
}

function handleFieldMouseUp() {
  if (!dragSubject) return;

  dragSubject = null;
  document.body.style.cursor = "default";
  document
    .querySelectorAll(".card-field.dragging")
    .forEach((el) => el.classList.remove("dragging"));
}

function setRotation(angle) {
  currentRotation = parseInt(angle);
  localStorage.setItem("impresion_rotation", angle);
  
  // UI Updates (buttons)
  document.querySelectorAll(".rotation-btn").forEach((btn) => {
    btn.classList.toggle(
      "active",
      parseInt(btn.dataset.rotation) === currentRotation,
    );
  });

  // Cambiar la vista previa de todas las tarjetas existentes
  document.querySelectorAll('.customer-card').forEach(card => {
    card.setAttribute('data-rotation', currentRotation);
  });

  // Si no hay tarjetas, podemos marcar el contenedor para que futuros renders lo sepan
  // Aunque renderizarTarjetero ya usa currentRotation global.
}

function refreshConfigDependentElements() {
  const lugares = APP_CONFIG.HOTEL?.COCKTAIL_LUGARES || [];
  const selectLugar = document.getElementById("cocktail-lugar");
  const inputHora = document.getElementById("cocktail-hora");
  const cocktailConfig = APP_CONFIG.HOTEL?.COCKTAIL_CONFIG || {
    DIA: 5,
    HORA: "19:00",
  };

  // 1. Refresh Places Dropdown
  if (selectLugar) {
    const backupValue = selectLugar.value;
    
    // Clean and rebuild
    selectLugar.innerHTML = "";
    lugares.forEach(l => {
      const opt = document.createElement("option");
      opt.value = l.es;
      opt.textContent = l.es;
      selectLugar.appendChild(opt);
    });

    const lugarDefault = lugares.find((l) => l.default) || lugares[0];
    const defaultValue = lugarDefault ? lugarDefault.es : "";

    // Si no había nada seleccionado (primera vez) o el valor actual ya no es válido, usamos defecto
    if (!backupValue || !lugares.some((l) => l.es === backupValue)) {
      selectLugar.value = defaultValue;
    } else {
      selectLugar.value = backupValue;
    }
    cocktailMetadata.lugar = selectLugar.value;
  }

  // 2. Refresh Time
  if (inputHora) {
    // Si la hora está vacía o es el valor fallback de JS, actualizamos con la config
    if (
      !cocktailMetadata.hora ||
      cocktailMetadata.hora === "" ||
      cocktailMetadata.hora === "19:00"
    ) {
      cocktailMetadata.hora = cocktailConfig.HORA;
    }
    inputHora.value = cocktailMetadata.hora;
  }

  // 3. Proactive Date Refresh
  const inputFecha = document.getElementById("cocktail-fecha");
  if (inputFecha) {
    if (!cocktailMetadata.fecha || cocktailMetadata.fecha === "") {
      const nextDate = getProximoCocktailDate(cocktailConfig.DIA);
      cocktailMetadata.fecha = nextDate.toISOString().split("T")[0];
    }
    inputFecha.value = cocktailMetadata.fecha;
  }

  // 4. Sincronizar cambios en las tarjetas si ya hay datos
  syncCocktailMetadata();
}

function getProximoCocktailDate(targetDay) {
  const now = new Date();
  const resultDate = new Date();
  const currentDay = now.getDay(); // 0 (Dom) a 6 (Sab)

  let daysUntil = targetDay - currentDay;
  if (daysUntil < 0) daysUntil += 7;

  resultDate.setDate(now.getDate() + daysUntil);
  return resultDate;
}

function setTemplateType(typeId, silent = false) {
  if (!TEMPLATE_CONFIGS[typeId]) return;
  currentTemplateId = typeId;
  localStorage.setItem("impresion_current_template", typeId);
  loadCoordinates();

  // Actualizar UI de pestañas
  document.querySelectorAll(".template-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === typeId);
  });

  // Actualizar nombre de la pestaña de vista previa si existiera el botón externo (opcional)
  const btnVista = document.getElementById("btnImpresionVista");
  if (btnVista) {
    btnVista.innerHTML = `<i class="bi bi-eye me-2"></i>Vista Previa`;
  }

  // Update CSS Variables for card size
  const root = document.documentElement;
  root.style.setProperty("--card-width", `${TEMPLATE_CONFIGS[typeId].width}mm`);
  root.style.setProperty(
    "--card-height",
    `${TEMPLATE_CONFIGS[typeId].height}mm`,
  );

  // Marcar root con el tipo de plantilla para el CSS de la guía
  const rootEl = document.getElementById("impresion-root");
  if (rootEl) rootEl.dataset.template = typeId;

  // Actualizar botones de rotación al cargar
  document.querySelectorAll(".rotation-btn").forEach((btn) => {
    btn.classList.toggle(
      "active",
      parseInt(btn.dataset.rotation) === currentRotation,
    );
  });

  if (lastParsedData.length > 0) {
    renderizarTarjetero(lastParsedData);
  }

  seleccionarCampo(null);
}

function updateNacionalidad(index, nac) {
  if (lastParsedData[index]) {
    lastParsedData[index].nacionalidad = nac;
    renderizarTarjetero(lastParsedData); // Re-render for grouping
  }
}

function resetCoordinate(key) {
  currentCoordinates[key] = JSON.parse(
    JSON.stringify(TEMPLATE_CONFIGS[currentTemplateId].coordinates[key]),
  );
  saveCoordinates();

  const coords = currentCoordinates[key];
  document.querySelectorAll(`.f-${key}`).forEach((el) => {
    el.style.left = coords.x + "mm";
    el.style.top = coords.y + "mm";
    el.style.height = coords.h + "mm";
  });

  Ui.showToast(
    `Reseteado: ${TEMPLATE_CONFIGS[currentTemplateId].coordinates[key].label}`,
    "info",
  );
}

function inyectarEstilosBase() {
  document
    .querySelectorAll('[id^="styles-impresion-"]')
    .forEach((el) => el.remove());
  const styleTag = document.createElement("style");
  styleTag.id = "styles-impresion";
  styleTag.innerHTML = `
        .customer-card {
            width: var(--card-width, 140mm) !important;
            height: var(--card-height, 110mm) !important;
            background: #ffffff !important;
            border: 1px solid #ddd !important;
            position: relative !important;
            margin: 20px auto !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1) !important;
            overflow: hidden !important;
            display: block !important;
            transition: all 0.3s ease !important;
        }

        /* Rotación 90 y 270 (Vertical) */
        .customer-card[data-rotation="90"],
        .customer-card[data-rotation="270"] {
            width: var(--card-height, 110mm) !important;
            height: var(--card-width, 140mm) !important;
        }

        .customer-card.show-guide {
            background-size: 100% 100% !important;
            background-repeat: no-repeat !important;
            transition: background 0.3s ease !important;
        }

        /* 0° - Default Landscape */
        .customer-card[data-rotation="0"].show-guide {
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 140 110"><rect x="0" y="0" width="62" height="110" fill="%236a9c3b" opacity="0.1"/><line x1="75" y1="0" x2="75" y2="110" stroke="red" stroke-width="0.5" opacity="0.3"/></svg>') !important;
        }
        [data-template="cocktail"] .customer-card[data-rotation="0"].show-guide {
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 165 100"><rect x="0" y="80" width="165" height="20" fill="%236a9c3b" opacity="0.1"/><line x1="0" y1="40" x2="165" y2="40" stroke="red" stroke-width="0.2" opacity="0.2"/><line x1="0" y1="52" x2="165" y2="52" stroke="red" stroke-width="0.2" opacity="0.2"/></svg>') !important;
        }

        /* 90° - Vertical (Rotate 90deg CW) */
        /* Left side becomes Top */
        .customer-card[data-rotation="90"].show-guide {
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 110 140"><rect x="0" y="0" width="110" height="62" fill="%236a9c3b" opacity="0.1"/><line x1="0" y1="75" x2="110" y2="75" stroke="red" stroke-width="0.5" opacity="0.3"/></svg>') !important;
        }
        /* Bottom side becomes Left */
        [data-template="cocktail"] .customer-card[data-rotation="90"].show-guide {
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 100 165"><rect x="0" y="0" width="20" height="165" fill="%236a9c3b" opacity="0.1"/><line x1="60" y1="0" x2="60" y2="165" stroke="red" stroke-width="0.2" opacity="0.2"/><line x1="48" y1="0" x2="48" y2="165" stroke="red" stroke-width="0.2" opacity="0.2"/></svg>') !important;
        }

        /* 180° - Upside Down */
        /* Left side becomes Right */
        .customer-card[data-rotation="180"].show-guide {
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 140 110"><rect x="78" y="0" width="62" height="110" fill="%236a9c3b" opacity="0.1"/><line x1="65" y1="0" x2="65" y2="110" stroke="red" stroke-width="0.5" opacity="0.3"/></svg>') !important;
        }
        /* Bottom side becomes Top */
        [data-template="cocktail"] .customer-card[data-rotation="180"].show-guide {
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 165 100"><rect x="0" y="0" width="165" height="20" fill="%236a9c3b" opacity="0.1"/><line x1="0" y1="60" x2="165" y2="60" stroke="red" stroke-width="0.2" opacity="0.2"/><line x1="0" y1="48" x2="165" y2="48" stroke="red" stroke-width="0.2" opacity="0.2"/></svg>') !important;
        }

        /* 270° - Vertical Reverse */
        /* Left side becomes Bottom */
        .customer-card[data-rotation="270"].show-guide {
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 110 140"><rect x="0" y="78" width="110" height="62" fill="%236a9c3b" opacity="0.1"/><line x1="0" y1="65" x2="110" y2="65" stroke="red" stroke-width="0.5" opacity="0.3"/></svg>') !important;
        }
        /* Bottom side becomes Right */
        [data-template="cocktail"] .customer-card[data-rotation="270"].show-guide {
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 100 165"><rect x="80" y="0" width="20" height="165" fill="%236a9c3b" opacity="0.1"/><line x1="40" y1="0" x2="40" y2="165" stroke="red" stroke-width="0.2" opacity="0.2"/><line x1="52" y1="0" x2="52" y2="165" stroke="red" stroke-width="0.2" opacity="0.2"/></svg>') !important;
        }

        .precision-container {
            position: relative;
            width: 100%;
            height: 100%;
            transition: transform 0.3s ease;
        }

        /* Lógica de transformaciones para rotar el contenido */
        /* Usamos translate + rotate de forma que siempre encaje en el nuevo contenedor */
        
        .customer-card[data-rotation="0"] .precision-container {
            transform: none !important;
        }

        .customer-card[data-rotation="90"] .precision-container {
            transform: rotate(90deg) translateY(-100%) !important;
            transform-origin: top left !important;
        }

        .customer-card[data-rotation="180"] .precision-container {
            transform: rotate(180deg) translate(-100%, -100%) !important;
            transform-origin: top left !important;
        }

        .customer-card[data-rotation="270"] .precision-container {
            transform: rotate(270deg) translateX(-100%) !important;
            transform-origin: top left !important;
        }

        /* Corregir tamaños del contenedor interno para que coincidan con la lógica de % */
        .customer-card .precision-container {
            width: var(--card-width) !important;
            height: var(--card-height) !important;
        }

        /* Bloquear eventos de ratón en las etiquetas para que no interfieran con el drag */
        .field-label {
            pointer-events: none !important;
        }
        .card-field {
            position: absolute;
            cursor: grab;
            display: flex;
            align-items: center;
            border: 1px dashed transparent;
            padding: 0 4px;
            user-select: none;
            overflow: hidden;
        }
        .card-field:hover {
            border-color: rgba(0,123,255,0.3) !important;
            background: rgba(0,123,255,0.05) !important;
        }
        .card-field.dragging {
            cursor: grabbing !important;
            border-color: #007bff !important;
            background: rgba(0,123,255,0.1) !important;
            z-index: 100 !important;
        }
        .card-field.active-field {
            border-color: #fbc02d !important;
            background: rgba(251, 192, 45, 0.1) !important;
            box-shadow: 0 0 8px rgba(251, 192, 45, 0.3) !important;
        }
        .field-label {
            font-size: 7.5pt !important;
            color: #999 !important;
            font-weight: bold !important;
            position: absolute !important;
            left: -60mm !important;
            width: 55mm !important;
            text-align: right !important;
            pointer-events: none !important;
            text-transform: uppercase !important;
        }
        .field-value {
            font-size: 13pt;
            font-weight: 800 !important;
            color: #000 !important;
            text-transform: uppercase !important;
            display: inline-block !important;
            white-space: nowrap !important;
            outline: none !important;
            min-width: 10px !important;
            cursor: text !important;
            user-select: text !important;
        }
        .field-value:focus {
            background: #fff9c4 !important;
            box-shadow: 0 0 0 2px #fbc02d !important;
            border-radius: 2px !important;
        }
        .nac-selector {
            position: absolute !important;
            top: 5px !important;
            right: 5px !important;
            display: flex !important;
            align-items: center !important;
            gap: 2px !important;
            z-index: 10 !important;
        }
        .nac-btn {
            padding: 2px 6px !important;
            font-size: 0.65rem !important;
            font-weight: bold !important;
            border: 1px solid #ddd !important;
            border-radius: 3px !important;
            background: white !important;
            cursor: pointer !important;
            transition: all 0.2s !important;
            color: #666 !important;
        }
        .nac-btn.active {
            color: white !important;
            border-color: transparent !important;
        }
        .nac-btn[data-nac="ES"].active { background: #dc3545 !important; }
        .nac-btn[data-nac="DE"].active { background: #ffc107 !important; color: black !important; }
        .nac-btn[data-nac="UK"].active { background: #0d6efd !important; }
        .nac-btn[data-nac="FR"].active { background: #0dcaf0 !important; }

        .template-tab-btn {
            position: relative !important;
            z-index: 1 !important; /* Force low priority relative to main navigation */
            border: none !important;
            background: transparent !important;
            padding: 10px 20px !important;
            border-bottom: 3px solid transparent !important;
            color: #6c757d !important;
            transition: all 0.3s ease !important;
        }
        .template-tab-btn.active {
            color: #0d6efd !important;
            border-bottom-color: #0d6efd !important;
            background: rgba(13, 110, 253, 0.05) !important;
        }
        .template-tab-btn:hover:not(.active) {
            background: #f8f9fa !important;
        }

        /* Selection Toggle Fixes */
        .form-switch .form-check-input {
            cursor: pointer !important;
            background-color: #fff !important;
            border-color: #dee2e6 !important;
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='rgba(0, 0, 0, 0.25)'/%3e%3c/svg%3e") !important;
        }
        .form-switch .form-check-input:checked {
            background-color: #0d6efd !important;
            border-color: #0d6efd !important;
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23fff'/%3e%3c/svg%3e") !important;
        }
        .form-switch .form-check-input:indeterminate {
            background-color: #0d6efd !important;
            border-color: #0d6efd !important;
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3e%3cpath fill='none' stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M6 10h8'/%3e%3c/svg%3e") !important;
        }

        /* Numbering and Selection Overlay */
        .card-selection-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            pointer-events: none !important;
            z-index: 100 !important;
        }
        .card-number-badge {
            position: absolute !important;
            top: 5px !important;
            left: 5px !important;
            background: rgba(0,0,0,0.6) !important;
            color: white !important;
            padding: 2px 8px !important;
            border-radius: 20px !important;
            font-size: 0.7rem !important;
            font-weight: bold !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
        }
        .card-checkbox-wrapper {
            position: absolute !important;
            top: 5px !important;
            left: 45px !important;
            pointer-events: all !important;
        }
        .card-checkbox {
            width: 18px !important;
            height: 18px !important;
            cursor: pointer !important;
        }
        .customer-card.unselected {
            opacity: 0.4 !important;
            filter: grayscale(0.8) !important;
        }
        .customer-card.unselected .precision-container {
            pointer-events: none !important;
        }
    `;
  document.head.appendChild(styleTag);
}

/**
 * PARSER v1.28
 */
function procesarDatosWord() {
  const rawText = document.getElementById("txtWordData").value;
  if (!rawText || rawText.trim().length < 10) {
    Ui.showToast("Pega los datos primero", "warning");
    return;
  }

  const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 5);
  const parsedData = [];
  const dateRegex = /\b\d{2}[\.\/\-]\d{2}[\.\/\-]\d{2,4}\b/g;

  lines.forEach((line) => {
    // 1. Detección de Columnas por Tabulador (Pestañas de Word)
    const tabs = line.split("\t");
    const hasTabs = tabs.length >= 4;

    let entry = {
      nombre: "DESCONOCIDO",
      habitacion: "",
      pax: "1",
      regime: "HD",
      entrada: "",
      salida: "",
      agencia: "DIRECTO",
      nacionalidad: "UK",
      nacionalidadCierta: false,
      selected: true,
    };

    const dates = line.match(dateRegex);
    if (!dates || dates.length < 2) return; // Línea inválida

    entry.entrada = dates[0];
    entry.salida = dates[1];

    if (hasTabs) {
      // LÓGICA POR COLUMNAS (Más fiable si viene de Word)
      // Estructura típica: Habitacion | Tipo | Pax | ResID | Nombre | Llegada | Salida | Regimen | ...
      // Buscamos cuál es cual basándonos en contenido

      tabs.forEach((col, idx) => {
        const val = col.trim();
        const valUpper = val.toUpperCase();

        // 1. Nombre (Campo con espacios y sin muchos números)
        if (val.length > 8 && val.includes(" ") && !val.match(/\b\d{3,}\b/)) {
          // Si el nombre aún es desconocido o este parece más largo
          if (entry.nombre === "DESCONOCIDO") entry.nombre = val.toUpperCase();
        }

        // 2. Habitación (Número de 3 dígitos usualmente, al principio)
        if (val.match(/^\b\d{2,4}\b$/) && !entry.habitacion && idx < 3) {
          entry.habitacion = val;
        }

        // 3. Pax (Número de 1 o 2 dígitos solo)
        if (val.match(/^\b\d{1,2}\b$/) && idx < 5 && val !== entry.habitacion) {
          entry.pax = val;
        }

        // 4. Régimen
        if (valUpper.match(/\b(MP|PC|TI|HD|AD|AL)\b/)) {
          let r = valUpper.match(/\b(MP|PC|TI|HD|AD|AL)\b/)[0];
          if (r === "AD") r = "HD";
          entry.regime = r;
        }

        // 5. Agencia (Búsqueda de palabras clave)
        const kw = [
          "EXPEDIA",
          "BOOKING",
          "TUI",
          "JET2",
          "MTS",
          "HOTELBEDS",
          "VECI",
          "DIR",
          "SUNWEB",
          "SCHAUIN",
          "DERTOUR",
        ];
        if (kw.some((k) => valUpper.includes(k))) {
          entry.agencia = val.substring(0, 20);
        }
      });
    } else {
      // LÓGICA FUZZY (Fallback para texto plano)
      const firstDateIdx = line.indexOf(dates[0]);
      const textBefore = line.substring(0, firstDateIdx).trim();
      const textAfter = line
        .substring(line.lastIndexOf(dates[1]) + dates[1].length)
        .toUpperCase();

      // Régimen en el texto posterior - Soporta AD -> HD y repeticiones
      const regimeMatch = textAfter.match(/\b(MP|PC|TI|HD|AD|AL)\b/);
      if (regimeMatch) {
        let r = regimeMatch[0];
        if (r === "AD") r = "HD";
        entry.regime = r;
      }

      // Números antes de la fecha
      const numbers = textBefore.match(/\b\d+\b/g) || [];

      // Heurística crítica: Una habitación tiene 2-4 dígitos.
      // Un ID de reserva suele tener 5 o más.
      const roomCandidates = numbers.filter(
        (n) => n.length >= 2 && n.length <= 4,
      );
      if (roomCandidates.length > 0) {
        entry.habitacion = roomCandidates[0];
      }

      const paxCandidates = numbers.filter(
        (n) => n.length === 1 && n !== entry.habitacion,
      );
      if (paxCandidates.length > 0) {
        entry.pax = paxCandidates[0];
      }

      // Nombre y Agencia
      const parts = textBefore
        .split(/[ ]{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 3);
      parts.forEach((p) => {
        const pUpper = p.toUpperCase();
        if (p.includes(" ") && !p.match(/\b\d{4,}\b/)) {
          entry.nombre = pUpper;
        }
        const kw = [
          "EXPEDIA",
          "BOOKING",
          "TUI",
          "JET2",
          "MTS",
          "HOTELBEDS",
          "VECI",
          "DIR",
          "SUNWEB",
          "SCHAUIN",
          "DERTOUR",
        ];
        if (kw.some((k) => pUpper.includes(k))) {
          entry.agencia = p.substring(0, 20);
        }
      });
    }

    // Determinar Nacionalidad Automática
    const agencyUpper = entry.agencia.toUpperCase();
    const toLists = APP_CONFIG.HOTEL?.TO_LISTS || {
      ES: [],
      DE: [],
      FR: [],
      UK: [],
    };
    if (toLists.DE.some((kw) => agencyUpper.includes(kw))) {
      entry.nacionalidad = "DE";
      entry.nacionalidadCierta = true;
    } else if (toLists.ES.some((kw) => agencyUpper.includes(kw))) {
      entry.nacionalidad = "ES";
      entry.nacionalidadCierta = true;
    } else if (toLists.FR.some((kw) => agencyUpper.includes(kw))) {
      entry.nacionalidad = "FR";
      entry.nacionalidadCierta = true;
    } else if (toLists.UK.some((kw) => agencyUpper.includes(kw))) {
      entry.nacionalidad = "UK";
      entry.nacionalidadCierta = true;
    }

    parsedData.push(entry);
  });

  if (parsedData.length === 0) {
    Ui.showToast("No se detectaron datos válidos.", "danger");
    return;
  }

  renderizarTarjetero(parsedData);
  lastParsedData = parsedData;

  // Si hay datos, auto-calcular fecha cocktail basada en el primer registro
  if (parsedData.length > 0) {
    autoCalcularFechaCocktail(parsedData[0].entrada);
  }

  document.getElementById("btnImpresionVista")?.click();
}

function syncCocktailMetadata() {
  // Si estamos en cocktail, refrescar el tarjetero preview para ver cambios de meta
  if (currentTemplateId === "cocktail" && lastParsedData.length > 0) {
    renderizarTarjetero(lastParsedData);
  }
}

function autoCalcularFechaCocktail(fechaEntradaStr) {
  if (!fechaEntradaStr) return;

  // Intentar parsear fecha (DD/MM/YYYY o DD.MM.YY)
  const parts = fechaEntradaStr.split(/[\.\/\-]/);
  if (parts.length < 2) return;

  let day = parseInt(parts[0]);
  let month = parseInt(parts[1]) - 1;
  let year = parts[2]
    ? parts[2].length === 2
      ? 2000 + parseInt(parts[2])
      : parseInt(parts[2])
    : new Date().getFullYear();

  const fechaBase = new Date(year, month, day);
  if (isNaN(fechaBase.getTime())) return;

  const cocktailConfig = APP_CONFIG.HOTEL?.COCKTAIL_CONFIG || {
    DIA: 5,
    HORA: "19:00",
  };
  const proximoDia = calcularProximoDia(fechaBase, cocktailConfig.DIA);

  // Formato YYYY-MM-DD para el input date
  const yyyy = proximoDia.getFullYear();
  const mm = String(proximoDia.getMonth() + 1).padStart(2, "0");
  const dd = String(proximoDia.getDate()).padStart(2, "0");

  cocktailMetadata.fecha = `${yyyy}-${mm}-${dd}`;

  const inputFecha = document.getElementById("cocktail-fecha");
  if (inputFecha) inputFecha.value = cocktailMetadata.fecha;

  const inputHora = document.getElementById("cocktail-hora");
  if (inputHora) inputHora.value = cocktailMetadata.hora;

  const inputLugar = document.getElementById("cocktail-lugar");
  if (inputLugar) inputLugar.value = cocktailMetadata.lugar;

  syncCocktailMetadata();
}

function renderizarTarjetero(data) {
  const container = document.getElementById("cards-container");
  const lblTotal = document.getElementById("lblTotalCards");
  if (!container) return;

  container.innerHTML = "";
  lblTotal.textContent = data.length;

  // Si es Cocktail, mostrar controles de lotes por nacionalidad
  if (currentTemplateId === "cocktail") {
    renderControlesLotes(data);
  }

  data.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "customer-card show-guide";
    div.dataset.index = index;
    div.setAttribute("data-rotation", currentRotation);

    const precisionContainer = document.createElement("div");
    precisionContainer.className = "precision-container";
    // Asegurar que el contenedor interno tenga el tamaño base para la rotación
    precisionContainer.style.width = TEMPLATE_CONFIGS[currentTemplateId].width + "mm";
    precisionContainer.style.height = TEMPLATE_CONFIGS[currentTemplateId].height + "mm";

    // Determinar coordenadas a usar
    const coordsToUse = TEMPLATE_CONFIGS[currentTemplateId].coordinates;

    Object.keys(coordsToUse).forEach((key) => {
      const coords = coordsToUse[key];
      let value = item[key] || "";

      // Valores especiales para cocktail
      if (currentTemplateId === "cocktail") {
        if (key === "nombre_invitado") value = item.nombre || "";
        if (key === "fecha_cocktail") {
          const parts = cocktailMetadata.fecha.split("-");
          value =
            parts.length === 3
              ? `${parts[2]}/${parts[1]}`
              : cocktailMetadata.fecha;
        }
        if (key === "hora_cocktail") value = cocktailMetadata.hora;
        if (key === "lugar_cocktail") {
          const trans = getTranslatedLugar(cocktailMetadata.lugar, item.nacionalidad);
          value = `"${trans}"`;
        }
      }

      const fieldWrapper = document.createElement("div");
      fieldWrapper.className = `card-field f-${key}`;
      fieldWrapper.style.left = `${coords.x}mm`;
      fieldWrapper.style.top = `${coords.y}mm`;
      fieldWrapper.style.height = `${coords.h}mm`;
      const widthValue =
        coords.w || TEMPLATE_CONFIGS[currentTemplateId].width - coords.x;
      fieldWrapper.style.width = `${widthValue}mm`;

      fieldWrapper.innerHTML = `
                <span class="field-label">${coords.label}:</span>
                <span class="field-value" contenteditable="true" data-key="${key}">${value}</span>
            `;

      fieldWrapper.addEventListener("mousedown", (e) => {
        if (e.target.classList.contains("field-value")) return;
        handleFieldMouseDown(e, key);
      });

      fieldWrapper.addEventListener("click", (e) => {
        if (e.target.classList.contains("field-value")) return;
        seleccionarCampo(key);
      });

      const valEl = fieldWrapper.querySelector(".field-value");

      // Auto-ajustar fuente después de inyectar en el DOM
      setTimeout(() => autoAjustarFuente(valEl), 50);

      valEl.addEventListener("input", (e) => {
        const newValue = e.target.textContent;

        // Auto-ajustar mientras se escribe
        autoAjustarFuente(e.target);

        if (currentTemplateId === "tarjetero") {
          data[index][key] = newValue;
        } else if (key === "nombre_invitado") {
          data[index].nombre = newValue;
        }
        autoAjustarFuente(e.target);
      });

      precisionContainer.appendChild(fieldWrapper);
    });

    // Control de Nacionalidad para Cocktail
    if (currentTemplateId === "cocktail") {
      const nacSelector = document.createElement("div");
      nacSelector.className = "nac-selector no-print";

      const nacs = [
        { id: "ES", label: "ES" },
        { id: "DE", label: "DE" },
        { id: "UK", label: "UK" },
        { id: "FR", label: "FR" },
      ];

      const agencySpan = document.createElement("span");
      const colorClass = item.nacionalidadCierta
        ? "bg-light text-dark border"
        : "bg-warning text-dark border-warning shadow-sm";
      agencySpan.className = `me-2 badge ${colorClass} fw-normal`;
      agencySpan.style.fontSize = "0.6rem";
      agencySpan.textContent = item.agencia || "DIRECTO";
      if (!item.nacionalidadCierta)
        agencySpan.title =
          "Nacionalidad incierta (por defecto UK). Por favor revisa.";
      nacSelector.appendChild(agencySpan);

      nacs.forEach((n) => {
        const btn = document.createElement("button");
        btn.className = `nac-btn ${item.nacionalidad === n.id ? "active" : ""}`;
        btn.dataset.nac = n.id;
        btn.textContent = n.label;
        btn.onclick = () => window.updateNacionalidad(index, n.id);
        nacSelector.appendChild(btn);
      });
      div.appendChild(nacSelector);
    }

    // Numbering and Checkbox
    const selectionOverlay = document.createElement("div");
    selectionOverlay.className = "card-selection-overlay no-print";
    selectionOverlay.innerHTML = `
        <div class="card-number-badge">#${index + 1}</div>
        <div class="card-checkbox-wrapper">
            <input type="checkbox" class="card-checkbox" ${item.selected ? "checked" : ""} />
        </div>
    `;

    const checkbox = selectionOverlay.querySelector(".card-checkbox");
    checkbox.onclick = (e) => {
        e.stopPropagation();
        item.selected = checkbox.checked;
        div.classList.toggle("unselected", !item.selected);
        syncSelectionSummary();
    };

    if (!item.selected) div.classList.add("unselected");

    div.appendChild(selectionOverlay);
    div.appendChild(precisionContainer);
    container.appendChild(div);

    setTimeout(() => {
      div
        .querySelectorAll(".field-value")
        .forEach((el) => autoAjustarFuente(el));
    }, 10);
  });
  
  syncSelectionSummary();
}

/**
 * SELECCIONAR TODO / NINGUNO
 * @param {boolean} val 
 */
function selectAll(val) {
    if (!lastParsedData || lastParsedData.length === 0) return;
    lastParsedData.forEach(item => item.selected = val);
    renderizarTarjetero(lastParsedData);
}

/**
 * SINCRONIZAR RESUMEN Y TOGGLE
 */
function syncSelectionSummary() {
    const total = lastParsedData.length;
    const selected = lastParsedData.filter(i => i.selected).length;
    
    const lbl = document.getElementById("lblTotalCards");
    if (lbl) {
        lbl.innerText = `${selected} / ${total}`;
    }

    const toggle = document.getElementById("toggleSelectAll");
    if (toggle) {
        toggle.checked = selected === total && total > 0;
        toggle.indeterminate = selected > 0 && selected < total;
    }
}

function renderControlesLotes(data) {
  const container = document.getElementById("cards-container");
  const lotesDiv = document.createElement("div");
  lotesDiv.className =
    "w-100 mb-4 no-print d-flex gap-2 justify-content-center p-3 bg-light rounded border";

  const countNac = (nac) => data.filter((i) => i.nacionalidad === nac).length;
  const countSelectedNac = (nac) => data.filter((i) => i.nacionalidad === nac && i.selected).length;

  const nacs = [
    { id: "ES", label: "España", btn: "danger" },
    { id: "DE", label: "Alemania", btn: "warning" },
    { id: "UK", label: "Inglaterra", btn: "primary" },
    { id: "FR", label: "Francia", btn: "info" },
  ];

  nacs.forEach((n) => {
    const total = countNac(n.id);
    const selected = countSelectedNac(n.id);
    const btn = document.createElement("button");
    btn.className = `btn btn-${n.btn} fw-bold`;
    btn.disabled = total === 0;
    
    let label = `${n.label} (${total})`;
    if (selected < total) {
        label = `${n.label} (${selected}/${total})`;
    }
    
    btn.innerHTML = `<i class="bi bi-printer me-2"></i> ${label}`;
    btn.onclick = () => imprimirLote(n.id);
    lotesDiv.appendChild(btn);
  });

  container.appendChild(lotesDiv);
}

function imprimirLote(nacId) {
  const dataToPrint = lastParsedData.filter((i) => i.nacionalidad === nacId);
  if (dataToPrint.length === 0) return;
  ejecutarImpresionAislada(dataToPrint);
}

function ejecutarImpresionAislada(forceData = null) {
  // Siempre filtramos por seleccionados
  const data = (forceData || lastParsedData).filter(i => i.selected);
  
  if (!data || data.length === 0) {
    Ui.showToast("No hay datos para imprimir", "warning");
    return;
  }

  const offX = parseFloat(document.getElementById("nudgeX")?.value || 0);
  const offY = parseFloat(document.getElementById("nudgeY")?.value || 0);
  const isCenterA4 = true; // Forzado por defecto

  const cardsHtml = [];
  const template = TEMPLATE_CONFIGS[currentTemplateId];
  const coordsToUse = template.coordinates;

  // A4 Portrait Dimensions (Standard feed 210mm wide)
  const A4_WIDTH = 210;
  const A4_HEIGHT = 297;

  // Calculate auto-center offset if enabled
    let finalOffX = offX;
    let finalOffY = offY;
    let finalPageSize = `${template.width}mm ${template.height}mm landscape`;
    let containerWidth = template.width;
    let containerHeight = template.height;

    // Adjust for rotation
    const isVertical = currentRotation === 90 || currentRotation === 270;
    const printWidth = isVertical ? template.height : template.width;
    const printHeight = isVertical ? template.width : template.height;

    if (isCenterA4) {
        // Centrar horizontalmente en Portrait: (210 - Ancho de lo que imprimimos) / 2
        const autoOffX = (A4_WIDTH - printWidth) / 2;
        finalOffX += autoOffX;
        finalPageSize = "A4 portrait";
        containerWidth = A4_WIDTH;
        containerHeight = A4_HEIGHT;
    }

  data.forEach((item) => {
    let fields = "";
    Object.keys(coordsToUse).forEach((key) => {
      const coords = coordsToUse[key];
      let value = item[key] || "";

      if (currentTemplateId === "cocktail") {
        if (key === "nombre_invitado") value = item.nombre || "";
        if (key === "fecha_cocktail") {
          const parts = cocktailMetadata.fecha.split("-");
          if (parts.length === 3) {
            value = `${parts[2]}/${parts[1]}`;
          } else {
            value = cocktailMetadata.fecha;
          }
        }
        if (key === "hora_cocktail") value = cocktailMetadata.hora;
        if (key === "lugar_cocktail") {
          const trans = getTranslatedLugar(cocktailMetadata.lugar, item.nacionalidad);
          value = `"${trans}"`;
        }
      }

      const widthValue = coords.w || template.width - coords.x;

      // Estimación de fuente para impresión (since we can't measure scrollWidth easily)
      // 13pt base. Si el texto > ancho disponible, reducimos.
      const chars = String(value).length;
      const estimatedWidthMm = chars * 2.5; // Heurística: 2.5mm por carácter en Arial 13pt Bold
      let fontSize = 13;
      if (estimatedWidthMm > widthValue) {
        fontSize = Math.max(
          6,
          Math.floor(13 * (widthValue / estimatedWidthMm)),
        );
      }

      fields += `
                <div style="position: absolute; left: ${coords.x}mm; top: ${coords.y}mm; height: ${coords.h}mm; width: ${widthValue}mm; display: flex; align-items: center; white-space: nowrap; overflow: hidden;">
                    <span style="font-family: Arial, sans-serif; font-weight: bold; color: black; text-transform: uppercase; font-size: ${fontSize}pt; line-height: 1;">
                        ${value}
                    </span>
                </div>`;
    });

        // El contenedor de la tarjeta mantiene su tamaño, pero lo movemos dentro del "papel" final
        let rotationStyle = '';
        if (currentRotation === 90) rotationStyle = `transform: rotate(90deg) translate(0, -${template.height}mm); transform-origin: top left;`;
        if (currentRotation === 180) rotationStyle = `transform: rotate(180deg); transform-origin: center;`;
        if (currentRotation === 270) rotationStyle = `transform: rotate(270deg) translate(-${template.width}mm, 0); transform-origin: top left;`;

        cardsHtml.push(`
            <div style="width: ${containerWidth}mm; height: ${containerHeight}mm; page-break-after: always; position: relative; overflow: hidden; background: white;">
                <div style="position: absolute; top: ${finalOffY}mm; left: ${finalOffX}mm; width: ${template.width}mm; height: ${template.height}mm; ${rotationStyle}">
                    ${fields}
                </div>
            </div>
        `);
  });

  const printWin = window.open("", "_blank", "width=800,height=600");
  if (!printWin) {
    Ui.showToast("El navegador bloqueó la ventana emergente.", "danger");
    return;
  }

  printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Impresión ${TEMPLATE_CONFIGS[currentTemplateId].label}</title>
            <style>
                @page { size: ${finalPageSize}; margin: 0; }
                body { margin: 0; padding: 0; background: white; }
                * { -webkit-print-color-adjust: exact !important; }
            </style>
        </head>
        <body>
            ${cardsHtml.join("")}
            <script>
                window.onload = function() {
                    setTimeout(() => { window.focus(); window.print(); }, 500);
                };
            </script>
        </body>
        </html>
    `);
  printWin.document.close();
}

function autoAjustarFuente(el) {
  const maxWidth = el.parentElement.offsetWidth - 10;
  let size = 13;
  el.style.fontSize = size + "pt";
  while (el.scrollWidth > maxWidth && size > 6) {
    size -= 0.5;
    el.style.fontSize = size + "pt";
  }
}

function calcularProximoDia(fechaBase, diaObjetivo) {
  const proxima = new Date(fechaBase);
  const dayOfWeek = proxima.getDay(); // 0-6 (Dom-Sab)

  // Calculamos los días hasta el objetivo
  let daysToAdd = (diaObjetivo - dayOfWeek + 7) % 7;

  // Si la llegada es el mismo día, ¿poner el mismo día o el siguiente de la semana que viene?
  // User dice "siguiente a la llegada", así que si llega el viernes y el cocktail es el viernes,
  // quizás sea el mismo día o el siguiente. Asumiremos que si es 0, sumamos 7 para que sea el "siguiente".
  if (daysToAdd === 0) daysToAdd = 7;

  proxima.setDate(proxima.getDate() + daysToAdd);
  return proxima;
}

function getTranslatedLugar(nombreES, nacId) {
  const list = APP_CONFIG.HOTEL?.COCKTAIL_LUGARES || [];
  const item = list.find((l) => l.es.toLowerCase() === nombreES.toLowerCase());
  if (!item) return nombreES;

  const nac = (nacId || "").toUpperCase();

  if (nac === "DE") return item.de || item.es;
  if (nac === "UK" || nac === "EN") return item.en || item.es;
  if (nac === "FR") return item.fr || item.es;
  return item.es;
}

window.inicializarImpresion = inicializarImpresion;
window.setTemplateType = setTemplateType;
window.updateNacionalidad = updateNacionalidad;
window.selectAll = selectAll;
