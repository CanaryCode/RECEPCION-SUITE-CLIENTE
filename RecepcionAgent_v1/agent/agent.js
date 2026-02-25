const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001; // Usamos un puerto diferente al servidor principal para evitar conflictos

// Middleware
app.use(cors());
app.use(express.json());

// Logging básico
app.use((req, res, next) => {
    console.log(`[AGENT] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

const config = require('./agent_config.json');

// Middleware de Estación (Seguridad AJPD)
app.use('/api', (req, res, next) => {
    // Permitir obtener la identidad de la estación siempre
    if (req.path === '/auth/id' || req.path === '/auth/id/') return next();

    // El resto de la API requiere autenticación de estación (x-station-key)
    const stationKey = req.headers['x-station-key'];
    if (stationKey === config.STATION_KEY) {
        return next();
    }

    // Nota: Las rutas de admin (login fallback) se manejan dentro de adminRoutes 
    // pero aquí aplicamos la primera capa de filtro de estación.
    if (req.path.startsWith('/admin')) return next();

    res.status(403).json({
        error: 'Acceso No Autorizado',
        message: 'Esta estación no ha sido validada por el Agente Local.'
    });
});

// Importar rutas locales
const systemLocalRoutes = require('./routes/system_local');
const adminRoutes = require('./routes/admin');

/**
 * GET /api/auth/id
 * Devuelve la identidad de la estación (Station Key)
 */
app.get('/api/auth/id', (req, res) => {
    try {
        const config = require('./agent_config.json');
        res.json({
            stationId: config.STATION_ID,
            stationKey: config.STATION_KEY,
            description: config.DESCRIPTION
        });
    } catch (e) {
        res.status(500).json({ error: 'Config file not found' });
    }
});

// Montar rutas
app.use('/api/system', systemLocalRoutes);
app.use('/api/admin', adminRoutes);

// Servir estáticos de la consola de administración
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// Health check para el Agente
app.get('/health', (req, res) => {
    res.json({ status: 'ok', component: 'local-agent' });
});

app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`  RECEPCION SUITE - AGENTE LOCAL`);
    console.log(`  Escuchando en http://localhost:${PORT}`);
    console.log(`========================================`);
});
