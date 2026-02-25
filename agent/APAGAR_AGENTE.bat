@echo off
title [ AGENTE ] - APAGAR SERVICIO
cd /d "%~dp0"

echo [!] Deteniendo Agente Local (Puerto 3001)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do (
    if NOT "%%a"=="0" (
        taskkill /F /PID %%a >nul 2>nul
        echo [+] Agente cerrado (PID %%a).
    )
)

echo [OK] El Agente se ha detenido.
timeout /t 3
exit
