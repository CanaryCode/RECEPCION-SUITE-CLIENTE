# Decisiones Descartadas — Recepción Suite

> Registro de enfoques que se evaluaron y se decidió **no implementar**, con el motivo.
> Objetivo: no proponer dos veces la misma solución descartada.

---

## Formato

```
### [FECHA] Título de la idea descartada
**Qué era**: descripción breve
**Por qué se descartó**: motivo técnico, de coste, de mantenimiento...
**Alternativa elegida**: qué se hizo en su lugar
```

---

## Historial

### [2026-02] Imágenes de Objetos Perdidos en Filesystem

**Qué era**: Guardar las fotos de objetos perdidos como archivos `.jpg`/`.png` en una carpeta del servidor (`storage/images/`), referenciadas por ruta en el JSON.

**Por qué se descartó**:

- Rompía la portabilidad del backup: el JSON solo contenía una ruta, no los datos.
- Al mover el servidor o restaurar un backup, las imágenes quedaban huérfanas.
- Complicaba la sincronización entre DB y archivos (dos fuentes de verdad).

**Alternativa elegida**: Almacenar imágenes como Base64 comprimido directamente en la DB/JSON. El objeto viaja completo. El coste en tamaño es aceptable para el volumen de imágenes.

---

### [2026-02] Control Remoto del PC via Petición HTTP Directa

**Qué era**: El navegador hacía `fetch('http://localhost:PORT/launch-app')` directamente al agente local para lanzar aplicaciones.

**Por qué se descartó**:

- Bloqueado por CORS (cross-origin entre `https://dominio.com` y `http://localhost`).
- Bloqueado por Private Network Access (PNA), política de Chrome que impide que páginas HTTPS hagan peticiones a redes privadas.
- No funcionaba en ningún navegador moderno sin flags de seguridad desactivados.

**Alternativa elegida**: Túnel WebSocket inverso. El agente abre la conexión _hacia fuera_ al servidor público. El servidor reenvía las órdenes por ese túnel. El navegador solo habla con el servidor público (sin problemas de CORS/PNA).

---

### [2026-02] Tests Automáticos de UI (Playwright / Selenium)

**Qué era**: Suite de tests end-to-end que abra el navegador y simule clicks/formularios en cada módulo.

**Por qué se descartó**:

- Coste de mantenimiento muy alto: la UI cambia frecuentemente y los tests se rompen constantemente.
- La app está en fase de iteración rápida; los tests de UI estabilizan lo que aún es fluido.
- El tiempo de escritura y mantenimiento no compensa en esta fase del proyecto.

**Alternativa elegida**: Tests de API/transacciones (`npm test` / `EJECUTAR_PRUEBAS.bat`) que verifican la capa de datos sin depender de la UI.

---

### [2026-02] Uso de React / Vue para el Frontend

**Qué era**: Reescribir el frontend usando un framework moderno con componentes reactivos.

**Por qué se descartó**:

- Añade un bundler (Webpack/Vite) y un proceso de build, rompiendo la filosofía "portable sin instalación".
- El PC de recepción no tiene garantía de tener Node.js instalado.
- Los ES Modules nativos del navegador son suficientes para el tamaño actual de la app.
- Coste de migración muy alto con beneficio marginal para UX.

**Alternativa elegida**: JavaScript ES6 Modules nativo + Bootstrap. Sin bundler.

---

### [2026-02] Botón de "Restaurar Valores de Fábrica" en Configuración

**Qué era**: Botón en el módulo de Configuración que borraba toda la config y restauraba los valores por defecto.

**Por qué se descartó**:

- Riesgo de borrado accidental de configuración crítica del hotel (recepcionistas, precios, tipos de habitación...).
- Un clic erróneo destruye semanas de configuración personalizada.
- No hay caso de uso real donde sea necesario en producción.

**Alternativa elegida**: El botón se eliminó. Las restauraciones se hacen manualmente editando `config.json` si es estrictamente necesario.
