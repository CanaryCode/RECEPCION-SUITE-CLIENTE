// --- STARTUP ---

// --- IMPORTACIÓN DE MÓDULOS CORE ---
import { Ui } from "./core/Ui.js";
import { clock } from "./modules/clock.js";
import { Spotify } from "./modules/spotify.js";
import { IconSelector } from "./core/IconSelector.js";
import { ModuleLoader } from "./core/ModuleLoader.js";

// --- SISTEMAS CORE (NÚCLEO) ---
import { APP_CONFIG, Config } from "./core/Config.js";
import { Api } from "./core/Api.js";
import { Modal } from "./core/Modal.js";
import { Router } from "./core/Router.js";
import { CompLoader } from "./core/CompLoader.js";
import { Search } from "./core/Search.js";
import { sessionService } from "./services/SessionService.js";
import { Utils } from "./core/Utils.js";
import { RoomDetailModal } from "./core/RoomDetailModal.js";
import "./core/PrintService.js";
import { SecurityBarrier } from "./core/SecurityBarrier.js";
import { realTimeSync } from "./core/RealTimeSync.js";
import { Login } from "./core/Login.js";

// Global debug helpers
window.clearConfigOverride = () => {
  localStorage.removeItem("app_config_override");
  location.reload();
};

// Helper para forzar limpieza total de caché (útil después de actualizaciones)
window.forceClearCache = async () => {
  console.log('[CACHE] Limpiando toda la caché del navegador...');

  // 1. Limpiar localStorage
  const preserveKeys = ['app_config_override', 'session_user'];
  const backup = {};
  preserveKeys.forEach(key => {
    const val = localStorage.getItem(key);
    if (val) backup[key] = val;
  });
  localStorage.clear();
  Object.entries(backup).forEach(([key, val]) => localStorage.setItem(key, val));

  // 2. Limpiar sessionStorage
  sessionStorage.clear();

  // 3. Limpiar Cache API (si está disponible)
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log(`[CACHE] ${cacheNames.length} cachés eliminadas.`);
  }

  // 4. Reload forzado sin caché
  console.log('[CACHE] Recargando sin caché...');
  window.location.reload(true);
};

// Expose Essentials globally for non-module scripts and inline events
window.Utils = Utils;
window.sessionService = sessionService;
window.APP_CONFIG = APP_CONFIG;
window.Ui = Ui;
window.Api = Api;
window.Router = Router;
window.navegarA = Router.navegarA;
window.openLaunchPad = () => {
  Router.navegarA('#aplicaciones-content');
};
window.Router = Router;
window.bootstrap = bootstrap; // Critical for core/legacy access to tooltips/modals

// Global Tooltip Cleanup Helper
window.hideAllTooltips = () => {
  document.querySelectorAll(".tooltip").forEach((t) => t.remove());
  // Robust cleanup using Bootstrap API if available
  if (window.bootstrap?.Tooltip) {
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach((el) => {
      const instance = bootstrap.Tooltip.getInstance(el);
      if (instance) instance.hide();
    });
  }
};


/**
 * Actualiza el widget de Calendario en el Dashboard sin cargar el módulo completo
 * Esta función se ejecuta al inicio para mostrar eventos del día
 */
window.actualizarWidgetCalendario = async function() {
  try {
    // Importar solo el servicio de calendario (ligero)
    const { calendarioService } = await import('./services/CalendarioService.js');

    // Calcular fecha de hoy
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Obtener eventos del día
    const events = await calendarioService.getEventosDia(today);

    // Filtrar solo eventos personales (no festivos)
    const personalEvents = events ? events.filter(e => e.readonly !== true).sort((a, b) => a.hora.localeCompare(b.hora)) : [];

    console.log('[Main] Eventos personales del día:', personalEvents.length);

    // Actualizar widget usando Ui.updateDashboardWidget
    Ui.updateDashboardWidget('calendario', personalEvents, (ev) => {
      const isUrgent = ev.priority === 'Urgente';
      const iconColor = isUrgent ? 'text-danger' : 'text-primary';

      return `
        <tr style="cursor: pointer;" onclick="navegarA('#calendario-content'); setTimeout(() => { if(window.editarEventoCalendario) window.editarEventoCalendario('${ev.id}'); }, 200)">
          <td>
            <i class="bi bi-circle-fill ${iconColor} me-2" style="font-size: 0.5rem;"></i>
            <span class="fw-bold">${ev.titulo}</span>
          </td>
          <td class="text-end">
            <span class="badge bg-light text-dark border small">${ev.hora}</span>
          </td>
        </tr>`;
    });
  } catch (e) {
    console.error('[Main] Error actualizando widget de calendario:', e);
  }
}

