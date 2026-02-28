/**
 * TESTS UNITARIOS — Lógica de BaseService
 * =========================================
 * Testa la lógica pura de BaseService: validate(), _ensureArray() y operaciones CRUD en arrays.
 * No requiere navegador ni servidor. Las dependencias de browser (LocalStorage, SyncManager)
 * se reemplazan por stubs ligeros.
 *
 * Ejecutar: node tests/unit/service_logic.test.js
 */

// ─── Mini Test Runner ──────────────────────────────────────────────────────
let passed = 0, failed = 0;

function assert(condition, label) {
    if (condition) { console.log(`  ✅ ${label}`); passed++; }
    else { console.error(`  ❌ FAILED: ${label}`); failed++; }
}
function assertThrows(fn, expectedMsg, label) {
    try { fn(); console.error(`  ❌ FAILED (no lanzó): ${label}`); failed++; }
    catch (e) {
        if (e.message.includes(expectedMsg)) { console.log(`  ✅ ${label}`); passed++; }
        else { console.error(`  ❌ FAILED (mensaje incorrecto: "${e.message}"): ${label}`); failed++; }
    }
}
function group(name, fn) { console.log(`\n[${name}]`); fn(); }

// ─── Stub de BaseService (lógica pura extraída, sin deps de browser) ───────
class ServiceStub {
    constructor(defaultValue = [], schema = null) {
        this.defaultValue = defaultValue;
        this.schema = schema;
        this.cache = Array.isArray(defaultValue) ? [] : {};
    }

    // validate() — copia exacta de BaseService
    validate(data) {
        if (!this.schema) return true;
        let items = [];
        if (Array.isArray(this.defaultValue)) {
            items = Array.isArray(data) ? data : [data];
        } else {
            const isSingleton = this.schema && Object.keys(this.schema).every(k => k in this.defaultValue);
            if (isSingleton) { items = [data]; }
            else { items = data ? Object.values(data) : []; }
        }
        for (const item of items) {
            for (const [key, type] of Object.entries(this.schema)) {
                if (!(key in item)) throw new Error(`Campo requerido faltante: ${key}`);
                const actualType = typeof item[key];
                if (type === 'number') {
                    if (typeof item[key] === 'string' && item[key].trim() !== '' && !isNaN(Number(item[key]))) { /* ok */ }
                    else if (typeof item[key] !== 'number' || isNaN(item[key])) throw new Error(`El campo '${key}' debe ser un número válido.`);
                } else if (actualType !== type && type !== 'any') {
                    throw new Error(`Tipo de dato inválido para '${key}': esperado ${type}, recibido ${actualType}`);
                }
            }
        }
        return true;
    }

    // _ensureArray() — copia exacta de BaseService
    _ensureArray(data) {
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object') {
            const isSingleItem = this.schema && Object.keys(this.schema).some(k => k in data);
            if (isSingleItem) return [data];
            return Object.values(data);
        }
        return [];
    }

    // Operaciones CRUD simplificadas (sin I/O)
    save(data) {
        if (Array.isArray(this.defaultValue)) data = this._ensureArray(data);
        this.validate(data);
        this.cache = data;
        return data;
    }
    add(item) { return this.save([...this._ensureArray(this.cache), item]); }
    update(id, data, idField = 'id') {
        const array = this._ensureArray(this.cache);
        const idx = array.findIndex(x => x[idField] == id);
        if (idx === -1) return this.add(data);
        const newAll = [...array];
        newAll[idx] = { ...newAll[idx], ...data };
        return this.save(newAll);
    }
    delete(id, idField = 'id') {
        return this.save(this._ensureArray(this.cache).filter(x => x[idField] != id));
    }
    getAll() { return this.cache; }
}

