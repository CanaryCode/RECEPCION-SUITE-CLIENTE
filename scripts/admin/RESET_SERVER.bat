@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0..\.."

title [ RECEPCION SUITE ] - REINICIAR SERVIDOR

echo ==================================================
echo   RESET COMPLETO DEL SERVIDOR (FULL RESTART)
echo ==================================================
echo.

:: 1. Cerrar procesos Node.js
echo   [1] Cerrando procesos Node.js antiguos...
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 >nul

:: 2. Detectar Node.js
set "NODE_EXEC=node"
if exist "bin\node.exe" (
    set "NODE_EXEC=%~dp0bin\node.exe"
) else (
    where node >nul 2>nul
    if !errorlevel! neq 0 (
        echo [!] ERROR: No se encuentra Node.js ni localmente ni en el sistema.
        pause
        exit /b
    )
)

echo.
echo   [2] Iniciando Servidor...
echo.

if exist "server/app.js" (
    "!NODE_EXEC!" server/app.js
) else (
    echo [!] ERROR: No se encuentra 'server/app.js'
    pause
)

echo.
echo ==================================================
echo   SERVIDOR INICIADO - NO CERRAR ESTA VENTANA
echo ==================================================
pause
