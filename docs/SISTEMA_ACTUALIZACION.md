# Sistema de Auto-Actualización - Recepción Suite

## Descripción General

El sistema de auto-actualización permite que los clientes (Agents) se actualicen automáticamente descargando solo los archivos modificados desde el servidor central, verificando su integridad y recompilando el launcher si es necesario.

## Arquitectura

```
┌─────────────────┐         HTTPS           ┌─────────────────┐
│                 │  ◄──────────────────►   │                 │
│  Servidor (API) │   Actualizaciones       │  Agent Cliente  │
│                 │                          │                 │
└─────────────────┘                          └─────────────────┘
        │                                            │
        │                                            │
   ┌────▼────┐                                 ┌────▼────┐
   │ version │                                 │ Updater │
   │   .json │                                 │  Module │
   └─────────┘                                 └─────────┘
```

## Componentes

### 1. Servidor Central (`/server/routes/updates.js`)

**Endpoints:**

- `GET /api/updates/check?version=X.X.X`
  - Verifica si hay actualizaciones disponibles
  - Retorna: información de versión y changelog

- `GET /api/updates/manifest`
  - Obtiene lista completa de archivos con checksums SHA256
  - Retorna: array de archivos con hash y tamaño

- `GET /api/updates/download/:filePath`
  - Descarga un archivo específico
  - Seguridad: solo archivos dentro de `/agent`

- `GET /api/updates/version`
  - Obtiene versión actual del servidor

### 2. Agent Cliente (`/agent/src/updater.js`)

**Funcionalidades:**

- ✅ Verificación de actualizaciones disponibles
- ✅ Descarga diferencial (solo archivos modificados)
- ✅ Verificación de integridad con SHA256
- ✅ Backup automático antes de actualizar
- ✅ Rollback automático si falla
- ✅ Preservación de configuración local
- ✅ Recompilación del launcher
- ✅ Reinicio automático opcional

**API del Agent:**

- `GET /api/agent/updates/check` - Verificar actualizaciones
- `POST /api/agent/updates/install` - Instalar actualización
- `GET /api/agent/updates/status` - Estado de instalación
- `GET /api/agent/updates/version` - Versión actual

### 3. Visualizador (`/assets/js/modules/actualizaciones.js`)

**Características:**

- Interfaz gráfica intuitiva
- Verificación con un clic
- Barra de progreso en tiempo real
- Información de changelog
- Confirmación antes de instalar

## Flujo de Actualización

### Paso 1: Verificación

```javascript
Usuario → [Buscar Actualizaciones]
         ↓
    Visualizador → Agent → Servidor
         ↓
    ¿Hay actualización?
         ↓
    [Mostrar Dialog]
```

### Paso 2: Descarga

```javascript
Usuario → [Instalar Ahora]
         ↓
    Agent inicia descarga
         ↓
    Obtiene manifiesto
         ↓
    Compara hashes locales vs servidor
         ↓
    Descarga solo archivos modificados
         ↓
    Guarda en carpeta temporal
```

### Paso 3: Instalación

```javascript
Crea backup completo en .backup/
         ↓
    Verifica hashes de archivos descargados
         ↓
    Copia archivos a ubicación final
         ↓
    Actualiza package.json
         ↓
    ¿Cambios en launcher?
         ↓
    [Recompila launcher.exe]
```

### Paso 4: Finalización

```javascript
Limpia archivos temporales
         ↓
    Notifica completado
         ↓
    [Ofrece reiniciar]
```

## Archivos Actualizables

### Incluidos en actualización:
- ✅ `src/**/*.js` - Todo el código del agent
- ✅ `launcher/**/*` - Código fuente del launcher
- ✅ `config/agent_config.json` - Configuración base
- ✅ `package.json` - Dependencias y versión

### Excluidos (preservados):
- ❌ `config/local_config.json` - Configuración local del usuario
- ❌ `logs/**/*` - Logs
- ❌ `node_modules/**/*` - Dependencias (se instalan con npm)
- ❌ `.agent_token` - Token de autenticación
- ❌ `RecepcionSuite.exe` - Se recompila después

## Seguridad

### Verificación de Integridad

1. **Checksums SHA256**: Cada archivo tiene un hash único
2. **Verificación pre-instalación**: Se verifica antes de copiar
3. **Verificación post-instalación**: Se verifica después de copiar
4. **Rollback automático**: Si algún hash no coincide

### Protección de Configuración

- La configuración local (`local_config.json`) **NUNCA** se sobrescribe
- Los tokens de autenticación se preservan
- Los logs no se eliminan

### Backup Automático

- Se crea backup completo antes de actualizar
- Se guarda en `.backup/`
- Se restaura automáticamente si hay error
- Se conserva hasta la próxima actualización

## Versionado

### Formato Semántico (SemVer)

```
MAJOR.MINOR.PATCH

Ejemplo: 1.2.3

MAJOR: Cambios incompatibles
MINOR: Nueva funcionalidad compatible
PATCH: Correcciones de bugs
```

