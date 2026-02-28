# Diseño y UX — Recepción Suite

## Principios Visuales

- **Estética**: Glassmorphism, sombras suaves, bordes redondeados. Premium y dinámico.
- **Evitar**: Diseños planos, colores primarios estándar (azul/rojo puro), paneles anidados.
- **Tipografía**: Inter / Roboto (Google Fonts). Nada de fuentes por defecto del navegador.
- **Iconos**: Exclusivamente `bootstrap-icons`.

## Paleta y Clases Clave

| Elemento          | Clase Bootstrap               |
| ----------------- | ----------------------------- |
| Acción principal  | `btn-primary`                 |
| Acción alterna    | `btn-outline-*`               |
| Cancelar/Limpiar  | `btn-light`                   |
| Fondo de app      | Texturizado/gris (CSS custom) |
| Fondo de tarjeta  | `bg-white`                    |
| Sombra estándar   | `shadow-sm`                   |
| Sombra de modal   | `shadow-lg`                   |
| Bordes modernos   | `border-0`, `rounded-3`       |
| Hover interactivo | `.hover-scale` (clase custom) |

## Estructura HTML Estándar de Módulo

```html
<!-- Título del módulo -->
<h4 class="module-title-discrete">
  <i class="bi bi-[ICONO]"></i> Nombre Módulo
</h4>

<!-- Barra de herramientas (siempre presente) -->
<div class="module-toolbar no-print">
  <div class="btn-group">
    <button class="btn btn-outline-primary active" id="btnVistaActiva">
      <i class="bi bi-laptop me-2"></i>Vista Trabajo
    </button>
    <button class="btn btn-outline-primary" id="btnVistaLista">
      <i class="bi bi-grid-3x3-gap me-2"></i>Vista Rack
    </button>
  </div>
  <div class="btn-print-wrapper">
    <button class="btn btn-primary btn-sm fw-bold shadow-sm">
      <i class="bi bi-printer-fill me-2"></i>Imprimir
    </button>
  </div>
</div>

<!-- Panel único de contenido -->
<div id="[modulo]-wrapper" class="content-panel animate-fade-in">
  <!-- Un solo nivel de card. Nunca card dentro de card con shadow. -->
  <div class="card shadow-sm border-0">
    <div class="card-header py-3">
      <h6 class="mb-0 fw-bold text-primary">
        <i class="bi bi-plus-circle me-2"></i>Nueva Entrada
      </h6>
    </div>
    <div class="card-body"><!-- Formulario --></div>
  </div>
</div>
```

## Componentes UI de la API Central (`Ui.js`)

### Notificaciones

```javascript
Ui.showToast(message, type); // type: 'success'|'warning'|'error'|'info'
Ui.showConfirm(message); // Async. Devuelve Promise<boolean>
Ui.showPrompt(message, type); // Para inputs de texto (contraseñas, etc.)
```

### Tablas y Listas

```javascript
Ui.renderTable(tbodyId, data, rowRenderer, emptyMsg, append);
Ui.enableTableSorting(tableId, data, renderCallback); // th's necesitan data-sort="campo"
Ui.createSentinelRow(id, texto, colspan);
Ui.infiniteScroll({ onLoadMore: fn, sentinelId: "id" });
```

### Formularios

```javascript
Ui.handleFormSubmission({ formId, service, idField, mapData, onSuccess });
// Automatiza: validación de usuario, extracción FormData, timestamp, notificación.
// Para edición: poner data-original-id en el form antes de llamar.
```

### Navigation y Vistas

```javascript
Ui.setupViewToggle({ buttons: [...] })  // Gestiona active/d-none automáticamente
Ui.initRoomAutocomplete(datalistId)     // Pobla datalist con habitaciones de Config.js
```

### Reportes PDF

```javascript
// ESTÁNDAR OBLIGATORIO. NO usar html2pdf.js directamente.
PdfService.generateReport({ title, author, htmlContent, filename, metadata });
Ui.preparePrintReport({ dateId, memberId, memberName, extraMappings });
```

## Modales: Reglas de Estética

1. **Siempre** clase `fade` para transición suave.
2. **Header con color de contexto**: rojo para danger, azul para info, verde para éxito.
3. `shadow-lg` + `rounded-3` en el dialog.
4. Backdrop oscuro estándar de Bootstrap.
5. Nunca `confirm()` nativo → siempre `Ui.showConfirm()`.

## Iconografía del Lanzador (Regla de Oro)

Se ignoran los iconos individuales del `config.json`. Se usa el icono de la **categoría**:

| Categoría       | Icono Bootstrap          | Color    |
| --------------- | ------------------------ | -------- |
| Apps / Sistemas | `cpu-fill`               | Primario |
| Carpetas        | `folder-fill`            | Amarillo |
| URLs Web        | `globe-americas`         | Verde    |
| Mapas           | `geo-alt-fill`           | Rojo     |
| Documentos      | `file-earmark-text-fill` | Turquesa |
| Video           | `play-circle-fill`       | Rojo     |
| Música/Spotify  | `spotify`                | Verde    |

## Selectores Estándar

```javascript
// Selector de iconos Bootstrap
IconSelector.open(targetInputId);

// Selector de archivos locales (solo Windows + servidor activo)
// Endpoint: GET /api/system/pick-file
```

## Edición "Pop & Fill" (Patrón Estándar)

1. Pulsar ✏️ en la fila → elemento desaparece de la lista local.
2. Sus datos se cargan en el formulario de añadir.
3. El usuario modifica y pulsa "Añadir" → vuelve actualizado.
4. Solo persistente tras pulsar "Aplicar Cambios".

## Control de Versión Visual

- **Ubicación**: Ribbon diagonal en `#app-header .version-ribbon`.
- **Formato**: `v.beta X` o `v.X.X.X`.
- **Cuándo**: Actualizar en cada commit a GitHub.
