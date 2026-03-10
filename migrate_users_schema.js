const db = require('./server/db');

async function migrateUsersSchema() {
    try {
        console.log('[MIGRATION] Checking usuarios_recepcion columns...');
        const [columns] = await db.query('SHOW COLUMNS FROM usuarios_recepcion');
        const colNames = columns.map(c => c.Field);

        if (!colNames.includes('password_hash')) {
            console.log('[MIGRATION] Adding column: password_hash');
            await db.query('ALTER TABLE usuarios_recepcion ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL');
        }
        if (!colNames.includes('avatar_url')) {
            console.log('[MIGRATION] Adding column: avatar_url');
            await db.query('ALTER TABLE usuarios_recepcion ADD COLUMN avatar_url TEXT DEFAULT NULL');
        }
        if (!colNames.includes('email')) {
            console.log('[MIGRATION] Adding column: email');
            await db.query('ALTER TABLE usuarios_recepcion ADD COLUMN email VARCHAR(255) DEFAULT NULL');
        }
        if (!colNames.includes('display_name')) {
            console.log('[MIGRATION] Adding column: display_name');
            await db.query('ALTER TABLE usuarios_recepcion ADD COLUMN display_name VARCHAR(255) DEFAULT NULL');
        }

        console.log('[MIGRATION] Database schema updated successfully.');
    } catch (err) {
        console.error('[MIGRATION ERROR]', err);
    } finally {
        process.exit();
    }
}

migrateUsersSchema();
