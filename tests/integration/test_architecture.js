const http = require('http');

/**
 * TEST SUITE: Arquitectura Semidistribuida (Seguridad AJPD)
 * --------------------------------------------------------
 * Este script verifica los 3 pilares de seguridad implementados:
 * 1. El Agente Local tiene identidad y es localizable.
 * 2. El Servidor Ubuntu bloquea peticiones sin clave.
 * 3. El Servidor Ubuntu permite peticiones con la clave correcta.
 */

const CONFIG = {
    AGENT_URL: 'http://127.0.0.1:3001',
    SERVER_URL: 'http://127.0.0.1:3000',
    STATION_KEY: 'RS-SECRET-8291-AJPD' // La clave autorizada
};

async function testAgentIdentity() {
    console.log('--- TEST 1: Identidad del Agente ---');
    try {
        const response = await fetch(`${CONFIG.AGENT_URL}/api/auth/id`);
        const data = await response.json();
        if (data.stationId && data.stationKey) {
            console.log('✅ EXITO: Agente detectado y con identidad.');
            return true;
        }
    } catch (e) {
        console.error(`❌ FALLO: El Agente no responde en 127.0.0.1:3001. Error: ${e.message}`);
    }
    return false;
}

async function testServerBlockNoKey() {
    console.log('\n--- TEST 2: Bloqueo sin Clave (Servidor Ubuntu) ---');
    try {
        // Usamos un endpoint que SI esté protegido
        const response = await fetch(`${CONFIG.SERVER_URL}/api/storage/list`);
        if (response.status === 403) {
            console.log('✅ EXITO: El servidor denegó el acceso sin clave (403).');
            return true;
        } else {
            console.error(`❌ FALLO: El servidor respondió con ${response.status} en lugar de 403.`);
        }
    } catch (e) {
        console.error(`❌ FALLO: El servidor central no responde en ${CONFIG.SERVER_URL}. Error: ${e.message}`);
    }
    return false;
}

async function testServerAllowWithKey() {
    console.log('\n--- TEST 3: Acceso con Clave Autorizada ---');
    try {
        const response = await fetch(`${CONFIG.SERVER_URL}/api/storage/list`, {
            headers: { 'X-Station-Key': CONFIG.STATION_KEY }
        });
        if (response.ok) {
            console.log('✅ EXITO: El servidor autorizó la petición con la clave correcta.');
            return true;
        } else {
            console.error(`❌ FALLO: El servidor rechazó una clave válida (${response.status}).`);
        }
    } catch (e) {
        console.error(`❌ FALLO: Error de red al probar la clave: ${e.message}`);
    }
    return false;
}

async function runAllTests() {
    console.log('================================================');
    console.log(' INICIANDO PRUEBAS DE ARQUITECTURA RECEPCION');
    console.log('================================================\n');

    const results = [
        await testAgentIdentity(),
        await testServerBlockNoKey(),
        await testServerAllowWithKey()
    ];

    console.log('\n================================================');
    if (results.every(r => r)) {
        console.log(' 🎉 TODAS LAS PRUEBAS SUPERADAS CON ÉXITO');
    } else {
        console.log(' ⚠️ ALGUNAS PRUEBAS HAN FALLADO');
    }
    console.log('================================================');
}

// Ejecutar si se llama directamente
if (require.main === module) {
    runAllTests();
}

module.exports = { runAllTests };
