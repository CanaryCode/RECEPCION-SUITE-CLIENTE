const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/home/ajpd/recepcion-suite/.env' });

async function check() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });
        const [rows] = await connection.query('SHOW COLUMNS FROM notas');
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        if (connection) await connection.end();
    }
}
check();
