---
description: Actualizar el contexto del proyecto tras resolver un problema (activado con la palabra "SELLADO")
---

# Workflow: Actualizar Contexto del Proyecto (SELLADO)

Este workflow se activa cuando el usuario escribe la palabra **`SELLADO`** al final de una sesión de trabajo.

> 📌 El documento de contexto es un **documento vivo**. Crece y mejora con cada sesión. El objetivo es que ningún problema se resuelva dos veces y que la próxima sesión empiece con más conocimiento que la anterior.

## Cuándo activar

- El usuario escribe `SELLADO` (sola o en una frase como "ya funciona, SELLADO" o "SELLADO, lo dejamos aquí").
- Indica que el problema se da por resuelto y hay que archivar el conocimiento generado.

## Pasos

// turbo-all

### 1. Leer el estado actual

Leer los archivos de documentación relevantes para entender el contexto antes de actualizar:

- `docs/obstaculos.md` — para no duplicar entradas
- El archivo de módulo relevante si se trabajó en un módulo concreto

### 2. Actualizar `docs/obstaculos.md`

Añadir una nueva entrada al historial con este formato:

```
### [FECHA] Título del Problema
**Síntoma**: qué veía el usuario
**Causa raíz**: por qué pasaba
**Solución**: qué se hizo
**Archivos afectados**: lista de archivos tocados
**Lección**: regla o patrón para evitar que se repita
```

Ser conciso pero completo. Incluir solo lo que NO es obvio o que podría repetirse.

### 3. Actualizar el documento del área afectada (si aplica)

- Si se cambió lógica de datos → revisar y actualizar `docs/algoritmos.md`
- Si se añadió un módulo nuevo → actualizar `docs/modulos_casos_de_uso.md`
- Si se estableció una nueva regla → añadir a `docs/reglas_de_oro.md`
- Si se cambió la arquitectura → actualizar `docs/arquitectura.md`
- Si se resolvió un error recurrente → añadir a `docs/troubleshooting.md`

### 4. Subir a GitHub

Tras actualizar los docs, hacer commit y push:

```bash
cd /home/ajpd/recepcion-suite
git add docs/ .agent/
git commit -m "docs: SELLADO - [título breve del problema resuelto]"
git push
```

### 5. Confirmar al usuario

Responder con un resumen muy breve de lo que se archivó:

```
✅ SELLADO. Archivado en obstaculos.md:
- [Título del problema y solución en una línea]
[Otros docs actualizados si aplica]
📤 Docs subidos a GitHub.
```

## Notas para la IA

- **No preguntar** qué hay que documentar. Inferirlo de la conversación anterior.
- **Ser selectivo**: solo documentar lo que es no-obvio o que podría repetirse.
- **No duplicar** información que ya existe en los docs.
- Si la conversación fue larga, priorizar las causas-raíz y las lecciones sobre los detalles de implementación.
- El objetivo no es hacer un diario, sino construir una base de conocimiento útil para futuras sesiones.
- Si durante la sesión se añadió alguna nueva regla operativa, añadirla también a `reglas_de_oro.md`.
