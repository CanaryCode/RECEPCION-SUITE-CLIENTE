const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function checkSchema() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 1,
        queueLimit: 0
    });

    try {
        console.log('--- TABLE STRUCTURE: chat_messages ---');
        const [columns] = await pool.execute('DESCRIBE chat_messages');
        columns.forEach(col => {
            console.log(`${col.Field}: ${col.Type} (Null: ${col.Null})`);
        });
        
        console.log('\n--- SAMPLE DATA ---');
        const [rows] = await pool.execute('SELECT * FROM chat_messages LIMIT 5');
        console.log(JSON.stringify(rows, null, 2));

    } catch (err) {
        console.error('Error detail:', err);
    } finally {
        await pool.end();
    }
}

checkSchema();
