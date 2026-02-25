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
    
    console.log('Uploading schema.sql...');
    await sftp.put('server/schema.sql', `${remotePath}/schema.sql`);
    
    console.log('Uploading storage.js...');
    await sftp.put('server/routes/storage.js', `${remotePath}/routes/storage.js`);
    
    console.log('Uploading fix_arqueo.js...');
    await sftp.put('server/scripts/fix_arqueo.js', `${remotePath}/scripts/fix_arqueo.js`);
    
    console.log('All files uploaded successfully.');
    
  } catch (err) {
    console.error('Deployment failed:', err);
  } finally {
    await sftp.end();
  }
}

main();