/**
 * PUNTO DE ENTRADA PRINCIPAL (DOMContentLoaded)
 * Se ejecuta cuando el navegador termina de cargar el HTML básico.
 */
document.addEventListener("DOMContentLoaded", async () => {
  console.log(`%c Reception Suite v${APP_CONFIG.SYSTEM.VERSION || '?.?.?'} `, 'background: #222; color: #bada55; font-size: 1.2rem; font-weight: bold;');
  try {
    // 0. Limpieza UI Base
    try {
      document
        .querySelectorAll("form, input")
        .forEach((el) => el.setAttribute("autocomplete", "off"));
    } catch (e) {
      console.warn("No se pudo desactivar autocompletado", e);
    }

    // 1. CARGAR CONFIGURACIÓN (CRÍTICO)
    const configLoaded = await Config.loadConfig();
    const initialLoader = document.getElementById("security-initial-loader");

    if (!configLoaded) {
      if (initialLoader) initialLoader.remove();
      document.body.innerHTML =
        '<div style="color:red; padding:20px; text-align:center;"><h1>Error Crítico</h1><p>No se ha podido cargar la configuración (config.json).</p></div>';
      return;
    }

    // --- 3. VALIDACIÓN DE SEGURIDAD (Con Timeout de Seguridad) ---
    console.log("Main: Validando estación...");
    let station = null;
    try {
      // Aumentamos el timeout a 20s para permitir que el bucle de retries de Api.js funcione
      // sin bloquear definitivamente el arranque si hay una desincronización de tokens.
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout de Seguridad")), 20000));
      station = await Promise.race([Api.validateStation(), timeout]);
    } catch (e) {
      console.warn("Main: Error o timeout en validación de estación:", e.message);
    }

    // SECURITY DEBUG — ver qué devuelve validateStation para diagnosticar bypasses
    console.log('[SECURITY] validateStation result:', station, '| stationId:', station?.stationId);

    // Defensive check: un objeto vacío {} sería truthy pero inválido → forzamos validar stationId
    if (!station || !station.stationId) {
      console.warn("Main: Estación no validada o sin stationId. Mostrando SecurityBarrier.");
      if (initialLoader) initialLoader.remove();
      SecurityBarrier.show('AGENT_DOWN');
      return;
    }

    console.log("Main: Estación validada con éxito.");

    // Si la seguridad pasa, quitamos la cortina suavemente
    if (initialLoader) {
      initialLoader.style.transition = 'opacity 0.4s ease';
      initialLoader.style.opacity = '0';
      setTimeout(() => initialLoader.remove(), 400);
    }

    console.log(`[AUTH] Estación validada: ${station.stationId}`);

    if (!sessionService.isAuthenticated()) {
      console.log("Main: No hay sesión activa. Mostrando selector de usuario...");
      await Login.showSelector();
    }
    const currentUser = sessionService.getUser();
    console.log(`[AUTH] Usuario identificado: ${currentUser}`);
    
    // Actualizar UI inmediatamente después de login
    updateUserUI(currentUser);

    // 2. MULTIMEDIA INIT (Spotify)...
    Spotify.initPlayer();

    // Diagnóstico de Almacenamiento Local
    try {
      const testKey = "__test_storage__";
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
    } catch (e) {
      console.error("Critical Storage Error:", e);
      alert("⚠️ ERROR CRÍTICO: El sistema no puede guardar datos locales.");
    }

    // 3. Inicializar Sistemas Base

    Ui.init();
    clock.init();
    Modal.init();
    Router.init();
    Search.init();

    // 4. Cargar Plantillas
    const componentes = [
      { id: "riu-content", path: "assets/templates/riu.html" },
      { id: "agenda-content", path: "assets/templates/agenda.html" },
      { id: "cobro-content", path: "assets/templates/cobro.html" },
      { id: "caja-content", path: "assets/templates/caja.html" },
      { id: "safe-content", path: "assets/templates/safe.html" },
      {
        id: "despertadores-content",
        path: "assets/templates/despertadores.html",
      },
      { id: "desayuno-content", path: "assets/templates/desayuno.html" },
      { id: "estancia-content", path: "assets/templates/estancia.html" },
      { id: "novedades-content", path: "assets/templates/novedades.html" },
      { id: "cena-fria-content", path: "assets/templates/cena_fria.html" },
      { id: "atenciones-content", path: "assets/templates/atenciones.html" },
      { id: "ayuda-content", path: "assets/templates/ayuda.html" },
      { id: "transfers-content", path: "assets/templates/transfers.html" },
      { id: "lost-found-content", path: "assets/templates/lost_found.html" },
      { id: "notas-content", path: "assets/templates/notas_permanentes.html" },
      { id: "precios-content", path: "assets/templates/precios.html" },
      {
        id: "system-alarms-content",
        path: "assets/templates/system_alarms.html",
      },
      { id: "rack-content", path: "assets/templates/rack.html" },
      { id: "excursiones-content", path: "assets/templates/excursiones.html" },
      {
        id: "reservas-instalaciones-content",
        path: "assets/templates/reservas_instalaciones.html",
      },
      {
        id: "configuracion-content",
        path: "assets/templates/configuracion.html",
      },
      { id: "valoracion-content", path: "assets/templates/valoracion.html" },
      { id: "tiempo-content", path: "assets/templates/tiempo.html" },
      { id: "ocr-datafonos-content", path: "assets/templates/ocr_datafonos.html" },
      { id: "calendario-content", path: "assets/templates/calendario.html" },
      { id: "tareas-content", path: "assets/templates/tareas.html" },
      { id: "guia-interactiva-content", path: "assets/templates/guia_interactiva.html" },
      { id: "calculadora-container", path: "assets/templates/calculadora.html" },
      { id: "chat-wrapper", path: "assets/templates/chat.html" },
    ];

    await CompLoader.loadAll(componentes);

    // 5. Inicialización de Módulos CRÍTICOS (Lazy Loading)
    console.log('[STARTUP] Cargando módulos críticos...');
    await ModuleLoader.loadCriticalModules();
    console.log('[STARTUP] Módulos críticos cargados. Los demás se cargarán bajo demanda.');

    // Exponer ModuleLoader globalmente para el Router
    window.ModuleLoader = ModuleLoader;

    // 5.1 Forzar refresh del dashboard después de cargar módulos críticos
    // Los módulos críticos (Despertadores, Transfers, etc.) renderizan sus widgets
    // pero necesitamos asegurar que el dashboard esté visible si hay datos
    setTimeout(async () => {
      // Llamar a las funciones de mostrar para cada módulo crítico que tenga widget
      if (window.mostrarDespertadores) window.mostrarDespertadores();
      if (window.mostrarTransfers) window.mostrarTransfers();
      if (window.mostrarCenasFrias) window.mostrarCenasFrias();
      if (window.mostrarDesayunos) window.mostrarDesayunos();
      if (window.mostrarNovedades) window.mostrarNovedades();
      if (window.mostrarTareas) window.mostrarTareas();

      // Actualizar widget de Calendario sin cargar el módulo completo
      await actualizarWidgetCalendario();

      // Inicializar Chat
      import("./modules/chat.js").then((m) => m.chat && m.chat.init());
    }, 100);

    // --- 5.5 WATCHDOG DE SEGURIDAD (Refresco de Handshake) ---
    // Verifica cada 30 segundos si el agente local sigue vivo
    let consecutiveAuthFailures = 0;
    setInterval(async () => {
      const stillValid = await Api.validateStation();
      if (!stillValid) {
        consecutiveAuthFailures++;
        console.warn(`[AUTH] Fallo en refresco de Agente (${consecutiveAuthFailures}/3).`);

        if (consecutiveAuthFailures >= 3) {
          console.error("[AUTH] Agente Local perdido permanentemente. Bloqueando acceso.");
          SecurityBarrier.show('AGENT_DOWN');
        }
      } else {
        // Si vuelve a ser válido, reseteamos el contador de fallos
        if (consecutiveAuthFailures > 0) {
          console.log("[AUTH] Conexión con Agente restaurada.");
        }
        consecutiveAuthFailures = 0;
      }
    }, 30000);

    // 6. Inicialización de UI Global (no depende de módulos)
    setTimeout(() => {
      inicializarSesionGlobal();
      initGlobalTooltips();
      window.renderLaunchPad("", "app", "tab");

      const ytModal = document.getElementById("youtubePlayerModal");
      if (ytModal)
        ytModal.addEventListener("hidden.bs.modal", window.stopYouTubeVideo);
      const webModal = document.getElementById("webViewerModal");
      if (webModal)
        webModal.addEventListener("hidden.bs.modal", window.stopWebViewer);

      // 7. Deep Linking (Vínculos directos)
      const initialHash = window.location.hash;
      if (initialHash && initialHash.length > 2) {
        console.log(`[Router] Detectado hash inicial: ${initialHash}`);
        // El Router cargará el módulo bajo demanda si es necesario
        setTimeout(() => {
          Router.navegarA(initialHash);
        }, 50);
      }

      // Mostrar estadísticas de carga en consola
      const stats = ModuleLoader.getStats();
      console.log(`[STARTUP] ✓ Arranque completo. Módulos: ${stats.loaded}/${stats.total} cargados.`);
    }, 100);

    // 8. Reactividad (WebSocket push events)
    window.addEventListener("service-synced", (e) => {
      const currentHash = window.location.hash;
      if (
        e.detail.endpoint === "riu_transfers" &&
        (!currentHash || currentHash === "#transfers-content")
      ) {
        import("./modules/transfers.js").then(
          (m) => m.mostrarTransfers && m.mostrarTransfers(),
        );
      }
      if (
        e.detail.endpoint === "riu_class_db" &&
        currentHash === "#riu-content"
      ) {
        import("./modules/riu.js").then(
          (m) => m.mostrarClientes && m.mostrarClientes(),
        );
      }
      if (
        e.detail.endpoint === "riu_safe_rentals" &&
        currentHash === "#safe-content"
      ) {
        import("./modules/safe.js").then(
          (m) => m.mostrarSafeRentals && m.mostrarSafeRentals(),
        );
      }
      if (
        e.detail.endpoint === "riu_tareas"
      ) {
        import("./modules/tareas.js").then(
          (m) => m.mostrarTareas && m.mostrarTareas(),
        );
      }
    });

    // 9. Heartbeat del servidor
    let heartbeatFailures = 0;
    const maxFailures = 5;
    setInterval(() => {
      fetch("/api/heartbeat")
        .then((response) => {
          if (response.ok) {
            heartbeatFailures = 0;
            const overlay = document.getElementById("server-lost-overlay");
            if (overlay) overlay.remove();
          }
        })
        .catch(() => {
          heartbeatFailures++;
          if (heartbeatFailures >= maxFailures) {
            if (!document.getElementById("server-lost-overlay")) {
              const overlay = document.createElement("div");
              overlay.id = "server-lost-overlay";
              overlay.innerHTML = `<div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                                    background: rgba(0,0,0,0.85); z-index: 30000; 
                                    display: flex; flex-direction: column; align-items: center; justify-content: center; 
                                    color: white; font-family: sans-serif; text-align: center;">
                                <div style="font-size: 4rem; color: #dc3545; margin-bottom: 20px;"><i class="bi bi-wifi-off"></i></div>
                                <h1 style="font-size: 2rem; margin-bottom: 10px;">¡Conexión Perdida!</h1>
                                <p style="font-size: 1.1rem; max-width: 500px; margin-bottom: 30px; opacity: 0.9;">El servidor se ha detenido. Reinicia la aplicación Reception Suite para continuar.</p>
                                <button onclick="location.reload()" style="padding: 12px 30px; background: #0d6efd; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">RECONECTAR</button>
                            </div>`;
              document.body.appendChild(overlay);
            }
          }
        });
    }, 10000);

    // 10. Iniciar sincronización en tiempo real
    realTimeSync.connect();
  } catch (criticalError) {
    console.error("CRITICAL BOOT ERROR:", criticalError);
    const errorBox = document.getElementById("global-error-box");
    if (errorBox) {
      errorBox.classList.remove("d-none");
      const list = document.getElementById("error-list-content");
      if (list)
        list.innerHTML += `<div><strong>ERROR DE ARRANQUE:</strong> ${criticalError.message}</div>`;
    }
  }
});

