const express = require('express');
const router = express.Router();
console.log('[DEBUG CHER ROUTER] Initializing Chat Router');
router.use((req, res, next) => {
    const log = req.app.get('logToFile');
    if (log) log(`[DEBUG CHAT ROUTER] Request: ${req.method} ${req.originalUrl}`);
    next();
});
const db = require('../db');

function getHotelId(req) {
    const raw = req.headers['x-hotel-id'];
    if (!raw) return 1;
    if (Array.isArray(raw)) return parseInt(raw[raw.length - 1]) || 1;
    if (typeof raw === 'string' && raw.includes(',')) {
        const parts = raw.split(',');
        return parseInt(parts[parts.length - 1].trim()) || 1;
    }
    return parseInt(raw) || 1;
}

/**
 * Verifica si el módulo de chat está marcado como compartido.
 */
async function checkIfChatShared(hotelId) {
    try {
        const [rows] = await db.query(
            'SELECT compartido FROM hotel_modulos WHERE hotel_id = ? AND modulo_id = ?',
            [hotelId, 'chat-wrapper']
        );
        return rows.length > 0 && rows[0].compartido === 1;
    } catch (e) {
        return false;
    }
}

/**
 * GET /api/chat/presence/:username
 * Returns the last seen and online status of a user.
 */
router.get('/presence/:username', async (req, res) => {
    const { username } = req.params;
    const hotelId = getHotelId(req);
    const logToFile = req.app.get('logToFile') || console.log;
    
    try {
        const isShared = await checkIfChatShared(hotelId);
        logToFile(`[DEBUG CHAT] Request for presence: ${username} (hotel: ${hotelId}, shared: ${isShared})`);
        
        let query = 'SELECT last_seen, is_online FROM chat_user_presence WHERE username = ?';
        let params = [username];
        
        if (!isShared) {
            query += ' AND hotel_id = ?';
            params.push(hotelId);
        }

        const [rows] = await db.query(query, params);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.json({ is_online: 0, last_seen: null });
        }
    } catch (err) {
        console.error('[CHAT ERROR]', err);
        res.status(500).json({ error: 'Fallo al obtener presencia' });
    }
});

/**
 * GET /api/chat/history
 * Returns the latest 50 chat messages.
 */
router.get('/history', async (req, res) => {
    const logToFile = req.app.get('logToFile') || console.log;
    const hotelId = getHotelId(req);
    
    try {
        const isShared = await checkIfChatShared(hotelId);
        const recipient = req.query.recipient;
        const sender = req.query.sender;
        
        logToFile(`[HISTORY TRACE] Route hit. Params: recipient=${recipient}, sender=${sender}, hotel=${hotelId}, shared=${isShared}`);
        
        let query = '';
        let params = [];

        if (recipient && sender) {
            query = `SELECT * FROM chat_messages 
                     WHERE ((sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?))`;
            params = [sender, recipient, recipient, sender];
        } else {
            query = `SELECT * FROM chat_messages WHERE recipient IS NULL`;
            params = [];
        }

        if (!isShared) {
            query += ` AND hotel_id = ?`;
            params.push(hotelId);
        }

        query += ` ORDER BY created_at DESC LIMIT 50`;

        const [rows] = await db.query(query, params);
        let data = Array.isArray(rows) ? [...rows].reverse() : [];
        res.json(data);
    } catch (err) {
        console.error('[CHAT ERROR]', err);
        res.status(500).json({ error: 'Fallo al obtener historial de chat' });
    }
});

/**
 * POST /api/chat/message (Optional fallback to WS)
 * Saves a message to the database.
 */
router.post('/message', async (req, res) => {
    const { sender, recipient, message, is_system } = req.body;
    const hotelId = getHotelId(req);

    if (!sender || !message) {
        return res.status(400).json({ error: 'Remitente y mensaje son requeridos' });
    }

    try {
        const isShared = await checkIfChatShared(hotelId);
        // If shared, we still tag with hotel_id for info, but don't filter it in history
        const [result] = await db.query(
            'INSERT INTO chat_messages (sender, recipient, message, is_system, hotel_id) VALUES (?, ?, ?, ?, ?)',
            [sender, recipient || null, message, is_system || false, hotelId]
        );
        
        const newMessage = {
            id: result.insertId,
            sender,
            recipient,
            message,
            is_system: is_system || false,
            hotel_id: hotelId,
            created_at: new Date()
        };

        const broadcast = req.app.get('broadcast');
        if (broadcast) {
            broadcast({ type: 'chat_message', payload: newMessage });
        }

        res.json(newMessage);
    } catch (err) {
        console.error('[CHAT ERROR]', err);
        res.status(500).json({ error: 'Fallo al guardar mensaje' });
    }
});

/**
 * DELETE /api/chat/message/:id
 */
router.delete('/message/:id', async (req, res) => {
    const { id } = req.params;
    const hotelId = getHotelId(req);

    try {
        const isShared = await checkIfChatShared(hotelId);
        let sql = 'DELETE FROM chat_messages WHERE id = ?';
        let params = [id];
        if (!isShared) {
            sql += ' AND hotel_id = ?';
            params.push(hotelId);
        }
        await db.query(sql, params);
        
        const broadcast = req.app.get('broadcast');
        if (broadcast) {
            broadcast({ type: 'chat_delete', payload: { id, hotel_id: hotelId } });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[CHAT ERROR]', err);
        res.status(500).json({ error: 'Fallo al borrar mensaje' });
    }
});

/**
 * GET /api/chat/unread-counts
 */
router.get('/unread-counts', async (req, res) => {
    const { user } = req.query;
    const hotelId = getHotelId(req);
    if (!user) return res.status(400).json({ error: 'Usuario requerido' });

    try {
        const isShared = await checkIfChatShared(hotelId);
        let sql = `SELECT sender, COUNT(*) as count 
                   FROM chat_messages 
                   WHERE recipient = ? AND is_read = 0`;
        let params = [user];

        if (!isShared) {
            sql += ' AND hotel_id = ?';
            params.push(hotelId);
        }

        sql += ' GROUP BY sender';

        const [rows] = await db.query(sql, params);
        const counts = {};
        rows.forEach(row => counts[row.sender] = row.count);
        res.json(counts);
    } catch (err) {
        console.error('[CHAT ERROR]', err);
        res.status(500).json({ error: 'Fallo al obtener mensajes no leídos' });
    }
});

/**
 * DELETE /api/chat/conversation
 */
router.delete('/conversation', async (req, res) => {
    const { user1, user2 } = req.query;
    const hotelId = getHotelId(req);
    if (!user1 || !user2) return res.status(400).json({ error: 'user1 y user2 son requeridos' });

    try {
        const isShared = await checkIfChatShared(hotelId);
        let sql = 'DELETE FROM chat_messages WHERE ((sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?))';
        let params = [user1, user2, user2, user1];

        if (!isShared) {
            sql += ' AND hotel_id = ?';
            params.push(hotelId);
        }

        await db.query(sql, params);

        const broadcast = req.app.get('broadcast');
        if (broadcast) {
            broadcast({ type: 'chat_clear_conversation', payload: { user1, user2, hotel_id: hotelId } });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[CHAT ERROR]', err);
        res.status(500).json({ error: 'Fallo al borrar conversación' });
    }
});

/**
 * GET /api/chat/presence/:username
 * Returns the last seen and online status of a user.
 */

module.exports = router;
