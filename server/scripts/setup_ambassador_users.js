const db = require('../db');

/**
 * SETUP AMBASSADOR USERS
 * 1. Adjusts UNIQUE constraint to allow same name in different hotels.
 * 2. Adds Johanna, Elisa, Yulimar, Jose Luis to Ambassador (ID 2).
 * 3. Copies Antonio to Ambassador (he remains in Garoé too).
 */
async function run() {
    console.log('--- Setting up Ambassador Users ---');
    
    try {
        // 1. Drop old unique index
        console.log('Dropping old UNIQUE index (nombre)...');
        try {
            await db.query('ALTER TABLE usuarios_recepcion DROP INDEX nombre');
        } catch (e) {
            console.log('Index "nombre" already dropped or not found.');
        }

        // 2. Add new composite unique index
        console.log('Adding new UNIQUE index (nombre, hotel_id)...');
        try {
            await db.query('ALTER TABLE usuarios_recepcion ADD UNIQUE INDEX nombre_hotel_idx (nombre, hotel_id)');
        } catch (e) {
            console.log('Index "nombre_hotel_idx" already exists.');
        }

        // 3. Insert users for Ambassador (hotel_id = 2)
        const ambassadorUsers = [
            'Johanna',
            'Elisa',
            'Yulimar',
            'Jose Luis',
            'Antonio'
        ];

        for (const name of ambassadorUsers) {
            console.log(`Processing user: ${name} for Ambassador...`);
            
            // Check if already exists for ID 2
            const [existing] = await db.query('SELECT id FROM usuarios_recepcion WHERE nombre = ? AND hotel_id = 2', [name]);
            
            if (existing.length === 0) {
                // If Antonio, copy his data from ID 1 if possible
                if (name === 'Antonio') {
                    const [garoeAntonio] = await db.query('SELECT * FROM usuarios_recepcion WHERE nombre = "Antonio" AND hotel_id = 1');
                    if (garoeAntonio.length > 0) {
                        const u = garoeAntonio[0];
                        await db.query(
                            'INSERT INTO usuarios_recepcion (nombre, activo, password_hash, avatar_url, email, display_name, hotel_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [u.nombre, u.activo, u.password_hash, u.avatar_url, u.email, u.display_name, 2]
                        );
                        console.log(`[OK] Antonio copied to Ambassador.`);
                        continue;
                    }
                }
                
                await db.query('INSERT INTO usuarios_recepcion (nombre, hotel_id, activo) VALUES (?, 2, 1)', [name]);
                console.log(`[OK] ${name} inserted for Ambassador.`);
            } else {
                console.log(`[SKIP] ${name} already exists for Ambassador.`);
            }
        }

        console.log('--- DONE ---');
        process.exit(0);
    } catch (err) {
        console.error('FATAL ERROR:', err);
        process.exit(1);
    }
}

run();
 biological_danger_zone: true
