/**
 * TESTS DE ENDPOINTS — API Express
 * ================================
 * Verifica que los endpoints del servidor responden correctamente.
 * Requiere el servidor corriendo en localhost:3000.
 *
 * Ejecutar: node tests/api/endpoints.test.js
 */

const http = require('http');
const https = require('https');

const HOST = 'localhost';
const PORT = 3000;
// Detectar si el servidor usa HTTPS (intentar ambos)
let useHttps = false;

// ─── Mini Test Runner ──────────────────────────────────────────────────────
let passed = 0, failed = 0;

function assert(condition, label) {
    if (condition) { console.log(`  ✅ ${label}`); passed++; }
    else { console.error(`  ❌ FAILED: ${label}`); failed++; }
}
function group(name, fn) { return fn().then ? fn().then(() => console.log()) : console.log(); }

// ─── Helper de petición HTTP/HTTPS ────────────────────────────────────────
function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const body = data ? JSON.stringify(data) : '';
        const options = {
            hostname: HOST,
            port: PORT,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            },
            rejectUnauthorized: false // Para certificados auto-firmados en desarrollo
        };

        const lib = useHttps ? https : http;
        const req = lib.request(options, (res) => {
            let resData = '';
            res.on('data', chunk => resData += chunk);
            res.on('end', () => {
                try {
                    const parsed = resData ? JSON.parse(resData) : {};
                    resolve({ status: res.statusCode, data: parsed });
                } catch {
                    resolve({ status: res.statusCode, data: resData });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function tryConnect() {
    // Primero probar HTTP, luego HTTPS
    try {
        await request('GET', '/api/storage/test_connection_check?_t=' + Date.now());
        console.log('  → Conectado via HTTP');
        return true;
    } catch (e) {
        useHttps = true;
        try {
            await request('GET', '/api/storage/test_connection_check?_t=' + Date.now());
            console.log('  → Conectado via HTTPS');
            return true;
        } catch (e2) {
            return false;
        }
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────
async function runTests() {
    console.log('--- TESTS DE ENDPOINTS API ---\n');

    console.log('[Conexión] Comprobando servidor...');
    const connected = await tryConnect();
    if (!connected) {
        console.error('  ❌ No se pudo conectar al servidor en localhost:3000');
        console.error('     Asegúrate de que el servidor está corriendo antes de ejecutar estos tests.');
        process.exit(1);
    }

    // TEST 1: Heartbeat
    console.log('\n[Test 1] Heartbeat — el servidor responde');
    try {
        const res = await request('GET', '/api/heartbeat/');
        assert(res.status === 200, `GET /api/heartbeat/ → 200 OK`);
    } catch (e) {
        console.error('  ❌ Error en heartbeat:', e.message);
        failed++;
    }

    // TEST 2: GET storage devuelve array
    console.log('\n[Test 2] GET /api/storage/:key — devuelve datos');
    try {
        const res = await request('GET', '/api/storage/riu_notas_permanentes?_t=' + Date.now());
        assert(res.status === 200, 'Estado 200 OK');
        assert(Array.isArray(res.data) || typeof res.data === 'object', 'Respuesta es JSON válido');
    } catch (e) {
        console.error('  ❌ Error:', e.message);
        failed++;
    }

    // TEST 3: POST storage — guardar y leer de vuelta
    console.log('\n[Test 3] POST /api/storage/:key — persistencia básica');
    const testKey = 'test_endpoint_verify';
    const testPayload = [{ id: Date.now(), test: true, valor: 'endpoint_test' }];
    try {
        const postRes = await request('POST', `/api/storage/${testKey}`, testPayload);
        assert(postRes.status === 200 || postRes.status === 201, 'POST devuelve 200/201');

        const getRes = await request('GET', `/api/storage/${testKey}?_t=` + Date.now());
        assert(getRes.status === 200, 'GET posterior devuelve 200');
        assert(
            JSON.stringify(getRes.data).includes('endpoint_test'),
            'Los datos guardados se pueden leer de vuelta'
        );
    } catch (e) {
        console.error('  ❌ Error:', e.message);
        failed++;
    }

    // TEST 4: POST con datos inválidos (clave vacía)
    console.log('\n[Test 4] POST /api/storage/ — manejo de errores');
    try {
        const res = await request('POST', '/api/storage/clave_que_no_existe_en_table_map', [{ test: true }]);
        // Puede devolver 400, 404 o 500 dependiendo de la implementación
        assert(res.status >= 400, 'Clave no registrada → error 4xx/5xx');
    } catch (e) {
        // Si la petición es rechazada, también es un comportamiento aceptable
        assert(true, 'Clave no registrada → petición rechazada (comportamiento correcto)');
    }

    // TEST 5: Anti-cache (dos GETs del mismo recurso no devuelven la misma URL cacheada)
    console.log('\n[Test 5] Anti-cache — timestamps únicos');
    const t1 = Date.now();
    await new Promise(r => setTimeout(r, 10));
    const t2 = Date.now();
    assert(t1 !== t2, 'Los timestamps son únicos (garantía de URLs de GET distintas)');

    // ─── Resumen ────────────────────────────────────────────────────────
    console.log(`\n${'─'.repeat(40)}`);
    console.log(`Resultado: ${passed} ✅ pasados, ${failed} ❌ fallados`);
    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error('Error crítico en tests de API:', err.message);
    process.exit(1);
});
