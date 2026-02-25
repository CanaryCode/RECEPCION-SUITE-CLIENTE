@echo off
title [ RECEPCION SUITE ] - APAGANDO SERVIDOR
cd /d "%~dp0"

echo [!] Cerrando Servidor Central (Puerto 3000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    if NOT "%%a"=="0" (
        taskkill /F /PID %%a >nul 2>nul
        echo [+] Servidor cerrado (PID %%a).
    )
)

echo [!] Cerrando Agente Local (Puerto 3001)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do (
    if NOT "%%a"=="0" (
        taskkill /F /PID %%a >nul 2>nul
        echo [+] Agente cerrado (PID %%a).
    )
)

echo [OK] Todos los servicios de Recepcion Suite se han detenido.
timeout /t 3
exit
