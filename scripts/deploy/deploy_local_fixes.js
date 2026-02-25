const Client = require('ssh2-sftp-client');
const sftp = new Client();

const config = {
  host: 'antoniojesus.ddns.net',
  username: 'ajpd',
  password: 'gravina82'
};

const basePath = 'C:/Users/jesus/Documents/VSCode/RECEPCION SUITE v2/assets/js';
const remotePath = '/home/ajpd/recepcion-suite/assets/js';

const filesToUpload = [
  { local: `${basePath}/services/BaseService.js`, remote: `${remotePath}/services/BaseService.js` },
  { local: `${basePath}/services/SystemAlarmsService.js`, remote: `${remotePath}/services/SystemAlarmsService.js` },
  { local: `${basePath}/services/ConfigService.js`, remote: `${remotePath}/services/ConfigService.js` },
  { local: `${basePath}/core/SyncManager.js`, remote: `${remotePath}/core/SyncManager.js` }
];

async function main() {
  try {
    console.log('Connecting to remote server...');
    await sftp.connect(config);
    
    for (const file of filesToUpload) {
        console.log(`Uploading ${file.local.split('/').pop()}...`);
        await sftp.put(file.local, file.remote);
    }
    
    console.log('All files deployed successfully.');
  } catch (err) {
    console.error('Deployment failed:', err);
  } finally {
    await sftp.end();
  }
}

main();
