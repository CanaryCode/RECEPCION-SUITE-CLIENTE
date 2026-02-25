# GUÍA DE ACTUALIZACIÓN SEGURA

Para actualizar "Recepción Suite" en el ordenador del trabajo sin borrar la agenda ni los datos que han introducido tus compañeros, sigue estas instrucciones.

## Regla de Oro

**TODA la información** (Agenda, Novedades, Precios...) está en la carpeta **`storage`**.
Si proteges esa carpeta, no perderás nada.

## Procedimiento Recomendado

### 1. En el ordenador del trabajo (ANTES de tocar nada)

1.  Entra en la carpeta del programa.
2.  Ejecuta el archivo **`HACER_BACKUP.bat`** (si no lo tienes, créalo o usa el que te acabo de hacer).
    - Esto creará una copia de seguridad en la carpeta `Backups/`.
    - _Si algo sale mal, siempre podrás recuperar esa copia._

### 2. Preparar la nueva versión (En tu casa)

1.  Prepara la carpeta nueva de "RECEPCION SUITE" que quieres llevar.
2.  **IMPORTANTE**: Asegúrate de borrar la carpeta `storage` de tu versión nueva (o que esté vacía de datos reales), para no machacar accidentalmente la del trabajo con tus pruebas.
    - _Nota: Si usas el sistema portable, asegúrate de llevar también la carpeta `bin` o ejecutar `PACK_PORTABLE.bat`._

### 3. Instalar la actualización

Tienes dos opciones, elige la que te sea más fácil:

**OPCIÓN A: Copiar y Reemplazar (Rápida)**

1.  Copia los archivos nuevos y pégalos **encima** de los viejos en el ordenador del trabajo.
2.  Windows te preguntará: "¿Desea reemplazar los archivos?".
    - Dile **SÍ A TODO**.
3.  **No toques la carpeta `storage`**. Como Windows fusiona carpetas, si tú no traes una carpeta `storage` que machaque la suya, sus archivos se quedarán intactos.

**OPCIÓN B: Borrón y Cuenta Nueva (Más limpia y segura)**

1.  En el ordenador del trabajo, **mueve** la carpeta `storage` al Escritorio (para guardarla).
2.  Borra TODA la carpeta antigua del programa.
3.  Pon la carpeta NUEVA del programa.
4.  Coge la carpeta `storage` que dejaste en el Escritorio y **muévela dentro** de la nueva carpeta.
5.  ¡Listo! Tienes el código nuevo con los datos viejos.

---

## Resumen para tus compañeros

_"Chicos, antes de actualizar, ejecutad HACER_BACKUP.bat por si acaso. Luego copiad los archivos nuevos encima, pero NUNCA borréis la carpeta storage a mano."_
