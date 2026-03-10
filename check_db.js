const mysql = require('mysql2/promise');
require('dotenv').config({ path: './server/.env' });

async function check() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'hotel_user',
        password: process.env.DB_PASSWORD || 'hotel_pass',
        database: process.env.DB_NAME || 'hotel_manager',
    });

    try {
        const [columns] = await pool.query('SHOW COLUMNS FROM notas');
        console.log('--- COLUMNS ---');
        console.log(JSON.stringify(columns, null, 2));

        const [rows] = await pool.query('SELECT * FROM notas LIMIT 5');
        console.log('\n--- ROWS ---');
        console.log(JSON.stringify(rows, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
