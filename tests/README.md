# Infraestructura de Pruebas (Test Suite)

Este directorio contiene las pruebas automatizadas para garantizar la estabilidad y la integridad de los datos de **Recepción Suite**.

## Estructura de Carpetas

- `tests/unit/`: Pruebas de funciones puras y lógica interna (sin efectos secundarios ni red).
- `tests/integration/`: Pruebas de extremo a extremo (E2E) que requieren que el servidor y MariaDB estén activos.

## Cómo Ejecutar las Pruebas

### Opción A: Script Automático (Windows)

Simplemente haz doble clic en el archivo **`EJECUTAR_PRUEBAS.bat`** en la raíz del proyecto. Este método es el más sencillo y no requiere usar la terminal.

### Opción B: Comando NPM

Si prefieres la terminal, utiliza el comando estándar:

```powershell
npm test
```

### Ejecutar por categorías

- **Integración (Base de Datos & Transacciones)**:

  ```powershell
  node tests/integration/storage.test.js
  ```

- **Unitaria (Lógica de Negocio)**:
  ```powershell
  # (Pendiente de añadir más pruebas)
  node tests/unit/normalization.test.js
  ```

## Reglas para Nuevas Pruebas

1. **Transaccionalidad**: Toda nueva prueba de base de datos debe verificar que el `rollback` funciona si ocurre un error.
2. **Independencia**: Las pruebas no deben depender entre sí. Cada una debe preparar su propio estado si es necesario.
3. **Legibilidad**: Usar `console.log` claros para indicar éxito (✅) o error (❌).
