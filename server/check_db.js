const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'Gravina82+',
            database: process.env.DB_NAME || 'hotel_manager'
        });
        console.log('Connected!');
        const [rows] = await connection.execute('SELECT id, username FROM admin_users');
        console.log('Users:', rows);
        await connection.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

check();
