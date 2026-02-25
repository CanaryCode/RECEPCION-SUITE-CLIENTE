const db = require('../db');

async function fixArqueo() {
    try {
        console.log('Dropping old arqueo_caja table...');
        await db.query(`DROP TABLE IF EXISTS \`arqueo_caja\``);
        
        console.log('Creating new arqueo_caja table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS arqueo_caja (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                fecha VARCHAR(50),
                turno VARCHAR(20),
                vales JSON,
                desembolsos JSON,
                comentarios TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('Successfully recreated arqueo_caja table!');
        process.exit(0);
    } catch (err) {
        console.error('Error recreating table:', err);
        process.exit(1);
    }
}

fixArqueo();
