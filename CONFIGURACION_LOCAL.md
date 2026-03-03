# Configuración Local por PC

## ¿Qué es?

Sistema de configuración **persistente** que se guarda **localmente en cada PC** (no en la base de datos del servidor). Ideal para:

- **Rutas de carpetas** específicas de cada ordenador
- **Launchers personalizados** (aplicaciones y carpetas)
- **Configuraciones que deben sobrevivir** al borrado de caché del navegador

## ¿Dónde se guarda?

- **En el agente local**: `agent/config/local_config.json`
- **Ruta relativa** a la carpeta del agente (funciona en Windows y Linux)
- **Persiste** al borrado de caché del navegador
- **Cada PC** tiene su propio archivo
- **NO se sube a git** (ignorado en `.gitignore`)

## Uso desde JavaScript

### 1. Importar el servicio

```javascript
import { localConfigService } from './services/LocalConfigService.js';
```

### 2. Obtener configuración

```javascript
// Obtener configuración de un módulo
const config = await localConfigService.get('transfers');
console.log(config); // { folders: ["C:\\Transfers"] }

// Obtener con valor por defecto
const calendarioConfig = await localConfigService.get('calendario', { folders: [] });
```

### 3. Guardar configuración

```javascript
// Guardar configuración completa de un módulo
await localConfigService.set('transfers', {
    folders: ["C:\\Transfers\\Llegadas", "C:\\Transfers\\Salidas"]
});

// Actualizar parcialmente
await localConfigService.update('transfers', {
    folders: ["C:\\Nueva\\Carpeta"]
});
```

### 4. Manejo de carpetas (helpers)

```javascript
// Obtener carpetas de un módulo
const folders = await localConfigService.getFolders('calendario');

// Establecer carpetas
await localConfigService.setFolders('calendario', [
    "C:\\Calendario\\Eventos",
    "D:\\Backup\\Calendario"
]);

// Añadir una carpeta
await localConfigService.addFolder('calendario', "E:\\Nuevos\\Eventos");

// Eliminar una carpeta
await localConfigService.removeFolder('calendario', "C:\\Vieja\\Carpeta");
```

### 5. Manejo de launchers

```javascript
// Obtener launchers
const launchers = await localConfigService.getLaunchers();

// Añadir launcher
await localConfigService.addLauncher({
    label: "Outlook",
    path: "C:\\Program Files\\Microsoft Office\\root\\Office16\\OUTLOOK.EXE",
    type: "app"
});

await localConfigService.addLauncher({
    label: "Documentos",
    path: "C:\\Users\\Admin\\Documents",
    type: "folder"
});

// Eliminar launcher por índice
await localConfigService.removeLauncher(0);
```

## Ejemplo desde un módulo

### Módulo de Transfers

```javascript
import { transfersService } from './services/TransfersService.js';

async function inicializarTransfers() {
    // Obtener carpetas configuradas para este PC
    const folders = await transfersService.getFolders();

    if (folders.length === 0) {
        console.log('No hay carpetas configuradas. Mostrar configurador...');
        mostrarConfiguradorCarpetas();
    } else {
        console.log('Carpetas configuradas:', folders);
        cargarArchivosDesde(folders);
    }
}

async function guardarCarpeta() {
    const nuevaCarpeta = document.getElementById('folder-input').value;
    await transfersService.addFolder(nuevaCarpeta);
    alert('Carpeta guardada en configuración local!');
}
```

### Módulo de Calendario

```javascript
import { calendarioService } from './services/CalendarioService.js';

async function configurarCarpetas() {
    // Obtener carpetas actuales
    const foldersActuales = await calendarioService.getFolders();

    // Añadir nueva carpeta
    const nuevaCarpeta = prompt('Ruta de la carpeta:');
    if (nuevaCarpeta) {
        await calendarioService.addFolder(nuevaCarpeta);
    }

    // Mostrar carpetas configuradas
    const folders = await calendarioService.getFolders();
    console.log('Carpetas configuradas:', folders);
}
```

## Estructura del archivo JSON

El archivo `agent_local_config.json` tiene esta estructura:

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
      "C:\\Calendario\\Eventos"
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
      "path": "C:\\Users\\Admin\\Documents",
      "type": "folder"
    }
  ]
}
```

## Eventos

El servicio dispara un evento cuando se actualiza la configuración:

```javascript
window.addEventListener('local-config-updated', (e) => {
    const { moduleKey, value } = e.detail;
    console.log(`Configuración actualizada para ${moduleKey}:`, value);

    // Recargar UI si es el módulo actual
    if (moduleKey === 'transfers') {
        recargarCarpetas();
    }
});
```

## Ventajas vs Base de Datos

| Característica | Config Local | Base de Datos |
|---------------|-------------|---------------|
| **Alcance** | Solo este PC | Todos los PCs |
| **Persistencia** | Sobrevive caché | Sobrevive caché |
| **Sincronización** | No (local) | Sí (compartido) |
| **Uso ideal** | Rutas, launchers | Datos compartidos |

## Ejemplo completo: Configurador de carpetas

```html
<!-- En el template del módulo -->
<div id="config-folders">
    <h3>Carpetas configuradas</h3>
    <ul id="folder-list"></ul>

    <button onclick="añadirCarpeta()">Añadir carpeta</button>
</div>
```

```javascript
import { transfersService } from './services/TransfersService.js';

async function cargarListaCarpetas() {
    const folders = await transfersService.getFolders();
    const lista = document.getElementById('folder-list');

    lista.innerHTML = folders.map((folder, idx) => `
        <li>
            ${folder}
            <button onclick="eliminarCarpeta(${idx})">❌</button>
        </li>
    `).join('');
}

async function añadirCarpeta() {
    const ruta = prompt('Introduce la ruta de la carpeta:');
    if (ruta) {
        await transfersService.addFolder(ruta);
        await cargarListaCarpetas();
    }
}

async function eliminarCarpeta(index) {
    const folders = await transfersService.getFolders();
    await transfersService.removeFolder(folders[index]);
    await cargarListaCarpetas();
}

// Inicializar
cargarListaCarpetas();
```

## Debugging

```javascript
// Ver toda la configuración local
const config = await localConfigService.init();
console.log('Configuración completa:', config);

// Ver configuración de un módulo específico
const transfersConfig = await localConfigService.get('transfers');
console.log('Transfers:', transfersConfig);
```
