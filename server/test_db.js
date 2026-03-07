const db = require('./db');

async function test() {
    try {
        const [rows] = await db.query('SHOW COLUMNS FROM chat_messages');
        console.log("SCHEMA:", JSON.stringify(rows));
        
        const [data] = await db.query('SELECT * FROM chat_messages LIMIT 1');
        console.log("ROW DATA:", JSON.stringify(data));
        
    } catch(err) {
        console.log("DB_ERROR:", err.message);
    }
    process.exit(0);
}

test();
