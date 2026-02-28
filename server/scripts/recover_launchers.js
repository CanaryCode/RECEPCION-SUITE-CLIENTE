const fs = require('fs').promises;
const path = require('path');
const db = require('../db');

const BACKUP_PATH = '/home/ajpd/Documentos/VSCode/RECEPCION SUITE v2/storage/config.json';

async function recover() {
    console.log('--- STARTING CONFIGURATION RECOVERY ---');
    
    try {
        // 1. Leer Respaldo
        const backupRaw = await fs.readFile(BACKUP_PATH, 'utf8');
        const backup = JSON.parse(backupRaw);
        
        if (!backup.SYSTEM || !backup.SYSTEM.LAUNCHERS) {
            throw new Error('No se encontraron Lanzadores en el respaldo.');
        }

        console.log(`Found ${backup.SYSTEM.LAUNCHERS.length} launchers in backup.`);

        // 2. Obtener config actual de la DB
        const [rows] = await db.query('SELECT * FROM app_config');
        const currentConfig = {};
        rows.forEach(r => {
            currentConfig[r.config_key] = r.config_value;
        });

        // 3. Actualizar SYSTEM (Lanzadores y Rutas de Galería)
        const system = currentConfig.SYSTEM || {};
        system.LAUNCHERS = backup.SYSTEM.LAUNCHERS;
        system.GALLERY_FOLDERS = backup.SYSTEM.GALLERY_FOLDERS || [];
        system.GALLERY_PATH = backup.SYSTEM.GALLERY_PATH || "";
        
        console.log('Updating SYSTEM config in DB...');
        await db.query('UPDATE app_config SET config_value = ? WHERE config_key = ?', [JSON.stringify(system), 'SYSTEM']);

        // 4. Actualizar HOTEL (Opcional: Si faltan cosas como SPOTIFY o RECEPCIONISTAS que vimos en el backup)
        // Pero el usuario se quejó específicamente de launchers y multimedia (lanzadores y multimedia).
        // El backup tenía RECEPCIONISTAS: ["Pavel", "Javi"...] y el actual tiene lo mismo o parecido?
        // Vamos a asegurar que HOTEL.SPOTIFY_PLAYLISTS esté si estaba en el backup.
        if (backup.HOTEL && backup.HOTEL.SPOTIFY_PLAYLISTS) {
            const hotel = currentConfig.HOTEL || {};
            hotel.SPOTIFY_PLAYLISTS = backup.HOTEL.SPOTIFY_PLAYLISTS;
            console.log('Updating HOTEL config (Spotify Playlists) in DB...');
            await db.query('UPDATE app_config SET config_value = ? WHERE config_key = ?', [JSON.stringify(hotel), 'HOTEL']);
        }

        console.log('--- RECOVERY COMPLETED SUCCESSFULLY ---');
        process.exit(0);
    } catch (err) {
        console.error('CRITICAL ERROR DURING RECOVERY:', err.message);
        process.exit(1);
    }
}

recover();
