@echo off
setlocal enabledelayedexpansion
title CERRAR AGENTE LOCAL - RECEPCION SUITE
cd /d "%~dp0"

echo ===================================================
echo   CERRAR AGENTE LOCAL - RECEPCION SUITE
echo ===================================================
echo.

:: Buscar y cerrar procesos en el puerto 3001
echo [1/2] Cerrando procesos en puerto 3001...
set "FOUND=0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    set "FOUND=1"
    echo     - Cerrando proceso (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
    if !errorlevel! equ 0 (
        echo     [OK] Proceso cerrado correctamente.
    ) else (
        echo     [!] No se pudo cerrar el proceso.
    )
)

if !FOUND! equ 0 (
    echo     [i] No hay procesos activos en el puerto 3001.
)

echo.

:: Buscar procesos de Node.js que contengan "agent" en su línea de comandos
echo [2/2] Buscando procesos de Node.js del agente...
set "NODE_FOUND=0"
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| findstr /C:"PID:"') do (
    set "PID=%%a"
    wmic process where "ProcessId=!PID!" get CommandLine 2>nul | findstr /i "agent" >nul
    if !errorlevel! equ 0 (
        set "NODE_FOUND=1"
        echo     - Cerrando proceso de Node.js del agente (PID: !PID!)...
        taskkill /F /PID !PID! >nul 2>&1
        if !errorlevel! equ 0 (
            echo     [OK] Proceso cerrado.
        )
    )
)

if !NODE_FOUND! equ 0 (
    echo     [i] No se encontraron procesos de Node.js del agente.
)

echo.
echo ===================================================
echo   AGENTE CERRADO
echo ===================================================
echo.

pause
