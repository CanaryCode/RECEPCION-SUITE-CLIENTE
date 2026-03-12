const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

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
 * GET /api/users/current
 * Obtiene los detalles del usuario actual basados en el nombre de sesión.
 */
router.get('/current', async (req, res) => {
    const username = req.headers['x-user-name'];
    const hotelId = getHotelId(req);

    if (!username) {
        return res.status(400).json({ error: 'Falta identificación de usuario' });
    }

    try {
        const [rows] = await db.query('SELECT id, nombre, email, display_name, avatar_url, activo, password_hash, hotel_id FROM usuarios_recepcion WHERE nombre = ? AND hotel_id = ?', [username, hotelId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        const user = rows[0];
        res.json({
            ...user,
            hasPassword: !!user.password_hash
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener datos del usuario', details: err.message });
    }
});
// ... (omitting intermediate lines for brevity if possible, but replace_file_content needs contiguous block)
// I will do two separate replaces if non-contiguous, but here I'll try to catch the other part if close or use multi_replace

/**
 * POST /api/users/update
 * Actualiza el perfil del usuario.
 */
router.post('/update', async (req, res) => {
    const username = req.headers['x-user-name'];
    const { display_name, email, current_password, new_password, avatar_url } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Falta identificación de usuario' });
    }

    try {
        const hotelId = getHotelId(req);
        // 1. Obtener datos actuales para validar contraseña si es necesario
        const [rows] = await db.query('SELECT * FROM usuarios_recepcion WHERE nombre = ? AND hotel_id = ?', [username, hotelId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        const user = rows[0];

        // 2. Validar contraseña si se intenta cambiar o si el usuario ya tiene una establecida
        if (user.password_hash) {
            if (!current_password) {
                return res.status(401).json({ error: 'Se requiere la contraseña actual para realizar cambios de seguridad' });
            }
            const currentHash = crypto.createHash('sha256').update(current_password).digest('hex');
            if (currentHash !== user.password_hash) {
                return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
            }
        }

        // 3. Preparar campos a actualizar
        const updates = [];
        const params = [];

        if (display_name !== undefined) {
            updates.push('display_name = ?');
            params.push(display_name);
        }
        if (email !== undefined) {
            updates.push('email = ?');
            params.push(email);
        }
        if (avatar_url !== undefined) {
            updates.push('avatar_url = ?');
            params.push(avatar_url);
        }
        if (new_password !== undefined) {
            let newHash = null;
            if (new_password && new_password.trim() !== '') {
                newHash = crypto.createHash('sha256').update(new_password).digest('hex');
            }
            updates.push('password_hash = ?');
            params.push(newHash);
        }

        if (updates.length === 0) {
            return res.json({ success: true, message: 'No hay cambios que realizar' });
        }

        params.push(username);
        params.push(hotelId);
        await db.query(`UPDATE usuarios_recepcion SET ${updates.join(', ')} WHERE nombre = ? AND hotel_id = ?`, params);

        res.json({ success: true, message: 'Perfil actualizado correctamente' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar el perfil', details: err.message });
    }
});
/**
 * GET /api/users/info/:username
 * Obtener información pública de un usuario (para el login)
 */
router.get('/info/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const hotelId = getHotelId(req);
        const [rows] = await db.query(`
            SELECT u.password_hash, u.hotel_id, h.habitaciones, h.nombre as hotel_nombre 
            FROM usuarios_recepcion u
            LEFT JOIN hoteles h ON u.hotel_id = h.id
            WHERE u.nombre = ? AND u.hotel_id = ?
        `, [username, hotelId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({
            username: username,
            hasPassword: !!rows[0].password_hash,
            hotelId: rows[0].hotel_id,
            hotelHabitaciones: rows[0].habitaciones,
            hotelNombre: rows[0].hotel_nombre
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al consultar usuario' });
    }
});

/**
 * POST /api/users/login-check
 * Verificar credenciales sin iniciar sesión formalmente (usado por el selector)
 */
router.post('/login-check', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await db.query(`
            SELECT u.password_hash, u.hotel_id, h.habitaciones, h.nombre as hotel_nombre
            FROM usuarios_recepcion u
            LEFT JOIN hoteles h ON u.hotel_id = h.id
            WHERE u.nombre = ? AND u.hotel_id = ?
        `, [username, req.body.hotelId || req.body.hotel_id || getHotelId(req)]);
        if (rows.length === 0) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

        const user = rows[0];
        const hash = password ? crypto.createHash('sha256').update(password).digest('hex') : null;
        
        if (user.password_hash && hash !== user.password_hash) {
            return res.json({ success: false, error: 'Credenciales inválidas' });
        }

        res.json({ 
            success: true,
            hotelId: user.hotel_id,
            hotelHabitaciones: user.habitaciones,
            hotelNombre: user.hotel_nombre
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error de servidor' });
    }
});

module.exports = router;
