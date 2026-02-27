@echo off
setlocal enabledelayedexpansion
title AGENTE LOCAL - RECEPCION SUITE
cd /d "%~dp0"

echo ===================================================
echo   LANZADOR AUTOMATICO - AGENTE LOCAL
echo ===================================================
echo.

:: 1. Verificar si Node.js está instalado
echo [i] Verificando Node.js...
node -v >nul 2>&1
if !errorlevel! neq 0 (
    echo [!] ERROR: Node.js no esta instalado. 
    echo     Por favor, instalelo desde https://nodejs.org/
    pause
    exit /b
)

:: 2. Verificar carpeta node_modules
if not exist "node_modules" (
    echo [i] No se encontraron dependencias (node_modules). 
    echo     Instalando librerias necesarias (npm install)...
    echo.
    call npm install
    if !errorlevel! neq 0 (
        echo.
        echo [!] ERROR: La instalacion de dependencias ha fallado.
        echo     Asegurese de tener conexion a internet.
        pause
        exit /b
    )
    echo.
    echo [i] Dependencias instaladas con exito.
)

:: 3. Iniciar el Agente
echo [i] Iniciando Agente Local (src/index.js)...
echo.
node src/index.js

if !errorlevel! neq 0 (
    echo.
    echo [!] El agente se ha detenido de forma inesperada.
    pause
)
