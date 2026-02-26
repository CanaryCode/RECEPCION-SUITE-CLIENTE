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
        echo       1. Instala Node.js en este PC ^(https://nodejs.org/^)
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
:: 5. INTERFAZ GRAFICA Y LANZAMIENTO DEL SERVIDOR
:: ---------------------------------------------------------
echo.
echo   [+] Mostrando interfaz de seleccion de aplicacion...

:: Ejecutar script de interfaz grafica en PowerShell y capturar seleccion
for /f "delims=" %%I in ('powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0launcher_ui.ps1"') do set "USER_CHOICE=%%I"

if "%USER_CHOICE%"=="CANCEL" (
    echo   [-] Lanzamiento cancelado por el usuario.
    exit
)
if "%USER_CHOICE%"=="" (
    :: Fallback por si PowerShell no responde correctamente
    set "USER_CHOICE=WEB"
)

:: Verificar si el servidor ya esta corriendo (Puerto 3000)
netstat -ano | findstr :3000 >nul
if %errorlevel% neq 0 (
    echo   [+] El Servidor Local (puerto 3000) NO esta activo. Iniciando Servidor...
    :: Se inicia server_v4.js desde la raiz del proyecto
    start /b node "%~dp0server_v4.js" > "%~dp0server\logs\server.log" 2>&1
    :: Esperar unos segundos a que inicie
    timeout /t 3 > nul
) else (
    echo   [+] El Servidor Local ya esta en ejecucion en el puerto 3000.
)

echo.
if "%USER_CHOICE%"=="ADMIN" (
    echo   [+] Abriendo Consola de Administracion...
    start http://localhost:3000/admin
) else (
    echo   [+] Abriendo Recepcion Suite Web...
    start http://localhost:3000
)

exit