### Archivo `version.json`

```json
{
  "version": "1.0.0",
  "buildDate": "2026-03-03",
  "changelog": {
    "1.0.0": [
      "Sistema inicial",
      "Auto-actualización implementada"
    ],
    "1.0.1": [
      "Fix: corrección de bugs menores"
    ]
  }
}
```

## Uso

### Para el Usuario Final

1. Abrir el Visualizador
2. Ir a "Configuración" → "Actualizaciones"
3. Hacer clic en "Buscar Actualizaciones"
4. Si hay actualización, clic en "Instalar Ahora"
5. Esperar a que complete (1-3 minutos)
6. Reiniciar la aplicación

### Para Desarrolladores

#### Publicar una Actualización

1. **Modificar código** en `/agent`

2. **Actualizar versión** en `/version.json`:
```json
{
  "version": "1.1.0",
  "buildDate": "2026-03-04",
  "changelog": {
    "1.1.0": [
      "Nueva funcionalidad X",
      "Mejora en Y",
      "Fix en Z"
    ]
  }
}
```

3. **Actualizar `package.json`** en `/agent`:
```json
{
  "version": "1.1.0"
}
```

4. **Probar** en entorno local

5. **Desplegar** al servidor de producción

6. Los clientes verán la actualización disponible automáticamente

#### Probar Localmente

```bash
# En el servidor
cd /home/ajpd/recepcion-suite
npm start

# En el agent
cd agent
npm start

# Abrir navegador
http://localhost:3000
```

## Recompilación del Launcher

### Automática (Recomendado)

El sistema detecta automáticamente si se actualizaron archivos del launcher y lo recompila.

### Manual

Si es necesario recompilar manualmente:

```batch
cd agent\launcher
build_launcher.bat
```

O después de actualizar:

```batch
cd agent\launcher
rebuild_after_update.bat
```

## Troubleshooting

### Problema: "No se puede conectar al servidor"

**Solución:**
- Verificar que el servidor está corriendo
- Verificar conectividad de red
- Revisar firewall

### Problema: "Error de hash después de descargar"

**Solución:**
- Verificar conexión a internet
- Reintentar la actualización
- Si persiste, actualización manual

### Problema: "Rollback automático ejecutado"

**Causa:** Algún archivo no pasó la verificación

**Solución:**
- Revisar logs en `agent/logs/agent.log`
- Verificar espacio en disco
- Reintentar la actualización

### Problema: "Launcher no se recompila"

**Solución:**
- Ejecutar manualmente `build_launcher.bat`
- Verificar que existe compilador de C# (.NET Framework)
- En Linux, no es necesario (se usa el ejecutable existente)

## Logs

### Servidor

Ubicación: `storage/server_debug.log`

```
[2026-03-03T10:30:00.000Z] [SERVER] Mounting Updates Routes...
```

### Agent

Ubicación: `agent/logs/agent.log`

```
[UPDATER] Archivos a actualizar: 5
[UPDATER] Descargando: src/index.js
[UPDATER] Instalando: src/index.js
[UPDATER] Backup creado exitosamente
```

## API Reference

### Server API

#### `GET /api/updates/check`

**Query Parameters:**
- `version` (string): Versión actual del cliente

**Response:**
```json
{
  "updateAvailable": true,
  "currentVersion": "1.0.0",
  "latestVersion": "1.1.0",
  "buildDate": "2026-03-04",
  "changelog": [
    "Nueva funcionalidad X",
    "Fix en Y"
  ]
}
```

#### `GET /api/updates/manifest`

**Response:**
```json
{
  "version": "1.1.0",
  "buildDate": "2026-03-04",
  "files": [
    {
      "path": "src/index.js",
      "hash": "a1b2c3...",
      "size": 16228
    }
  ],
  "totalSize": 45678
}
```

### Agent API

#### `POST /api/agent/updates/install`

**Response:**
```json
{
  "success": true,
  "message": "Actualización iniciada"
}
```

#### `GET /api/agent/updates/status`

**Response:**
```json
{
  "checking": false,
  "downloading": true,
  "installing": false,
  "error": null,
  "progress": 45,
  "currentFile": "src/routes/admin.js"
}
```

## Roadmap

### Versión 1.1
- [ ] Actualizaciones incrementales por delta (patch files)
- [ ] Compresión de archivos descargados
- [ ] Programar actualizaciones automáticas

### Versión 1.2
- [ ] Rollback manual desde UI
- [ ] Historial de actualizaciones
- [ ] Notificaciones push de nuevas versiones

### Versión 2.0
- [ ] Canales de actualización (stable, beta, dev)
- [ ] Firma digital de paquetes
- [ ] Actualizaciones P2P entre agents

## Soporte

Para reportar problemas o sugerir mejoras:

1. Revisar esta documentación
2. Revisar logs del servidor y agent
3. Crear issue en el repositorio del proyecto

---

**Última actualización:** 2026-03-03
**Versión del documento:** 1.0
