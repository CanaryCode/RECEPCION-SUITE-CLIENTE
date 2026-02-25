const fs = require('fs').promises;
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const STORAGE_DIR = path.resolve(__dirname, '../storage');

const TABLE_MAP = {
    // MODULOS PRINCIPALES (Keys usadas por los Services)
    'agenda_contactos': 'agenda_contactos',
    'riu_clientes': 'clientes_riu',
    'riu_despertadores': 'despertadores',
    'riu_safe_rentals': 'safe_rentals',
    'riu_novedades': 'novedades',
    'riu_notas_permanentes': 'notas',
    'riu_precios': 'precios',
    'riu_estancia_diaria': 'estancia_diaria',
    'arqueo_caja': 'arqueo_caja',
    'reservas_instalaciones': 'reservas_instalaciones',
    'riu_atenciones_v2': 'atenciones',
    'riu_cenas_frias': 'cenas_frias',
    'riu_desayunos': 'desayunos',
    'riu_excursiones': 'registro_excursiones',
    'riu_lost_found': 'lost_found',
    'riu_rack': 'rack_status',
    'riu_system_alarms': 'system_alarms',
    'riu_transfers': 'transfers',
    'vales_data': 'vales',
    'guia_operativa': 'guia_operativa',
    'gallery_favorites': 'gallery_favorites',
    
    // ALIAS PARA COMPATIBILIDAD O LEGACY
    'riu_agenda_contactos': 'agenda_contactos',
    'riu_class_db': 'clientes_riu'
};

async function migrate() {
    console.log('--- STARTING JSON TO MARIADB MIGRATION ---');
    
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'hotel_user',
        password: process.env.DB_PASSWORD || 'hotel_pass',
        database: process.env.DB_NAME || 'hotel_manager',
    });

    for (const [jsonKey, tableName] of Object.entries(TABLE_MAP)) {
        const filePath = path.join(STORAGE_DIR, `${jsonKey}.json`);
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);
            
            console.log(`Migrating ${jsonKey} -> ${tableName}...`);
            
            // Normalize to array
            let items = [];
            if (jsonKey === 'guia_operativa') {
                items = Object.entries(data).map(([turno, tareas]) => ({ turno, tareas }));
            } else if (jsonKey === 'gallery_favorites') {
                items = data.map(path => ({ path }));
            } else if (Array.isArray(data)) {
                items = data;
            } else if (typeof data === 'object' && data !== null) {
                // Si es un objeto de objetos (p.e. rack o atenciones)
                items = Object.entries(data).map(([k, v]) => {
                    if (typeof v === 'object') return { habitacion: k, ...v };
                    return { habitacion: k, value: v };
                });
            }

            if (items.length === 0) {
                console.log(`  Skipping ${jsonKey} (empty)`);
                continue;
            }

            // Clear table
            await pool.query(`DELETE FROM \`${tableName}\``);

            // Insert items
            const columns = Object.keys(items[0]);
            const placeholders = columns.map(() => '?').join(', ');
            const sql = `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES (${placeholders})`;

            for (const item of items) {
                const values = columns.map(col => {
                    let val = item[col];
                    if (typeof val === 'boolean') return val ? 1 : 0;
                    if (typeof val === 'object' && val !== null) return JSON.stringify(val);
                    return val === undefined ? null : val;
                });
                await pool.query(sql, values);
            }
            console.log(`  SUCCESS: ${items.length} items migrated.`);
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.log(`  INFO: ${jsonKey}.json not found, skipping.`);
            } else {
                console.error(`  ERROR migrating ${jsonKey}:`, err.message);
            }
        }
    }

    await pool.end();
    console.log('--- MIGRATION FINISHED ---');
}

migrate();
