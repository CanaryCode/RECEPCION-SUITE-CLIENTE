const express = require('express');
const app = express();

app.use(express.json());

// Cargar las rutas de updates
const updatesRoutes = require('./server/routes/updates.js');
app.use('/api/updates', updatesRoutes);

// Iniciar servidor
const PORT = 3333;
app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
    console.log(`Test: http://localhost:${PORT}/api/updates/version`);
});
