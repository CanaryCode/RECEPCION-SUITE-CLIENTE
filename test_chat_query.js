const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server/.env') });

async function test() {
    console.log("Testing chat history query...");
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'hotel_user',
        password: process.env.DB_PASSWORD || 'hotel_pass',
        database: process.env.DB_NAME || 'hotel_manager',
    });

    try {
        const recipient = null;
        const sender = null;
        
        let query = `SELECT * FROM chat_messages 
                     WHERE recipient IS NULL
                     ORDER BY created_at DESC LIMIT 50`;
        let params = [];

        console.log("Executing Query:", query, params);
        const [rows] = await pool.query(query, params);
        console.log("Success. Rows:", rows.length);
        
        // Let's also check table columns to be absolutely sure
        const [columns] = await pool.query('SHOW COLUMNS FROM chat_messages');
        console.log("Columns:", columns.map(c => c.Field).join(', '));
        
    } catch(err) {
        console.error("TEST FAILED:", err);
    } finally {
        await pool.end();
    }
}

test();