// --- HELPER FUNCTIONS & GLOBAL EXPOSURE ---

/**
 * LANZADOR DE APLICACIONES (LaunchPad)
 */
window._currentLaunchPadFilter = "app";

window.openLaunchPad = () => {
  const searchInput = document.getElementById("launchPadSearch");
  if (searchInput) searchInput.value = "";
  window._currentLaunchPadFilter = "app";

  // Update filter buttons UI
  document
    .querySelectorAll('[id^="btnFilterLaunch"]')
    .forEach((btn) => btn.classList.remove("active", "btn-primary"));
  document
    .getElementById("btnFilterLaunchApps")
    ?.classList.add("active", "btn-primary");

  window.renderLaunchPad("", "app", "modal");

  // Verificar que Bootstrap esté cargado
  try {
    if (typeof bootstrap === 'undefined' || !bootstrap.Modal) {
      console.error('[LaunchPad] Bootstrap no está disponible');
      alert('Error: Bootstrap no está cargado. Por favor recarga la página con Ctrl+Shift+R');
      return;
    }

    const modalEl = document.getElementById("launchPadModal");
    if (!modalEl) {
      console.error('[LaunchPad] El elemento launchPadModal no existe en el DOM');
      alert('Error técnico: El lanzador no se encuentra en la página.');
      return;
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  } catch (e) {
    console.error('[LaunchPad] Error al abrir modal:', e);
    alert('Error al abrir LaunchPad. Por favor recarga la página con Ctrl+Shift+R');
  }
};

window.filterLaunchPad = (filter, target = "modal") => {
  window._launchPadOffset = 0; // Reset offset on filter change
  window._currentLaunchPadFilter = filter; // Update global filter state

  // UI Update
  const prefix = target === "tab" ? "_Tab" : "";
  const btnMap = {
    all: "btnFilterLaunchAll" + prefix,
    app: "btnFilterLaunchApps" + prefix,
    folder: "btnFilterLaunchFolders" + prefix,
    url: "btnFilterLaunchUrls" + prefix,
    maps: "btnFilterLaunchMaps" + prefix,
    documentos: "btnFilterLaunchDocs" + prefix,
  };

  Object.values(btnMap).forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.classList.remove("active", "btn-primary");
      if (id === btnMap[filter]) btn.classList.add("active", "btn-primary");
    }
  });

  const searchId = target === "tab" ? "launchPadSearch_Tab" : "launchPadSearch";
  const query = document.getElementById(searchId)?.value || "";
  window.renderLaunchPad(query, filter, target);
};

