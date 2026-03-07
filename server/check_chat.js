const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function checkMessages() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const [rows] = await pool.execute('SELECT id, sender, receiver, created_at FROM chat_messages ORDER BY created_at ASC LIMIT 50');
        console.log('Total messages (first 50):', rows.length);
        rows.forEach(row => {
            console.log(`ID: ${row.id}, From: ${row.sender}, To: ${row.receiver}, Created: ${row.created_at}`);
        });
        
        const [count] = await pool.execute('SELECT COUNT(*) as total FROM chat_messages');
        console.log('Total messages in DB:', count[0].total);
        
        const now = new Date();
        console.log('Current server time:', now.toISOString());
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkMessages();
