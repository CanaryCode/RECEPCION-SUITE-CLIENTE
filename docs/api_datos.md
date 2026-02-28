# API y Datos — Recepción Suite

## Endpoints del Servidor (Express)

| Área          | Prefijo                         | Descripción                                                                 |
| ------------- | ------------------------------- | --------------------------------------------------------------------------- |
| **STORAGE**   | `GET/POST /api/storage/:key`    | CRUD híbrido. Prioriza MariaDB con fallback JSON. Transacciones atómicas.   |
| **SYSTEM**    | `/api/system/launch`            | Lanza aplicaciones en el PC de recepción (vía túnel WebSocket al agente).   |
| **SYSTEM**    | `/api/system/pick-file`         | Abre diálogo de selección de archivo en Windows (solo con servidor activo). |
| **SYSTEM**    | `/api/system/image-proxy`       | Proxy para galería de imágenes locales.                                     |
| **SYSTEM**    | `/api/system/copy-to-clipboard` | Copia texto al portapapeles del cliente local.                              |
| **HEARTBEAT** | `/api/heartbeat/`               | Keepalive del servidor. Auto-shutdown tras 24h de inactividad.              |
| **ADMIN**     | `/api/admin/`                   | CPU, red, estado del servidor para la consola de administración.            |

## BaseService — Clase Base de Servicios

Todos los servicios de datos extienden `BaseService.js`. Métodos disponibles:

```javascript
await service.init(); // Carga inicial + sincronización con servidor
await service.add(item); // Añade elemento al array
await service.update(id, data, idField); // Busca y actualiza (o añade si no existe)
await service.delete(id, idField); // Elimina registro del array
service.getByKey(key); // Para datos tipo objeto: recupera valor de clave
await service.setByKey(key, value); // Para datos tipo objeto: establece/actualiza clave
await service.removeByKey(key); // Elimina clave de un objeto de datos
service.syncWithServer(); // Sincronización en background (prioridad disco)
```

### Schema de Validación Automática

Los servicios pueden definir un `schema` que `BaseService` valida antes de guardar:

```javascript
// En ChildService.js
this.schema = {
  id: "number",
  concepto: "string",
  importe: "number",
};
```

## Reglas al Crear un Nuevo Módulo con Persistencia

1. **Registrar en TABLE_MAP** (`server/routes/storage.js`):
   ```javascript
   const TABLE_MAP = {
     nuevo_modulo: "tabla_nueva", // añadir aquí
   };
   ```
2. **Crear schema SQL** si aplica: actualizar `server/schema.sql` y reiniciar Docker.
3. **Registrar en BackupService** (`assets/js/services/BackupService.js`):
   ```javascript
   import { nuevoService } from "./NuevoService.js";
   this.services = [
     // ... existentes ...
     { name: "Nuevo Módulo", svc: nuevoService },
   ];
   ```
4. **Servicio debe exponer**: `getAll()` y `save(data)` o `saveAll(data)`.

## Esquema Estándar de Datos (Objeto en Array)

```json
[
  {
    "id": 1674829302,
    "fecha": "2026-01-27",
    "autor": "Nombre Recepcionista",
    "datos": { "...campos específicos del módulo..." }
  }
]
```

> La lógica de negocio (filtrado, ordenación, validación) reside 100% en el **Frontend** antes de enviar el JSON al servidor.

## Validaciones Obligatorias por Módulo

| Módulo           | Campos obligatorios                                                     |
| ---------------- | ----------------------------------------------------------------------- |
| Despertadores    | `habitacion`, `hora`                                                    |
| Cenas Frías      | `habitacion`, `hora`, `pax`                                             |
| Desayunos        | `habitacion`, `hora`, `pax` → dispara alarma automáticamente            |
| Atenciones       | `habitacion`, `tipo`                                                    |
| Transfers        | `fecha_recogida`, `destino`, `hora`, `habitacion`, `pax`                |
| Safe             | `habitacion`, `fecha_inicio`                                            |
| RIU Class        | `habitacion`, `nombre`, `tipo_tarjeta`, `fecha_entrada`, `fecha_salida` |
| Guía Operativa   | Sin restricciones                                                       |
| Lista de Precios | Sin restricciones                                                       |

## EventBus (Comunicación entre Módulos)

Para desacoplar módulos, usar pub/sub en vez de imports cruzados:

```javascript
import { EventBus } from '../core/EventBus.js';
import { CONSTANTS } from '../core/Constants.js';

// Emitir
EventBus.emit(CONSTANTS.EVENTS.DATA_UPDATED, { module: 'agenda', data: [...] });

// Escuchar
EventBus.on(CONSTANTS.EVENTS.DATA_UPDATED, (payload) => { ... });
```

## Lazy Load y Rendimiento

- **Prohibido** volcar >50 filas al DOM de golpe.
- Usar `IntersectionObserver` via `Ui.infiniteScroll(...)` para scroll infinito.
- Al filtrar por búsqueda: resetear vista y mostrar solo primer bloque de coincidencias.
- Usar `append` al añadir filas, nunca `innerHTML = ''` seguido de rebuilt completo.
