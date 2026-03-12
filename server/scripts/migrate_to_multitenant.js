const db = require('../db');

/**
 * MIGRATE TO MULTI-TENANT
 * Adds 'hotel_id' to all relevant tables and assigns existing data to Garoé (ID 1).
 */
async function migrate() {
    console.log('--- STARTING MULTI-TENANT MIGRATION ---');

    const tables = [
        'agenda_contactos',
        'alarm_log',
        'arqueo_caja',
        'atenciones',
        'calendario_eventos',
        'cenas_frias',
        'chat_messages',
        'clientes_riu',
        'desayunos',
        'despertadores',
        'estancia_diaria',
        'guia_checks',
        'guia_operativa',
        'lost_found',
        'notas',
        'novedades',
        'precios',
        'rack_status',
        'registro_excursiones',
        'reservas_instalaciones',
        'safe_rentals',
        'system_alarms',
        'transfers',
        'turnos_empleados',
        'usuarios_recepcion',
        'vales'
    ];

    for (const table of tables) {
        try {
            console.log(`Checking table: ${table}`);
            
            // Verificamos si la tabla de verdad existe sin params en SHOW TABLES (algunos drivers dan guerra)
            const [tablesResult] = await db.query(`SHOW TABLES LIKE '${table}'`);
            if (tablesResult.length === 0) {
                console.warn(`[SKIP] Table ${table} does not exist in DB.`);
                continue;
            }

            // Check if column exists
            const [columns] = await db.query(`SHOW COLUMNS FROM \`${table}\` LIKE 'hotel_id'`);
            
            if (columns.length === 0) {
                console.log(`[ADD] Adding hotel_id column to ${table}...`);
                // Usamos un bloque TRY/CATCH específico por si se interrumpió y ya existe
                try {
                    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN hotel_id INT NOT NULL DEFAULT 1`);
                    await db.query(`ALTER TABLE \`${table}\` ADD INDEX hotel_id_idx (hotel_id)`);
                    console.log(`[OK] Column hotel_id added to ${table}.`);
                } catch (alterErr) {
                    console.warn(`[INFO] Could not add column/index to ${table} (maybe already exists): ${alterErr.message}`);
                }
            } else {
                console.log(`[EXIST] Column hotel_id already exists in ${table}.`);
            }

            // Ensure all data has hotel_id = 1 (enforcing default)
            await db.query(`UPDATE \`${table}\` SET hotel_id = 1 WHERE hotel_id IS NULL OR hotel_id = 0`);

        } catch (err) {
            console.error(`[ERROR] Failed to migrate table ${table}:`, err.message);
        }
    }

    console.log('--- MIGRATION COMPLETED ---');
    process.exit(0);
}

migrate();
 biological_danger_zone: true
