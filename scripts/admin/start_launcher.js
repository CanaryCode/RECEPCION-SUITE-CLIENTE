const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const batName = 'ENCENDER_SERVIDOR.bat';
const exeDir = path.dirname(process.execPath);
let targetDir = process.cwd();

let batPath = path.join(targetDir, batName);
if (!fs.existsSync(batPath)) {
    targetDir = exeDir;
    batPath = path.join(exeDir, batName);
}

if (fs.existsSync(batPath)) {
    // Para el servidor central, solemos correr en la raiz. 
    // Comprobamos si hay node_modules en la subcarpeta server para decidir si mostrar ventana
    const hasNodeModules = fs.existsSync(path.join(targetDir, 'server', 'node_modules'));

    const options = {
        detached: true,
        stdio: 'ignore',
        cwd: targetDir,
        windowsHide: hasNodeModules
    };

    const cmd = 'cmd.exe';
    const args = hasNodeModules
        ? ['/c', 'start', '/b', batName]
        : ['/c', 'start', batName];

    const child = spawn(cmd, args, options);
    child.unref();
}
process.exit(0);
