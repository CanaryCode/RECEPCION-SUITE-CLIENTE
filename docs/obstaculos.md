# Obstáculos y Decisiones — Recepción Suite

> Registro permanente de problemas encontrados, decisiones tomadas y el porqué.
> Se actualiza tras cada sesión de trabajo usando la palabra clave **`SELLADO`**.

---

## Formato de Entrada

```
### [FECHA] Título del Problema
**Síntoma**: qué veía el usuario
**Causa raíz**: por qué pasaba
**Solución**: qué se hizo
**Archivos afectados**: lista
**Lección**: qué aprendimos para no repetirlo
```

---

## Historial

### [2026-02] Bypass de la Barrera de Seguridad tras Refactor

**Síntoma**: La pantalla de login dejó de aparecer; la app cargaba directamente sin autenticación.

**Causa raíz**: Al refactorizar el flujo de arranque en `main.js`, la comprobación del estado de autenticación se movió después del renderizado inicial de módulos, permitiendo que el contenido cargara antes de validar credenciales.

**Solución**: Se restauró el orden de inicialización: primero `AuthService.check()` → si no autenticado, mostrar pantalla de login y bloquear el resto del arranque con `return`.

**Archivos afectados**: `assets/js/main.js`, `assets/js/services/AuthService.js`

**Lección**: El bloqueo de seguridad debe ser lo **primero** en `main.js`, antes de cualquier llamada a `inicializarModulo()`. Añadir comentario `// SECURITY BARRIER - DO NOT MOVE` en el código.

---

### [2026-02] Bypass de la Barrera de Seguridad — 2ª Ocurrencia

**Síntoma**: La app cargaba sin bloquear incluso sin agente activo.

**Causa raíz**: La condición `if (!station)` en `main.js` falla si `validateStation()` retorna un objeto vacío `{}` en lugar de `null`. `{}` es truthy → el bloqueo no se ejecuta. Este edge case existe cuando hay un path de error en la cadena de promesas que captura la excepción y devuelve un objeto parcial.

**Solución**: Cambiar el check de `!station` a `!station || !station.stationId`. Solo un objeto con `stationId` real válido pasa la barrera.

**Archivos afectados**: `assets/js/main.js` (línea del check de seguridad)

**Lección**: Un check de identidad/seguridad **nunca** debe usar `!objeto` (solo comprueba null/undefined). Debe verificar que el objeto tiene el campo identificador real. Regla S4 aplicada: se creó `tests/security/auth_barrier.test.js` (10 tests) para evitar una 3ª ocurrencia.

---

### [2026-02-28] Auth por Red vs Auth por Dispositivo

**Síntoma**: La autenticación basada en IP pública permitía acceso a cualquier equipo en la misma red (hotel, oficina), aunque no tuviera el agente instalado.

**Causa raíz**: El mecanismo IP+token era de nivel de red (NAT comparte IP pública). Varios equipos detrás del mismo router compartían la IP y todos pasaban la barrera si uno tenía el agente.

**Solución**: Cambio de arquitectura a auth **device-level**:

1. El navegador llama directamente a `http://localhost:3001/local-token`. Solo el equipo con el agente instalado puede alcanzar localhost.
2. El servidor valida el token (sin comprobar IP), porque el paso 1 ya garantiza presencia física del agente.

**Riesgo conocido**: Chrome/Edge PNA (`Private Network Access`) puede bloquear `fetch('http://localhost:3001/')` desde una página HTTPS. El agente ya envía `Access-Control-Allow-Private-Network: true` en el preflight, lo que debería resolverlo.

**Archivos afectados**: `assets/js/core/Api.js` (validateStation), `server/routes/admin.js` (/auth/id), `agent/src/index.js` (LOCAL_ONLY + heartbeat vía localhost), `agent/config/agent_config.json`

**Lección**: Autenticación por IP pública = autenticación por red. Si se necesita por dispositivo, debe haber una prueba de presencia local (localhost o hardware fingerprint). Documentar en `arquitectura.md` la distinción.

---

### [2026-02-28] Bloqueo PNA: Fetch HTTP desde HTTPS

