# REGLAS Y CONTEXTO DEL PROYECTO (RECEPCIÓN SUITE)

> [!IMPORTANT]
> **Arquitectura Cliente/Servidor**: La carpeta `agent/` contiene la aplicación **cliente** (la que se instala en el PC de recepción). El resto de carpetas constituyen el **servidor**. Al desplegar, solo es necesario llevar la carpeta `agent/` al terminal del cliente.

## 1. Descripción del Proyecto

- **Nombre**: Recepción Suite (Hotel Garoé).
- **Objetivo**: Aplicación web de gestión para recepción de hotel, enfocada en rapidez, diseño premium y funcionalidad offline/híbrida.
- **Tecnología**: HTML5, CSS3 (Vanilla), JavaScript ES6 Modules. No usa frameworks complejos (React/Vue) ni bundlers pesados por defecto.

## 2. Preferencias de Diseño (CRÍTICO)

- **Estética**: Diseño moderno, premium y dinámico (Glassmorphism, sombras suaves, bordes redondeados).
- **Interacción**: Animaciones sutiles, feedback visual inmediato, tooltips informativos.
- **Evitar**: Diseños planos aburridos, colores primarios estándar (azul/rojo puro), alertas nativas del navegador (usar Modales/Toasts).

### 7.3. Estética Limpia

- **Estructura de Panel Único**: Los módulos deben contenido principal en **UN solo contenedor** tipo "card" o "content-panel". **NUNCA anidar** cards dentro de cards (paneles dentro de paneles), ya que genera ruido visual y márgenes innecesarios.
- **Alineación**: Los formularios y la información principal deben tender a ocupar el ancho disponible o justificarse a la **IZQUIERDA**. Evitar el centrado de formularios (`justify-content-center`) que deja espacios vacíos a los lados innecesariamente.
- **Iconos**: Usar `bootstrap-icons`.
- **Botones**: Primarios (`btn-primary`) para acciones principales, `btn-outline-*` para alternas, `btn-light` para cancelar/limpiar. Efecto `hover-scale` para interactividad.

## 3. Arquitectura Técnica

- **Configuración**: Todas las constantes (nombres, precios, configuraciones del hotel) DEBEN estar en `config.json` y cargarse vía `Config.js`. NO harcodear valores.
- **Persistencia Híbrida (MariaDB + JSON)**:
  - **Autoridad MariaDB**: Desde la Iteración 12, la base de datos MariaDB (Docker) es la **fuente de verdad primaria**. Todos los módulos operativos se persisten en tablas relacionales.
  - **Respaldo JSON Transaccional**: El sistema mantiene una copia exacta de cada tabla en `storage/*.json` como respaldo de alta disponibilidad y para permitir la portabilidad (ejecución sin Docker). El archivo JSON solo se actualiza si la transacción de la DB tiene éxito.
  - **Integridad Atómica**: Toda operación de escritura (`POST /api/storage/:key`) utiliza transacciones SQL (`BEGIN/COMMIT`). Si una inserción falla, se ejecuta un `ROLLBACK` total y el archivo JSON no se toca.
  - **Sin Caché**: La aplicación prohíbe el uso de caché del navegador para datos operativos. Se usa un timestamp (`?_t=...`) en los GET.
  - **LocalStorage Abstraction**: Es **OBLIGATORIO** usar el wrapper `core/LocalStorage.js` para persistencia temporal (UI states). Prohibido el uso directo de `localStorage` nativo.
- **Configurabilidad (Adaptabilidad Hotelera)**:
  - Cualquier variable específica (Precios, departamentos, tipos de habitación...) **DEBE SER CONFIGURABLE** desde `config.json`. El objetivo es que la app sea instalable en cualquier hotel solo cambiando el JSON de configuración.
  - El objetivo es que la aplicación sea "multihotel" o fácilmente adaptable a otro establecimiento sin tocar código fuente.
- **Módulos**: Uso estricto de ES Modules (`import/export`).
- **CSS**: Estilos centralizados pero modulares. Evitar estilos en línea excesivos.
- **Prioridad de Cómputo en Cliente (Procesamiento Distribuido)**:
  - Para evitar la saturación del servidor principal y aprovechar el hardware local del PC de recepción, todo procesamiento pesado que sea técnicamente viable (OCR, generación de reportes PDF, algoritmos de comparación complejos, tratamiento de imágenes) **DEBE realizarse en el lado del cliente (Navegador/Agente)**.
  - El servidor debe quedar reservado principalmente para persistencia (DB/JSON), orquestación mínima y seguridad. 
  - Esta regla solo se romperá si el cómputo en cliente compromete críticamente la seguridad de los datos maestros o la clave de cifrado.

## 4. Flujo de Trabajo

