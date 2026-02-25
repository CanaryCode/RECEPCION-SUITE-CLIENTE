const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const batName = 'APAGAR_AGENTE.bat';
const exeDir = path.dirname(process.execPath);
let targetDir = process.cwd();

let batPath = path.join(targetDir, batName);
if (!fs.existsSync(batPath)) {
    targetDir = exeDir;
    batPath = path.join(exeDir, batName);
}

if (fs.existsSync(batPath)) {
    // Apagar siempre es silencioso
    const child = spawn('cmd.exe', ['/c', 'start', '/b', batName], {
        detached: true,
        stdio: 'ignore',
        cwd: targetDir,
        windowsHide: true
    });
    child.unref();
}
process.exit(0);