**Síntoma**: Chrome/Edge bloqueaban el acceso a `http://localhost:3001` desde `https://www.desdetenerife.com:3000` con error:

```
Access to fetch at 'http://localhost:3001/...' has been blocked by CORS policy:
Permission was denied for this request to access the `loopback` address space.
```

**Causa raíz**: Private Network Access (PNA) impide que páginas HTTPS accedan a recursos HTTP en localhost, incluso con headers `Access-Control-Allow-Private-Network: true`. El navegador requiere que **ambos extremos usen el mismo protocolo** (HTTPS ↔ HTTPS).

**Solución**: Cambiar las URLs en `Api.js` de `http://localhost:3001` a `https://localhost:3001`. El agente ya estaba corriendo en HTTPS (puerto 3001) con certificados SSL válidos, solo faltaba usar el protocolo correcto desde el navegador.

**Archivos afectados**: `assets/js/core/Api.js` (líneas 180-181)

**Lección**: PNA no se resuelve solo con headers CORS. Si la página es HTTPS, **todos** los recursos de red privada (localhost, 192.168.x.x, etc.) también deben ser HTTPS. Verificar siempre el protocolo del agente antes de culpar a PNA.

---

**Síntoma**: El `StorageService` se inicializaba repetidamente en bucle. Los módulos que dependían de él nunca terminaban de cargar.

**Causa raíz**: Un evento `service-synced` emitido durante `init()` desencadenaba otro `init()` en el listener del mismo servicio. Bucle infinito de inicialización.

**Solución**: Añadir flag `this._initializing = true` al inicio de `init()`. Si el flag está activo, ignorar el evento. Resetear el flag al terminar.

**Archivos afectados**: `assets/js/core/BaseService.js`

**Lección**: Los métodos de inicialización de servicios deben ser idempotentes con guards. Nunca confiar en que un evento no se emitirá durante la propia inicialización.

---

### [2026-02] Agente No Detectado (STATION_KEY inválida)

**Síntoma**: La app mostraba "Agente no detectado" aunque el agente estuviera corriendo.

**Causa raíz**: La carpeta `agent/` se copió manualmente a un nuevo PC. La `STATION_KEY` generada con el hardware anterior no coincidía con el del nuevo PC.

**Solución**: Re-registrar el agente: ejecutar el proceso de registro desde la consola de Admin, que regenera la `STATION_KEY` con el nuevo hardware y la almacena en la DB.

**Archivos afectados**: `agent/`, panel Admin → sección "Estaciones"

**Lección**: El `STATION_KEY` está vinculada al hardware. Si se cambia de PC, siempre re-registrar. Documentar este paso en `troubleshooting.md`.

---

### [2026-02] Spotify Footer Maximizado en Arranque

**Síntoma**: El footer del lanzador aparecía expandido al iniciar la app, ocupando pantalla innecesariamente.

**Causa raíz**: El estado del footer (expandido/colapsado) se guardaba en `LocalStorage`. En un arranque limpio o tras limpiar el storage, el estado por defecto era "expandido".

**Solución**: Cambiar el valor por defecto del estado del footer a `"collapsed"`. En la función de inicialización del Lanzador, leer el estado guardado y si no existe, usar `"collapsed"`.

**Archivos afectados**: `assets/js/modules/launcher.js`

**Lección**: Los estados de UI persistidos en LocalStorage siempre necesitan un valor por defecto seguro y no intrusivo.

---

### [2026-02] Objetos Perdidos: Imágenes en Filesystem vs Base64

**Decisión tomada**: Almacenar imágenes de Objetos Perdidos como Base64 comprimido directamente en la DB/JSON, en vez de guardarlas como archivos en el filesystem del servidor.

**Por qué Base64**:

- El JSON de backup viaja completo con las imágenes (portabilidad total).
- Sin dependencia de rutas de filesystem que pueden romperse.
- Simplifica los backups (un solo archivo lo tiene todo).

**Contra**: Los JSON crecen más. Aceptable para un régimen de decenas de fotos al mes.

**Archivos afectados**: `assets/js/services/LostFoundService.js`, `assets/js/modules/lost_found.js`

---

