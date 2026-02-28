# Troubleshooting — Recepción Suite

> Errores frecuentes y sus soluciones. Para problemas sin resolver / decisiones, ver `obstaculos.md`.

---

## Arranque y Agente

### "Agente no detectado" al abrir la app

**Causas y soluciones**:

1. **El agente no está iniciado**: Ejecutar `INICIAR_AGENTE.bat` en el PC de recepción.
2. **PC nuevo / carpeta copiada**: La `STATION_KEY` cambió. Re-registrar el agente desde Admin Console → Estaciones → Registrar nuevo dispositivo.
3. **Firewall bloqueando el WebSocket**: Verificar que el puerto 3000 no está bloqueado. El agente usa tráfico WebSocket _saliente_ (no necesita puerto abierto entrante).

### "502 Bad Gateway" al cargar configuración

**Causa**: El agente aún no terminó de inicializarse cuando la app intentó conectar.

**Solución**: Esperar 5 segundos y recargar la página. Si persiste, verificar que el servidor Node.js en `agent/` está corriendo (ver logs en `agent/server_debug.log`).

### SmartScreen bloquea `RecepcionSuite.exe`

**Solución**:

```powershell
# En PowerShell como Administrador:
Unblock-File -Path ".\RecepcionSuite.exe"
```

### El servidor se detuvo ("Conexión Perdida" / pantalla negra)

**Causa**: Timeout de 24h de inactividad o suspensión del PC servidor.

**Solución**: Ejecutar de nuevo el acceso directo del servidor y pulsar "Reconectar" en el navegador.

---

## Datos y Sincronización

### Los cambios de otro recepcionista no aparecen

**Verificar**:

1. El WebSocket de sincronización está conectado (ver indicador en la esquina de la app).
2. Si está desconectado: la app reintenta sola. Esperar 30s.
3. Si no se reconecta: recargar la página (`F5`).

### Un módulo muestra datos desactualizados

**Solución rápida**: Recargar el módulo desde la barra de herramientas (botón de refresco si existe) o recargar la página.

**Si persiste**: El archivo JSON y la DB pueden estar desincronizados. Verificar `storage/server_debug.log` para errores de transacción.

### Error al guardar: "Transacción fallida"

**Causa**: Docker (MariaDB) está detenido o con problemas.

**Solución**:

```bash
# Reiniciar el contenedor de MariaDB
docker restart recepcion-suite-db
```

Mientras el Docker está caído, el sistema funciona en modo **solo-JSON** (fallback automático).

---

## Interfaz y Módulos

### Un módulo no carga / aparece en blanco

**Verificar en consola del navegador (F12)**:

1. Error de import (`404 Not Found` en un `.js`): verificar que el archivo del módulo existe en `assets/js/modules/`.
2. Error de `BaseService`: verificar que el servicio está registrado en `BackupService.js`.
3. Validación de datos fallando: revisar si hay datos corruptos en `storage/*.json` para ese módulo.

### Los tooltips no aparecen o un dropdown no funciona

**Causa**: Conflicto de instancias Bootstrap en el mismo elemento DOM (tooltip + dropdown en el mismo botón).

**Solución**: Ver Regla U9 en `reglas_de_oro.md`. Mover el tooltip a un `<span>` hijo del botón.

### La vista de trabajo no es la que aparece por defecto al abrir un módulo

**Causa**: Al implementar el módulo, se dejó activo el tab de lista/rack en el HTML.

**Solución**: En el HTML del módulo, asegurar que el botón de "Vista Trabajo" tiene la clase `active` y su panel tiene `show active`. El panel de lista debe tener `d-none` inicialmente.

---

## Build y Despliegue

### `INICIAR_AGENTE.bat` falla con "comando no reconocido"

**Causa probable**: Node.js portable no encontrado en la ruta esperada.

**Verificar**: La carpeta `agent/node_modules` debe existir. Si no existe, ejecutar `npm install` dentro de la carpeta `agent/`.

### Error al compilar `Launcher.cs` (Agent Launcher)

**Causa**: El proceso `RecepcionSuite.exe` anterior sigue corriendo y tiene el archivo bloqueado.

**Solución**:

```bash
# En PowerShell:
Stop-Process -Name "RecepcionSuite" -Force -ErrorAction SilentlyContinue
# Luego ejecutar build_launcher.bat
```

### El icono del ejecutable no aparece / es genérico

**Causa**: La ruta del `.ico` en el script de compilación es relativa y no se resuelve correctamente desde el directorio de trabajo.

**Solución**: Usar la ruta absoluta del `.ico` en el comando `csc` de compilación.

---

## Git y Versionado

### Se borraron archivos del servidor al hacer push

**Causa**: Un commit de reestructuración eliminó rutas del servidor accidentalmente.

**Solución**: `git revert HEAD` para deshacer el último commit, verificar que se restauran los archivos y hacer un nuevo commit limpio.

### El folder `agent/node_modules` no sube a GitHub

**Causa**: Está en `.gitignore`.

**Solución adoptada**: Incluir explícitamente en el repositorio (override del `.gitignore`) para facilitar el despliegue sin necesitar `npm install` en el PC de recepción.
