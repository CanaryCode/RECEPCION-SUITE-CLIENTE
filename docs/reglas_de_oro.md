# Reglas de Oro — Recepción Suite

> Estas reglas son invariantes. Cualquier cambio que las viole debe ser rechazado o consultado explícitamente.

---

## DATOS Y PERSISTENCIA

| #   | Regla                             | Detalle                                                                                            |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| D1  | **Atomicidad total**              | Toda escritura usa `BEGIN/COMMIT`. Si falla la DB, el JSON no se toca. Nunca escrituras parciales. |
| D2  | **JSON es espejo, no origen**     | El `.json` en `storage/` se actualiza DESPUÉS de la DB, nunca antes.                               |
| D3  | **Sin caché en datos operativos** | Siempre `?_t=Date.now()` en GETs. Prohibido confiar en caché del navegador para datos de negocio.  |
| D4  | **LocalStorage solo con wrapper** | Prohibido `localStorage.setItem()` directo. Usar siempre `core/LocalStorage.js`.                   |
| D5  | **Lectura defensiva**             | Nunca asumir que un campo existe en datos guardados. Usar `data.campo \|\| 'default'`.             |
| D6  | **No borrar claves antiguas**     | Si se depreca un campo, migrarlo suavemente. Los datos del usuario son sagrados.                   |
| D7  | **Backup antes de migraciones**   | Ante cualquier cambio de estructura de datos crítica, forzar backup del estado actual primero.     |

## CÓDIGO Y ARQUITECTURA

| #   | Regla                            | Detalle                                                                                    |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------ |
| C1  | **ES Modules estricto**          | Solo `import/export`. Sin `require()`. Sin scripts globales en HTML salvo bootstrap.       |
| C2  | **Rutas relativas siempre**      | HTML: `assets/img/foto.jpg` (sin `/`). JS: `../core/Utils.js`. Nunca rutas absolutas.      |
| C3  | **Sin dependencias globales**    | No asumir Node.js ni NPM instalados en el cliente. Todo dentro del proyecto.               |
| C4  | **Configuración en JSON**        | Ningún valor de negocio (precios, tipos, nombres) en código fuente. Todo en `config.json`. |
| C5  | **Registro en BackupService**    | Todo nuevo servicio de datos DEBE añadirse al array `this.services` en `BackupService.js`. |
| C6  | **Registrar tabla en TABLE_MAP** | Todo nuevo módulo con persistencia debe registrarse en `server/routes/storage.js`.         |
| C7  | **Cómputo pesado en cliente**    | OCR, PDF, imágenes → JavaScript del navegador. El servidor es solo para persistencia.      |
| C8  | **Sin magic strings**            | Usar `core/Constants.js` para eventos, nombres de módulos y claves.                        |
| C9  | **Minimalismo en headers para Agente** | Prohibido enviar headers de sesión (`X-User-Name`, etc.) a peticiones locales (localhost) para evitar bloqueos CORS/PNA innecesarios. |
| C10 | **Singletons globales en arranque** | Servicios core (`realTimeSync`, `Api`, etc.) deben exponerse a `window` para ser accesibles por módulos asíncronos o scripts legacy durante el race condition del arranque. |

## INTERFAZ Y UX

| #   | Regla                                      | Detalle                                                                                                           |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| U1  | **Prohibido `alert()` nativo**             | Usar `Ui.showToast()`, `Ui.showConfirm()`, `Ui.showPrompt()`.                                                     |
| U2  | **Vista Trabajo = primera vista**          | El formulario de entrada/acción es siempre el tab activo por defecto.                                             |
| U3  | **No paneles anidados**                    | `.card` dentro de `.card` con `shadow` está prohibido. Un solo nivel de contenedor blanco.                        |
| U4  | **Barra de herramientas obligatoria**      | Todo módulo con datos debe tener toolbar con botón IMPRIMIR visible.                                              |
| U5  | **Módulos de resumen: invisible si vacío** | Si no hay datos del día, ocultar el widget con `d-none`. No mostrar cajas vacías.                                 |
| U6  | **Autocomplete off global**                | Todos los formularios e inputs: `autocomplete="off"`. Evita autorrelleno de contraseñas o datos viejos.           |
| U7  | **IntersectionObserver via Ui.js**         | No implementar manualmente. Usar `Ui.infiniteScroll(...)`.                                                        |
| U8  | **Tablas ordenables**                      | Toda tabla de listado debe tener `data-sort` en sus `<th>` y usar `Ui.enableTableSorting(...)`.                   |
| U9  | **Tooltips no en botones dropdown**        | Nunca `data-bs-toggle="tooltip"` en un elemento que ya tenga `data-bs-toggle="dropdown"`. Envolverlo en `<span>`. |
| U10 | **Prohibido volcar todo al DOM**           | Máximo 50 filas visibles. Usar paginación o scroll infinito con `IntersectionObserver`.                           |

## SEGURIDAD

| #   | Regla                                 | Detalle                                                                                                                                                     |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **Pantalla bloqueada sin auth**       | La UI nunca muestra datos operativos sin login validado.                                                                                                    |
| S2  | **Huella de hardware activa**         | El agente usa MAC+UUID+Hostname. Si se copia a otro PC, la conexión se deniega.                                                                             |
| S3  | **Clave de cifrado solo en servidor** | Ningún secreto maestro en el cliente. La clave de cifrado nunca viaja al navegador.                                                                         |
| S4  | **Test ante fallo recurrente**        | Si un área ha fallado dos veces o más de la misma forma, crear un test automático que verifique ese comportamiento. No esperar a que falle una tercera vez. |

## VERSIONADO

| #   | Regla                                 | Detalle                                                                                            |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| V1  | **Actualizar versión en cada commit** | Editar la etiqueta `#app-header .version-ribbon` en `index.html` con formato `v.beta X`.           |
| V2  | **Navegar en silencio**               | Usar `Router.js` para cambiar vistas. Nunca `bootstrap.Tab.show()` que abre dropdowns no deseados. |