### [2026-02] Error 502 en Carga de Config del Agente

**Síntoma**: Al arrancar, error "502 Bad Gateway" al intentar cargar configuración local desde el agente.

**Causa raíz**: La app intentaba conectar al agente antes de que este hubiera completado su arranque y abierto el WebSocket de vuelta al servidor.

**Solución**: Añadir reintentos con delay (`retry con backoff`) en la carga de configuración del agente. Si el primer intento falla, esperar 2s y reintentar hasta 3 veces antes de declarar error.

**Archivos afectados**: `assets/js/core/Api.js` o `SyncManager.js`

**Lección**: Nunca asumir que el agente local está disponible en el primer milisegundo de la app. Las conexiones locales también pueden tener latencia de arranque.

---

### [2026-02] Tooltips Conflictivos con Dropdowns en Navbar

**Síntoma**: Algunos botones del navbar con `data-bs-toggle="dropdown"` dejaban de funcionar o lanzaban errores de Bootstrap al intentar inicializar tooltips sobre ellos.

**Causa raíz**: Bootstrap 5 prohíbe múltiples instancias de componentes en el mismo elemento DOM. Un tooltip y un dropdown no pueden coexistir en el mismo nodo.

**Solución**: Envolver el contenido del botón en un `<span data-bs-toggle="tooltip" ...>` interno. El tooltip se inicializa en el span hijo, el dropdown en el botón padre.

**Archivos afectados**: `index.html`, cualquier módulo con botones toolbar duales

### [2026-02-28] Quick Login: Grid de Usuarios vacío

**Síntoma**: La pantalla "¿Quién eres hoy?" aparecía pero sin tarjetas de usuario (grid vacío).
**Causa raíz**: Inconsistencia en las versiones de los módulos (`Config.js?v=XXX`). `main.js` importaba una versión y `Login.js` otra (o ninguna), lo que provocaba que el navegador cargara dos instancias separadas de `APP_CONFIG`. La instancia de `Login.js` permanecía con el estado inicial (vacío).
**Solución**: Estandarizar todos los imports core en `Login.js` para usar los mismos query strings de versión que `main.js`, garantizando que compartan el mismo objeto en memoria.
**Archivos afectados**: `assets/js/core/Login.js`
**Lección**: En una arquitectura de ES Modules sin bundler (Vite/Webpack), el versionado por URL debe ser **idéntico** en todo el grafo de dependencias para evitar duplicidad de singletons.

---

### [2026-02-28] Error CORS en Impresión de PDFs Externos

**Síntoma**: Al intentar imprimir el tiempo, la consola mostraba error de CORS bloqueando el acceso a `eltiempo.es`.
**Causa raíz**: `printJS` intenta descargar el PDF mediante `XMLHttpRequest` para procesarlo. El servidor remoto no incluye cabeceras `Access-Control-Allow-Origin` para nuestro dominio.
**Solución**: Enrutar la descarga a través del `web-proxy` interno del servidor (`/api/system/web-proxy?url=...`). El servidor descarga el binario y lo sirve como recurso propio, eliminando el conflicto de CORS.
**Archivos afectados**: `assets/js/modules/tiempo.js`, `server/app.js` (se excluyó el proxy de la validación de estación para permitir la descarga directa).
**Lección**: Para recursos externos que deban ser procesados por JS (impresión, manipulación), siempre usar el proxy del servidor.

---

### [2026-02-28] ERR_SSL_PROTOCOL_ERROR en Validación de Agente

**Síntoma**: La app se bloqueaba antes de entrar mostrando error de protocolo SSL al conectar con el agente local (`localhost:3001`).
**Causa raíz**: El frontend forzaba la conexión vía `https://localhost:3001`, pero el agente estaba corriendo en `http` (puerto 3001 pero sin SSL activo en ese entorno).
**Solución**: Implementar fallback automático en `Api.js`. El handshake ahora intenta `https` primero y, si falla, reintenta por `http` antes de denegar el acceso.
**Archivos afectados**: `assets/js/core/Api.js`
**Lección**: No asumir que el entorno local siempre tiene SSL. El handshake debe ser resiliente a ambos protocolos.
