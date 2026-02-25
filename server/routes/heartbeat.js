const express = require('express');
const router = express.Router();

let shutdownTimer = null;

// Utility to reset the timer
const resetShutdownTimer = () => {
    if (shutdownTimer) clearTimeout(shutdownTimer);

    // Configurar nuevo timer de 24 HORAS (Persistencia total durante el turno)
    shutdownTimer = setTimeout(() => {
        console.log('[Heartbeat] No heartbeat received for 24 hours. Shutting down...');
        process.exit(0);
    }, 86400000);
};

/**
 * GET /api/heartbeat
 * Resets the 24h idle shutdown timer.
 */
router.get('/', (req, res) => {
    console.log('[Heartbeat] <<< Ping received');
    resetShutdownTimer();
    res.send('OK');
});

// Initial startup timeout DISABLED for better availability 
// shutdownTimer = setTimeout(() => {
//     console.log('[Heartbeat] CRITICAL: Initial startup timeout. No client connected within 10 minutes. Shutting down...');
//     process.exit(0);
// }, 600000); // 10 minutes

module.exports = router;
