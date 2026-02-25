@echo off
title AGENTE LOCAL - RECEPCION SUITE
echo.
echo   ========================================
1:   [AGENTE] INICIANDO SERVICIOS LOCALES...
2:   ========================================
echo.

:: Verificar si Node está presente
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Asegurate de que el archivo node.exe este en esta carpeta o instalado.
    pause
    exit
)

echo [+] Iniciando servidor del Agente...
start /b node agent.js

echo [+] Esperando inicializacion...
timeout /t 3 > nul

echo.
echo [OK] Agente en ejecucion en puerto 3001.
echo Ya puedes usar la aplicacion web.
echo.
pause