- **Portable**: La aplicación debe ser capaz de ejecutarse en entornos con restricciones (versiones portables de Node.js).
- **Validación Automatizada**: Antes de desplegar o dar por terminada una mejora en el storage, es obligatorio ejecutar la suite de pruebas:
  - Ejecutar **`EJECUTAR_PRUEBAS.bat`** (Recomendado) o `npm test` para verificar transacciones y rollback.
- **Registro de Logs**: Verificar siempre `storage/server_debug.log` para confirmar que las operaciones SQL se realizaron correctamente.
- **Carga de Datos**: Verificar siempre que los cambios en JS no rompan la carga asíncrona de configuración.

## 5. Instrucciones para la IA

- Antes de planificar cambios complejos, revisa `config.json` y la estructura de módulos existente.
- Prioriza soluciones que no requieran instalar nuevas dependencias de NPM si es posible hacerlo nativamente.
- Mantén el código limpio, comentado y consistente con el estilo existente.

## 6. Estándares de Diseño y Desarrollo de Módulos

Para asegurar la consistencia visual y funcional, **todo nuevo módulo** debe seguir estas directrices:

### 6.1. Estructura Visual (HTML)

Todo módulo debe usar el contenedor `.content-panel` (si aplica estilo tarjeta) o la estructura estándar de encabezado + contenido.

```html
<!-- Encabezado del Módulo (Título Dinámico) -->
<h4 class="module-title-discrete">
  <i class="bi bi-[ICONO_DINAMICO]"></i> [NOMBRE MÓDULO]
</h4>

<!-- Barra de Herramientas y Vistas (Opcional, pero recomendada) -->
<div class="module-toolbar no-print">
  <div class="btn-group" role="group">
    <button
      class="btn btn-outline-primary active"
      id="btn[Modulo]Vista1"
      onclick="cambiarVista('vista1')"
      data-bs-toggle="tooltip"
      data-bs-title="Ver Vista Principal"
    >
      <i class="bi bi-laptop me-2"></i>Vista Trabajo
    </button>
    <button
      class="btn btn-outline-primary"
      id="btn[Modulo]Vista2"
      onclick="cambiarVista('vista2')"
      data-bs-toggle="tooltip"
      data-bs-title="Ver Vista Resumen/Rack"
    >
      <i class="bi bi-grid-3x3-gap me-2"></i>Vista Rack
    </button>
  </div>

  <!-- Botones de Acción Principal -->
  <div class="btn-print-wrapper">
    <button
      class="btn btn-primary btn-sm fw-bold shadow-sm"
      onclick="accionPrincipal()"
    >
      <i class="bi bi-save-fill me-2"></i>Guardar / Acción
    </button>
  </div>
</div>

<!-- Contenedor Principal -->
<div id="[modulo]-content-wrapper" class="content-panel animate-fade-in">
  <!-- 1. Tarjeta de Formulario / Entrada -->
  <div class="card mb-4 shadow-sm border-0">
    <div class="card-header py-3">
      <h6 class="mb-0 fw-bold text-primary">
        <!-- Subtítulo con Icono Dinámico -->
        <i class="bi bi-[ICONO_SUBTITULO] me-2"></i>Nueva Entrada
      </h6>
    </div>
    <div class="card-body">
      <!-- Formulario Standard -->
    </div>
  </div>

  <!-- 2. Tabla de Datos -->
  <div class="card shadow-sm border-0">
    <div class="card-header py-3 bg-white">
      <h6 class="mb-0 fw-bold text-muted">Registros Activos</h6>
    </div>
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead class="table-light">
          <!-- TH Headers -->
        </thead>
        <tbody>
          <!-- JS Rendering -->
        </tbody>
      </table>
    </div>
  </div>
</div>
```

### 6.2. Patrón de Código (JS)

Usar el patrón de módulo ES6 con servicio separado si hay lógica de datos compleja.

```javascript
import { APP_CONFIG } from '../core/Config.js';
import { Utils } from '../core/Utils.js';

// Estado Local
let moduloInicializado = false;

export function inicializar[Modulo]() {
    if (moduloInicializado) return;

    // Renderizado Inicial
    renderizarInterfaz();

    // Event Listeners
    configurarEventos();

    moduloInicializado = true;
}

function renderizarInterfaz() {
    // Usar Utils.formatCurrency, Utils.formatDate, etc.
}
```

### 6.3. Paleta de Colores y Clases Clave

- **Principal (Brand)**: `btn-primary`, `text-primary` (Azul/Violeta corporativo).
- **Fondos**: `bg-light` (Gris suave para fondos generales), `bg-white` (Tarjetas).
- **Sombras**: `shadow-sm` (Elementos estándar), `shadow-lg` (Modales).
- **Texto**: `fw-bold` para encabezados y datos clave. `text-muted` para etiquetas secundarias.
- **Bordes**: `border-0` en tarjetas para look moderno. `rounded` o `rounded-3`.

