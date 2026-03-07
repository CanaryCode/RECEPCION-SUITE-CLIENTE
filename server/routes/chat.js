const express = require('express');
const router = express.Router();
console.log('[DEBUG CHER ROUTER] Initializing Chat Router');
router.use((req, res, next) => {
    const log = req.app.get('logToFile');
    if (log) log(`[DEBUG CHAT ROUTER] Request: ${req.method} ${req.originalUrl}`);
    next();
});
const db = require('../db');

/**
 * GET /api/chat/history
 * Returns the latest 50 chat messages.
 */
router.get('/history', async (req, res) => {
    const logToFile = req.app.get('logToFile') || console.log;
    logToFile(`[HISTORY TRACE] 1. Route hit. Params: recipient=${req.query.recipient}, sender=${req.query.sender}`);
    
    try {
        const recipient = req.query.recipient;
        const sender = req.query.sender;
        
        let query = '';
        let params = [];

        if (recipient && sender) {
            logToFile(`[HISTORY TRACE] 2a. Building private query`);
            query = `SELECT * FROM chat_messages 
                     WHERE (sender = ? AND recipient = ?) 
                        OR (sender = ? AND recipient = ?)
                     ORDER BY created_at DESC LIMIT 50`;
            params = [sender, recipient, recipient, sender];
        } else {
            logToFile(`[HISTORY TRACE] 2b. Building general query`);
            query = `SELECT * FROM chat_messages 
                     WHERE recipient IS NULL
                     ORDER BY created_at DESC LIMIT 50`;
            params = [];
        }

        logToFile(`[HISTORY TRACE] 3. Executing query. Params count: ${params.length}`);
        const [rows] = await db.query(query, params);
        
        logToFile(`[HISTORY TRACE] 4. Query finished. Rows returned: ${rows ? rows.length : 'undefined'}`);
        
        let data = [];
        if (Array.isArray(rows)) {
             data = [...rows].reverse();
        }
        
        logToFile(`[HISTORY TRACE] 5. Sending response`);
        res.json(data);
        logToFile(`[HISTORY TRACE] 6. Response sent successfully`);
    } catch (err) {
        logToFile(`[CHAT FATAL ERROR] /history: ${err ? err.message : 'Unknown object thrown'}`);
        console.error('[CHAT ERROR]', err);
        try {
            res.status(500).json({ error: 'Fallo al obtener historial de chat', detail: err ? err.message : 'Unknown' });
        } catch(e) {
            logToFile(`[CHAT FATAL ERROR] Failed to send 500 response: ${e.message}`);
        }
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

/**
 * DELETE /api/chat/message/:id
 * Deletes a message by ID.
 */
router.delete('/message/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[DEBUG CHAT] DELETE /api/chat/message/${id} hit`);

    try {
        await db.query('DELETE FROM chat_messages WHERE id = ?', [id]);
        
        // Broadcast deletion to all WS clients
        const broadcast = req.app.get('broadcast');
        if (broadcast) {
            broadcast({
                type: 'chat_delete',
                payload: { id }
            });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[CHAT ERROR]', err);
        res.status(500).json({ error: 'Fallo al borrar mensaje' });
    }
});



/**
 * GET /api/chat/unread-counts
 * Returns unread message count grouped by sender for a given user.
 */
router.get('/unread-counts', async (req, res) => {
    const { user } = req.query;
    if (!user) return res.status(400).json({ error: 'Usuario requerido' });

    try {
        // First check if is_read column exists to avoid 500 html errors if migration wasn't run
        const [columns] = await db.query('SHOW COLUMNS FROM chat_messages LIKE "is_read"');
        if (columns.length === 0) {
            console.error('[CHAT ERROR] Database migration not performed: is_read column missing.');
            return res.status(200).json({}); // Return empty counts instead of failing
        }

        const [rows] = await db.query(
            `SELECT sender, COUNT(*) as count 
             FROM chat_messages 
             WHERE recipient = ? AND is_read = 0 
             GROUP BY sender`,
            [user]
        );
        
        const counts = {};
        rows.forEach(row => counts[row.sender] = row.count);
        res.json(counts);
    } catch (err) {
        console.error('[CHAT ERROR]', err);
        res.status(500).json({ error: 'Fallo al obtener mensajes no leídos', detail: err.message });
    }
});

/**
 * DELETE /api/chat/conversation
 * Deletes all messages between two users.
 */
router.delete('/conversation', async (req, res) => {
    console.log('[DEBUG CHAT] DELETE /api/chat/conversation hit', req.query);
    const { user1, user2 } = req.query;
    if (!user1 || !user2) {
        return res.status(400).json({ error: 'user1 y user2 son requeridos' });
    }

    try {
        await db.query(
            'DELETE FROM chat_messages WHERE (sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?)',
            [user1, user2, user2, user1]
        );

        // Broadcast deletion to all WS clients
        const broadcast = req.app.get('broadcast');
        if (broadcast) {
            broadcast({
                type: 'chat_clear_conversation',
                payload: { user1, user2 }
            });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[CHAT ERROR]', err);
        res.status(500).json({ error: 'Fallo al borrar conversación' });
    }
});

module.exports = router;
