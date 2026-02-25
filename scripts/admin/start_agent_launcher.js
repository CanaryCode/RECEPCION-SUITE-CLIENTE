const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const batName = 'ENCENDER_AGENTE.bat';
const exeDir = path.dirname(process.execPath);
let targetDir = process.cwd();

// Prioridad: 1. Directorio de trabajo, 2. Directorio del ejecutable
let batPath = path.join(targetDir, batName);
if (!fs.existsSync(batPath)) {
    targetDir = exeDir;
    batPath = path.join(exeDir, batName);
}

if (fs.existsSync(batPath)) {
    const hasNodeModules = fs.existsSync(targetDir === exeDir ? path.join(exeDir, 'node_modules') : path.join(process.cwd(), 'node_modules'));

    // Si no hay node_modules, abrimos una ventana para que se vea la instalacion
    // Si ya existe, corremos en segundo plano (oculto)
    const options = {
        detached: true,
        stdio: 'ignore',
        cwd: targetDir,
        windowsHide: hasNodeModules // TRUE = Oculta la ventana si ya esta instalado
    };

    const cmd = 'cmd.exe';
    const args = hasNodeModules
        ? ['/c', 'start', '/b', batName] // /b para que no cree ventana nueva si se lanza desde cmd, pero aqui dependemos de windowsHide
        : ['/c', 'start', batName];     // Sin /b para que se vea la instalacion si es necesario

    const child = spawn(cmd, args, options);
    child.unref();
}
process.exit(0);
