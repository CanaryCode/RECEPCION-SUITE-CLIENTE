const db = require('./db');

async function checkSchema() {
    try {
        const [columns] = await db.query('SHOW COLUMNS FROM notas');
        console.log(JSON.stringify(columns, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