// ─── Tests de validate() ─────────────────────────────────────────────────
group('validate() — schema enforcement', () => {
    const svc = new ServiceStub([], { id: 'number', concepto: 'string' });

    assert(svc.validate([{ id: 1, concepto: 'Test' }]) === true,
        'Array válido pasa validación');
    assert(svc.validate([{ id: '5', concepto: 'Test' }]) === true,
        'id como string numérico es aceptado');
    assertThrows(
        () => svc.validate([{ id: 1 }]),
        'Campo requerido faltante: concepto',
        'Lanza error si falta campo requerido'
    );
    assertThrows(
        () => svc.validate([{ id: 'abc', concepto: 'Test' }]),
        "debe ser un número válido",
        'Lanza error si id no es número válido'
    );
    assertThrows(
        () => svc.validate([{ id: 1, concepto: 99 }]),
        "Tipo de dato inválido para 'concepto'",
        'Lanza error si tipo es incorrecto'
    );

    const svcNoSchema = new ServiceStub([]);
    assert(svcNoSchema.validate([{ cualquier: 'cosa' }]) === true,
        'Sin schema: cualquier dato pasa');
});

// ─── Tests de _ensureArray() ─────────────────────────────────────────────
group('_ensureArray() — normalización de datos', () => {
    const svc = new ServiceStub([], { id: 'number' });

    assert(JSON.stringify(svc._ensureArray([1, 2, 3])) === '[1,2,3]',
        'Array ya es array → devuelve igual');
    assert(JSON.stringify(svc._ensureArray({ id: 1 })) === '[{"id":1}]',
        'Objeto con clave de schema → wrappea en array');
    assert(JSON.stringify(svc._ensureArray({ a: { id: 1 }, b: { id: 2 } })) === '[{"id":1},{"id":2}]',
        'Diccionario {k: item} → extrae valores');
    assert(JSON.stringify(svc._ensureArray(null)) === '[]',
        'Null → array vacío');
    assert(JSON.stringify(svc._ensureArray(undefined)) === '[]',
        'Undefined → array vacío');
});

// ─── Tests de CRUD en arrays ──────────────────────────────────────────────
group('CRUD — add / update / delete', () => {
    const svc = new ServiceStub([]);

    // add
    svc.add({ id: 1, nombre: 'Ana' });
    svc.add({ id: 2, nombre: 'Bob' });
    assert(svc.getAll().length === 2,              'add(): dos elementos añadidos');
    assert(svc.getAll()[0].nombre === 'Ana',       'add(): primer elemento correcto');

    // update existente
    svc.update(1, { nombre: 'Ana García' });
    assert(svc.getAll()[0].nombre === 'Ana García','update(): modifica el elemento correcto');
    assert(svc.getAll().length === 2,              'update(): no añade elemento nuevo');

    // update inexistente → actúa como add
    svc.update(99, { id: 99, nombre: 'Carlos' });
    assert(svc.getAll().length === 3,              'update() de id inexistente → add()');

    // delete
    svc.delete(2);
    assert(svc.getAll().length === 2,              'delete(): elimina el elemento');
    assert(!svc.getAll().find(x => x.id === 2),   'delete(): el elemento ya no existe');

    // delete inexistente → no crash, no cambio
    const beforeLen = svc.getAll().length;
    svc.delete(999);
    assert(svc.getAll().length === beforeLen,      'delete() de id inexistente → sin cambios');
});

// ─── Tests de save() con schema ──────────────────────────────────────────
group('save() con schema — validación en escritura', () => {
    const svc = new ServiceStub([], { habitacion: 'string', hora: 'string' });

    svc.save([{ habitacion: '101', hora: '08:00' }]);
    assert(svc.getAll().length === 1, 'save(): dato válido guardado correctamente');

    assertThrows(
        () => svc.save([{ habitacion: '101' }]),
        'Campo requerido faltante: hora',
        'save(): lanza error si falta campo obligatorio (no guarda)'
    );
    assert(svc.getAll().length === 1, 'save(): cache no se modifica tras error de validación');
});

// ─── Resumen ─────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`Resultado: ${passed} ✅ pasados, ${failed} ❌ fallados`);
if (failed > 0) process.exit(1);
