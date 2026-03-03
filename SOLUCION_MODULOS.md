# Solución: Módulos No Cargan

## Problema
Los siguientes módulos no se estaban cargando:
- Transfers ✓
- Desayunos ✓
- Cenas Frías ✓
- Atenciones VIP ✓
- Impresión de Documentos ❌ (faltaba en registry)
- Precios ✓
- Tiempo ✓
- Configuración ✓
- Alarmas del Sistema ✓
- Notas Permanentes ✓
- Galerías ✓

## Causa Raíz
1. **Versiones inconsistentes** de parámetros `?v=` (YA CORREGIDO)
2. **Módulos faltantes** en ModuleLoader.MODULE_REGISTRY
3. **Caché del navegador** con versiones antiguas

## Solución Aplicada

### 1. Módulos Agregados al Registry
Se agregaron los módulos faltantes en [ModuleLoader.js](assets/js/core/ModuleLoader.js):

```javascript
'impresion': {
    selector: '#impresion-content',
    importPath: '/assets/js/modules/Impresion.js?v=V156_UNIFIED',
    initFunction: 'inicializarImpresion',
    critical: false
},
```

### 2. Instrucciones para Usuario

#### Paso 1: Limpiar Caché
Abrir consola del navegador (F12) y ejecutar:
```javascript
window.forceClearCache()
```

#### Paso 2: Verificar Carga de Módulos
Después de recargar, ejecutar en consola:
```javascript
ModuleLoader.getStats()
```

Debería mostrar todos los módulos disponibles.

#### Paso 3: Cargar Módulo Manualmente (si falla)
```javascript
await ModuleLoader.loadModule('nombre-del-modulo')
```

## Módulos Críticos (cargan al inicio)
- despertadores
- novedades
- cena-fria
- desayuno
- transfers
- alarms
- alarms-ui
- configuracion

## Módulos Lazy (cargan bajo demanda)
- impresion
- precios
- tiempo
- notas-permanentes
- gallery
- atenciones
- safe
- riu
- etc.

## Verificación
```bash
# Ver stats de carga
grep "MODULE_REGISTRY =" -A 200 assets/js/core/ModuleLoader.js
```

---
**Fix aplicado:** 2026-03-02
