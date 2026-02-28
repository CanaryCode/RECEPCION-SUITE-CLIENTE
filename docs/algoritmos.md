# Algoritmos y Lógica No Trivial — Recepción Suite

> Este documento describe los algoritmos y decisiones de diseño técnico no obvias del proyecto.

---

## 0. Lazy Loading de Módulos (ModuleLoader)

**Problema**: Cargar todos los módulos al arranque (Agenda, Caja, Excursiones, etc.) hace que la app tarde ~8-15 segundos en estar lista, aunque el usuario solo necesite 2-3 módulos en su sesión.

**Algoritmo**:

```
[Al Arrancar - main.js]
1. Cargar solo MÓDULOS CRÍTICOS:
   - Dashboard widgets: Despertadores, Transfers, Cenas, Novedades, Desayunos
   - Alarmas (deben chequearse al inicio)
   - Configuración (necesaria para funcionamiento)
2. Marcar resto de módulos como "lazy" (se cargan bajo demanda)
3. Exponer ModuleLoader globalmente

[Durante Navegación - Router.handleModuleReload()]
1. Usuario hace clic en "Agenda"
2. Router detecta navegación a #agenda-content
3. Router.handleModuleReload('#agenda-content') →
   → ModuleLoader.loadBySelector('#agenda-content')
4. ModuleLoader verifica si ya está cargado:
   - Si SÍ → return (no hacer nada)
   - Si NO → dynamic import('./modules/agenda.js')
            → ejecutar inicializarAgenda()
            → marcar como loaded
5. Usuario ve el módulo completamente funcional

[Garantías de Seguridad]
- Set _loadedModules previene cargas duplicadas
- Map _pendingLoads previene race conditions (dos clicks rápidos)
- Módulos críticos siempre disponibles al arranque
```

**Beneficios**:
- ✅ **Arranque 60-70% más rápido**: Solo 8 módulos críticos vs 25+ totales
- ✅ **Menos memoria**: Solo se cargan módulos que el usuario usa
- ✅ **Scroll infinito no afectado**: Agenda, etc. siguen usando lazy rendering

**Archivos**:
- `assets/js/core/ModuleLoader.js` — Sistema de carga lazy
- `assets/js/core/Router.js` — Integración de lazy load en navegación
- `assets/js/main.js` — Arranque con módulos críticos

---

## 1. Persistencia Transaccional Atómica (Dual-Write)

**Problema**: Mantener MariaDB y JSON siempre en sintonía sin que un fallo deje el sistema en estado inconsistente.

**Algoritmo**:

```
1. Recibir POST /api/storage/:key con datos nuevos
2. Abrir transacción: BEGIN
3. Ejecutar INSERT/UPDATE en MariaDB
4. Si éxito:
   a. Escribir archivo JSON en storage/:key.json
   b. COMMIT
   c. Emitir evento WebSocket 'data-changed' a todos los clientes
5. Si fallo en cualquier punto:
   a. ROLLBACK (la DB vuelve al estado anterior)
   b. El archivo JSON no se toca (permanece coherente)
   c. Devolver error 500 al cliente
```

**Por qué**: Un fallo de disco o de DB en la mitad de una escritura doble sin transacción dejaría una fuente de verdad corrompida y la otra correcta, sin forma de saber cuál es válida.

---

## 2. Sincronización en Tiempo Real (WebSocket Push)

**Problema**: Múltiples recepcionistas usando la app al mismo tiempo ven datos desactualizados si no recargamos.

**Algoritmo**:

```
[Servidor]
  - Mantiene lista de conexiones WebSocket activas
  - Tras cada escritura exitosa: emit('data-changed', { key: 'modulo' })

[Cliente - RealTimeSync.js]
  - Al iniciar: conectar wss:// (o ws:// si HTTP)
  - Al recibir 'data-changed': buscar el BaseService registrado para esa key
  - Llamar service.syncWithServer() en background

[BaseService.syncWithServer()]
  - GET /api/storage/:key con anti-cache timestamp
  - Comparar contenido JSON recibido vs datos locales (JSON.stringify)
  - Si son distintos: actualizar datos locales + emitir 'service-synced'
  - Si son iguales: no hacer nada (evitar parpadeos de UI)
```

**Reconexión**: Si la conexión se pierde, `RealTimeSync.js` reintenta con backoff exponencial.

---

## 3. Huella de Hardware (Device Fingerprinting)

