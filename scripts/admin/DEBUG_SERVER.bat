@echo off
cd /d "%~dp0..\.."
echo ==========================================
echo DIAGNOSTICO DE SERVIDOR
echo ==========================================
echo.
echo 1. Verificando archivos...
if exist "server\app.js" ( echo [OK] server\app.js encontrado ) else ( echo [ERROR] server\app.js NO encontrado )
if exist "server\routes\system.js" ( echo [OK] server\routes\system.js encontrado ) else ( echo [ERROR] server\routes\system.js NO encontrado )

echo.
echo 2. Iniciando Servidor con trazas detalladas...
echo.

:: Usar node del sistema o del bin
set "NODE_EXEC=node"
if exist "bin\node.exe" set "NODE_EXEC=bin\node.exe"

"%NODE_EXEC%" server/app.js

echo.
echo ==========================================
echo EL SERVIDOR SE HA CERRADO
echo ==========================================
pause