### 6.4. Persistencia y Backup (CRÍTICO)

Para que los datos del nuevo módulo se guarden y respalden correctamente:

1.  **Clave Única**: Definir una clave única para `LocalStorage` (ej: `app_[modulo]_data`).
2.  **Servicio de Datos**: Crear un servicio que extienda la lógica de almacenamiento estándar.
3.  **Registro en BackupService**: **OBLIGATORIO**. Añadir el nuevo servicio al array `this.services` en `assets/js/services/BackupService.js`.

    ```javascript
    // Ejemplo en BackupService.js
    import { nuevoModuloService } from "./NuevoModuloService.js";

    // ... en constructor ...
    this.services = [
      // ... otros ...
      { name: "Nuevo Modulo", svc: nuevoModuloService },
    ];
    ```

4.  **Métodos Requeridos**: El servicio del módulo debe implementar `getAll()` y `save(data)` o `saveAll(data)`.

### 6.5. Componentes UI Obligatorios y Estética

El usuario exige un alto nivel de pulido visual. Cumplir estrictamente:

1.  **Títulos y Subtítulos Dinámicos**:
    - Usar siempre etiquetas `<i>` con clases de Bootstrap Icons (`bi bi-...`).
    - Los iconos deben ser semánticos (ej: `bi-pencil` para editar, `bi-trash` para borrar).

2.  **Panel de Vistas e Impresión**:
    - Si el módulo tiene visualización de datos, incluir botones para alternar vistas (Trabajo vs Rack/Resumen).
    - Siempre incluir un botón/sección de "Imprimir" o "Guardar" alineado a la derecha en la barra de herramientas.
    - Usar la clase `no-print` en contenedores que no deban salir en papel.

3.  **Ventanas Emergentes (Modales)**:
    - **No usar `alert()` nativos** salvo error crítico del navegador.
    - Usar `Modal.showAlert()`, `Modal.showConfirm()` o modales de Bootstrap personalizados.
    - Estética Modal: `shadow-lg`, bordes redondeados, headers con color de contexto (Danger para borrar, Primary para info).

### 6.6. Portabilidad y Rutas (CRÍTICO)

Para garantizar que la aplicación funcione en cualquier PC sin instalación (modo portable):

1.  **Rutas Relativas SIEMPRE**:
    - HTML: Usar `assets/img/foto.jpg` no `/assets/img/foto.jpg`.
    - JS Imports: Usar `./` o `../` (ej: `../core/Utils.js`). NUNCA imports absolutos.
    - Fetch/Cargas: Las rutas dinámicas deben ser relativas al `index.html`.

2.  **No Dependencias Globales**:
    - No asumir que Node.js o NPM están instalados en el sistema anfitrión.
    - Todo lo necesario debe estar dentro de la carpeta del proyecto.

### 6.7. Retrocompatibilidad y Seguridad de Datos (CRÍTICO)

El sistema debe ser robusto ante actualizaciones. Para evitar corromper datos de versiones anteriores:

1.  **Lectura Defensiva**:
    - Nunca asumir que un campo existe en el JSON guardado.
    - Usar asignación con valores por defecto (ej: `const valor = data.campo || "default";`).
    - Si se añade una nueva propiedad a un objeto guardado, el código debe poder funcionar si esa propiedad falta (tratándola como antigua versión).

2.  **No Borrar Claves Antiguas (Sagrado)**:
    - Si se depreca un campo, mantenerlo en el código de lectura o migrarlo suavemente, nunca borrarlo drásticamente si eso impide cargar el backup anterior.
    - Los datos introducidos por el usuario (contactos, alarmas, etc.) son el activo más valioso; ninguna actualización de código debe borrarlos o ignorarlos.

3.  **Backups Seguros**:
    - Antes de cualquier migración de estructura de datos crítica, el sistema debe forzar un backup del estado actual.

4.  **Anti-Autofill Global**:
    - Todos los formularios e inputs deben tener `autocomplete="off"` para evitar que el navegador guarde o inyecte "basura" (como contraseñas o datos antiguos) en campos de dinero o información operativa.

### 6.8. Variables de Configuración Dinámicas (Habitaciones)

Los atributos de las habitaciones no deben estar harcodeados en el código JS ("Strings Mágicos").

1.  **Carga desde JSON**: Las listas de _Tipos_, _Vistas_ y _Características_ deben cargarse desde `APP_CONFIG.HOTEL.STATS_CONFIG.FILTROS`.
2.  **Uso en la App**:
    - Al renderizar filtros o selectores, iterar sobre estas variables de configuración.
    - No usar `if (tipo === "Doble")` si "Doble" no está definido en la configuración.

### 6.9. Capacidad de Edición y Actualización (CRUD Completo)