window.renderLaunchPad = async (
  query = "",
  filter = "app",
  target = "modal",
) => {
  const gridId = target === "tab" ? "launchPadGrid_Tab" : "launchPadGrid";
  const container = document.getElementById(gridId);
  if (!container) return;

  window._currentLaunchPadFilter = filter;
  window._launchPadOffset = 0; // Reiniciar paginación

  let baseApps = APP_CONFIG.SYSTEM?.LAUNCHERS || [];

  // 1. Filtrar Lanzadores Base por Categoría
  let filteredLaunchers = baseApps;
  if (filter !== "all") {
    filteredLaunchers = baseApps.filter((a) => {
      // 1. Prioridad: Tipo explícito definido por el usuario
      let type = a.type;

      // 2. Si no tiene tipo, realizamos inferencia robusta
      if (!type) {
        const isHttp = (a.url && a.url.startsWith("http")) || (a.path && a.path.startsWith("http"));

        if (isHttp) {
          type = "url";
        } else if (a.path && !a.path.match(/\.(exe|lnk|bat|cmd|msi)$/i)) {
          type = "folder";
        } else {
          type = "app";
        }
      }

      if (filter === "documentos") return type === "documentos";
      if (filter === "video") return type === "video";
      if (filter === "spotify") return type === "spotify";
      if (filter === "maps") return type === "maps";

      // Mapas NO deben incluirse en URL si queremos que tengan su propia pestaña
      if (filter === "url" && type === "maps") return false;

      return type === filter;
    });
  }

  // 2. LÓGICA ESPECIAL PARA AGREGAR DOCUMENTOS
  let aggregatedItems = [];
  if (filter === "documentos") {
    const folderLaunchers = filteredLaunchers.filter((a) => {
      const p = (a.path || "").toLowerCase();
      const docExts = [
        ".pdf",
        ".doc",
        ".docx",
        ".txt",
        ".xlsx",
        ".xls",
        ".odt",
        ".rtf",
      ];
      return !docExts.some((ext) => p.endsWith(ext));
    });

    const directFiles = filteredLaunchers.filter(
      (a) => !folderLaunchers.includes(a),
    );
    aggregatedItems = [...directFiles];

    if (folderLaunchers.length > 0) {
      const loaderId = "docs-loading-indicator-" + target;
      container.innerHTML = `<div id="${loaderId}" class="col-12 text-center py-5"><div class="spinner-border text-info"></div><div class="mt-2 text-muted">Explorando documentos...</div></div>`;

      try {
        const data = await Api.post("/system/list-docs", {
          folderPaths: folderLaunchers.map((f) => f.path),
        });

        if (data && data.documents) {
          aggregatedItems = [...aggregatedItems, ...data.documents];

          // Ordenar documentos por fecha de modificación (más recientes primero)
          aggregatedItems.sort((a, b) => {
            const dateA = new Date(a.mtime || 0);
            const dateB = new Date(b.mtime || 0);
            return dateB - dateA;
          });
        }
      } catch (err) {
        console.error("Error scan:", err);
        Ui.showToast("Error al explorar documentos", "danger");
      }
    }
  } else {
    aggregatedItems = filteredLaunchers;
  }

  // 3. Filtrar por Búsqueda
  if (query) {
    const q = query.toLowerCase().trim();
    aggregatedItems = aggregatedItems.filter(
      (a) =>
        (a.label || "").toLowerCase().includes(q) ||
        (a.path && a.path.toLowerCase().includes(q)),
    );
  }

  window._launchPadCurrentItems = aggregatedItems;
  window._launchPadOffset = window._launchPadLimit;

  container.innerHTML = "";
  renderGridItems(
    container,
    aggregatedItems.slice(0, window._launchPadLimit),
    query,
  );

  // Añadir botón "Cargar más" si hay más items
  if (aggregatedItems.length > window._launchPadLimit) {
    container.insertAdjacentHTML(
      "afterend",
      `<div id="load-more-btn-container" class="col-12 text-center py-3"><button class="btn btn-sm btn-outline-secondary" onclick="loadMoreLaunchPad('${gridId}')">Cargar más resultados...</button></div>`,
    );
  } else {
    document.getElementById("load-more-btn-container")?.remove();
  }
};

