const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const db = require('../db');


const STORAGE_DIR = path.resolve(__dirname, '../../storage');
const LOG_FILE = path.join(STORAGE_DIR, 'server_debug.log');

// Helper to log to file (USANDO RUTAS ABSOLUTAS)
const logToFile = (msg) => {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${msg}\n`;
    try {
        if (!fsSync.existsSync(STORAGE_DIR)) {
            fsSync.mkdirSync(STORAGE_DIR, { recursive: true });
        }
        fsSync.appendFileSync(LOG_FILE, entry);
    } catch (e) {
        console.error('CRITICAL: Could not write to log file', e);
    }
};

// Log de inicio
logToFile('--- STORAGE SERVICE INITIALIZED (SQL + JSON) ---');

const TABLE_MAP = {
    // MODULOS PRINCIPALES (Keys usadas por los Services)
    'agenda_contactos': 'agenda_contactos',
    'riu_clientes': 'clientes_riu',
    'riu_despertadores': 'despertadores',
    'riu_safe_rentals': 'safe_rentals',
    'riu_novedades': 'novedades',
    'riu_notas_permanentes': 'notas',
    'riu_precios': 'precios',
    'riu_estancia_diaria': 'estancia_diaria',
    'arqueo_caja': 'arqueo_caja',
    'reservas_instalaciones': 'reservas_instalaciones',
    'riu_atenciones_v2': 'atenciones',
    'riu_cenas_frias': 'cenas_frias',
    'riu_desayunos': 'desayunos',
    'riu_excursiones': 'registro_excursiones',
    'riu_lost_found': 'lost_found',
    'riu_rack': 'rack_status',
    'riu_system_alarms': 'system_alarms',
    'riu_transfers': 'transfers',
    'vales_data': 'vales',
    'guia_operativa': 'guia_operativa',
    'gallery_favorites': 'gallery_favorites',
    'calendario_eventos': 'calendario_eventos',
    'recepcionistas': 'usuarios_recepcion',
    'turnos_empleados': 'turnos_empleados',
    'hoteles': 'hoteles',
    'hotel_modulos': 'hotel_modulos',


    // ALIAS PARA COMPATIBILIDAD O LEGACY
    'riu_agenda_contactos': 'agenda_contactos',
    'riu_class_db': 'clientes_riu',
    'config': 'app_config',
    'alarm_log': 'alarm_log',
    'chat_messages': 'chat_messages',
    'chat_presence': 'chat_user_presence',
    'calculadora_ops': 'calculadora_ops',
    'apps_herramientas': 'apps_herramientas'
};

// TABLAS QUE REQUIEREN AISLAMIENTO POR HOTEL
const ISOLATED_TABLES = new Set([
    'clientes_riu',
    'safe_rentals',
    'despertadores',
    'estancia_diaria',
    'novedades',
    'notas',
    'precios',
    'guia_checks',
    'arqueo_caja',
    'reservas_instalaciones',
    'atenciones',
    'cenas_frias',
    'desayunos',
    'lost_found',
    'transfers',
    'registro_excursiones',
    'rack_status',
    'system_alarms',
    'vales',
    'guia_operativa',
    'calendario_eventos',
    'usuarios_recepcion',
    'turnos_empleados',
    'hoteles',
    'hotel_modulos',
    'agenda_contactos',
    'alarm_log',
    'chat_messages',
    'chat_user_presence',
    'gallery_favorites',
    'calculadora_ops',
    'apps_herramientas',
    'app_config'
]);

// MAPEO DE TABLAS A IDS DE MODULO (Para verificar si son compartidos)
const TABLE_TO_MODULO = {
    'clientes_riu': 'riu-content',
    'safe_rentals': 'safe-content',
    'despertadores': 'despertadores-content',
    'estancia_diaria': 'estancia-content',
    'novedades': 'novedades-content',
    'notas': 'notas-content',
    'precios': 'precios-content',
    'guia_checks': 'guia-interactiva-content',
    'arqueo_caja': 'caja-content',
    'reservas_instalaciones': 'reservas_instalaciones-content',
    'atenciones': 'atenciones-content',
    'cenas_frias': 'cena-fria-content',
    'desayunos': 'desayuno-content',
    'lost_found': 'lost-found-content',
    'transfers': 'transfers-content',
    'registro_excursiones': 'excursiones-content',
    'rack_status': 'rack-content',
    'system_alarms': 'system-alarms-content',
    'vales': 'vales-content',
    'guia_operativa': 'ayuda-content',
    'calendario_eventos': 'calendario-content',
    'usuarios_recepcion': 'turnos-content',
    'turnos_empleados': 'turnos-content',
    'agenda_contactos': 'agenda-content',
    'chat_messages': 'chat-wrapper',
    'chat_user_presence': 'chat-wrapper',
    'alarm_log': 'system-alarms-content',
    'calculadora_ops': 'calculadora-container',
    'apps_herramientas': 'aplicaciones-content'
};

function getHotelId(req) {
    // 1. Prioritize explicit parameters in query or body (important for Login)
    const explicitId = req.query.hotel_id || req.body.hotel_id || (req.body && req.body.hotelId);
    if (explicitId) return parseInt(explicitId) || 1;

    // 2. Otherwise look at headers
    const raw = req.headers['x-hotel-id'];
    if (!raw) return 1;
    // Handle potential list of headers (Express/Node behavior)
    if (Array.isArray(raw)) return parseInt(raw[raw.length - 1]) || 1;
    if (typeof raw === 'string' && raw.includes(',')) {
        const parts = raw.split(',');
        return parseInt(parts[parts.length - 1].trim()) || 1;
    }
    return parseInt(raw) || 1;
}

/**
 * Verifica si un módulo está marcado como compartido para el hotel actual.
 */
async function checkIfShared(tableName, hotelId) {
    const modId = TABLE_TO_MODULO[tableName];
    if (!modId) return false;
    try {
        const [rows] = await db.query(
            'SELECT compartido FROM hotel_modulos WHERE hotel_id = ? AND modulo_id = ?',
            [hotelId, modId]
        );
        return rows.length > 0 && rows[0].compartido === 1;
    } catch (e) {
        return false;
    }
}


/**
 * GET /api/storage/list?folder=...
 * Lists files in a specific subfolder of storage/
 */
router.get('/list', async (req, res) => {
    const { folder } = req.query;
    logToFile(`[Storage] GET /list - folder: ${folder}`);
    if (!folder) return res.status(400).json({ error: 'Missing folder parameter' });

    try {
        const targetDir = path.join(STORAGE_DIR, folder);
        logToFile(`[Storage] GET /list - targetDir: ${targetDir}`);
        // Basic security check to prevent directory traversal
        if (!targetDir.startsWith(STORAGE_DIR)) {
            logToFile(`[Storage] GET /list - FORBIDDEN (traversal attempt)`);
            return res.status(403).json({ error: 'Forbidden' });
        }

        const files = await fs.readdir(targetDir, { withFileTypes: true });
        const result = files
            .filter(f => f.isFile())
            .map(f => ({
                name: f.name,
                path: path.join(folder, f.name).replace(/\\/g, '/')
            }));

        logToFile(`[Storage] GET /list - Found ${result.length} files`);
        res.json(result);
    } catch (err) {
        logToFile(`[Storage] GET /list - Error: ${err.message}`);
        if (err.code === 'ENOENT') return res.json([]);
        res.status(500).json({ error: 'Read error', details: err.message });
    }
});

/**
 * GET /api/storage/debug/log
 * Devuelve el contenido del log de depuración.
 */
router.get('/debug/log', async (req, res) => {
    try {
        const logs = await fs.readFile(LOG_FILE, 'utf8');
        res.type('text/plain').send(logs);
    } catch (err) {
        res.status(404).send('No hay logs todavía.');
    }
});

// Utility: Ensure storage directory exists
const ensureStorageDir = async () => {
    try {
        await fs.access(STORAGE_DIR);
    } catch {
        await fs.mkdir(STORAGE_DIR, { recursive: true });
    }
};

/**
 * POST /api/storage/upload
 * Saves a media file (Base64) to storage/media/:folder/
 */
router.post('/upload', async (req, res) => {
    logToFile('>>> POST /upload received');
    logToFile(`Headers: ${req.headers['content-type']}`);
    logToFile(`Body keys: ${Object.keys(req.body || {}).join(', ')}`);

    try {
        const { fileName, fileData, folder = 'misc' } = req.body;

        logToFile(`Upload request: ${fileName || 'NO_NAME'} to folder ${folder}`);
        if (!fileName || !fileData) {
            console.error('[Storage] Error: Missing fileName or fileData');
            return res.status(400).json({ error: 'Missing fileName or fileData' });
        }

        logToFile(`[Storage] Received data length: ${fileData.length}`);
        logToFile(`[Storage] Data start: ${fileData.substring(0, 70)}...`);

        const mediaDir = path.join(STORAGE_DIR, 'media', folder);
        console.log(`[Storage] Procesando subida de archivo para: ${fileName}`);

        // Ensure folder exists
        try {
            await fs.mkdir(mediaDir, { recursive: true });
        } catch (dirErr) {
            console.warn('[Storage] Error creating directory (might exist):', dirErr.message);
        }

        const filePath = path.join(mediaDir, fileName);

        // Remove Base64 prefix if present (handle both raw b64 and data URIs)
        const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
        const buffer = Buffer.from(base64Data, 'base64');

        await fs.writeFile(filePath, buffer);
        console.log(`[Storage] File saved: ${filePath}`);

        // Return relative path for frontend
        const relativePath = `storage/media/${folder}/${fileName}`;
        console.log(`[Storage] Returning path: ${relativePath}`);
        res.json({ success: true, path: relativePath });
    } catch (err) {
        console.error(`[Storage] Error uploading file:`, err);
        res.status(500).json({ error: 'Upload error', details: err.message });
    }
});

/**
 * GET /api/storage/:key
 * Retrieves data from MariaDB or falls back to a JSON file.
 */
router.get('/:key', async (req, res) => {
    const { key } = req.params;
    const tableName = TABLE_MAP[key];

    // Try Database first if mapping exists
    if (tableName) {
        const hotelId = getHotelId(req);
        const isIsolated = ISOLATED_TABLES.has(tableName);
        let isSharedValue = true;

        try {
            isSharedValue = isIsolated ? await checkIfShared(tableName, hotelId) : true;
            
            logToFile(`[Storage] DB Read attempt: ${tableName} (key: ${key}, hotel: ${hotelId}, isolated: ${isIsolated}, shared: ${isSharedValue})`);
            
            let queryArr;
            // Si la tabla NO es aislada O es compartida, no filtramos por hotel_id
            if (isIsolated && !isSharedValue && tableName !== 'hoteles') {
                const sql = `SELECT * FROM \`${tableName}\` WHERE hotel_id = ?`;
                logToFile(`[Storage] SQL EXEC: ${sql} [${hotelId}]`);
                queryArr = await db.query(sql, [hotelId]);
            } else {
                const sql = `SELECT * FROM \`${tableName}\``;
                logToFile(`[Storage] SQL EXEC: ${sql}`);
                queryArr = await db.query(sql);
            }
            const [rows] = queryArr;
            logToFile(`[Storage] DB Read success: ${tableName} - Found ${rows.length} rows`);

            // Special handling for JSON fields in DB if needed (e.g. departamentos in novedades)
            const processedRows = rows.map(row => {
                const newRow = { ...row };
                // PARSEO GENÉRICO DE CAMPOS JSON Y FECHAS
                Object.keys(newRow).forEach(col => {
                    const val = newRow[col];
                    // 1. JSON
                    if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
                        try { newRow[col] = JSON.parse(val); } catch (e) { }
                    }
                    // 2. FECHAS (Sólo DATE, no TIMESTAMP)
                    if (val instanceof Date && col !== 'created_at' && col !== 'updated_at' && col !== 'actualizado_en') {
                        // Usamos el formato local para evitar desfases UTC
                        const year = val.getFullYear();
                        const month = String(val.getMonth() + 1).padStart(2, '0');
                        const day = String(val.getDate()).padStart(2, '0');
                        newRow[col] = `${year}-${month}-${day}`;
                    }
                });
                return newRow;
            });

            // Si es un módulo que el frontend espera como objeto (p.e. rack o atenciones)
            if (['riu_rack', 'riu_atenciones_v2', 'riu_desayunos', 'riu_cenas_frias'].includes(key)) {
                const obj = {};
                processedRows.forEach(row => {
                    const pk = row.habitacion;
                    if (pk) {
                        delete row.habitacion;
                        obj[pk] = row;
                    }
                });
                return res.json(obj);
            }

            // CASO ESPECIAL: CONFIG (Flat Object mapping key->value)
            if (key === 'config') {
                const obj = {};
                processedRows.forEach(row => {
                    obj[row.config_key] = row.config_value;
                });
                if (Object.keys(obj).length === 0) throw new Error('Empty config DB');
                return res.json(obj);
            }

            // CASO ESPECIAL: GUÍA OPERATIVA (Object of Arrays)
            if (key === 'guia_operativa') {
                const obj = {};
                processedRows.forEach(row => {
                    obj[row.turno] = row.tareas || [];
                });
                return res.json(obj);
            }

            // CASO ESPECIAL: GALLERY FAVORITES (Flat Array)
            if (key === 'gallery_favorites') {
                return res.json(processedRows.map(r => r.path));
            }

            // CASO ESPECIAL: ARQUEO DE CAJA (Singleton Object)
            if (key === 'arqueo_caja') {
                return res.json(processedRows[0] || {});
            }

            // Mapeo inverso para que el frontend reciba camelCase si la DB tiene snake_case
            if (key === 'riu_estancia_diaria') {
                return res.json(processedRows.map(row => ({
                    fecha: row.fecha,
                    ocupadas: row.ocupadas ?? 0,
                    vacias: row.vacias ?? 0,
                    totalHab: row.total_hab ?? row.totalHab ?? row.TOTAL_HAB ?? 0, 
                    createdAt: row.created_at
                })));
            }

            if (key === 'riu_transfers') {
                return res.json(processedRows.map(row => ({
                    transfer_id: row.id,
                    fecha: row.fecha, // Ya viene formateada por el loop superior
                    hora: row.hora,
                    habitacion: row.habitacion,
                    tipo: row.tipo || '',
                    pax: row.pasajeros ?? row.pax ?? row.PASAJEROS ?? 0,
                    destino: row.lugar_destino ?? row.destino ?? row.LUGAR_DESTINO ?? '',
                    nombre_cliente: row.nombre_cliente,
                    externo: row.externo === 1,
                    notas: row.notas,
                    compania: row.compania,
                    vuelo: row.vuelo,
                    autor: row.autor
                })));
            }

            if (key === 'vales_data') {
                return res.json(processedRows.map(row => {
                    const id = row.id;
                    return {
                        ...row,
                        id: (typeof id === 'string' && !isNaN(Number(id))) ? Number(id) : id
                    };
                }));
            }

            if (key === 'riu_excursiones') {
                return res.json(processedRows.map(row => ({
                    id: row.id,
                    tipoId: row.tipo_id ?? row.tipoId,
                    huesped: row.huesped,
                    habitacion: row.habitacion,
                    fechaExcursion: row.fecha_excursion ?? row.fechaExcursion,
                    adultos: row.adultos ?? 0,
                    niños: row.ninos ?? row.niños ?? 0,
                    total: row.total ?? 0,
                    estado: row.estado,
                    vendedor: row.vendedor,
                    autor: row.autor,
                    fechaVenta: row.fecha_venta ?? row.fechaVenta,
                    comments: row.comments || row.comentario || ''
                })));
            }

            return res.json(processedRows);

        } catch (dbErr) {
            logToFile(`[Storage] DB Read Error for ${tableName}: ${dbErr.message}.`);
            // Only continue to JSON fallback if NOT an isolated table
            if (isIsolated) {
                return res.status(500).json({ error: 'Database error on isolated table', details: dbErr.message });
            }
        }

        // JSON Fallback (ONLY for non-isolated or shared data tables)
        if (isIsolated && !isSharedValue) {
            logToFile(`[Storage] 🛑 Blocked JSON fallback for isolated table: ${tableName}`);
            return res.json(key === 'config' ? {} : []); // Return empty instead of leaking
        }
    }

    const filePath = path.join(STORAGE_DIR, `${key}.json`);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        if (err.code === 'ENOENT') {
            if (key === 'config') {
                return res.json({
                    SYSTEM: { API_URL: '/api', USE_SYNC_SERVER: true },
                    HOTEL: { RECEPCIONISTAS: [] }
                });
            }
            return res.json(null);
        }
        res.status(500).json({ error: 'Read error', details: err.message });
    }
});

