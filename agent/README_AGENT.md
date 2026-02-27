# Guía de Inicio del Agente Local (Recepcion Suite)

El Agente Local es necesario para gestionar el hardware (datafonos, impresoras) y la seguridad de la estación. Siga estos pasos para ponerlo en marcha en el nuevo PC:

## Requisitos Previos
1. **Node.js**: Debe estar instalado en el sistema. Puedes descargarlo desde [nodejs.org](https://nodejs.org/).
2. **Conexión a Internet**: Necesaria para la instalación inicial de dependencias.

## Pasos para la Puesta en Marcha

1. **Opción Recomendada (Todo Automático)**:
   - Haz doble clic en el archivo **`INICIAR_AGENTE.bat`** en la carpeta `agent`.
   - El script detectará si falta Node.js o las librerías (`node_modules`) y las instalará automáticamente antes de arrancar.

2. **Opción Manual (Paso a Paso)**:
   - Abre una terminal en la carpeta `agent`.
   - Ejecuta `npm install`.
   - Ejecuta `node src/index.js`.


3. **Verificar**:
   - Si la terminal muestra `[AGENT] Servidor iniciado en puerto 3001`, el agente está funcionando.
   - Refresca la aplicación web en el navegador. Las advertencias de "Agente no detectado" deberían desaparecer.

## Solución de Problemas
- **ERR_CONNECTION_REFUSED**: Significa que el proceso Node.js no se ha iniciado. Asegúrate de que no haya errores de "npm install" y de que el puerto 3001 esté libre.
- **502 Bad Gateway**: Si ves esto en el navegador al intentar cargar la configuración, suele ser consecuencia de que el agente no está respondiendo localmente.
