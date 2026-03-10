/**
 * MIGRACIÓN: Agregar campos 'usuario' y 'autor' a la tabla notas
 *
 * Ejecutar con: node server/migrate_notas_personal.js
 */

const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'riu_admin',
    password: 'gravina82',
    database: 'riu_reception'
  });

  try {
    console.log('🔄 Iniciando migración de tabla notas...');

    // Verificar si las columnas ya existen
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'riu_reception'
        AND TABLE_NAME = 'notas'
        AND COLUMN_NAME IN ('usuario', 'autor')
    `);

    const existingColumns = columns.map(c => c.COLUMN_NAME);

    if (!existingColumns.includes('usuario')) {
      console.log('➕ Agregando columna "usuario"...');
      await connection.query(`
        ALTER TABLE notas
        ADD COLUMN usuario VARCHAR(100) DEFAULT NULL COMMENT 'NULL = nota global, username = nota personal'
      `);
      console.log('✅ Columna "usuario" agregada correctamente');
    } else {
      console.log('⚠️  Columna "usuario" ya existe, saltando...');
    }

    if (!existingColumns.includes('autor')) {
      console.log('➕ Agregando columna "autor"...');
      await connection.query(`
        ALTER TABLE notas
        ADD COLUMN autor VARCHAR(100) DEFAULT NULL COMMENT 'Quien creó la nota'
      `);
      console.log('✅ Columna "autor" agregada correctamente');
    } else {
      console.log('⚠️  Columna "autor" ya existe, saltando...');
    }

    // Verificar estructura final
    const [finalColumns] = await connection.query(`
      SHOW COLUMNS FROM notas
    `);

    console.log('\n📋 Estructura final de la tabla notas:');
    finalColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });

    console.log('\n✅ Migración completada exitosamente');

  } catch (error) {
    console.error('❌ Error durante la migración:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

migrate().catch(console.error);
