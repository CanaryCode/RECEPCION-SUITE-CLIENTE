@echo off
setlocal enabledelayedexpansion
title AGENTE LOCAL - RECEPCION SUITE
cd /d "%~dp0"

echo ===================================================
echo   INSTALADOR Y LANZADOR - AGENTE LOCAL
echo ===================================================
echo.

:: 1. Verificar Node.js
echo [1/3] Verificando Node.js...
node -v >nul 2>&1
if !errorlevel! neq 0 (
    echo [!] ERROR: Node.js NO esta instalado. 
    echo     Por favor, instalelo desde: https://nodejs.org/
    echo.
    pause
    exit /b
) else (
    for /f "tokens=*" %%a in ('node -v') do set NODE_VER=%%a
    echo [OK] Node.js detectado: !NODE_VER!
)

:: 2. Verificar dependencias
if not exist "node_modules" (
    echo [2/3] No se encontraron dependencias. Instalando...
    echo     Esto puede tardar un minuto...
    echo.
    
    :: Comprobar si existe package.json
    if not exist "package.json" (
        echo [!] ERROR: No se encuentra el archivo 'package.json'.
        echo     Asegurate de haber extraido la carpeta 'agent' completa.
        pause
        exit /b
    )

    :: Ejecutar instalacion
    call npm install
    if !errorlevel! neq 0 (
        echo.
        echo [!] ERROR: La instalacion de dependencias ha fallado.
        echo     Comprueba tu conexion a internet o si tienes permisos.
        pause
        exit /b
    )
    echo.
    echo [OK] Dependencias instaladas con exito.
) else (
    echo [2/3] Dependencias ya instaladas.
)

:: 3. Verificar y cerrar procesos antiguos del puerto 3001
echo [3/4] Verificando si hay procesos antiguos en el puerto 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    echo     - Encontrado proceso antiguo en puerto 3001 (PID: %%a). Cerrando...
    taskkill /F /PID %%a >nul 2>&1
    if !errorlevel! equ 0 (
        echo     [OK] Proceso anterior cerrado.
    ) else (
        echo     [!] No se pudo cerrar el proceso. Continuando...
    )
)
echo.

:: 4. Iniciar el Agente
echo [4/4] Iniciando Agente Local...
echo.
node src/index.js

if !errorlevel! neq 0 (
    echo.
    echo [!] El agente se ha detenido de forma inesperada.
    pause
)
