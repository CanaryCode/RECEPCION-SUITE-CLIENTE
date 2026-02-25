@echo off
setlocal enabledelayedexpansion
title [ RECEPCION SUITE ] - CREAR VERSION PORTABLE

echo =======================================================
echo   CREADOR DE VERSION PORTABLE
echo =======================================================
echo.
echo   Este script preparara la aplicacion para funcionar en CUALQUIER PC
echo   copiando el ejecutable de Node.js dentro de la carpeta.
echo.

:: 1. Verificar si ya existe la carpeta bin
if not exist "%~dp0..\..\bin" (
    echo   [+] Creando carpeta 'bin'...
    mkdir "%~dp0..\..\bin"
)

:: 2. Buscar Node.js en el sistema actual
echo   [?] Buscando Node.js en su sistema...

:: Intento 1: PATH global
where node >nul 2>nul
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('where node') do (
        set "NODE_PATH=%%i"
        goto :FoundNode
    )
)

:: Intento 2: C:\Program Files\nodejs\node.exe
if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE_PATH=%ProgramFiles%\nodejs\node.exe"
    goto :FoundNode
)

:: Intento 3: C:\Program Files (x86)\nodejs\node.exe
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "NODE_PATH=%ProgramFiles(x86)%\nodejs\node.exe"
    goto :FoundNode
)

:: Intento 4: Ruta especifica conocida (Tu PC)
if exist "C:\Users\jesus\AppData\Local\ms-playwright-go\1.50.1\node.exe" (
    set "NODE_PATH=C:\Users\jesus\AppData\Local\ms-playwright-go\1.50.1\node.exe"
    goto :FoundNode
)

:: Si no se encuentra en ningun sitio:
echo   [!] ERROR: No se encontro Node.js instalado en este equipo.
echo       Necesitas tener Node.js instalado para crear la version portable.
echo       Instalalo desde: https://nodejs.org/
echo.
pause
exit /b

:FoundNode
echo   [+] Node.js encontrado en: !NODE_PATH!

:: 4. Copiar Node.exe a la carpeta bin
echo   [+] Copiando a carpeta local 'bin'...
copy "!NODE_PATH!" "%~dp0..\..\bin\node.exe" >nul

:: 5. Asegurar node_modules (OPCIONAL pero recomendado)
echo   [?] Comprobando si existen librerias de servidor...
if exist "%~dp0..\..\server\package.json" (
    echo   [+] Detectado proyecto Node.js en 'server'.
    cd /d "%~dp0..\..\server"
    if not exist "node_modules" (
        echo   [!] No se encontro 'node_modules'. Intentando instalar...
        call npm install
    ) else (
        echo   [OK] Las librerias ya estan presentes.
    )
    cd /d "%~dp0..\.."
)

if %errorlevel% equ 0 (
    echo.
    echo   =======================================================
    echo   [OK] EXITO: ¡VERSION PORTABLE LISTA!
    echo   =======================================================
    echo.
    echo   PROXIMOS PASOS PARA EL OTRO PC:
    echo   1. Copia toda esta carpeta ("RECEPCION SUITE") a un USB.
    echo   2. Ejecuta solo "INICIAR_APP.bat" o "RecepcionSuite.exe".
    echo.
) else (
    echo.
    echo   [!] ERROR al preparar la version portable.
)

echo.
pause