Todos los módulos que gestionen registros (tablas) deben implementar obligatoriamente la capacidad de **Edición**:

1.  **UI**: Incluir un botón de "Editar" (icono `bi-pencil`, color `btn-outline-primary`) junto al botón de eliminar en cada fila de la tabla.
2.  **UX**: Al pulsar editar:
    - Cargar los datos del registro en el formulario principal (Vista Trabajo).
    - Cambiar el foco a ese formulario.
    - Cambiar el texto del botón de guardar a "Guardar Cambios" o "Actualizar".
3.  **Lógica (Limpieza y Renombrado)**:
    - Si se edita la clave principal (ej: Número de Habitación), el sistema debe **ELIMINAR** el registro original y **CREAR** uno nuevo con la nueva clave.
    - Esto se gestiona automáticamente en `Ui.handleFormSubmission` si se establece el atributo `data-original-id` en el formulario durante la preparación de la edición.

## 7. Reglas de UX/UI y "Resumen del Día" (CRÍTICO)

### 7.1. Módulos de "Resumen del Día"

Ciertos módulos generan información vital que debe revisarse nada más abrir el turno. Estos módulos DEBEN aparecer en el Dashboard o vista principal de "Novedades del Día".

- **Módulos Incluidos**: Novedades, Desayunos Temprano, Cenas Frías, **Transfers**.
- **Implementación**: Deben exponer un método o servicio que permita consultar sus registros activos para el día actual y mostrarlos en el widget de resumen.
- **Visibilidad Inteligente**: Si un módulo de resumen NO tiene registros activos (está vacío), **DEBE OCULTARSE** completamente del Dashboard (usando `d-none` en su contenedor) para no ocupar espacio inútil.

### 7.2. Orden de Vistas y Jerarquía

- **Orden de Vistas**: La **Vista de Trabajo** (Formulario para añadir/procesar) debe ser SIEMPRE la **PRIMERA VISTA** (pestaña activa por defecto). La Vista de Lista/Resumen/Rack debe ser secundaria.
  - _Razón_: La prioridad es la operativa rápida (añadir datos).
- **Barra de Herramientas**: TODO módulo debe tener explícitamente una barra de herramientas con el botón de **IMPRIMIR** visible y funcional.

### 7.3. Limpieza Visual (Estilo Flat/Glass)

- **Prohibido Paneles Blancos Anidados**: No colocar una tarjeta (`.card` / `bg-white`) dentro de otro contenedor que ya tiene fondo blanco o apariencia de panel.
  - El fondo de la aplicación ya es texturizado/gris, por lo que el primer nivel de contenedor puede ser blanco (`card`), pero su contenido NO debe estar encerrado en otros bloques con fondo blanco y sombra (`shadow`). Esto "ensucia" el diseño.
  - Mantener diseño limpio, aireado y sin excesivos bordes o cajas dentro de cajas.

### 7.4. Componentes Estándar (Selectores Globales)

Para mantener la consistencia en la selección de activos y recursos del sistema:

1.  **Selector de Iconos (Standard)**:
    - **Módulo**: `assets/js/core/IconSelector.js`.
    - **Uso**: Inocar `IconSelector.open(targetInputId)` para abrir el modal estándar con buscador de Bootstrap Icons.
    - **Propósito**: Usar siempre este selector cuando el usuario deba personalizar iconos de módulos, habitaciones o servicios.

2.  **Selector de Archivos (Local)**:
    - **Endpoint**: `/api/system/pick-file` (Requiere servidor Node.js activo).
    - **Uso**: Usar solo en configuraciones del sistema (ej: lanzadores de apps) donde se requiera una ruta absoluta local.
    - **Limitación**: Solo funciona en entorno Windows/Localhost con el servidor backend propio.

## 8. Arquitectura de Datos y API (CRUD)

La aplicación utiliza un sistema de persistencia **JSON-agnóstico**. El backend no tiene esquemas fijos; simplemente guarda y entrega archivos JSON según lo solicite el frontend.

### 8.1. Endpoints Modulares (Express)

Desde la **Iteración 12**, el servidor utiliza un motor de almacenamiento transaccional distribuido (DB + JSON).

| Área         | Prefijo API         | Descripción                                                                            |
| :----------- | :------------------ | :------------------------------------------------------------------------------------- |
| **STORAGE**  | `/api/storage/:key` | CRUD Híbrido. Prioriza MariaDB con fallback JSON. Soporta Transacciones Atómicas.      |
| **SYSTEM**   | `/api/system/`      | Comandos de SO: `launch`, `list-files`, `image-proxy` (galería) y `copy-to-clipboard`. |
| **HEARTBIT** | `/api/heartbeat/`   | Mantiene el servidor activo y gestiona el auto-shutdown tras 24h de inactividad.       |

