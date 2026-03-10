const mysql = require('mysql2/promise');

async function testNotas() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'riu_admin',
    password: 'gravina82',
    database: 'riu_reception'
  });

  try {
    const [rows] = await connection.execute('SELECT id, titulo, modifiedAt FROM riu_notas_permanentes');
    console.log('Notas en BD:');
    rows.forEach(row => {
      console.log(`  ID: ${row.id}, Titulo: ${row.titulo}, modifiedAt: ${row.modifiedAt} (tipo: ${typeof row.modifiedAt})`);
    });
  } finally {
    await connection.end();
  }
}

testNotas().catch(console.error);
