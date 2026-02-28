/**
 * TESTS DE SEGURIDAD — Barrera de Autenticación
 * ==============================================
 * Verifica que el endpoint de autenticación de la barrera de seguridad
 * rechaza correctamente el acceso no autorizado.
 *
 * Este test existe porque la barrera ha fallado ≥2 veces (regla S4).
 * Ejecutar: node tests/security/auth_barrier.test.js
 *
 * Requiere que el servidor esté corriendo en localhost:3000.
 */

const https = require('https');
const http = require('http');

const HOST = 'localhost';
const PORT = 3000;

// ─── Mini runner ───────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(cond, label) {
    if (cond) { console.log(`  ✅ ${label}`); passed++; }
    else { console.error(`  ❌ FAILED: ${label}`); failed++; }
}
function group(name) { console.log(`\n[${name}]`); }

// ─── Helper HTTP ───────────────────────────────────────────────────────────
function get(path) {
    return new Promise((resolve, reject) => {
        const opts = {
            hostname: HOST, port: PORT, path,
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            rejectUnauthorized: false
        };
        // Intentar HTTPS primero, luego HTTP
        const tryHttps = () => {
            const req = https.request(opts, res => {
                let d = '';
                res.on('data', c => d += c);
                res.on('end', () => {
                    try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
                    catch { resolve({ status: res.statusCode, data: d }); }
                });
            });
            req.on('error', () => {
                const req2 = http.request({ ...opts }, res => {
                    let d = '';
                    res.on('data', c => d += c);
                    res.on('end', () => {
                        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
                        catch { resolve({ status: res.statusCode, data: d }); }
                    });
                });
                req2.on('error', reject);
                req2.end();
            });
            req.end();
        };
        tryHttps();
    });
}

async function runTests() {
    console.log('--- TESTS DE BARRERA DE SEGURIDAD ---');
    console.log(`Servidor: ${HOST}:${PORT}\n`);

    // Verificar conectividad
    try {
        await get('/api/heartbeat/');
    } catch (e) {
        console.error('❌ No se puede conectar al servidor. Asegúrate de que está corriendo.');
        process.exit(1);
    }

    // ── Test 1: Sin token → debe rechazar ───────────────────────────────────
    group('Test 1: Auth sin token debe devolver 401');
    try {
        const res = await get('/api/admin/agent-proxy/auth/id');
        assert(res.status === 401, `GET /auth/id sin token → 401 (got ${res.status})`);
        assert(res.data?.error !== undefined, 'Respuesta incluye campo "error"');
        // CRÍTICO: nunca debe devolver stationId si no hay token válido
        assert(!res.data?.stationId, 'Sin token → respuesta NO contiene stationId');
    } catch (e) {
        console.error('  ❌ Error en test 1:', e.message);
        failed++;
    }

    // ── Test 2: Token falso → debe rechazar ─────────────────────────────────
    group('Test 2: Auth con token falso debe devolver 401');
    try {
        const fakeToken = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        const res = await get(`/api/admin/agent-proxy/auth/id?token=${fakeToken}`);
        assert(res.status === 401, `GET /auth/id con token falso → 401 (got ${res.status})`);
        assert(!res.data?.stationId, 'Token falso → respuesta NO contiene stationId');
        assert(!res.data?.stationKey, 'Token falso → respuesta NO contiene stationKey');
    } catch (e) {
        console.error('  ❌ Error en test 2:', e.message);
        failed++;
    }

    // ── Test 3: Token vacío → debe rechazar ─────────────────────────────────
    group('Test 3: Auth con token vacío debe devolver 401');
    try {
        const res = await get('/api/admin/agent-proxy/auth/id?token=');
        assert(res.status === 401, `GET /auth/id con token vacío → 401 (got ${res.status})`);
        assert(!res.data?.stationId, 'Token vacío → respuesta NO contiene stationId');
    } catch (e) {
        console.error('  ❌ Error en test 3:', e.message);
        failed++;
    }

    // ── Test 4: local-token sin agente → debe rechazar ──────────────────────
    group('Test 4: local-token sin agente registrado → 404');
    try {
        const res = await get('/api/admin/agent-proxy/local-token');
        // Si no hay agente corriendo en esta red, debe ser 404
        // Si hay agente, puede ser 200 — ambos son válidos dependiendo del entorno
        assert(
            res.status === 404 || res.status === 200,
            `GET /local-token → ${res.status} (404 sin agente, 200 con agente — ambos válidos)`
        );
        // Pero si devuelve 200, debe tener un token real de 32 chars
        if (res.status === 200) {
            assert(
                typeof res.data?.token === 'string' && res.data.token.length === 32,
                'Token presente y con longitud correcta (32 chars)'
            );
        }
    } catch (e) {
        console.error('  ❌ Error en test 4:', e.message);
        failed++;
    }

    // ── Test 5: Verificar que el endpoint de auth está en lista blanca ──────
    // (No requiere autenticación de admin para acceder a él)
    group('Test 5: /auth/id es accesible sin cookie de sesión de admin');
    try {
        const res = await get('/api/admin/agent-proxy/auth/id');
        // Puede ser 401 (sin agente) pero NO debe ser 403 (Forbidden por authMiddleware)
        // El 403 significaría que el endpoint está protegido por el middleware de admin
        assert(res.status !== 403, `Endpoint accesible sin sesión admin (no 403) → got ${res.status}`);
        console.log(`  ℹ️  Status: ${res.status} — ${res.status === 401 ? 'Sin agente activo (correcto en entorno dev)' : 'Agente activo'}`);
    } catch (e) {
        console.error('  ❌ Error en test 5:', e.message);
        failed++;
    }

    // ── Resumen ─────────────────────────────────────────────────────────────
    console.log(`\n${'─'.repeat(40)}`);
    console.log(`Resultado: ${passed} ✅ pasados, ${failed} ❌ fallados`);

    if (failed === 0) {
        console.log('\n🔒 Barrera de seguridad verificada correctamente.');
    } else {
        console.error('\n⚠️  ALERTA: Hay fallos en la barrera de seguridad. Revisar urgentemente.');
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Error crítico:', err.message);
    process.exit(1);
});
