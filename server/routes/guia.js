const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/guia
 * Obtiene todos los elementos de la guía interactiva.
 */
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM guia_interactiva ORDER BY category, title');
        
        // Convertimos los campos JSON de string a objeto (dependiendo de la configuración del driver mysql2)
        const processedRows = rows.map(row => ({
            ...row,
            use_cases: typeof row.use_cases === 'string' ? JSON.parse(row.use_cases) : row.use_cases,
            considerations: typeof row.considerations === 'string' ? JSON.parse(row.considerations) : row.considerations
        }));

        res.json(processedRows);
    } catch (err) {
        console.error('[GUIA ROUTES] Error en GET /:', err);
        res.status(500).json({ error: 'Error al obtener los datos de la guía' });
    }
});

/**
 * GET /api/guia/category/:category
 * Obtiene elementos de la guía por categoría.
 */
router.get('/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const [rows] = await db.query('SELECT * FROM guia_interactiva WHERE category = ? ORDER BY title', [category]);
        
        const processedRows = rows.map(row => ({
            ...row,
            use_cases: typeof row.use_cases === 'string' ? JSON.parse(row.use_cases) : row.use_cases,
            considerations: typeof row.considerations === 'string' ? JSON.parse(row.considerations) : row.considerations
        }));

        res.json(processedRows);
    } catch (err) {
        console.error('[GUIA ROUTES] Error en GET /category:', err);
        res.status(500).json({ error: 'Error al obtener los datos de la guía por categoría' });
    }
});

module.exports = router;
