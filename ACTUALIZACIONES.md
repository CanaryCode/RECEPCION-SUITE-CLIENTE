# 🔄 Sistema de Auto-Actualización - Guía Rápida

## ¿Qué hace?

Tu aplicación ahora puede **actualizarse automáticamente** desde el servidor central, descargando solo los archivos que cambiaron, verificando su integridad, y recompilando el launcher si es necesario.

## 🎯 Características Principales

✅ **Actualización con 1 clic** desde el Visualizador
✅ **Descarga inteligente** - solo archivos modificados
✅ **Verificación de integridad** con SHA256
✅ **Backup automático** antes de actualizar
✅ **Rollback automático** si algo falla
✅ **Preserva tu configuración local**
✅ **Recompila el launcher** automáticamente
✅ **Barra de progreso** en tiempo real

## 📱 Cómo usar (Usuario Final)

### Paso 1: Abrir Actualizaciones

1. Abre el **Visualizador** (navegador)
2. Ve a **⚙️ Configuración**
3. Despliega la sección **"8. Actualizaciones del Sistema"**

### Paso 2: Buscar Actualizaciones

1. Haz clic en **"🔍 Buscar Actualizaciones"**
2. El sistema verificará con el servidor central
3. Si hay actualización, verás:
   - Versión actual y nueva
   - Lista de cambios (changelog)
   - Fecha de la actualización

### Paso 3: Instalar

1. Haz clic en **"Instalar Ahora"**
2. Espera 1-3 minutos mientras:
   - Se descargan los archivos
   - Se verifica la integridad
   - Se instala la actualización
   - Se recompila el launcher (si es necesario)
3. ¡Listo! Reinicia la aplicación

## 🔧 Para Desarrolladores

### Publicar una Nueva Versión

#### 1. Actualizar el código
Modifica los archivos en `/agent/src/` o `/agent/launcher/`

#### 2. Actualizar la versión

**En `/version.json`:**
```json
{
  "version": "1.1.0",
  "buildDate": "2026-03-04",
  "changelog": {
    "1.1.0": [
      "Nueva funcionalidad: Chat privado mejorado",
      "Fix: Corrección de bug en transferencias",
      "Mejora: Optimización de carga de galerías"
    ]
  }
}
```

**En `/agent/package.json`:**
```json
{
  "version": "1.1.0"
}
```

#### 3. Subir al servidor

```bash
# En producción
cd /home/ajpd/recepcion-suite
git add .
git commit -m "release: v1.1.0"
git push

# Reiniciar servidor (si es necesario)
pm2 restart server
```

#### 4. Los clientes se actualizarán

Los usuarios verán la actualización disponible al hacer clic en "Buscar Actualizaciones"

### Probar Localmente

```bash
# Terminal 1: Servidor
cd /home/ajpd/recepcion-suite/server
npm start

# Terminal 2: Agent
cd /home/ajpd/recepcion-suite/agent
npm start

# Navegador
http://localhost:3000
```

## 📋 Archivos del Sistema

```
recepcion-suite/
├── version.json                           # Versión y changelog
├── server/
│   └── routes/updates.js                  # API de actualizaciones
├── agent/
│   ├── src/
│   │   ├── updater.js                     # Motor de actualización
│   │   └── routes/updates.js              # API del agent
│   └── launcher/
│       ├── build_launcher.bat             # Compilar launcher
│       └── rebuild_after_update.bat       # Recompilar post-actualización
├── assets/
│   └── js/
│       └── modules/
│           └── actualizaciones.js         # UI del visualizador
└── docs/
    └── SISTEMA_ACTUALIZACION.md           # Documentación completa
```

## 🛡️ Seguridad

- **Solo archivos permitidos**: El sistema solo actualiza archivos dentro de `/agent`
- **Verificación SHA256**: Cada archivo se verifica antes y después de instalar
- **Backup automático**: Se crea copia de seguridad antes de actualizar
- **Rollback automático**: Si falla, se restaura el backup
- **Configuración protegida**: Tu `local_config.json` nunca se sobrescribe

## ⚙️ API Endpoints

### Servidor (`https://www.desdetenerife.com:3000`)

- `GET /api/updates/check?version=1.0.0` - Verificar actualización
- `GET /api/updates/manifest` - Obtener lista de archivos
- `GET /api/updates/download/src/index.js` - Descargar archivo

### Agent (Local `http://localhost:3001`)

- `GET /api/agent/updates/check` - Verificar desde el agent
- `POST /api/agent/updates/install` - Iniciar instalación
- `GET /api/agent/updates/status` - Estado de la instalación
- `GET /api/agent/updates/version` - Versión actual

## 🐛 Solución de Problemas

### "No se puede conectar al servidor"
- Verifica que el servidor esté corriendo: `pm2 status`
- Revisa la conectividad de red
- Verifica el firewall

### "Error de hash después de descargar"
- Verifica tu conexión a internet
- Reinicia el agent y reintenta
- Si persiste, actualiza manualmente copiando archivos

### "Rollback ejecutado"
- Revisa los logs: `/home/ajpd/recepcion-suite/agent/logs/agent.log`
- Verifica espacio en disco: `df -h`
- Reintenta la actualización

### Launcher no se recompila (Windows)
- Ejecuta manualmente: `cd agent\launcher && build_launcher.bat`
- Verifica que esté instalado .NET Framework 4.0+

## 📊 Logs

**Servidor:**
```bash
tail -f /home/ajpd/recepcion-suite/storage/server_debug.log
```

**Agent:**
```bash
tail -f /home/ajpd/recepcion-suite/agent/logs/agent.log
```

**PM2:**
```bash
pm2 logs server
pm2 logs agent
```

## 🚀 Próximas Mejoras

- [ ] Actualizaciones automáticas programadas
- [ ] Notificaciones push de nuevas versiones
- [ ] Canales de actualización (estable, beta, dev)
- [ ] Compresión de archivos descargados
- [ ] Historial de actualizaciones en la UI

## 💡 Consejos

1. **Antes de actualizar**: Asegúrate de que no haya tareas críticas en proceso
2. **Conexión estable**: Usa una conexión a internet estable
3. **Espacio en disco**: Mantén al menos 500MB libres
4. **Backup manual**: Ocasionalmente haz backup manual de tu configuración
5. **Probar primero**: Si es posible, prueba la actualización en un PC de prueba

## 📞 Soporte

Si tienes problemas:

1. Revisa esta guía
2. Consulta `/docs/SISTEMA_ACTUALIZACION.md` para detalles técnicos
3. Revisa los logs del servidor y agent
4. Contacta al administrador del sistema

---

**¡Tu aplicación ya puede actualizarse sola! 🎉**

Creado: 2026-03-03
Versión del documento: 1.0