### 8.2. Reglas de Escritura (Good Conduct)

Para mantener la integridad, cualquier desarrollador (o IA) debe seguir estas reglas:

1.  **Registro en TABLE_MAP**: Antes de crear un módulo, añadir su clave y tabla correspondiente en `server/routes/storage.js`.
2.  **Atomicidad**: Nunca realizar múltiples peticiones `POST` seguidas para una sola operación de negocio si pueden unificarse. El backend se encarga de que el `save` sea todo o nada.
3.  **Mantenimiento de Schema**: Si se cambia la estructura de un objeto, se debe actualizar `server/schema.sql` y reiniciar el contenedor para aplicar cambios (o ejecutarlos vía CLI).

### 8.3. BaseService (Capa de Servicio Evolucionada)

Todos los servicios de datos extienden de `BaseService.js`. El servicio incluye métodos semánticos:

- `init()`: Carga inicial y sincronización automática con el servidor.
- `add(item)`: Añade un elemento a la lista (Array).
- `update(id, data, idField)`: Busca y actualiza un registro en un array. Si no existe, lo añade.
- `delete(id, idField)`: Elimina un registro de un array.
- `getByKey(key)`: Para datos tipo objeto, recupera el valor de una clave.
- `setByKey(key, value)`: Para datos tipo objeto, establece o actualiza una clave.
- `removeByKey(key)`: Elimina una clave de un objeto de datos.
- `syncWithServer()`: Sincronización en segundo plano con prioridad al disco (JSON Authority).

### 8.4. Capa de Validación (Schema) [NUEVO]

Para garantizar la integridad de los datos, `BaseService` permite definir un `schema` en sus clases hijas. El sistema valida automáticamente los tipos de datos antes de cualquier operación de guardado.

```javascript
// Ejemplo en ChildService.js
this.schema = {
  id: "number",
  concepto: "string",
  importe: "number",
};
```

### 8.3. Esquema de Datos (Flexible)

No existe un "JSON maestro" de especificación porque cada módulo define su propia estructura. Sin embargo, el estándar seguido por los módulos (ej: `AgendaService`, `NotesService`) es:

```json
[
  {
    "id": 1674829302,
    "fecha": "2026-01-27",
    "autor": "Nombre Recepcionista",
    "datos": { ... campos específicos del módulo ... }
  }
]
```

> [!NOTE]
> La lógica de negocio (filtrado, ordenación, validación) reside 100% en el **Frontend** antes de enviar el paquete JSON final al servidor para su persistencia física.

## 9. Rendimiento y Carga de Datos (Lazy Load)

Dado que la aplicación puede manejar miles de registros y eventualmente se conectará a una base de datos real, es **IMPERATIVO** que los módulos de listado (Agenda, Clientes, Histórico) implementen estrategias de carga diferida ("Lazy Loading").

1.  **Prohibido "Cargar Todo" en el DOM**:
    - Nunca volcar 1000 filas `<tr>` de golpe en una tabla. El navegador se congelará.
    - Usar **Paginación** o **Scroll Infinito** (Infinite Scroll).

2.  **Scroll Infinito (Recomendado)**:
    - Utilizar `IntersectionObserver` para detectar cuando el usuario llega al final del scroll.
    - Cargar/Mostrar bloques pequeños (ej: 50 elementos).
    - Usar `append` para añadir los nuevos elementos al DOM, **nunca** repintar toda la lista (`innerHTML +=`) ya que eso destruye y recrea todos los nodos previos.

3.  **Filtrado Eficiente**:
    - Al filtrar por búsqueda, resetear la vista y mostrar solo el primer bloque de coincidencias.

## 10. Core API (`Ui.js`)

Para evitar duplicidad de código y asegurar consistencia, se ha creado una API central (`assets/js/core/Ui.js`) que maneja patrones de interfaz comunes.

1.  **Infinite Scroll (Estándar)**:
    - **NO** implementar `IntersectionObserver` manualmente en los módulos.
    - Usar `Ui.infiniteScroll({ onLoadMore: miFuncion, sentinelId: 'mi-id' })`.
    - Esto gestiona automáticamente la desconexión y reconexión segura del observador.

2.  **Spinners y Sentinels**:
    - Usar `Ui.createSentinelRow(id, texto, colspan)` para generar filas de carga estandarizadas.
    - Usar `Ui.renderTable(tbodyId, data, rowRenderer, emptyMsg, append)` para generar tablas de forma limpia y consistente.
    - Usar `Ui.updateDashboardWidget(moduleName, data, rowRenderer)` para actualizar contadores y tablas del dashboard.
    - Usar `Ui.setupViewToggle({ buttons: [...] })`: Gestiona el cambio entre vista "Trabajo" y "Listado/Rack" automáticamente, manejando clases `active` y `d-none`.
    - Usar `Ui.initRoomAutocomplete(datalistId)`: Popula rápidamente selectores de habitación con datos de `Config.js`.

