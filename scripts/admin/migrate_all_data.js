const fs = require('fs').promises;
const path = require('path');
const https = require('https');

const FILE_TO_KEY = {
    'agenda_contactos.json': 'agenda_contactos',
    'riu_clientes.json': 'riu_clientes',
    'riu_despertadores.json': 'riu_despertadores',
    'riu_safe_rentals.json': 'riu_safe_rentals',
    'riu_novedades.json': 'riu_novedades',
    'riu_notas_permanentes.json': 'riu_notas_permanentes',
    'riu_precios.json': 'riu_precios',
    'riu_estancia_diaria.json': 'riu_estancia_diaria',
    'arqueo_caja.json': 'arqueo_caja',
    'reservas_instalaciones.json': 'reservas_instalaciones',
    'riu_atenciones_v2.json': 'riu_atenciones_v2',
    'riu_cenas_frias.json': 'riu_cenas_frias',
    'riu_desayunos.json': 'riu_desayunos',
    'riu_excursiones.json': 'riu_excursiones',
    'riu_lost_found.json': 'riu_lost_found',
    'riu_rack.json': 'riu_rack',
    'riu_system_alarms.json': 'riu_system_alarms',
    'riu_transfers.json': 'riu_transfers',
    'vales_data.json': 'vales_data',
    'guia_operativa.json': 'guia_operativa',
    'gallery_favorites.json': 'gallery_favorites'
};

const STORAGE_DIR = path.resolve(__dirname, '../../storage');

async function postData(key, data) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(data);
        const options = {
            hostname: '127.0.0.1',
            port: 3000,
            path: `/api/storage/${key}`,
            method: 'POST',
            rejectUnauthorized: false,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        resolve({ success: true });
                    }
                } else {
                    reject(new Error(`Status ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.write(payload);
        req.end();
    });
}

async function startMigration() {
    console.log('--- INICIANDO MIGRACIÓN MASIVA DE DATOS ---');
    try {
        const files = await fs.readdir(STORAGE_DIR);
        for (const file of files) {
            const key = FILE_TO_KEY[file];
            if (!key) continue;

            const filePath = path.join(STORAGE_DIR, file);
            try {
                const rawData = await fs.readFile(filePath, 'utf8');
                const data = JSON.parse(rawData);

                if (rawData.length < 5 && Array.isArray(data) && data.length === 0) {
                    console.log(`[EMPTY] ${file} saltado.`);
                    continue;
                }

                console.log(`[MIGRATING] ${file} -> Key: ${key}...`);
                await postData(key, data);
            } catch (err) {
                console.error(`  ERROR migrando ${file}: ${err.message}`);
            }
        }
        console.log('--- MIGRACIÓN COMPLETADA ---');
    } catch (err) {
        console.error('CRITICAL ERROR', err);
    } finally {
        process.exit(0);
    }
}

startMigration();
