@echo off
setlocal enabledelayedexpansion
title RECOMPILACION POST-ACTUALIZACION - RECEPCION SUITE

:: Este script se ejecuta automáticamente después de una actualización
:: para recompilar el launcher con los nuevos archivos

cd /d "%~dp0"

echo ===================================================
echo   RECOMPILACION POST-ACTUALIZACION
echo ===================================================
echo.
echo [i] Iniciando recompilacion del launcher...
echo.

:: Verificar que existe el script de compilación
if not exist "build_launcher.bat" (
    echo [!] ERROR: No se encuentra build_launcher.bat
    echo.
    pause
    exit /b 1
)

:: Ejecutar la compilación
call build_launcher.bat

:: Verificar que se creó el ejecutable
if exist "RecepcionSuite.exe" (
    echo.
    echo ===================================================
    echo   RECOMPILACION EXITOSA
    echo ===================================================
    echo.
    echo [+] El launcher ha sido recompilado correctamente.
    echo [+] Puede cerrar esta ventana y reiniciar la aplicacion.
    echo.
) else (
    echo.
    echo [!] ERROR: No se pudo crear RecepcionSuite.exe
    echo.
)

pause
