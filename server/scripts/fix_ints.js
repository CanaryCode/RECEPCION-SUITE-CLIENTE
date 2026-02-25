const db = require('../db');

async function fixIds() {
    const tablesWithId = [
        'clientes_riu', 'safe_rentals', 'despertadores', 'novedades',
        'notas', 'precios', 'agenda_contactos', 'guia_checks', 'gallery_favorites'
    ];
    
    console.log('Starting BIGINT migration...');
    for (const table of tablesWithId) {
        try {
            console.log(`Altering table ${table}...`);
            await db.query(`ALTER TABLE \`${table}\` MODIFY id BIGINT AUTO_INCREMENT`);
            console.log(`Success: ${table}`);
        } catch (e) {
            console.error(`Error altering ${table}:`, e.message);
        }
    }
    
    console.log('Migration finished.');
    process.exit(0);
}

fixIds();
