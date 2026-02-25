@echo off
title [ RECEPCION SUITE ] - INICIANDO SERVIDOR
cd /d "%~dp0"

echo [+] Buscando procesos previos en puerto 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    if NOT "%%a"=="0" (
        echo [!] Cerrando servidor anterior (PID %%a)...
        taskkill /F /PID %%a >nul 2>nul
    )
)

echo [+] Iniciando Servidor Central (Puerto 3000)...
start /b node server/app.js

echo [+] Iniciando Agente Local (Puerto 3001)...
start /b node agent/agent.js

echo [OK] El sistema esta corriendo en segundo plano.

set /p OpenAdmin="Deseas abrir la Consola de Administracion? (S/N): "
if /I "%OpenAdmin%"=="S" (
    echo [+] Abriendo consola de administracion...
    timeout /t 2 > nul
    start http://localhost:3001/assets/admin/index.html
) ELSE (
    echo [+] La aplicacion Recepcion Suite seguira corriendo en segundo plano.
)

echo      Puedes cerrar esta ventana en 5 segundos...
timeout /t 5

exit
