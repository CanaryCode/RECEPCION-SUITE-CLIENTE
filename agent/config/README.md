# Carpeta de Configuración del Agente

Esta carpeta contiene archivos de configuración **locales** del agente.

## Archivos

### `agent_config.json`
Configuración general del agente (STATION_KEY, configuración de conexión, etc.)

### `local_config.json`
**⚠️ IMPORTANTE: Este archivo NO se sube a git**

Contiene la configuración **específica de cada PC**:
- Rutas de carpetas personalizadas (transfers, calendario, etc.)
- Launchers personalizados (aplicaciones y carpetas del sistema)
- Cualquier configuración que varía entre ordenadores

**Características:**
- ✅ Se crea automáticamente la primera vez que se guarda configuración
- ✅ Persiste al borrado de caché del navegador
- ✅ Cada PC tiene su propia configuración independiente
- ✅ Ruta relativa: funciona en Windows y Linux

**Ejemplo de contenido:**
```json
{
  "transfers": {
    "folders": [
      "C:\\Transfers\\Llegadas",
      "C:\\Transfers\\Salidas"
    ]
  },
  "calendario": {
    "folders": [
      "C:\\Eventos"
    ]
  },
  "launchers": [
    {
      "label": "Outlook",
      "path": "C:\\Program Files\\Microsoft Office\\root\\Office16\\OUTLOOK.EXE",
      "type": "app"
    },
    {
      "label": "Documentos",
      "path": "C:\\Users\\Recepcion\\Documents",
      "type": "folder"
    }
  ]
}
```

## Instalación en nuevos PCs

Cuando instales el agente en un nuevo ordenador:

1. **NO copies** el archivo `local_config.json` de otro PC
2. Deja que se cree automáticamente cuando el usuario configure sus carpetas
3. Cada PC generará su propia configuración adaptada a sus rutas

## Backup

Si quieres hacer backup de la configuración de un PC específico, **guarda una copia** de `local_config.json` con el nombre del PC:

```bash
# Windows
copy local_config.json local_config_RECEPCION1_backup.json

# Linux
cp local_config.json local_config_RECEPCION1_backup.json
```
