const { execSync } = require('child_process');
const fs = require('fs');
let output = '';

try {
    const list = execSync('pm2 jlist', { encoding: 'utf-8' });
    const apps = JSON.parse(list);
    apps.forEach(app => {
        output += `App: ${app.name}\n`;
        output += `  Status: ${app.pm2_env.status}\n`;
        output += `  File: ${app.pm2_env.pm_exec_path}\n`;
        output += `  CWD: ${app.pm2_env.pm_cwd}\n\n`;
    });
} catch(e) {
    output = "Error checking PM2 directly via script: " + e.message;
}

try {
    fs.writeFileSync('/home/ajpd/recepcion-suite/storage/pm2_check.txt', output);
} catch(e) {
    console.error("Could not write pm2 check", e.message);
}
