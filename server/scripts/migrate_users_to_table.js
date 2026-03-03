const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function migrate() {
    let connection;
    try {
        console.log('--- User Migration: JSON to Table ---');
        
        // 1. Read config.json for initial data
        const configPath = path.join(__dirname, '../../storage/config.json');
        let initialUsers = [];
        try {
            const configData = JSON.parse(await fs.readFile(configPath, 'utf8'));
            initialUsers = configData.HOTEL?.RECEPCIONISTAS || [];
        } catch (e) {
            console.warn('Could not read config.json, will check DB config.');
        }

        // 2. Connect to Database
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'hotel_manager'
        });

        // 3. Create table
        console.log('Creating table usuarios_recepcion...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS usuarios_recepcion (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL UNIQUE,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 4. Try to get users from DB config if config.json was empty
        if (initialUsers.length === 0) {
            const [rows] = await connection.execute('SELECT config_value FROM app_config WHERE config_key = ?', ['HOTEL']);
            if (rows.length > 0) {
                const val = typeof rows[0].config_value === 'string' ? JSON.parse(rows[0].config_value) : rows[0].config_value;
                initialUsers = val.RECEPCIONISTAS || [];
            }
        }

        console.log(`Migrating ${initialUsers.length} users...`);

        // 5. Insert users
        for (const nombre of initialUsers) {
            try {
                await connection.execute(
                    'INSERT IGNORE INTO usuarios_recepcion (nombre) VALUES (?)',
                    [nombre]
                );
                console.log(`✓ User added/already exists: ${nombre}`);
            } catch (e) {
                console.error(`✗ Error adding user ${nombre}:`, e.message);
            }
        }

        console.log('✓ Migration completed!');

    } catch (err) {
        console.error('✗ Migration failed:', err.message);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
