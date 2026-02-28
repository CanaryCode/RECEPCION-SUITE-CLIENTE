# Módulos y Casos de Uso — Recepción Suite

> Este documento describe qué hace cada módulo operativo, cuándo se usa y sus particularidades.

## Mapa de Módulos

| Módulo             | Archivo JS                 | Servicio            | Caso de Uso Principal                               |
| ------------------ | -------------------------- | ------------------- | --------------------------------------------------- |
| Novedades          | `modules/novedades.js`     | `NovedadesService`  | Notas del turno para el siguiente recepcionista     |
| Agenda             | `modules/agenda.js`        | `AgendaService`     | Contactos del hotel (proveedores, clientes VIP…)    |
| Despertadores      | `modules/despertadores.js` | `WakeUpService`     | Alarmas de wake-up para habitaciones                |
| Desayunos Temprano | `modules/desayunos.js`     | `BreakfastService`  | Desayunos antes de la hora habitual                 |
| Cenas Frías        | `modules/cenas.js`         | `DinnerService`     | Pedidos de cena fría nocturna                       |
| Transfers          | `modules/transfers.js`     | `TransfersService`  | Traslados: recogida, destino, hora, pax             |
| Atenciones         | `modules/atenciones.js`    | `AttentionsService` | Registro de incidencias o atenciones a huéspedes    |
| Safe               | `modules/safe.js`          | `SafeService`       | Control de cajas de seguridad en habitaciones       |
| RIU Class          | `modules/riu_class.js`     | `RiuClassService`   | Control de tarjetas de fidelización RIU Class       |
| Guía Operativa     | `modules/guia.js`          | `GuiaService`       | Base de conocimiento operativo del hotel            |
| Lista de Precios   | `modules/precios.js`       | `PreciosService`    | Tarifas de servicios del hotel                      |
| Habitaciones       | `modules/habitaciones.js`  | —                   | Estado y detalle de habitaciones (RackView)         |
| Arqueo de Caja     | `modules/arqueo.js`        | `CajaService`       | Conteo de caja y cierre de turno                    |
| Objetos Perdidos   | `modules/lost_found.js`    | `LostFoundService`  | Registro de objetos extraviados (imagen en Base64)  |
| Lanzador           | `modules/launcher.js`      | —                   | Acceso directo a apps, carpetas y URLs              |
| Configuración      | `modules/configuracion.js` | —                   | Ajustes del sistema (recepcionistas, precios, etc.) |

## Dashboard ("Novedades del Día")

Módulos que deben aparecer en el dashboard si tienen registros activos para hoy:

- Novedades
- Desayunos Temprano
- Cenas Frías
- Transfers

**Regla**: Si el módulo está vacío para hoy → `d-none` en su widget. No mostrar contenedores vacíos.

## Flujos de Uso Críticos

### Transfers (flujo completo)

1. Recepcionista añade transfer con fecha, hora, destino, habitación y pax.
2. Sistema guarda en `TransfersService`.
3. Al día del transfer, aparece en el widget del Dashboard.
4. Recepcionista lo marca como completado.
5. Se archiva y desaparece del widget.

### Desayunos (integración con Alarmas)

1. Recepcionista añade desayuno para hab X a las 07:00.
2. `BreakfastService.add()` → dispara automáticamente una alarma de sistema.
3. A las 07:00, el sistema emite una alerta visual/sonora al recepcionista.

### Arqueo de Caja

1. Recepcionista cuenta billetes, monedas y valores.
2. App calcula el total y el desglose.
3. Genera informe PDF con `PdfService.generateReport()`.
4. Guarda el arqueo en `storage/arqueo_caja.json`.

### Objetos Perdidos (Lost & Found)

1. Se registra el objeto con descripción, habitación y foto opcional.
2. Las imágenes se comprimen y almacenan como Base64 directamente en la DB/JSON.
3. Sin sistema de archivos externo; el objeto viaja completo con el backup.

### Seguridad / Login

1. Pantalla de login al cargar la web.
2. Contraseña → hash → comparación con DB.
3. Si OK: se muestra la app completa.
4. Si no: pantalla de acceso denegado.
5. El agente verifica su huella de hardware contra el servidor al iniciar.

## Módulos con Vista Doble (Trabajo + Rack)

Los siguientes módulos tienen dos vistas:

- **Vista Trabajo**: Formulario para añadir/editar (siempre activa por defecto).
- **Vista Rack/Lista**: Tabla o grid de todos los registros.

| Módulo       | Vista Rack                                |
| ------------ | ----------------------------------------- |
| Habitaciones | Grid del hotel por planta (`RackView.js`) |
| Transfers    | Lista cronológica de traslados            |
| Agenda       | Tabla de contactos buscable               |

## Lanzador (Launcher)

- Lee su configuración de `config.json` → sección `LAUNCHERS`.
- Cada ítem tiene: `nombre`, `tipo` (app/folder/url/map/doc/video/music), `ruta`.
- El icono se asigna por **categoría** (ver `diseno_ux.md` → sección Iconografía).
- Al pulsar, envía la orden al servidor que la reenvía por el túnel WebSocket al agente local.
- El agente ejecuta el proceso en el SO del PC de recepción.

---

## ✅ Checklist: Crear un Nuevo Módulo

> Usar esta lista cada vez que se añada un módulo nuevo. No saltarse pasos.

### Backend

- [ ] Añadir entrada en `TABLE_MAP` en `server/routes/storage.js`: `'clave_modulo': 'nombre_tabla'`
- [ ] Añadir la tabla en `server/schema.sql` y reiniciar Docker si el esquema cambió

### Servicio de Datos (`assets/js/services/`)

- [ ] Crear `NuevoModuloService.js` extendiendo `BaseService`
- [ ] Definir `this.key`, `this.storageKey`, y `this.schema` (campos y tipos)
- [ ] Implementar `getAll()` y `save(data)` / `saveAll(data)`
- [ ] Registrar en `BackupService.js` → array `this.services`

### Módulo de UI (`assets/js/modules/`)

- [ ] Crear `nuevo_modulo.js` con función `inicializarNuevoModulo()`
- [ ] Guardar flag `let moduloInicializado = false` y respetar el guard al inicio
- [ ] Importar en `main.js` y añadir al router

### HTML (`index.html`)

- [ ] Añadir el panel `<div id="nuevo-modulo" class="tab-pane">` con el HTML estándar:
  - `h4.module-title-discrete` con icono Bootstrap
  - `div.module-toolbar.no-print` con botones de vista e imprimir
  - `div.content-panel.animate-fade-in` como contenedor único (sin cards anidadas)
- [ ] Añadir enlace a la navbar (dropdown correspondiente)

### Validaciones

- [ ] Revisar campos obligatorios en `api_datos.md` → sección "Validaciones por módulo"
- [ ] Añadir validaciones al `schema` del servicio

### Dashboard (si aplica)

- [ ] Si el módulo tiene registros del día relevantes: añadirlo al widget del dashboard
- [ ] Implementar lógica de ocultación (`d-none`) cuando esté vacío

### Post-implementación

- [ ] Probar `npm test` / `EJECUTAR_PRUEBAS.bat` para verificar transacciones
- [ ] Revisar `storage/server_debug.log` para confirmar operaciones SQL
- [ ] Actualizar este archivo con el nuevo módulo en el Mapa de Módulos