/**
 * POST /api/storage/:key
 * Saves data to MySQL and JSON file using atomic transactions.
 */
router.post('/:key', async (req, res) => {
    const { key } = req.params;
    const tableName = TABLE_MAP[key];
    const data = req.body;

    logToFile(`>>> POST /api/storage/${key} - Table: ${tableName || 'NONE'}`);

    // DEBUG: Log para diagnosticar transfers vacíos
    if (key === 'riu_transfers') {
        logToFile(`[Storage] DEBUG riu_transfers - Received data type: ${typeof data}, is Array: ${Array.isArray(data)}, length: ${Array.isArray(data) ? data.length : 'N/A'}`);
    }

    const connection = await db.pool.getConnection();
    try {
        await connection.beginTransaction();

        if (tableName) {
            const hotelId = getHotelId(req);
            const isIsolated = ISOLATED_TABLES.has(tableName);
            
            logToFile(`[Storage] DB Write (Transaction Start): ${tableName} (key: ${key}, hotel: ${hotelId}, isolated: ${isIsolated})`);

            // CASO ESPECIAL: CONFIG (No queremos borrar todo, sino hacer UPSERT)
            if (key === 'config') {
                logToFile('[Storage] Special handling for config - UPSERT mode');
                for (const [k, v] of Object.entries(data)) {
                    // Si el valor ya es un objeto, lo stringificamos para la DB
                    const valStr = (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
                    await connection.query(
                        'INSERT INTO app_config (config_key, config_value, hotel_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE config_value = ?',
                        [k, valStr, hotelId, valStr]
                    );
                }

                // Recuperar la configuración completa para el archivo JSON y para el broadcast (Filtrado por hotel)
                const [allRows] = await connection.query('SELECT * FROM app_config WHERE hotel_id = ?', [hotelId]);
                const fullConfig = {};
                allRows.forEach(r => {
                    let val = r.config_value;
                    // Asegurar que devolvemos objetos si están guardados como JSON string
                    if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                        try { val = JSON.parse(val); } catch (e) { }
                    }
                    fullConfig[r.config_key] = val;
                });
                
                // Actualizamos 'data' para que el guardado en JSON y el broadcast sean completos
                Object.keys(data).forEach(k => delete data[k]);
                Object.assign(data, fullConfig);
                
            } else {
                // 1. Limpiar tabla actual para otros módulos (comportamiento estándar actual)
                const isSharedValue = isIsolated ? await checkIfShared(tableName, hotelId) : true;
                
                if (isIsolated && !isSharedValue) {
                    await connection.query(`DELETE FROM \`${tableName}\` WHERE hotel_id = ?`, [hotelId]);
                } else {
                    await connection.query(`DELETE FROM \`${tableName}\``);
                }

                // 2. Normalizar data a array para inserción
                let itemsToInsert = [];
                if (key === 'guia_operativa') {
                    itemsToInsert = Object.entries(data).map(([turno, tareas]) => ({ turno, tareas }));
                } else if (key === 'gallery_favorites') {
                    itemsToInsert = Array.isArray(data) ? data.map(path => ({ path })) : [];
                } else if (key === 'arqueo_caja') {
                    itemsToInsert = [data];
                } else if (key === 'riu_estancia_diaria') {
                    itemsToInsert = data.map(item => ({
                        fecha: item.fecha,
                        ocupadas: item.ocupadas || 0,
                        vacias: item.vacias || 0,
                        total_hab: item.totalHab || item.total_hab || 0
                    }));
                } else if (key === 'riu_system_alarms') {
                    itemsToInsert = data.map(item => ({
                        id: item.id,
                        msg: item.mensaje || item.msg || '',
                        prioridad: item.prioridad || 'Normal',
                        activo: item.active !== undefined ? item.active : (item.activo !== undefined ? item.activo : 1),
                        hora: item.hora || null,
                        type: item.type || 'daily',
                        date: item.date || null,
                        days: item.days || null,
                        day: item.day || null,
                        usuario: item.usuario || null
                    }));
                } else if (key === 'riu_precios') {
                    itemsToInsert = data.map(item => ({
                        id: item.id,
                        nombre: item.nombre,
                        precio: item.precio,
                        icono: item.icono,
                        comentario: item.comentario,
                        favorito: item.favorito ? 1 : 0
                    }));
                } else if (key === 'riu_excursiones') {
                    itemsToInsert = data.map(item => ({
                        id: item.id,
                        tipo_id: item.tipoId || item.tipo_id,
                        huesped: item.huesped,
                        habitacion: item.habitacion,
                        fecha_excursion: item.fechaExcursion || item.fecha_excursion,
                        adultos: item.adultos || 0,
                        ninos: item.niños !== undefined ? item.niños : (item.ninos !== undefined ? item.ninos : 0),
                        total: item.total || 0,
                        estado: item.estado || 'Pendiente',
                        vendedor: item.vendedor,
                        autor: item.autor,
                        fecha_venta: item.fechaVenta || item.fecha_venta
                    }));
                } else if (key === 'reservas_instalaciones') {
                    itemsToInsert = data.map(item => ({
                        id: item.id,
                        instalacion: item.instalacion,
                        habitacion: item.habitacion,
                        fecha: item.fecha,
                        hora_inicio: item.hora_inicio,
                        hora_fin: item.hora_fin,
                        personas: item.pax || 1,
                        nombre: item.nombre_cliente || item.nombre,
                        autor: item.autor,
                        comentarios: item.observaciones || item.comentarios
                    }));
                } else if (key === 'riu_transfers') {
                    itemsToInsert = data.map((item, idx) => ({
                        id: item.transfer_id || item.id || `TRF-${Date.now()}-${idx}`,
                        fecha: item.fecha || new Date().toISOString().split('T')[0],
                        tipo: item.tipo,
                        pasajeros: item.pax || item.pasajeros || 1,
                        habitacion: item.habitacion,
                        hora: item.hora,
                        lugar_destino: item.destino || item.lugar_destino,
                        nombre_cliente: item.nombre_cliente || '',
                        externo: item.externo ? 1 : 0,
                        notas: item.notas || '',
                        compania: item.compania || '',
                        vuelo: item.vuelo || '',
                        autor: item.autor
                    }));
                } else if (key === 'riu_rack') {
                    itemsToInsert = Object.entries(data).map(([num, val]) => ({
                        habitacion: num,
                        estado: val.status || val.estado,
                        comentarios: val.comments || val.comentarios,
                        extras: val.extras || {}
                    }));
                } else if (key === 'riu_atenciones_v2') {
                    itemsToInsert = Object.entries(data).map(([num, val]) => ({
                        habitacion: num,
                        comentarios: val.comentario || val.comentarios || '',
                        tipos: val.tipos || [],
                        autor: val.autor,
                        actualizado_en: val.actualizadoEn || val.actualizado_en || new Date().toISOString()
                    }));
                } else if (key === 'calendario_eventos') {
                    itemsToInsert = Array.isArray(data) ? data.map(ev => ({
                        id: ev.id,
                        titulo: ev.titulo,
                        fecha: ev.fecha,
                        hora: ev.hora,
                        categoria: ev.categoria,
                        priority: ev.priority,
                        color: ev.color,
                        descripcion: ev.descripcion
                    })) : [];
                } else if (key === 'recepcionistas') {
                    itemsToInsert = Array.isArray(data) ? data.map(val => (typeof val === 'string' ? { nombre: val } : val)) : [];
                } else if (Array.isArray(data)) {
                    itemsToInsert = data;
                } else if (typeof data === 'object') {
                    itemsToInsert = Object.entries(data).map(([pk, val]) => {
                        if (typeof val === 'object' && val !== null) {
                            const item = { habitacion: pk, ...val };
                            if (item.hab && !item.habitacion) item.habitacion = item.hab;
                            return item;
                        }
                        return { habitacion: pk, value: val };
                    });
                }

                // Inserción genérica con validación de columnas
                if (itemsToInsert.length > 0) {
                    // AUTO-CREATE TABLE hotel_modulos if missing
                    if (tableName === 'hotel_modulos') {
                        try {
                            await connection.query(`
                                CREATE TABLE IF NOT EXISTS hotel_modulos (
                                    id INT AUTO_INCREMENT PRIMARY KEY,
                                    hotel_id INT NOT NULL,
                                    modulo_id VARCHAR(100) NOT NULL,
                                    activo TINYINT(1) DEFAULT 1,
                                    compartido TINYINT(1) DEFAULT 0,
                                    UNIQUE KEY (hotel_id, modulo_id),
                                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                                )
                            `);
                        } catch (e) {
                            logToFile(`[Storage] hotel_modulos creation error: ${e.message}`);
                        }
                    }

                    let [dbColumnsResult] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
                    let validDbColumns = new Set(dbColumnsResult.map(c => c.Field));

                    // AUTO-MIGRACIÓN NOTAS (Fallback if initNotasDB didn't run or failed)
                    if (tableName === 'notas' && !validDbColumns.has('protegida')) {
                        logToFile(`[Storage] Detection: Table 'notas' missing 'protegida' column. Columns found: ${Array.from(validDbColumns).join(',')}`);
                        try {
                            if (!validDbColumns.has('protegida')) {
                                logToFile('[Storage] Migration: Adding column protegida to notas');
                                await connection.query('ALTER TABLE notas ADD COLUMN protegida TINYINT(1) DEFAULT 0');
                            }
                            if (!validDbColumns.has('favorito')) {
                                logToFile('[Storage] Migration: Adding column favorito to notas');
                                await connection.query('ALTER TABLE notas ADD COLUMN favorito TINYINT(1) DEFAULT 0');
                            }
                            if (!validDbColumns.has('modifiedAt')) {
                                logToFile('[Storage] Migration: Adding column modifiedAt to notas');
                                await connection.query('ALTER TABLE notas ADD COLUMN modifiedAt BIGINT DEFAULT NULL');
                            }
                            
                            // Re-fetch columns after migration
                            [dbColumnsResult] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
                            validDbColumns = new Set(dbColumnsResult.map(c => c.Field));
                            logToFile(`[Storage] Auto-migration success. New columns: ${Array.from(validDbColumns).join(',')}`);
                        } catch (migErr) {
                            logToFile(`[Storage] CRITICAL: Auto-migration failed for notas: ${migErr.message}`);
                        }
                    }

                    // AUTO-MIGRACIÓN HOTEL_MODULOS
                    if (tableName === 'hotel_modulos' && !validDbColumns.has('compartido')) {
                        try {
                            logToFile('[Storage] Migration: Adding column compartido to hotel_modulos');
                            await connection.query('ALTER TABLE hotel_modulos ADD COLUMN compartido TINYINT(1) DEFAULT 0');
                            [dbColumnsResult] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
                            validDbColumns = new Set(dbColumnsResult.map(c => c.Field));
                        } catch (migErr) {
                            logToFile(`[Storage] CRITICAL: Auto-migration failed for hotel_modulos: ${migErr.message}`);
                        }
                    }

                    logToFile(`[Storage] Saving to ${tableName}. Available DB Columns: ${Array.from(validDbColumns).join(', ')}`);

                    for (const item of itemsToInsert) {
                        const itemColumns = Object.keys(item).filter(col => validDbColumns.has(col));
                        if (itemColumns.length === 0) {
                            logToFile(`[Storage] Skipping item: no valid columns found. Item keys: ${Object.keys(item).join(',')}`);
                            continue;
                        }

                        const placeholders = itemColumns.map(() => '?').join(', ');
                        const sql = `INSERT INTO \`${tableName}\` (\`${itemColumns.join('\`, \`')}\`) VALUES (${placeholders})`;
                        
                        const values = itemColumns.map(col => {
                            let val = item[col];
                            if (typeof val === 'string' && val.includes('T') && val.endsWith('Z')) {
                                const dateMatch = val.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
                                if (dateMatch) return `${dateMatch[1]} ${dateMatch[2]}`;
                            }
                            if (typeof val === 'boolean') return val ? 1 : 0;
                            if (typeof val === 'object' && val !== null) return JSON.stringify(val);
                            
                            // Specific fix for turnos_empleados: tipo_turno should not be null
                            if (key === 'turnos_empleados' && col === 'tipo_turno' && (val === null || val === undefined)) {
                                return '';
                            }

                            return (val === undefined) ? null : val;
                        });

                        // Inject hotel_id if the table is isolated AND NOT SHARED
                        if (isIsolated && !isSharedValue) {
                            const hotelIdIdx = itemColumns.indexOf('hotel_id');
                            if (hotelIdIdx === -1) {
                                // Add hotel_id to the query if not present in item keys
                                const sqlIsolated = `INSERT INTO \`${tableName}\` (\`${itemColumns.join('\`, \`')}\`, \`hotel_id\`) VALUES (${placeholders}, ?)`;
                                await connection.query(sqlIsolated, [...values, hotelId]);
                            } else {
                                // Replace existing hotel_id with the request context one to enforce isolation
                                values[hotelIdIdx] = hotelId;
                                await connection.query(sql, values);
                            }
                        } else {
                            await connection.query(sql, values);
                        }
                    }
                } else {
                    logToFile(`[Storage] No items to insert for ${tableName}`);
                }
            }
            logToFile(`[Storage] DB Write (Transaction Success): ${tableName}`);
        }

        await connection.commit();
        const filePath = path.join(STORAGE_DIR, `${key}.json`);
        await fs.writeFile(filePath, JSON.stringify(data, null, 4), 'utf8');

        const broadcast = req.app.get('broadcast');
        if (broadcast) broadcast({ type: 'data-changed', key });

        res.json({ success: true, source: tableName ? 'db+json' : 'json' });

    } catch (err) {
        if (connection) await connection.rollback();
        logToFile(`[Storage] CRITICAL: Transaction Error for ${key}: ${err.message}`);
        res.status(500).json({ error: 'Transaction error', details: err.message });
    } finally {
        if (connection) connection.release();
    }
});


module.exports = router;
