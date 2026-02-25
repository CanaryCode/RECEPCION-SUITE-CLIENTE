const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'hotel_user',
    password: process.env.DB_PASSWORD || 'hotel_pass',
    database: process.env.DB_NAME || 'hotel_manager',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Probar conexión al inicio
pool.getConnection()
    .then(conn => {
        console.log('✅ DATABASE CONNECTED SUCCESSFULLY');
        conn.release();
    })
    .catch(err => {
        console.error('❌ DATABASE CONNECTION FAILED:', err.message);
    });

module.exports = {
    query: (sql, params) => pool.execute(sql, params),
    pool
};