window.loadMoreLaunchPad = (gridId) => {
  const container = document.getElementById(gridId);
  const nextItems = window._launchPadCurrentItems.slice(
    window._launchPadOffset,
    window._launchPadOffset + window._launchPadLimit,
  );
  if (nextItems.length > 0) {
    renderGridItems(container, nextItems, "", true);
    window._launchPadOffset += window._launchPadLimit;
  }
  if (window._launchPadOffset >= window._launchPadCurrentItems.length) {
    document.getElementById("load-more-btn-container")?.remove();
  }
};

// Helper interno para renderizar los items en el grid
function renderGridItems(container, items, query = "", append = false) {
  if (!append) {
    container.innerHTML = "";
    document.getElementById("load-more-btn-container")?.remove();
  }

  if (items.length === 0 && !append) {
    container.innerHTML = `<div class="col-12 text-center py-5"><i class="bi bi-search fs-1 text-muted mb-2 d-block"></i><div class="text-muted">No hay resultados.</div></div>`;
    return;
  }

  items.forEach((app) => {
    const isFolder = app.type === "folder";
    const isUrl = app.type === "url" || app.type === "maps";
    const isDoc = app.type === "documentos";
    const isVideo = app.type === "video";
    const isSpotify = app.type === "spotify";
    const isEmbedded = app.embedded === true || app.embedded === "true"; // Handle potential string from config
    const pathStr = (app.path || "").replace(/\\/g, "\\\\");

    // Standardized Icons by Category
    let specificIcon = "cpu-fill"; // Default for 'app'
    let iconColor = "text-primary";

    if (isFolder) {
      specificIcon = "folder-fill";
      iconColor = "text-warning";
    } else if (app.type === "maps") {
      specificIcon = "geo-alt-fill";
      iconColor = "text-danger";
    } else if (isUrl) {
      specificIcon = "globe-americas";
      iconColor = "text-success";
    } else if (isDoc) {
      specificIcon = "file-earmark-text-fill";
      iconColor = "text-info";
    } else if (isSpotify) {
      specificIcon = "spotify";
      iconColor = "text-success";
    } else if (isVideo) {
      specificIcon = "play-circle-fill";
      iconColor = "text-danger";
    }

    const iconHtml = app.icon && (app.icon.startsWith('data:') || app.icon.includes('.') || app.icon.includes('/'))
      ? `<div class="mb-2 text-center"><img src="${app.icon}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 12px;" class="shadow-sm"></div>`
      : `<div class="mb-2 ${iconColor} text-center"><i class="bi bi-${app.icon || specificIcon} fs-1"></i></div>`;

    let clickHandler = `window.launchExternalApp('${pathStr}', '${app.type || "app"}', '${app.label.replace(/'/g, "\\'")}', ${isEmbedded})`;
    if (isVideo && isEmbedded)
      clickHandler = `window.playVideo('${pathStr}', '${app.label.replace(/'/g, "\\'")}')`;

    container.insertAdjacentHTML(
      "beforeend",
      `
        <div class="col-6 col-md-4 col-lg-2 animate__animated animate__fadeIn">
            <div class="card h-100 border-0 shadow-sm hover-scale text-center p-2" 
                 style="cursor:pointer;" onclick="${clickHandler}">
                <div class="position-absolute top-0 end-0 p-2 opacity-50">
                    <i class="bi bi-${isFolder ? "folder-symlink" : isUrl ? "globe" : isDoc ? "file-earmark" : isVideo ? "play-circle" : isSpotify ? "spotify" : "cpu-fill"} small"></i>
                </div>
                <div class="d-flex justify-content-center w-100">${iconHtml}</div>
                <div class="fw-bold text-dark small launcher-label mt-1">${app.label}</div>
                <div class="text-muted" style="font-size: 0.6rem;">${isFolder ? "Carpeta" : app.type === "maps" ? "Mapas" : isUrl ? "URL Web" : isDoc ? "Archivo" : isVideo ? "Video YouTube" : isSpotify ? "Spotify" : "App"}</div>
            </div>
        </div>`,
    );
  });
}

