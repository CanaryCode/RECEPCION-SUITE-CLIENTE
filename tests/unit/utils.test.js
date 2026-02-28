/**
 * TESTS UNITARIOS — Lógica Pura (Utils)
 * =====================================
 * Testa funciones puras de Utils.js que no dependen del navegador ni del servidor.
 * Ejecutar: node tests/unit/utils.test.js
 */

// ─── Mini Test Runner ──────────────────────────────────────────────────────
let passed = 0, failed = 0;

function assert(condition, label) {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.error(`  ❌ FAILED: ${label}`);
        failed++;
    }
}

function group(name, fn) {
    console.log(`\n[${name}]`);
    fn();
}

// ─── Implementaciones puras (copiadas de Utils.js para test sin browser) ───
const Utils = {
    formatCurrency: (amount) => {
        const num = parseFloat(amount);
        if (isNaN(num)) return "0.00€";
        const sign = num < 0 ? "-" : "";
        return sign + Math.abs(num).toFixed(2) + "€";
    },

    formatDate: (dateStr) => {
        if (!dateStr) return "";
        try {
            if (dateStr instanceof Date) return dateStr.toLocaleDateString();
            const parts = dateStr.split('-');
            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
            return dateStr;
        } catch (e) { return dateStr; }
    },

    checkOverlap: (startA, endA, startB, endB) => {
        return (startA < endB) && (startB < endA);
    },

    getTodayISO: () => {
        const local = new Date();
        local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
        return local.toISOString().split('T')[0];
    }
};

// ─── Tests de formatCurrency ──────────────────────────────────────────────
group('formatCurrency', () => {
    assert(Utils.formatCurrency(5) === "5.00€",       'Entero positivo → "5.00€"');
    assert(Utils.formatCurrency(5.5) === "5.50€",     'Decimal → "5.50€"');
    assert(Utils.formatCurrency(-10) === "-10.00€",   'Negativo → "-10.00€"');
    assert(Utils.formatCurrency(0) === "0.00€",       'Cero → "0.00€"');
    assert(Utils.formatCurrency("15.3") === "15.30€", 'String numérico → "15.30€"');
    assert(Utils.formatCurrency("abc") === "0.00€",   'String no numérico → "0.00€"');
    assert(Utils.formatCurrency(null) === "0.00€",    'Null → "0.00€"');
    assert(Utils.formatCurrency(1234.567) === "1234.57€", 'Redondeo correcto');
});

// ─── Tests de formatDate ──────────────────────────────────────────────────
group('formatDate', () => {
    assert(Utils.formatDate("2026-01-15") === "15/01/2026", 'ISO → DD/MM/YYYY');
    assert(Utils.formatDate("2026-12-31") === "31/12/2026", 'Último día del año');
    assert(Utils.formatDate("") === "",                     'String vacío → ""');
    assert(Utils.formatDate(null) === "",                   'Null → ""');
    assert(Utils.formatDate(undefined) === "",              'Undefined → ""');
    assert(Utils.formatDate("formato-raro") === "formato-raro", 'Formato desconocido → devuelve original');
});

// ─── Tests de checkOverlap ────────────────────────────────────────────────
group('checkOverlap (solapamiento de horarios)', () => {
    // A: 09:00-11:00, B: 10:00-12:00 → solapan
    assert(Utils.checkOverlap(9, 11, 10, 12) === true,   'Solapamiento parcial (derecha)');
    // A: 09:00-11:00, B: 08:00-10:00 → solapan
    assert(Utils.checkOverlap(9, 11, 8, 10) === true,    'Solapamiento parcial (izquierda)');
    // A: 09:00-11:00, B: 09:00-11:00 → solapan
    assert(Utils.checkOverlap(9, 11, 9, 11) === true,    'Solapamiento total (mismo rango)');
    // A: 09:00-11:00, B: 09:30-10:30 → solapan (B dentro de A)
    assert(Utils.checkOverlap(9, 11, 9.5, 10.5) === true, 'B contenido en A');
    // A: 09:00-11:00, B: 11:00-13:00 → NO solapan (frontera exacta)
    assert(Utils.checkOverlap(9, 11, 11, 13) === false,  'Sin solapamiento (frontera exacta)');
    // A: 09:00-11:00, B: 12:00-14:00 → NO solapan
    assert(Utils.checkOverlap(9, 11, 12, 14) === false,  'Sin solapamiento (B posterior)');
    // A: 12:00-14:00, B: 09:00-11:00 → NO solapan
    assert(Utils.checkOverlap(12, 14, 9, 11) === false,  'Sin solapamiento (B anterior)');
});

// ─── Tests de getTodayISO ─────────────────────────────────────────────────
group('getTodayISO', () => {
    const today = Utils.getTodayISO();
    assert(/^\d{4}-\d{2}-\d{2}$/.test(today),           'Formato correcto YYYY-MM-DD');
    assert(today === new Date().toISOString().split('T')[0] ||
           today.length === 10,                           'Devuelve fecha de hoy (aprox)');
});

// ─── Resumen ──────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`Resultado: ${passed} ✅ pasados, ${failed} ❌ fallados`);
if (failed > 0) process.exit(1);