3.  **Gestión de Formularios (Standard submission)**:
    - Usar `Ui.handleFormSubmission({ formId, service, idField, mapData, onSuccess })`.
    - Este helper automatiza: Validación de usuario (recaudador), extracción de `FormData`, validación de habitación (si el `idField` es una hab), timestamp de actualización y notificación de éxito.
    - Soporta mapeo personalizado de datos y callbacks de éxito para refrescar la UI.

4.  Notificaciones y Confirmaciones:

- Usar `Ui.showToast(message, type)`: Muestra una alerta visual no bloqueante (success, warning, error, info). Sustituye `window.showAlert`.
- Usar `Ui.showConfirm(message)`: Muestra un diálogo de confirmación asíncrono. Sustituye al `confirm()` nativo.
- Usar `Ui.showPrompt(message, type)`: Solicita entrada de texto al usuario (ej: contraseñas). Sustituye al `prompt()` nativo.

5. Reportes e Impresión (PdfService):

- Usar `Ui.preparePrintReport({ dateId, memberId, memberName, extraMappings })`: Centraliza la preparación de metadatos de impresión.
- Usar `PdfService.generateReport({ title, author, htmlContent, filename, metadata })`: **ESTÁNDAR OBLIGATORIO** para generar reportes PDF profesionales. Sustituye la lógica manual de `html2pdf.js` en los módulos. Centraliza cabeceras, logos y pie de página.

6.  **Tablas Ordenables (Sorting Global)**:
    - **Política**: Todas las tablas que muestren listados de datos deben ser ordenables por columnas relevantes.
    - **Implementación**: Usar `Ui.enableTableSorting(tableId, data, renderCallback)`.
    - **Requisito HTML**: La tabla debe tener `<thead`> con `th` que incluyan el atributo `data-sort="nombrePropiedad"`.

7.  **Vistas Complejas (RackView)**:
    - **Módulo**: `assets/js/core/RackView.js`.
    - **Uso**: `RackView.render(containerId, itemRenderer, floorRenderer, floorFilter)` para pintar el estado del hotel (habitaciones). Soporta filtros.

## 11. Solución de Problemas (Troubleshooting)

### 11.1. SmartScreen (Pantalla Azul "Windows protegió su PC")

Si al ejecutar `RecepcionSuite.exe` Windows bloquea la aplicación por falta de firma digital:

1.  Abrir **PowerShell** como Administrador.
2.  Ejecutar el comando de desbloqueo:
    ```powershell
    Unblock-File -Path ".\RecepcionSuite.exe"
    ```

### 11.2. Error de Conexión ("Server Lost")

Si aparece la pantalla negra de "Conexión Perdida":

- **Causa**: El servidor Node.js se detuvo (timeout de 24h o suspensión del PC).
- **Solución**: Ejecutar nuevamente el acceso directo del escritorio y pulsar "Reconectar" en el navegador.

---

## 12. Mejoras de Arquitectura (v3) - Estandarización y Desacoplamiento

Se han introducido nuevos componentes en el Core (`assets/js/core/`) para mejorar la escalabilidad y limpieza del código en futuras iteraciones.

### 12.1. EventBus (Sistema Pub/Sub)

**Objetivo**: Desacoplar completamente los módulos. Que un módulo (ej: `SystemAlarms`) pueda notificar al sistema (ej: Navbar) sin importar el archivo JS del otro y sin conocer su existencia.

- **Archivo**: `assets/js/core/EventBus.js`
- **Uso Recomendado**:
  - **Emitir**: `EventBus.emit(CONSTANTS.EVENTS.DATA_UPDATED, { module: 'agenda', data: ... })`
  - **Escuchar**: `EventBus.on(CONSTANTS.EVENTS.DATA_UPDATED, (payload) => { ... })`

### 12.2. Constants (Diccionario Global)

**Objetivo**: Centralizar las cadenas de texto repetitivas ("Magic Strings") para evitar errores de tipeo y facilitar refactorizaciones masivas.

- **Archivo**: `assets/js/core/Constants.js`
- **Contenido**:
  - `ALARM_TYPES` (weekly, daily...)
  - `MODULES` (agenda, caja...)
  - `EVENTS` (app:init, data:updated...)
- **Regla**: Importar y usar estas constantes en lugar de escribir string literales en la lógica condicional.

### 12.3. Tipado Semántico (JSDoc)

Aunque no usamos TypeScript, es altamente recomendable documentar los métodos de los `Services` y `Core` usando JSDoc para obtener autocompletado y verificación de tipos básica en VS Code.

```javascript
/**
 * @param {string} id
 * @param {object} data
 * @returns {Promise<boolean>}
 */
```

