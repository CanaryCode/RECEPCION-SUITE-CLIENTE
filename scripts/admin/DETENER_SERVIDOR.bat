@echo off
cd /d "%~dp0..\.."
title [ RECEPCION SUITE ] - DETENER SERVIDOR
echo ==================================================
echo   DETENIENDO SERVIDOR PARA MANTENIMIENTO
echo ==================================================
echo.
echo   [!] Cerrando procesos de Node.js...
taskkill /F /IM node.exe /T 2>nul
echo.
echo   [OK] El servidor se ha detenido. 
echo   [i] Ahora puedes reemplazar los archivos sin bloqueos.
echo.
pause
