const fs = require('fs');
const Client = require('ssh2-sftp-client');
const sftp = new Client();

const config = {
  host: 'antoniojesus.ddns.net',
  username: 'ajpd',
  password: 'gravina82'
};

async function main() {
  try {
    console.log('Connecting to remote server...');
    await sftp.connect(config);
    
    const remotePath = '/home/ajpd/recepcion-suite/server';
    
    console.log('Uploading fix_ints.js...');
    await sftp.put('server/scripts/fix_ints.js', `${remotePath}/scripts/fix_ints.js`);
    console.log('Done.');
    
  } catch (err) {
    console.error('Deployment failed:', err);
  } finally {
    await sftp.end();
  }
}

main();