## 13. Reglas de Validación de Negocio (OBLIGATORIO)

La aplicación aplica las siguientes reglas estrictas de validación de datos:

- **Despertadores**: Obligatorio `habitacion` y `hora`. `comentarios` es opcional.
- **Cenas Frías**: Obligatorio `habitacion`, `hora` y `pax`.
- **Desayunos**: Obligatorio `habitacion`, `hora` y `pax`. **Integración con Alarmas**: Los desayunos deben disparar automáticamente una Alarma de Sistema cuando llegue su hora.
- **Atenciones**: Obligatorio `habitacion` y `tipo` (atención/motivo).
- **Transfers**: Obligatorio `fecha_recogida`, `destino`, `hora`, `habitacion` y `pax`.
- **Safe**: Obligatorio `habitacion` y `fecha_inicio`.
- **RIU Class**: Obligatorio `habitacion`, `nombre`, `tipo_tarjeta`, `fecha_entrada` y `fecha_salida`.
- **Guía Operativa**: Sin campos obligatorios restrictivos.
- **Lista de Precios**: Sin campos obligatorios restrictivos.

## 14. Reglas de Interacción y Navegación (Iteración 6+)

### 14.1. Navegación Silenciosa (Router)

- **Problema**: El uso de `bootstrap.Tab.show()` despliega automáticamente los menús dropdown padres, lo cual es molesto al usar accesos directos del Dashboard.
- **Solución**: Se utiliza **Navegación Silenciosa**. El `Router.js` gestiona manualmente las clases `.show` y `.active` de los paneles y botones.
- **Regla**: Nunca usar métodos de Bootstrap que disparen eventos visuales no deseados en la barra de navegación principal.

### 14.2 Aislamiento de Componentes Bootstrap

Bootstrap 5 prohíbe tener más de un tipo de instancia (ej: Tooltip y Dropdown) en el mismo elemento DOM.

- **Regla:** NUNCA pongas `data-tooltip="true"` o `data-bs-toggle="tooltip"` en un botón que ya tenga `data-bs-toggle="dropdown"` o `data-bs-toggle="tab"`.
- **Solución:** Envuelve el contenido del botón en un `<span data-tooltip="true" ...>` para que el tooltip se inicialice en el span y el dropdown en el botón.

### 14.3. Conflictos de ID en Modales (RoomDetailModal)

- **ID de Habitaciones:** Las IDs de los elementos dinámicos dentro del Modal de Detalle deben llevar el prefijo `v8-` (ej: `v8-check-sofa`) para evitar colisiones con elementos duplicados en el DOM principal.
- **Limpieza**: Evitar dejar contenedores de modales ocultos en el `index.html` si el modal se genera y destruye vía JS (Inyección en el Overlay).

## 15. Refinamiento del Módulo de Configuración (Iteración 11+)

Para mejorar la seguridad y la usabilidad del sistema de ajustes:

### 15.1. Seguridad y Mantenimiento

- **Eliminación del Botón Reset**: Se ha eliminado el botón de "Restaurar valores de fábrica" para evitar borrados accidentales de la configuración crítica del hotel.
- **Limpieza de Secciones**: Se han eliminado las secciones de configuración que no requieren edición frecuente o que son manejadas por otros servicios (Alarmas de Sistema, Países de Agenda, Sistema Monetario).

### 15.2. Edición Completa ("Pop & Fill")

Todas las listas de configuración (Recepcionistas, Transfers, Departamentos, Launchers, Excursiones, Instalaciones, Rangos) utilizan ahora un patrón de **Edición Dinámica**:

1.  Al pulsar el botón **Editar (Lápiz)**, el elemento se elimina temporalmente de la lista local.
2.  Los datos del elemento se cargan automáticamente en el formulario de "Añadir".
3.  El usuario modifica los datos y pulsa "Añadir" para devolver el elemento actualizado a la lista.
4.  Los cambios solo son permanentes tras pulsar **Aplicar Cambios** (Save Config).

Este patrón simplifica la interfaz al no requerir modales adicionales para cada tipo de dato.

### 15.3. Estética de Ventanas Emergentes (Modales)

Para mantener la coherencia visual "Premium", todos los modales deben:

- **Evitar `confirm()` nativos**: Usar siempre `Ui.showConfirm()` que despliega un modal estilizado.
- **Sombra y Bordes**: Usar `shadow-lg` y bordes redondeados (`rounded-3` o superior).
- **Color de Contexto**: El encabezado o los botones principales deben reflejar la acción (Verde para éxito/añadir, Azul para información, Rojo para eliminación/peligro).
- **Animación**: Deben incluir la clase `fade` para una transición suave de entrada y salida.
- **Fondo**: El backdrop debe ser oscuro y difuminado si es posible (`modal-backdrop` estándar de Bootstrap).

