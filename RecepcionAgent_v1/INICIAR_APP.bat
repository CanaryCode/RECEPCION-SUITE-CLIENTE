@echo off
setlocal enabledelayedexpansion
set "VERSION=4.0 [WEB EDITION]"

:: Forzar que el script se ejecute siempre en su propia carpeta
cd /d "%~dp0"

:: Título de la ventana
title [ RECEPCION SUITE v%VERSION% ] - SERVIDOR ACTIVO

echo  =======================================================
echo   RECEPCION SUITE - Sistema de Gestion Hotelera
echo   Versión: %VERSION%
echo  =======================================================
echo.

:: ---------------------------------------------------------
:: 1. BUSQUEDA DE MOTOR NODE.JS
:: ---------------------------------------------------------

:: Opcion 1: Node.js Portable (Carpeta local 'bin')
set "NODE_EXEC=%~dp0bin\node.exe"
if exist "!NODE_EXEC!" (
    echo   [+] Modo: PORTABLE (Usando Node local en /bin)
    goto :CheckDependencies
)

:: Opcion 2: Node.js Instalado (PATH del sistema)
where node >nul 2>nul
if %errorlevel% equ 0 (
    set "NODE_EXEC=node"
    echo   [+] Modo: INSTALADO (Usando Node del Sistema)
    goto :CheckDependencies
)

:: Opcion 3: Busqueda en Program Files
if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE_EXEC=%ProgramFiles%\nodejs\node.exe"
    goto :CheckDependencies
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "NODE_EXEC=%ProgramFiles(x86)%\nodejs\node.exe"
    goto :CheckDependencies
)

:: ---------------------------------------------------------
:: SI LLEGAMOS AQUI, NO SE ENCONTRO NADA
:: ---------------------------------------------------------
echo.
echo   [!] ERROR CRITICO: No se encuentra Node.js.
echo.
echo   Para que esta aplicacion sea PORTABLE, debes copiar el archivo
echo   "node.exe" dentro de una carpeta llamada "bin" aqui mismo.
echo.
echo   Estructura requerida:
echo      /RECEPCION SUITE/
91:         /bin/node.exe
92:         /server/...
93:         INICIAR_APP.bat
echo.
pause
exit /b

:: ---------------------------------------------------------
:: 2. VERIFICACION DE DEPENDENCIAS (AUTO-INSTALL)
:: ---------------------------------------------------------
:CheckDependencies

if not exist "%~dp0server\node_modules" (
    echo.
    echo   [!] PRIMERA EJECUCION O LIBRERIAS FALTANTES
    echo   [i] Intentando instalar librerias necesarias...
    echo.
    
    :: Verificar si tenemos NPM
    where npm >nul 2>nul
    if !errorlevel! equ 0 (
        cd server
        call npm install
        cd ..
        echo.
        echo   [+] Instalacion completada de forma automatica.
    ) else (
        echo   [!] ERROR: No se encontro 'node_modules' y tampoco tenemos 'npm' 
        echo       instalado en este equipo para descargarlos.
        echo.
        echo       SOLUCION: 
        echo       1. Instala Node.js en este PC (https://nodejs.org/)
        echo       2. O copia el programa desde el PC original INCLUYENDO la carpeta 'server/node_modules'.
        echo.
        pause
        exit /b
    )
    echo.
)

:: ---------------------------------------------------------
:: 3. ARRANQUE
:: ---------------------------------------------------------
:: ---------------------------------------------------------
:: 4. LANZAMIENTO DEL AGENTE LOCAL (Puerto 3001)
:: ---------------------------------------------------------
echo.
echo   [+] LANZANDO AGENTE HARDWARE (Localhost:3001)...
cd agent
start /b node agent.js > logs/agent.log 2>&1
cd ..

:: ---------------------------------------------------------
:: 5. LANZAMIENTO DEL SERVIDOR O NAVEGADOR
:: ---------------------------------------------------------
echo.
echo   [?] ¿Deseas iniciar también el SERVIDOR LOCAL (Puerto 3000)?
echo       (Si vas a conectar a un servidor remoto en Ubuntu, elige N)
set /p START_SERVER="   ¿Iniciar servidor local? (S/N): "

if /i "%START_SERVER%"=="S" (
    echo   [+] Iniciando Servidor de Datos...
    cd server
    start /b node app.js > logs/server.log 2>&1
    cd ..
)

echo.
echo   [+] Abriendo Recepción Suite...
timeout /t 2 > nul
start http://localhost:3000

exit
