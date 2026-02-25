const fs = require('fs').promises;
const path = require('path');
const db = require('../db');

const STORAGE_DIR = path.resolve(__dirname, '../../storage');

const TABLE_MAP = {
    'riu_despertadores': 'despertadores',
    'riu_safe_rentals': 'safe_rentals',
    'riu_novedades': 'novedades',
    'riu_notas_permanentes': 'notas',
    'riu_precios': 'precios',
    'riu_agenda_contactos': 'agenda_contactos',
    'riu_estancia_diaria': 'estancia_diaria',
    'riu_class_db': 'clientes_riu'
};

async function migrate() {
    console.log('--- STARTING DATA MIGRATION: JSON -> MariaDB ---');

    for (const [key, tableName] of Object.entries(TABLE_MAP)) {
        const filePath = path.join(STORAGE_DIR, `${key}.json`);
        
        try {
            console.log(`Processing: ${key} -> ${tableName}`);
            const dataRaw = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(dataRaw);

            if (!Array.isArray(data)) {
                console.log(`Skipping ${key}: Data is not an array.`);
                continue;
            }

            if (data.length === 0) {
                console.log(`Skipping ${key}: Array is empty.`);
                continue;
            }

            // Clear table
            await db.query(`DELETE FROM \`${tableName}\``);
            console.log(`  Cleared table ${tableName}`);

            // Insert data
            const columns = Object.keys(data[0]);
            const placeholders = columns.map(() => '?').join(', ');
            const sql = `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES (${placeholders})`;

            let successCount = 0;
            for (const item of data) {
                try {
                    const values = columns.map(col => {
                        let val = item[col];
                        if (typeof val === 'boolean') return val ? 1 : 0;
                        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
                        return val;
                    });
                    await db.query(sql, values);
                    successCount++;
                } catch (itemErr) {
                    console.error(`  Error inserting item into ${tableName}:`, itemErr.message);
                }
            }
            console.log(`  Successfully migrated ${successCount}/${data.length} records.`);

        } catch (err) {
            if (err.code === 'ENOENT') {
                console.log(`  File ${key}.json not found. Skipping.`);
            } else {
                console.error(`  Error migrating ${key}:`, err.message);
            }
        }
    }

    console.log('--- MIGRATION FINISHED ---');
    process.exit(0);
}

migrate();
