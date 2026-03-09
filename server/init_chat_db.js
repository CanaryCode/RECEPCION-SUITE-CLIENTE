const db = require('./db');

async function init() {
    try {
        console.log('Iniciando creación de tabla de presencia...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS chat_user_presence (
                username VARCHAR(50) PRIMARY KEY,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_online TINYINT(1) DEFAULT 0
            )
        `);
        console.log('Tabla chat_user_presence verificada/creada.');
        process.exit(0);
    } catch (err) {
        console.error('Error inicializando DB:', err);
        process.exit(1);
    }
}

init();
