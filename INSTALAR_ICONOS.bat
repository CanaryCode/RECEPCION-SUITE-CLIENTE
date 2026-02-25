@echo off
setlocal
cd /d "%~dp0"

echo [i] Creando accesos directos en el Escritorio con icono...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/admin/crear_accesos.ps1"

echo.
echo [+] Proceso finalizado. Busca los iconos en tu escritorio.
timeout /t 5
exit
