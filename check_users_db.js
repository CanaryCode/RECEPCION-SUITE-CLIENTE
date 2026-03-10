const db = require('./server/db');

async function checkUsers() {
    try {
        const [columns] = await db.query('SHOW COLUMNS FROM usuarios_recepcion');
        console.log('Columns:', columns.map(c => c.Field));
        const [rows] = await db.query('SELECT * FROM usuarios_recepcion');
        console.log('Rows:', rows);
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
}

checkUsers();
