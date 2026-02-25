const { Client } = require('ssh2');

const conn = new Client();

const sqlMigration = `
USE hotel_manager;

-- Reparar tabla desayunos
DROP TABLE IF EXISTS desayunos;
CREATE TABLE desayunos (
    habitacion VARCHAR(10) PRIMARY KEY,
    pax INT DEFAULT 1,
    hora VARCHAR(5),
    comentarios TEXT,
    autor VARCHAR(100),
    fecha DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reparar tabla cenas_frias
DROP TABLE IF EXISTS cenas_frias;
CREATE TABLE cenas_frias (
    habitacion VARCHAR(10) PRIMARY KEY,
    pax INT DEFAULT 1,
    obs TEXT,
    comentarios TEXT,
    autor VARCHAR(100),
    fecha DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(`echo gravina82 | sudo -S mysql -u root -p'Gravina82+' -e "${sqlMigration.replace(/"/g, '\\"')}"`, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: 'antoniojesus.ddns.net',
  port: 22,
  username: 'ajpd',
  password: 'gravina82'
});
