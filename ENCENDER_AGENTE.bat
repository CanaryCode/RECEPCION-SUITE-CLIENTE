@echo off
setlocal enabledelayedexpansion
title [ AGENTE ] - ENCENDER SERVICIO
cd /d "%~dp0"

echo [+] AGENTE LOCAL - RECEPCION SUITE
echo [+] =======================================================
echo.

:: 1. VERIFICAR NODE.JS
node -v >nul 2>&1
if !errorlevel! neq 0 (
    echo [!] ERROR: Node.js no esta instalado.
    echo Por favor, instala Node.js (https://nodejs.org/) para continuar.
    pause
    exit /b
)

:: 2. AUTO-INSTALACION DE DEPENDENCIAS
if not exist "node_modules" (
    echo [!] PRIMERA EJECUCION: Instalando dependencias necesarias...
    echo Esto puede tardar un minuto...
    call npm install
    if !errorlevel! neq 0 (
        echo [!] ERROR: Hubo un problema al instalar las librerias.
        echo Revisa tu conexion a internet.
        pause
        exit /b
    )
    echo [+] Instalacion completada con exito.
    echo.
)

:: 3. LIMPIEZA DE PUERTO 3001
echo [+] Liberando puerto 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do (
    if NOT "%%a"=="0" (
        taskkill /F /PID %%a >nul 2>nul
    )
)

:: 4. LANZAMIENTO
echo [+] Iniciando Agente Local...
start /b node agent.js

echo.
echo [OK] El Agente esta funcionando correctamente.
echo      Ya puedes usar el sistema.
echo.
timeout /t 5
exit
