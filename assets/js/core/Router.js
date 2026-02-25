/**
 * SISTEMA DE ENRUTAMIENTO Y NAVEGACIÓN
 * -----------------------------------
 * Este módulo se encarga de cambiar entre las diferentes pestañas de la aplicación
 * Este módulo se encarga de cambiar entre las diferentes pestañas de la aplicación
 * (Inicio, Operaciones, Administración, etc.) sin recargar la página.
 */

let navigationHistory = [];
let forwardStack = [];
let isNavigatingHistory = false;

export const Router = {
  /**
   * inicialización.
   * Registra la función navegarA globalmente para que pueda ser llamada
   * desde cualquier botón del HTML con onclick="navegarA(...)".
   *
   * COMPORTAMIENTO DE NAVEGACIÓN:
   * - "Inicio Transparente": El Dashboard no se guarda en el historial, actúa como capa base.
   * - "Centro Toggle": El botón central de la cabecera alterna entre Inicio y el último módulo.
   * - "Atrás Virtual": Si el historial está vacío, "Atrás" lleva a Inicio.
   */
  init: () => {
    window.navegarA = Router.navegarA;
    window.Router = Router; // Globalize Router for HTML onclick

    // GLOBAL EVENT LISTENER: Ensure only ONE tab pane is visible at a time
    // This fixes the issue where dropdown tabs might not effectively hide the Dashboard or other views.
    const tabElsp = document.querySelectorAll('button[data-bs-toggle="tab"]');
    tabElsp.forEach((tabBtn) => {
      // Trigger reload on CLICK
      tabBtn.addEventListener("click", (event) => {
        const targetId = tabBtn.getAttribute("data-bs-target");
        Router.handleModuleReload(targetId);
      });

      tabBtn.addEventListener("show.bs.tab", (event) => {
        const targetId = event.target.getAttribute("data-bs-target");

        // Si el relatedTarget es nulo (pasa en navegación manual),
        // intentamos obtener el ID del panel que está activo actualmente.
        let relId = event.relatedTarget
          ? event.relatedTarget.getAttribute("data-bs-target")
          : null;
        if (!relId) {
          const currentActive = document.querySelector(".tab-pane.active");
          if (currentActive) relId = "#" + currentActive.id;
        }

        if (!targetId) return;

        // Capturar historial si viene de una pestaña nativa de Bootstrap
        // y no estamos ya en medio de una navegación controlada por el Router
        if (relId && relId !== targetId && !isNavigatingHistory) {
          Router.recordNavigation(relId, targetId);
        }

        // Force hide ALL other tab-panes
        document.querySelectorAll(".tab-pane").forEach((pane) => {
          if ("#" + pane.id !== targetId) {
            pane.classList.remove("show", "active");
            pane.style.display = "none";
          }
        });

        // Ensure target is prepared to be shown
        const targetPane = document.querySelector(targetId);
        if (targetPane) {
          targetPane.style.display = "";
          Router.handleModuleReload(targetId);
        }

        // UPDATE URL (Catch-all for clicks on native Bootstrap tabs)
        if (!isNavigatingHistory) {
          const isDashboard = Router.isDashboardId(targetId);
          const finalHash = isDashboard ? "#" : targetId;
          
          if (history.pushState) {
            history.pushState(null, null, finalHash);
          } else {
            location.hash = finalHash;
          }
        }

        // Asegurar que la cabecera se actualice al final del evento
        Router.updateHeaderContext();
      });
    });
  },

  /**
   * GESTIÓN DE RECARGAS DE MÓDULOS
   * Se llama cuando una pestaña se activa para asegurar que los datos estén frescos.
   */
  handleModuleReload: (selector) => {
    if (selector === "#gallery-content") {
      if (window.Gallery) window.Gallery.loadImages(true);
    } else if (selector === "#impresion-content") {
      import("../modules/Impresion.js?v=V145_VAL_FIX").then((m) => {
        if (m.inicializarImpresion) m.inicializarImpresion();
      });
    } else if (selector === "#vales-content") {
      import("../modules/vales.js").then((m) => {
        if (m.initVales) m.initVales();
      });
    }
    // Aquí se pueden añadir otros módulos que necesiten refresco al abrir
  },

  /**
   * MÉTODO PRINCIPAL DE NAVEGACIÓN
   * @param {string} targetId - El ID del panel al que queremos ir (ej: '#riu-content')
   *
   * Este método hace un cambio "limpio" de pestaña asegurándose de que:
   * 1. Se oculte todo lo anterior.
   * 2. Se desmarque el menú activo antiguo.
   * 3. Se active el nuevo panel visualmente.
   */
  navegarA: (targetId) => {
    const selector = targetId.startsWith("#") ? targetId : "#" + targetId;
    const currentActive = document.querySelector(".tab-pane.active");
    const currentId = currentActive ? "#" + currentActive.id : null;

    // Capturar Historial
    if (currentId && currentId !== selector && !isNavigatingHistory) {
      Router.recordNavigation(currentId, selector);
    }

    const targetPane = document.querySelector(selector);

    if (!targetPane) {
      console.error(`Router: Panel no encontrado ${selector}`);
      return;
    }

    // 1. CLEANUP UI (Modals, Dropdowns, Tooltips, Backdrops)
    // Close all open Bootstrap modals
    const openModals = document.querySelectorAll(".modal.show");
    openModals.forEach((modalEl) => {
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (modalInstance) modalInstance.hide();
    });

    document.querySelectorAll(".dropdown-menu.show").forEach((el) => {
      el.classList.remove("show");
      const toggle = el.parentElement.querySelector(".dropdown-toggle");
      if (toggle) {
        toggle.classList.remove("show");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
    document.querySelectorAll(".tooltip").forEach((el) => el.remove());

    // 2. DEACTIVATE EVERYTHING
    // Remove active state from all nav-links and dropdown-items
    document
      .querySelectorAll("#mainTabs .nav-link, #mainTabs .dropdown-item")
      .forEach((btn) => {
        btn.classList.remove("active");
      });

    // Hide all tab-panes
    document.querySelectorAll(".tab-pane").forEach((pane) => {
      pane.classList.remove("show", "active");
      pane.style.display = "";
    });

    // 3. ACTIVATE TARGET CONTENT
    targetPane.classList.add("show", "active");

    // 4. HIGHLIGHT NAVBAR BUTTON (SILENTLY)
    const triggerEl = document.querySelector(
      `button[data-bs-target="${selector}"]`,
    );
    if (triggerEl) {
      triggerEl.classList.add("active");

      // If the button is inside a dropdown, highlight the parent dropdown-toggle too
      const parentDropdown = triggerEl.closest(".dropdown");
      if (parentDropdown) {
        const toggle = parentDropdown.querySelector(".dropdown-toggle");
        if (toggle) toggle.classList.add("active");
      }
    }

    // 5. UPDATE URL (Optional, but good for back button)
    const isDashboard = Router.isDashboardId(selector);
    const finalHash = isDashboard ? "#" : selector;
    
    if (history.pushState) {
      history.pushState(null, null, finalHash);
    } else {
      location.hash = finalHash;
    }

    // Importante: No resetear isNavigatingHistory aquí,
    // se resetea en back() / forward() tras completar navegarA
    Router.handleModuleReload(selector);

    // Sincronizar indicadores de cabecera tras el cambio de vista
    Router.updateHeaderContext();
  },

  recordNavigation: (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;

    // LÓGICA DE INICIO TRANSPARENTE:
    // Si venimos de Inicio, el sistema gestiona si limpiar el stack "adelante"
    if (Router.isDashboardId(fromId)) {
      // Solo limpiamos "adelante" si vamos a un Módulo Nuevo (no historial y no Dashboard)
      if (!isNavigatingHistory && !Router.isDashboardId(toId)) {
        forwardStack = [];
      }
      return;
    }

    console.log(`[Router] Grabando: ${fromId} -> ${toId}`);

    // Evitar duplicados consecutivos
    if (
      navigationHistory.length > 0 &&
      navigationHistory[navigationHistory.length - 1] === fromId
    )
      return;

    navigationHistory.push(fromId);
    if (navigationHistory.length > 20) navigationHistory.shift();

    // Toda navegación nueva (no desde el historial) rompe el "adelante"
    // EXCEPCIÓN: Ir al Inicio no lo rompe, permitiendo que actúe como capa base
    if (!isNavigatingHistory && !Router.isDashboardId(toId)) {
      forwardStack = [];
    }

    Router.updateHeaderContext();
  },

  /**
   * Gestión de clics en la cabecera para navegación bidireccional + Centro = Toggle Inicio
   * - Izquierda (<30%): Atrás
   * - Derecha (>70%): Adelante
   * - Centro: Si estás en módulo -> Vas a Inicio. Si estás en Inicio -> Vuelves al módulo.
   */
  handleHeaderClick: (event) => {
    const header = event.currentTarget;
    const rect = header.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width;

    const leftZone = width * 0.3; // 30% izquierda
    const rightZone = width * 0.7; // 70% derecha (inicio de la zona)

    if (x < leftZone) {
      Router.back();
    } else if (x > rightZone) {
      Router.forward();
    } else {
      // Centro: Toggle Inicio / Último módulo
      const currentActive = document.querySelector(".tab-pane.active");
      const onDashboard =
        currentActive && Router.isDashboardId("#" + currentActive.id);

      if (!onDashboard) {
        // Si no estoy en inicio, voy a inicio
        Router.navegarA("#dashboard-content");
      } else {
        // Si ya estoy en inicio, intento volver al último módulo del historial
        Router.back();
      }
    }
  },

  forward: () => {
    if (forwardStack.length === 0) return;

    const nextId = forwardStack.pop();

    try {
      isNavigatingHistory = true;
      const currentActive = document.querySelector(".tab-pane.active");
      const currentId = currentActive ? "#" + currentActive.id : null;

      if (currentId && !Router.isDashboardId(currentId)) {
        navigationHistory.push(currentId);
      }

      Router.navegarA(nextId);
    } finally {
      isNavigatingHistory = false;
      Router.updateHeaderContext();
    }
  },

  back: () => {
    const currentActive = document.querySelector(".tab-pane.active");
    const currentId = currentActive ? "#" + currentActive.id : null;
    const onDashboard = currentId && Router.isDashboardId(currentId);

    // Determinar destino:
    // 1. Si hay historial, ir al anterior
    // 2. Si no hay historial pero no estamos en Dashboard, ir a Dashboard (Virtual Back)
    let targetId = null;
    if (navigationHistory.length > 0) {
      targetId = navigationHistory.pop();
    } else if (!onDashboard) {
      targetId = "#dashboard-content";
    }

    if (!targetId) return;

    try {
      isNavigatingHistory = true;
      // Guardar en forward stack para poder volver "adelante"
      if (currentId && !Router.isDashboardId(currentId)) {
        forwardStack.push(currentId);
      }

      Router.navegarA(targetId);
    } finally {
      isNavigatingHistory = false;
      Router.updateHeaderContext();
    }
  },

  /**
   * Actualiza los indicadores visuales de la cabecera
   */
  updateHeaderContext: () => {
    const header = document.querySelector(".app-header-panel");
    if (!header) return;

    const currentActive = document.querySelector(".tab-pane.active");
    const onDashboard =
      currentActive && Router.isDashboardId("#" + currentActive.id);

    // Indicador Izquierdo (Atrás)
    const leftInd = document.getElementById("header-indicator-left");
    const lastBackId =
      navigationHistory.length > 0
        ? navigationHistory[navigationHistory.length - 1]
        : null;

    let prevLabel = "";
    let showLeft = false;

    if (lastBackId) {
      prevLabel = `Atrás: ${Router.getModuleLabel(lastBackId)}`;
      showLeft = true;
    } else if (!onDashboard) {
      prevLabel = "Atrás: Inicio";
      showLeft = true;
    }

    if (showLeft && leftInd) {
      leftInd.innerHTML = `<i class="bi bi-arrow-left-short"></i> ${prevLabel}`;
      leftInd.classList.remove("d-none");
    } else if (leftInd) {
      leftInd.classList.add("d-none");
    }

    // Indicador Derecho (Adelante)
    const rightInd = document.getElementById("header-indicator-right");
    const lastForwardId =
      forwardStack.length > 0 ? forwardStack[forwardStack.length - 1] : null;

    if (lastForwardId) {
      const nextLabel = `Sig: ${Router.getModuleLabel(lastForwardId)}`;
      if (rightInd) {
        rightInd.innerHTML = `${nextLabel} <i class="bi bi-arrow-right-short"></i>`;
        rightInd.classList.remove("d-none");
      }
    } else if (rightInd) {
      rightInd.classList.add("d-none");
    }

    if (
      navigationHistory.length === 0 &&
      forwardStack.length === 0 &&
      onDashboard
    ) {
      header.style.cursor = "default";
      header.title = "";
    } else {
      header.style.cursor = "pointer";
      header.title = "Izquierda: Atrás | Centro: Inicio | Derecha: Adelante";
    }
  },

  /**
   * Helper robusto para identificar el Dashboard
   */
  isDashboardId: (id) => {
    if (!id) return false;
    const clean = id.toString().trim().toLowerCase().replace("#", "");
    return (
      clean === "dashboard-content" ||
      clean === "inicio" ||
      clean === "dashboard" ||
      clean === "main-dashboard"
    );
  },

  /**
   * Intenta resolver un nombre legible para un módulo basándose en su ID
   */
  getModuleLabel: (id) => {
    if (!id) return "";
    if (Router.isDashboardId(id)) return "Inicio";

    const btn = document.querySelector(`button[data-bs-target="${id}"]`);
    if (btn && btn.innerText) return btn.innerText.trim();

    const pane = document.querySelector(id);
    if (pane) {
      const headerTitle = pane.querySelector(
        ".card-header h5, .card-header .fw-bold, h4, h5",
      );
      if (headerTitle && headerTitle.innerText)
        return headerTitle.innerText.trim();
    }

    const cleanId = id.replace("#", "").replace("-content", "");
    return cleanId.charAt(0).toUpperCase() + cleanId.slice(1);
  },
};

// Aliases para compatibilidad y uso simplificado
const isDashboardId = Router.isDashboardId;
const getModuleLabel = Router.getModuleLabel;
const updateHeaderContext = Router.updateHeaderContext;
