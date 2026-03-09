const db = require('./server/db');

async function test() {
    try {
        console.log("Checking chat_messages columns...");
        const [msgCols] = await db.query('SHOW COLUMNS FROM chat_messages');
        console.log("Columns in chat_messages:", msgCols.map(c => c.Field).join(', '));

        console.log("\nChecking chat_user_presence table...");
        const [tables] = await db.query("SHOW TABLES LIKE 'chat_user_presence'");
        if (tables.length > 0) {
            console.log("Table chat_user_presence EXISTS.");
            const [presCols] = await db.query('SHOW COLUMNS FROM chat_user_presence');
            console.log("Columns in chat_user_presence:", presCols.map(c => c.Field).join(', '));
            
            const [rows] = await db.query('SELECT * FROM chat_user_presence');
            console.log("Rows in chat_user_presence:", rows.length);
        } else {
            console.log("Table chat_user_presence DOES NOT EXIST.");
        }
        
        process.exit(0);
    } catch (err) {
        console.error("TEST FAILED:", err);
        process.exit(1);
    }
}

test();
