# Arquitectura Técnica — Recepción Suite

## Stack Tecnológico

- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript ES6 Modules. Sin frameworks (no React/Vue), sin bundlers.
- **Backend**: Node.js + Express (`server/app.js`). Puerto 3000.
- **DB**: MariaDB en Docker (autoridad primaria). Fallback a JSON (`storage/*.json`).
- **Desktop**: Agente C# (`agent/`) que sirve la web y ejecuta comandos locales del SO.

## Topología Cliente/Servidor

```
[PC de Recepción]                    [Servidor Público]
 agent/  ←── Node.js portable         server/  ← Express + MariaDB (Docker)
  └── Launcher.exe                     └── Puerto 3000 (HTTPS)
  └── Abre: https://desdetenerife.com:3000
```

> **IMPORTANTE**: La carpeta `agent/` es el cliente. El resto es el servidor. Al desplegar, solo llevar `agent/` al PC de recepción.

## Persistencia Híbrida (MariaDB + JSON)

| Capa         | Rol                             | Archivo                        |
| ------------ | ------------------------------- | ------------------------------ |
| MariaDB      | Fuente de verdad primaria       | Docker container               |
| JSON         | Respaldo de alta disponibilidad | `storage/*.json`               |
| LocalStorage | Estado de UI temporal           | Wrapper `core/LocalStorage.js` |

**Flujo de escritura (atómico)**:

1. `POST /api/storage/:key` → `BEGIN` transacción SQL
2. Si DB OK → escribe JSON → `COMMIT`
3. Si falla → `ROLLBACK` → JSON no se toca

**Regla**: El JSON solo se actualiza si la transacción de DB tiene éxito. Nunca al revés.

## Módulos y Estructura de Carpetas

```
assets/js/
├── core/           ← Infraestructura global (no tocar sin entender)
│   ├── Api.js          ← Fetch centralizado con anti-cache (?_t=...)
│   ├── BaseService.js  ← Clase base para todos los servicios de datos
│   ├── Config.js       ← Carga y expone APP_CONFIG desde config.json
│   ├── Constants.js    ← Cadenas mágicas centralizadas (EVENTS, MODULES...)
│   ├── EventBus.js     ← Pub/Sub para desacoplar módulos
│   ├── LocalStorage.js ← Wrapper obligatorio (prohibido localStorage nativo)
│   ├── Router.js       ← Navegación silenciosa (no usa bootstrap.Tab.show)
│   ├── RealTimeSync.js ← Cliente WebSocket para sincronización en tiempo real
│   ├── SyncManager.js  ← Orquestador de sincronización entre servicios
│   ├── Ui.js           ← API central de interfaz (tablas, formularios, toasts...)
│   ├── Utils.js        ← Helpers de formato (fechas, moneda, etc.)
│   ├── RackView.js     ← Render del estado del hotel (habitaciones)
│   └── IconSelector.js ← Modal estándar de selección de iconos Bootstrap
├── services/       ← Un servicio por módulo de datos
│   ├── BackupService.js    ← OBLIGATORIO: registrar aquí cada nuevo servicio
│   ├── AgendaService.js
│   ├── TransfersService.js
│   └── ... (resto de módulos)
└── modules/        ← Lógica de UI de cada módulo
    ├── novedades.js
    ├── transfers.js
    └── ...
```

## Sincronización en Tiempo Real (WebSocket)

- El servidor emite `data-changed` con la `key` del recurso modificado tras cada escritura.
- `RealTimeSync.js` escucha y avisa al `BaseService` correspondiente.
- El `BaseService` ejecuta `syncWithServer()` en background.
- Solo se dispara eventos de UI si el dato remoto es distinto al local (evita parpadeos).
- Protocolo: `wss://` si HTTPS, `ws://` si HTTP.

## Arquitectura de Seguridad (Zero-Trust Local)

Ver detalles completos en → [`obstaculos.md`](./obstaculos.md) sección "Seguridad".

**Resumen**:

1. Login con contraseña (hash en DB). Sin password → pantalla bloqueada.
2. Huella de hardware (`STATION_KEY`): MAC + UUID + Hostname. Si el agente se copia a otro PC, la huella cambia y el servidor deniega.
3. Agente abre WebSocket _saliente_ hacia el servidor para evitar CORS/PNA. El servidor manda órdenes por ese túnel.

## Configurabilidad Multi-Hotel

- Todas las variables específicas (precios, tipos de habitación, departamentos) viven en `config.json`.
- El objetivo es que cambiar solo el JSON sea suficiente para adaptar la app a otro hotel.
- **Prohibido hardcodear** valores de negocio en código JS.
- Arrays de configuración se exponen via `APP_CONFIG` (cargado por `Config.js`).

## Prioridad de Cómputo en Cliente

Todo procesamiento pesado que sea técnicamente viable (OCR, PDF, comparaciones complejas, tratamiento de imágenes) **debe hacerse en el cliente** (navegador/agente), no en el servidor. El servidor se reserva para persistencia, orquestación y seguridad.