/**
 * EJECUTAR APP EXTERNA O ABRIR URL
 */
window.launchExternalApp = async (
  command,
  type = "app",
  label = "",
  embedded = false,
) => {
  console.log('[LAUNCH] Called with:', { command, type, label, embedded });

  // Si es una URL o el comando parece una URL
  if (
    type === "url" ||
    type === "maps" ||
    type === "video" ||
    type === "spotify" ||
    command.startsWith("http")
  ) {
    if (embedded) {
      // Usamos el proxy por defecto si es embebido para evitar bloqueos
      window.openWebViewer(command, label || "Acceso Externo", true);
    } else {
      window.open(command, "_blank");
    }
    return;
  }

  // Validación para evitar errores 400 por comandos vacíos
  if (!command || command.trim() === "") {
    console.warn(`[Launcher] Intento de lanzar comando vacío para: "${label}"`);
    Ui.showToast(
      `El lanzador "${label}" no tiene una ruta configurada.`,
      "warning",
    );
    return;
  }

  console.log('[LAUNCH] Sending command to agent:', command);
  try {
    // FIX: Usar Api.post para asegurar que se envía el X-Station-Key y se rutea correctamente
    // Para carpetas, enviar el tipo para que el agente use el comando correcto (explorer en Windows)
    const result = await Api.post("system/launch", {
      command,
      type: type === 'folder' ? 'folder' : 'app'
    });
    console.log('[LAUNCH] Success:', result);
  } catch (e) {
    console.error("[LAUNCH] Fallo al lanzar:", e);
    alert("Error al lanzar aplicación: " + (e.message || e));
  }
};

