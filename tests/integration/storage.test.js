const http = require('http');
const fs = require('fs').promises;
const path = require('path');

const API_HOST = 'localhost';
const API_PORT = 3000;
const API_PATH = '/api/storage';
const STORAGE_DIR = path.resolve(__dirname, '../../storage');

async function request(method, key, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const options = {
            hostname: API_HOST,
            port: API_PORT,
            path: `${API_PATH}/${key}`,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = http.request(options, (res) => {
            let resData = '';
            res.on('data', (chunk) => resData += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(resData);
                    if (res.statusCode >= 400) reject({ status: res.statusCode, data: parsed });
                    else resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    reject({ status: res.statusCode, error: 'Invalid JSON response' });
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.write(body);
        req.end();
    });
}

async function runTests() {
    console.log('--- STARTING TRANSACTION INTEGRITY TESTS (NATIVE) ---');

    // 1. TEST: SUCCESSFUL SAVE
    console.log('\n[Test 1] Successful Save (Atomicity)...');
    const testData = [
        { id: 9991, titulo: 'Test Nota 1', contenido: 'Contenido 1', color: 'note-yellow' },
        { id: 10001, titulo: 'Test Nota 2', contenido: 'Contenido 2', color: 'note-blue' }
    ];

    try {
        const res = await request('POST', 'riu_notas_permanentes', testData);
        console.log('  Response status:', res.status);
        console.log('  Source reported by API:', res.data.source);

        const jsonContent = await fs.readFile(path.join(STORAGE_DIR, 'riu_notas_permanentes.json'), 'utf8');
        const parsedJson = JSON.parse(jsonContent);
        if (parsedJson.length >= 2 && parsedJson.some(n => n.titulo === 'Test Nota 2')) {
            console.log('  ✅ SUCCESS: JSON synchronized correctly.');
        } else {
            console.error('  ❌ FAILURE: JSON sync mismatch.');
        }
    } catch (err) {
        console.error('  ❌ ERROR in Test 1:', err);
    }

    // 2. TEST: FORCED FAILURE & ROLLBACK
    console.log('\n[Test 2] Forced Failure & Rollback (Integrity)...');
    
    // First, save a valid state
    const initialState = [{ habitacion: 'T101', fecha_inicio: '2026-01-01', fecha_fin: '2026-01-05' }];
    await request('POST', 'riu_safe_rentals', initialState);
    console.log('  Initial state saved (Hab T101).');

    // Now send a batch that violates UNIQUE constraint (two for 'T102')
    const badData = [
        { habitacion: 'T102', fecha_inicio: '2026-02-01', fecha_fin: '2026-02-05' },
        { habitacion: 'T102', fecha_inicio: '2026-03-01', fecha_fin: '2026-03-05' } // DUPLICATE HAB
    ];

    try {
        await request('POST', 'riu_safe_rentals', badData);
        console.error('  ❌ ERROR: The request should have failed but succeeded.');
    } catch (err) {
        console.log('  ✅ SUCCESS: Request failed as expected:', err.data?.error || err.error || err.message);
        
        // Verify JSON was NOT updated (should still have initialState)
        const jsonContent = await fs.readFile(path.join(STORAGE_DIR, 'riu_safe_rentals.json'), 'utf8');
        const parsedJson = JSON.parse(jsonContent);
        if (parsedJson.length === 1 && parsedJson[0].habitacion === 'T101') {
            console.log('  ✅ SUCCESS: Rollback confirmed. JSON remains at initial state.');
        } else {
            console.error('  ❌ FAILURE: Rollback verification failed! State was changed.');
        }
    }

    console.log('\n--- TESTS FINISHED ---');
}

runTests().catch(err => {
    console.error('Critical test error:', err);
    process.exit(1);
});
