
const mysql = require('mysql2/promise');

async function run() {
    console.log('Starting direct DB migration...');
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'hotel_user',
            password: 'Gravina82+',
            database: 'hotel_manager'
        });

        console.log('Connected to MariaDB.');

        const [columns] = await connection.query('SHOW COLUMNS FROM notas');
        const colNames = columns.map(c => c.Field);
        console.log('Existing columns:', colNames.join(', '));

        if (!colNames.includes('protegida')) {
            console.log('Adding protegida...');
            await connection.query('ALTER TABLE notas ADD COLUMN protegida TINYINT(1) DEFAULT 0');
        }
        if (!colNames.includes('favorito')) {
            console.log('Adding favorito...');
            await connection.query('ALTER TABLE notas ADD COLUMN favorito TINYINT(1) DEFAULT 0');
        }
        if (!colNames.includes('modifiedAt')) {
            console.log('Adding modifiedAt...');
            await connection.query('ALTER TABLE notas ADD COLUMN modifiedAt BIGINT DEFAULT NULL');
        }

        console.log('Migration finished successfully.');
        await connection.end();
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

run();