## 16. Control de Versiones en UI

Para mantener un seguimiento visual de las actualizaciones del sistema:

### 16.1. Etiqueta de Versión

- **Regla**: Cada vez que se haga un commit y se suba a GitHub, se debe actualizar la etiqueta de versión en `index.html`.
- **Ubicación**: La versión se encuentra en una cinta (ribbon) diagonal en la esquina inferior derecha del panel de cabecera (`#app-header .version-ribbon`).
- **Formato**: `v.beta X` o `v.X.X.X`.

## 17. Estandarización de Iconografía (Lanzador)

Para mantener una interfaz limpia, rítmica y profesional, se ha unificado la iconografía del Lanzador de Aplicaciones:

- **Regla de Oro**: Se ignoran los iconos individuales (`icon`) o miniaturas configuradas en `config.json`. Cada elemento muestra el icono predefinido para su categoría.
- **Mapeo de Categorías**:
  - **Apps / Sistemas**: `cpu-fill` (Color Primario)
  - **Carpetas / Directorios**: `folder-fill` (Amarillo)
  - **Enlaces Web (URLs)**: `globe-americas` (Verde)
  - **Mapas / Localización**: `geo-alt-fill` (Rojo)
  - **Documentos / Archivos**: `file-earmark-text-fill` (Turquesa)
  - **Videos / Multimedia**: `play-circle-fill` (Rojo)
  - **Música / Spotify**: `spotify` (Verde)

## 18. Arquitectura de Autenticación y Seguridad (Zero-Trust Local)

Para garantizar que solo el personal autorizado acceda al Panel de Control Web (`https://www.desdetenerife.com:3000`) y controlar los equipos locales (ejecutar apps, etc.), el sistema implementa una arquitectura rigurosa:

### 18.1. Pantalla Inicial de Login Seguro
- **Concepto**: El Panel de Control Web nunca muestra información ni botones operativos sin validación.
- **Flujo**: Al acceder a la web, aparece primero una pantalla de Login.
- **Credenciales**: Solicita contraseña (comprobada contra Hash en DB, ej: `gravina82`). Si no está autorizado, la interfaz deniega el acceso con un mensaje claro.

### 18.2. Huella de Hardware (Device Fingerprinting)
- **Problema**: Una clave en texto plano es vulnerable si alguien copia el agente a otro PC.
- **Solución**: El agente local general al instalarse una **Huella de Máquina Única** (MAC, UUID, Hostname).
- **Proceso**:
  1. Esta huella sella la Llave de Estación (`STATION_KEY`).
  2. El Servidor Central Web registra las "Huellas Permitidas". 
  3. Si la carpeta se copia a un PC distinto, la huella cambiará y el Servidor Web denegará la conexión.

### 18.3. Túnel de Comunicación Inverso (WebSocket)
- **Concepto**: Se invierte el flujo para evitar bloqueos de navegador (CORS/PNA/Certificados).
- **Flujo**:
  1. El Agente Local abre silenciosamente un WebSocket saliente hacia el Servidor Central Público y se autentica con su huella de hardware.
  2. El Servidor valida y mantiene el "Túnel Abierto".
  3. Cuando el Admin usa el Panel Web, la orden viaja al Servidor Central y luego hacia el Agente Local a través del túnel preexistente.

## 19. Sincronización en Tiempo Real (WebSockets)

Para mantener los datos actualizados en todas las estaciones de trabajo sin necesidad de recargar la página, el sistema implementa un mecanismo de "Push" basado en WebSockets.

### 19.1. Servidor de Notificaciones
- **Ubicación**: Integrado en `server/app.js`.
- **Puerto**: Utiliza el mismo puerto que la API (3000).
- **Funcionamiento**: El servidor mantiene una lista de clientes conectados. Cuando se produce una escritura en el disco (MariaDB/JSON) a través de `storage.js`, se emite un evento `data-changed` incluyendo la `key` (endpoint) del recurso modificado.

### 19.2. Cliente de Tiempo Real (`RealTimeSync.js`)
- **Conexión**: El cliente establece una conexión automática al iniciar la app (`main.js`).
- **Gestión de Reconexión**: Implementa lógica de reintento automático si la conexión se pierde.
- **Protocolo**: Utiliza `wss://` si el sitio se sirve por HTTPS, o `ws://` por HTTP.

### 19.3. Refresco Selectivo y Silencioso
- **Registro**: Cada `BaseService` se registra en el `RealTimeSync` al inicializarse.
- **Acción**: Al recibir una notificación de cambio para su endpoint, el servicio ejecuta `syncWithServer()` en segundo plano.
- **Optimización**: El sistema solo dispara eventos de actualización de UI (`service-synced`) si los datos remotos son realmente distintos de los locales (comparación de contenido JSON), evitando parpadeos innecesarios en la interfaz.
