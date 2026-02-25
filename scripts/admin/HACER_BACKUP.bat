@echo off
setlocal enabledelayedexpansion
title [ RECEPCION SUITE ] - COPIA DE SEGURIDAD

:: Obtener fecha y hora para el nombre de la carpeta
set "FECHA=%DATE:/=-%"
set "HORA=%TIME::=-%"
set "HORA=%HORA: =0%"
set "HORA=%HORA:.=%_%"

set "BACKUP_NAME=BACKUP_DATOS_%FECHA%_%HORA%"
set "BACKUP_DIR=%~dp0..\..\Backups\%BACKUP_NAME%"

echo =======================================================
echo   SISTEMA DE COPIA DE SEGURIDAD
echo =======================================================
echo.
echo   [+] Creando copia de sus datos...
echo   [+] Destino: Backups\%BACKUP_NAME%

:: Crear carpeta
mkdir "%BACKUP_DIR%" 2>nul
mkdir "%BACKUP_DIR%\storage" 2>nul

:: Copiar archivos de datos (Todo lo que hay en storage)
xcopy "%~dp0..\..\storage" "%BACKUP_DIR%\storage" /E /I /Y >nul

if %errorlevel% equ 0 (
    echo.
    echo   [OK] COPIA COMPLETADA CON EXITO.
    echo.
    echo   Tus datos (agenda, configuracion, etc.) estan a salvo en:
    echo   "%BACKUP_DIR%"
) else (
    echo.
    echo   [!] OCURRIO UN ERROR AL COPIAR.
)

echo.
pause
