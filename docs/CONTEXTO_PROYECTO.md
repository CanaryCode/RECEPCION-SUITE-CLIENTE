# CONTEXTO DEL PROYECTO — Recepción Suite (Índice)

> **Para la IA**: Lee solo este archivo primero. Ve a los documentos satélite solo cuando el problema lo requiera.
> **Palabra clave de sesión**: Cuando el usuario diga **`SELLADO`**, ejecutar el workflow `sellado` para archivar lo aprendido y subir los docs a GitHub.
> **Este documento es vivo**: evoluciona con la app. Cada SELLADO lo mejora.

---

## 📍 Estado Actual del Proyecto

> **Actualizar en cada SELLADO.**

| Campo                      | Valor                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| **Última versión**         | v5.0.3                                                                                    |
| **Módulo en foco**         | Chat con Mensajería Privada + Robustez de API Core                                        |
| **Deuda técnica conocida** | Ninguna conocida                                                                          |
| **Próximo objetivo**       | Ver `roadmap.md`                                                                          |
| **Última sesión**          | 2026-03-03 — SELLADO: Implementación de Chat Privado y fix de errores críticos en Api.js. |

---

## ¿Qué es esto?

Aplicación web de gestión para recepción de hotel (Hotel Garoé). Stack: HTML5 + CSS3 + JS ES6 Modules. Sin frameworks pesados. Backend: Node.js + Express + MariaDB (Docker). El cliente es la carpeta `agent/` (se instala en el PC de recepción). El servidor es todo lo demás.

URL de producción: `https://www.desdetenerife.com:3000`

---

## Mapa de Documentación

| Documento                                                  | Cuándo leerlo                                                         |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| [`arquitectura.md`](./arquitectura.md)                     | Estructura de carpetas, topología, DB, seguridad, WebSocket           |
| [`reglas_de_oro.md`](./reglas_de_oro.md)                   | **Leer siempre antes de proponer cambios.** Invariantes del proyecto. |
| [`diseno_ux.md`](./diseno_ux.md)                           | Al trabajar en UI: clases, componentes, Ui.js API, modales            |
| [`api_datos.md`](./api_datos.md)                           | Al trabajar en servicios, endpoints, BaseService, validaciones        |
| [`modulos_casos_de_uso.md`](./modulos_casos_de_uso.md)     | Al añadir/modificar un módulo operativo. Incluye checklist.           |
| [`algoritmos.md`](./algoritmos.md)                         | Lógica no trivial: transacciones, WebSocket, fingerprinting, routing  |
| [`obstaculos.md`](./obstaculos.md)                         | **Siempre antes de depurar.** Historial de problemas y soluciones.    |
| [`troubleshooting.md`](./troubleshooting.md)               | Errores frecuentes ya resueltos con solución rápida                   |
| [`roadmap.md`](./roadmap.md)                               | Qué está pendiente, en progreso y completado                          |
| [`decisiones_descartadas.md`](./decisiones_descartadas.md) | **Antes de proponer una solución nueva.** Enfoques ya rechazados.     |

---

## Resumen Rápido de Arquitectura

```
[PC Recepción]                        [Servidor Público: desdetenerife.com]
 agent/ (Node.js portable)    ←WSS→    server/ (Express + MariaDB Docker)
  └── Launcher.exe                      └── Puerto 3000 (HTTPS)
  └── Abre la web en el navegador        └── storage/*.json (backup JSON)
```

**Persistencia dual**: DB MariaDB (primaria) + JSON (espejo). Escrituras atómicas: `BEGIN → DB ok → escribe JSON → COMMIT`. Si falla: `ROLLBACK`, JSON intacto.

**Sincronización**: WebSocket Push. Tras cada escritura el servidor emite `data-changed`. Los clientes actualizan solo si los datos son distintos (evita parpadeos).

**Seguridad**: Login con hash en DB + Huella de hardware (`STATION_KEY` = hash de MAC+UUID+Hostname). Si el agente se copia a otro PC, la huella cambia y el servidor deniega acceso.

---

## Stack de Archivos Core

