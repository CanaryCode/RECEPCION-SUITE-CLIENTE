const express = require('express');
const router = express.Router();
const https = require('https');

router.get('/', (req, res) => {
    const text = req.query.text;
    const lang = req.query.lang || 'es';

    if (!text) {
        return res.status(400).send('Texto requerido');
    }

    const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=gtx`;

    https.get(url, (googleRes) => {
        if (googleRes.statusCode !== 200) {
            return res.status(googleRes.statusCode).send('Error desde Google TTS');
        }

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cachear el audio todo un año en el navegador
        googleRes.pipe(res);
    }).on('error', (err) => {
        console.error('Error proxy TTS:', err);
        res.status(500).send('Error interno descargando audio');
    });
});

module.exports = router;
