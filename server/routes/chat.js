const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/chat/history
 * Returns the latest 50 chat messages.
 */
router.get('/history', async (req, res) => {
    console.log('[DEBUG CHAT] GET /api/chat/history hit');
    const { recipient, sender } = req.query;
    
    try {
        let query = 'SELECT * FROM chat_messages WHERE recipient IS NULL';
        let params = [];

        if (recipient && sender) {
            query = 'SELECT * FROM chat_messages WHERE (sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?)';
            params = [sender, recipient, recipient, sender];
        }

        const [rows] = await db.query(
            `${query} ORDER BY created_at DESC LIMIT 50`,
            params
        );
        res.json(rows.reverse());
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
    console.log('[DEBUG CHAT] POST /api/chat/message hit', req.body);
    const { sender, recipient, message, is_system } = req.body;

    if (!sender || !message) {
        return res.status(400).json({ error: 'Remitente y mensaje son requeridos' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO chat_messages (sender, recipient, message, is_system) VALUES (?, ?, ?, ?)',
            [sender, recipient || null, message, is_system || false]
        );
        
        const newMessage = {
            id: result.insertId,
            sender,
            message,
            is_system: is_system || false,
            created_at: new Date()
        };

        // Broadcast to all WS clients
        const broadcast = req.app.get('broadcast');
        if (broadcast) {
            broadcast({
                type: 'chat_message',
                payload: newMessage
            });
        }

        res.json(newMessage);
    } catch (err) {
        console.error('[CHAT ERROR]', err);
        res.status(500).json({ error: 'Fallo al guardar mensaje' });
    }
});

module.exports = router;
