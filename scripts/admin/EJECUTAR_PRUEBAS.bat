@echo off
setlocal enabledelayedexpansion
set "VERSION=4.0 [WEB EDITION]"

:: Forzar que el script se ejecute siempre en su propia carpeta
cd /d "%~dp0..\.."

:: Título de la ventana
title [ RECEPCION SUITE ] - VALIDACIÓN DE INTEGRIDAD

echo  =======================================================
echo   RECEPCION SUITE - Suite de Pruebas Automáticas
echo   Propósito: Verificar Transacciones y Base de Datos
echo  =======================================================
echo.

:: ---------------------------------------------------------
:: 1. BUSQUEDA DE MOTOR NODE.JS
:: ---------------------------------------------------------

:: Opcion 1: Node.js Portable (Carpeta local 'bin')
set "NODE_EXEC=%~dp0bin\node.exe"
if exist "!NODE_EXEC!" (
    echo   [+] Motor: PORTABLE (Local /bin)
    goto :RunTests
)

:: Opcion 2: Node.js Instalado (PATH del sistema)
where node >nul 2>nul
if %errorlevel% equ 0 (
    set "NODE_EXEC=node"
    echo   [+] Motor: SISTEMA (Installed)
    goto :RunTests
)

:: ---------------------------------------------------------
:: SI LLEGAMOS AQUI, NO SE ENCONTRO NADA
:: ---------------------------------------------------------
echo   [!] ERROR: No se encuentra Node.js para correr las pruebas.
echo       Por favor, instala Node.js o usa la version portable.
echo.
pause
exit /b

:: ---------------------------------------------------------
:: 2. EJECUCION DE PRUEBAS
:: ---------------------------------------------------------
:RunTests

echo   [i] Iniciando pruebas de INTEGRIDAD (Storage + Transactions)...
echo.

"!NODE_EXEC!" tests/integration/storage.test.js

if %errorlevel% equ 0 (
    echo.
    echo   =======================================================
    echo   ✅ PRUEBAS FINALIZADAS CON ÉXITO
    echo   =======================================================
) else (
    echo.
    echo   =======================================================
    echo   ❌ SE DETECTARON ERRORES EN LAS PRUEBAS
    echo   =======================================================
)

echo.
pause
exit /b
