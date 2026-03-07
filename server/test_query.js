const db = require('./db');

async function test() {
    console.log("Testing chat history query...");
    try {
        const recipient = null;
        const sender = null;
        
        const [rows] = await db.query(
            `SELECT * FROM chat_messages 
             WHERE (recipient IS NULL AND ?) 
                OR (sender = ? AND recipient = ?) 
                OR (sender = ? AND recipient = ?)
             ORDER BY created_at DESC LIMIT 50`,
            [recipient === null, sender, recipient, recipient, sender]
        );
        console.log("Success. Rows:", rows.length);
    } catch(err) {
        console.error("TEST FAILED:", err);
    }
    process.exit(0);
}

test();
