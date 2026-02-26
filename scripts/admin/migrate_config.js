const fs = require('fs').promises;
const path = require('path');
const db = require('../../server/db');

async function migrateConfig() {
    try {
        console.log('[MIGRATION] Empezando migración de config.json a la Base de Datos...');

        // 1. Crear tabla app_config
        const createTableSql = `
            CREATE TABLE IF NOT EXISTS app_config (
                config_key VARCHAR(100) PRIMARY KEY,
                config_value JSON
            )
        `;
        await db.pool.query(createTableSql);
        console.log('[MIGRATION] Tabla app_config verificada/creada.');

        // 2. Leer archivo JSON actual
        const configPath = path.resolve(__dirname, '../../storage/config.json');
        const rawData = await fs.readFile(configPath, 'utf8');
        const configObj = JSON.parse(rawData);

        // 3. Insertar secciones en DB
        const connection = await db.pool.getConnection();
        let inserted = 0;
        try {
            await connection.beginTransaction();
            for (const [key, value] of Object.entries(configObj)) {
                await connection.query(
                    'INSERT INTO app_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)',
                    [key, JSON.stringify(value)]
                );
                inserted++;
            }
            await connection.commit();
            console.log(`[MIGRATION] Éxito. Migradas ${inserted} secciones de configuración a MariaDB.`);
        } catch (e) {
            await connection.rollback();
            throw e;
        } finally {
            connection.release();
        }

    } catch (err) {
        console.error('[MIGRATION FAILED]', err);
    } finally {
        process.exit(0);
    }
}

migrateConfig();
