---
description: Archivar conocimiento y subir a GitHub al terminar una sesión de trabajo (palabra clave SELLADO)
---

# Protocolo SELLADO

Cuando el usuario diga **"SELLADO"**, ejecutar los siguientes pasos en orden:

## 1. Actualizar `docs/obstaculos.md`

Añadir una nueva entrada con el formato estándar documentando:

- El problema que se ha resuelto en esta sesión
- Causa raíz
- Solución aplicada
- Archivos afectados
- Lección aprendida

## 2. Actualizar `docs/CONTEXTO_PROYECTO.md`

Actualizar la sección **Estado Actual**:

- Versión actual (si cambió)
- Módulo en foco
- Deuda técnica conocida
- Fecha de última actualización

## 3. Actualizar otros docs si procede

- `docs/arquitectura.md` si cambió algo estructural
- `docs/algoritmos.md` si se implementó un algoritmo nuevo
- `docs/reglas_de_oro.md` si surgió una nueva regla

## 4. Git commit y push

// turbo

```bash
cd /home/ajpd/recepcion-suite && git add -A && git commit -m "SELLADO: [resumen de la sesión]" && git push origin main
```

> **Nota**: el mensaje del commit debe resumir en pocas palabras lo trabajado en la sesión.