**Problema**: Impedir que alguien copie la carpeta `agent/` a otro PC y acceda al sistema.

**Algoritmo**:

```
[Al instalar/ejecutar el agente por primera vez]
1. Recopilar: MAC address, UUID del sistema, Hostname del PC
2. Concatenar y hashear (SHA-256): STATION_KEY = hash(MAC + UUID + Hostname)
3. Guardar STATION_KEY en archivo local cifrado

[Al conectar al servidor]
1. Agente envía STATION_KEY en el handshake del WebSocket
2. Servidor busca STATION_KEY en tabla 'authorized_stations' de la DB
3. Si no existe o no coincide: cerrar conexión, denegar acceso
4. Si existe: registrar túnel activo, conexión aceptada
```

**Por qué**: Las MAC addresses y UUIDs del hardware son únicas por máquina. Un clon de la carpeta en otro PC generará un hash distinto.

---

## 4. Tunnel Inverso WebSocket (Control Remoto)

**Problema**: El navegador no puede hacer peticiones directas al agente local por CORS/PNA/certificados.

**Algoritmo**:

```
[Agente] → abre WebSocket SALIENTE → [Servidor público]
  Agente se autentica con STATION_KEY

[Cuando el admin pulsa "Lanzar App"]
  Navegador → POST /api/system/launch → Servidor
  Servidor → reenvía orden por WebSocket → Agente
  Agente → ejecuta proceso en SO local → responde éxito/error
  Servidor → responde al navegador
```

**Por qué se invierte el flujo**: El agente abre la conexión "hacia fuera" (tráfico saliente), lo que siempre funciona sin problemas de firewall. El servidor público nunca necesita abrir conexiones "hacia dentro" del PC de recepción.

---

## 5. Anti-Cache en Datos Operativos

**Problema**: El navegador cachea respuestas GET y puede mostrar datos viejos.

**Solución**:

```javascript
// En core/Api.js, todos los GETs añaden timestamp
fetch(`/api/storage/${key}?_t=${Date.now()}`);
```

**Por qué no Cache-Control headers**: La app puede ser servida por distintos servidores/proxies con políticas distintas. El timestamp en URL garantiza unicidad en cualquier contexto.

---

## 6. Edición de Clave Principal (Rename de ID)

**Problema**: Si el usuario edita el campo que es la clave (ej: número de habitación), no se puede hacer un `UPDATE id = nuevo_id` en una tabla con foreign keys.

**Algoritmo**:

```
1. Al entrar en modo edición: guardar original_id en data-original-id del formulario
2. Al guardar:
   a. Detectar que original_id !== nuevo_id
   b. DELETE registro con original_id
   c. INSERT nuevo registro con nuevo_id y los datos actualizados
3. En la DB: la transacción engloba DELETE + INSERT (atómico)
```

**Implementado en**: `Ui.handleFormSubmission()` de forma automática.

---

## 7. Comparación Eficiente de Datos para Evitar Parpadeos

**Problema**: Si el WebSocket notifica un cambio y los datos locales ya son los mismos (el propio cliente fue quien guardó), refrescar la UI causa un parpadeo innecesario.

**Solución**:

```javascript
// En BaseService.syncWithServer()
const remoteStr = JSON.stringify(remoteData);
const localStr = JSON.stringify(this.data);
if (remoteStr !== localStr) {
  this.data = remoteData;
  EventBus.emit(EVENTS.SERVICE_SYNCED, { module: this.key });
}
// Si son iguales: no se emite nada, la UI no se toca
```

**Trade-off**: `JSON.stringify` de arrays grandes es O(n). Aceptable porque la comparación ocurre en el cliente y los arrays son de tamaño moderado (cientos, no millones).

---

## 8. Navegación Silenciosa (Router sin Bootstrap.Tab)

**Problema**: `bootstrap.Tab.show()` dispara eventos que abren menús dropdown padre de la navbar, generando un parpadeo visual indeseado al navegar desde el Dashboard.

**Solución en `Router.js`**:

```javascript
// En vez de: Bootstrap.Tab.getOrCreateInstance(target).show()
// Hacer manualmente:
panelAnterior.classList.remove("show", "active");
panelNuevo.classList.add("show", "active");
tabAnterior.classList.remove("active");
tabNuevo.classList.add("active");
// Sin disparar eventos de Bootstrap → sin efectos colaterales en navbar
```