function inicializarSesionGlobal() {
  const userList = document.getElementById("globalUserList");
  const userBtnName = document.getElementById("globalUserName");
  const userBtn = document.getElementById("globalUserBtn");

  // 2. Restaurar sesión (Ya se hace en el arranque bloqueante, pero sincronizamos aquí también)
  const currentUser = sessionService.getUser();
  if (currentUser) {
    updateUserUI(currentUser);
  } else {
    userBtn.classList.add("btn-outline-danger", "animation-pulse");
  }

  // 3. Exponer funciones
  window.setGlobalUser = (name) => {
    sessionService.setUser(name);
    updateUserUI(name);
    userBtn.classList.remove("btn-outline-danger", "animation-pulse");
    userBtn.classList.add("btn-outline-secondary");
  };

  // Modal para 'Otro'
  if (!document.getElementById("modalGlobalUser")) {
    const modalDiv = document.createElement("div");
    modalDiv.innerHTML = `
            <div class="modal fade" id="modalGlobalUser" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow-lg">
                        <div class="modal-header border-0 pb-0">
                            <h5 class="modal-title fw-bold text-primary"><i class="bi bi-person-badge me-2"></i>Identifícate</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <input type="text" id="inputGlobalUser" class="form-control form-control-lg text-center" placeholder="Nombre...">
                        </div>
                        <div class="modal-footer border-0 pt-0">
                            <button type="button" class="btn btn-primary w-100" onclick="window.confirmGlobalUser()">Guardar</button>
                        </div>
                    </div>
                </div>
            </div>`;
    document.body.appendChild(modalDiv);
    document
      .getElementById("inputGlobalUser")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") window.confirmGlobalUser();
      });
  }

  window.promptGlobalUser = () => {
    const modal = bootstrap.Modal.getOrCreateInstance(
      document.getElementById("modalGlobalUser"),
    );
    modal.show();
  };

  window.confirmGlobalUser = () => {
    const name = document.getElementById("inputGlobalUser").value;
    if (name?.trim()) {
      window.setGlobalUser(name.trim());
      bootstrap.Modal.getInstance(
        document.getElementById("modalGlobalUser"),
      ).hide();
    }
  };

  window.logoutGlobal = () => {
    sessionService.logout();
    location.reload();
  };

  window.cleanupUI = () => {
    document.querySelectorAll(".modal-backdrop").forEach((b) => b.remove());
    document
      .querySelectorAll(".modal.show")
      .forEach((m) => m.classList.remove("show"));
    document.body.classList.remove("modal-open");
    document.body.style.overflow = "";
    alert("UI Limpia");
  };
};

