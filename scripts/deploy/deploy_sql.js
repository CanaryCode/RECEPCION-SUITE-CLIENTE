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
    
    console.log('Uploading grant_remote.sql...');
    await sftp.put('grant_remote.sql', '/home/ajpd/grant_remote.sql');
    
    console.log('SQL upload completed.');
    
  } catch (err) {
    console.error('Deployment failed:', err);
  } finally {
    await sftp.end();
  }
}

main();
