const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function sync() {
    let connection;
    try {
        console.log('--- Config Sync Utility ---');
        
        // 1. Read config.json
        const configPath = path.join(__dirname, '../../storage/config.json');
        console.log(`Reading config from: ${configPath}`);
        const configData = JSON.parse(await fs.readFile(configPath, 'utf8'));
        
        if (!configData.HOTEL || !configData.HOTEL.RECEPCIONISTAS) {
            throw new Error('RECEPCIONISTAS not found in config.json');
        }
        
        console.log(`Found ${configData.HOTEL.RECEPCIONISTAS.length} receptionists in config.json`);

        // 2. Connect to Database
        console.log('Connecting to database...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'hotel_manager'
        });

        // 3. Get current HOTEL config from DB
        const [rows] = await connection.execute('SELECT config_value FROM app_config WHERE config_key = ?', ['HOTEL']);
        
        let dbHotelConfig = {};
        if (rows.length > 0) {
            let val = rows[0].config_value;
            if (typeof val === 'string') {
                try {
                    dbHotelConfig = JSON.parse(val);
                } catch (e) {
                    console.warn('DB config value is a string but not valid JSON, using empty object.');
                    dbHotelConfig = {};
                }
            } else if (typeof val === 'object' && val !== null) {
                dbHotelConfig = val;
            }
            console.log('Current DB HOTEL config processed.');
        } else {
            console.log('HOTEL config not found in DB, creating new one.');
        }

        // 4. Update RECEPCIONISTAS in the object
        dbHotelConfig.RECEPCIONISTAS = configData.HOTEL.RECEPCIONISTAS;
        
        // Ensure everything is serializable to string before saving
        const criticalFields = ['HABITACIONES', 'STATS_CONFIG', 'SPOTIFY_PLAYLISTS', 'COCKTAIL_CONFIG'];
        criticalFields.forEach(field => {
            if (configData.HOTEL[field] && (!dbHotelConfig[field] || (Array.isArray(dbHotelConfig[field]) && dbHotelConfig[field].length === 0))) {
                console.log(`Syncing missing/empty field: ${field}`);
                dbHotelConfig[field] = configData.HOTEL[field];
            }
        });

        // 5. Save back to DB (EXPLICIT STRINGIFY)
        const finalObj = {};
        Object.entries(dbHotelConfig).forEach(([k, v]) => {
            finalObj[k] = v;
        });

        const updatedValue = JSON.stringify(finalObj);
        await connection.execute(
            'INSERT INTO app_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?',
            ['HOTEL', updatedValue, updatedValue]
        );

        console.log('✓ Success: Database app_config updated successfully.');

    } catch (err) {
        console.error('✗ Error during sync:', err.message);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

sync();