// --- TOOLTIP HELPERS ---

window.initTooltips = (container = document.body) => {
  const selector =
    '[data-bs-toggle="tooltip"], .custom-tooltip, [data-tooltip="true"]';
  if (container.matches && container.matches(selector))
    initSingleTooltip(container);
  if (container.querySelectorAll)
    container.querySelectorAll(selector).forEach((el) => initSingleTooltip(el));
};

function initSingleTooltip(el) {
  try {
    bootstrap.Tooltip.getOrCreateInstance(el, {
      trigger: "hover",
      container: "body",
      delay: { show: 700, hide: 100 },
      html: true,
      placement: el.dataset.bsPlacement || "top",
    });
  } catch (e) {
    console.warn("Tooltip error:", e);
  }
}

function initGlobalTooltips() {
  window.initTooltips(document.body);
  new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      if (m.type === "childList")
        m.addedNodes.forEach((node) => {
          if (node.nodeType === 1) window.initTooltips(node);
        });
    });
  }).observe(document.body, { childList: true, subtree: true });
}

function updateUserUI(name) {
  const userBtnName = document.getElementById("globalUserName");
  const userBtn = document.getElementById("globalUserBtn");
  if (userBtnName) userBtnName.innerText = name;
  if (userBtn) {
    userBtn.classList.remove("btn-outline-secondary", "btn-outline-danger", "animation-pulse");
    userBtn.classList.add("btn-success", "text-white");
  }
}
window.updateUserUI = updateUserUI;

window.checkDailySummaryVisibility = () => {
  const section = document.getElementById("dashboard-resumen-seccion");
  if (!section) return;

  // FIX: El usuario quiere que el título "Resumen del Día" esté SIEMPRE visible.
  // Eliminamos la lógica que oculta la sección completa si no hay items.
  section.classList.remove("d-none");

  // Opcional: Podríamos mostrar un mensaje de "Todo al día" aquí si quisiéramos,
  // pero por ahora solo aseguramos que la sección y su título permanezcan visibles.
  section.classList.remove("d-none");
};

/**
 * YOUTUBE HELPERS
 */
window.getYouTubeId = (url) => {
  if (!url) return null;
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

window.playVideo = (url, title) => {
  const videoId = window.getYouTubeId(url);
  if (!videoId) {
    Ui.showToast(
      "No se pudo identificar el ID del video de YouTube",
      "warning",
    );
    return;
  }

  const iframe = document.getElementById("youtubeIframe");
  const titleEl = document.getElementById("youtubePlayerTitle");

  if (iframe)
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  if (titleEl) titleEl.textContent = title;

  const modal = new bootstrap.Modal(
    document.getElementById("youtubePlayerModal"),
  );
  modal.show();
};

window.stopYouTubeVideo = () => {
  const iframe = document.getElementById("youtubeIframe");
  if (iframe) iframe.src = "";
};

/**
 * WEB VIEWER HELPERS
 */
window._currentWebUrl = "";

window.openWebViewer = (url, title, useProxy = true) => {
  const iframe = document.getElementById("webViewerIframe");
  const titleEl = document.getElementById("webViewerTitle");

  window._currentWebUrl = url;

  // Si useProxy es true, pasamos la URL por nuestro proxy para evitar bloqueos CSP/X-Frame
  const finalUrl = useProxy
    ? `/api/system/web-proxy?url=${encodeURIComponent(url)}`
    : url;

  if (iframe) iframe.src = finalUrl;
  if (titleEl) titleEl.textContent = title;

  const modal = new bootstrap.Modal(document.getElementById("webViewerModal"));
  modal.show();
};

window.openExternalWeb = () => {
  if (window._currentWebUrl) {
    window.open(window._currentWebUrl, "_blank");
  }
};

window.stopWebViewer = () => {
  const iframe = document.getElementById("webViewerIframe");
  if (iframe) iframe.src = "";
};

/**
 * LAZY-LOADED MODULE WRAPPERS
 * Funciones globales que cargan módulos bajo demanda antes de ejecutar acciones
 */
window.abrirCaja = async function() {
  const originalFn = window.abrirCaja;
  await ModuleLoader.loadModule('caja');
  if (window.abrirCaja && window.abrirCaja !== originalFn) {
    window.abrirCaja();
  }
};

window.abrirCalculadora = async function() {
  // Carga e inicializa el módulo de forma perezosa
  const m = await import("./modules/calculadora.js");
  if (m.calculadora) {
    await m.calculadora.init();
    m.calculadora.abrir();
  }
};