```
assets/js/core/
├── Api.js           ← Fetch con anti-cache (?_t=...)
├── BaseService.js   ← Clase base de todos los servicios de datos
├── Config.js        ← APP_CONFIG desde config.json (NO hardcodear valores)
├── Constants.js     ← Magic strings centralizadas (EVENTS, MODULES...)
├── EventBus.js      ← Pub/Sub para desacoplar módulos
├── LocalStorage.js  ← Wrapper OBLIGATORIO (prohibido localStorage nativo)
├── Router.js        ← Navegación silenciosa (NO bootstrap.Tab.show)
├── RealTimeSync.js  ← Cliente WebSocket de sync
├── Ui.js            ← API central: tablas, formularios, toasts, scroll infinito
└── Utils.js         ← Helpers de formato
```

---

## Reglas Críticas (Top 5)

1. **Atomicidad**: Toda escritura es `BEGIN/COMMIT`. JSON solo se toca si DB ok.
2. **Sin hardcode**: Valores de negocio → `config.json`. Strings → `Constants.js`.
3. **LocalStorage con wrapper**: Nunca `localStorage.setItem()` directo.
4. **Sin alert() nativo**: Siempre `Ui.showToast/showConfirm/showPrompt`.
5. **Nuevo módulo**: Registrar en `TABLE_MAP` (storage.js) + `BackupService.js`.

→ Ver todas las reglas en [`reglas_de_oro.md`](./reglas_de_oro.md)

---

## Protocolo de Colaboración IA-Humano

### Palabra clave: `SELLADO`

Cuando el usuario escribe `SELLADO`, la IA debe:

1. Inferir el problema resuelto de la conversación.
2. Añadir una entrada a `docs/obstaculos.md` con: síntoma, causa raíz, solución, archivos y lección.
3. Actualizar cualquier otro doc afectado (algoritmos, reglas, módulos...).
4. Hacer `git add docs/ .agent/ && git commit && git push` con el título del problema.
5. Confirmar con resumen de una línea + confirmación de push.

**Objetivo**: Que ningún problema se resuelva dos veces. Contexto siempre disponible para la siguiente sesión.

### Regla de depuración (anti-iteración ciega)

Antes de iterar código a ciegas cuando algo no funciona, **obligatorio** poner logs estratégicos primero:

```javascript
console.log("[MÓDULO][función] variable:", variable); // ← trampa de diagnóstico
```

- Instrumentar puntos de entrada, respuestas de API, valores de estado y condicionales clave.
- Solo cuando los logs revelan la causa raíz, iterar el código.

### Regla divide y vencerás (tareas complejas)

Ante desafíos grandes, **obligatorio** trocearlos en subtareas independientes antes de empezar:

1. Definir el objetivo final en una frase.
2. Descomponerlo en pasos del tamaño de **un fichero o una función** cada uno.
3. Completar y verificar cada paso antes del siguiente.
4. **No abrir más de 2-3 ficheros a la vez** si no están directamente relacionados.

Si en medio de una tarea aparece algo nuevo que requiere atención, anotarlo y terminarlo después — no dispersarse. Una cosa a la vez, bien hecha.

### Tests como herramienta de trabajo

Antes de pedir al usuario que verifique manualmente algo en el navegador, comprobar si hay un test ejecutable:

```bash
npm test                              # Suite completa
node tests/integration/storage.test.js   # Transacciones DB
node tests/unit/utils.test.js            # Lógica pura (formateo, validación)
node tests/unit/service_logic.test.js    # Lógica de BaseService
node tests/api/endpoints.test.js         # Endpoints Express
```

Si el test cubre lo que se ha cambiado → ejecutarlo yo mismo → solo comunicar el resultado al usuario.

- **El diagnóstico primero, siempre.** Ahorra tokens y evita 20 cambios ciegos.

### Protocolo DEBUG.md (sesiones complejas)

En sesiones de depuración larga, crear `/tmp/DEBUG.md` al inicio con:

- Síntoma exacto
- Hipótesis ordenadas por probabilidad
- Qué logs se han puesto y qué se espera ver en cada uno

Este fichero guía la sesión y evita perder el hilo. Se descarta en el SELLADO (el conocimiento útil va a `obstaculos.md`).
