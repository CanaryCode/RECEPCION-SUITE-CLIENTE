@echo off
cd /d "%~dp0..\.."
set "VERSION=5.0 [ADMIN]"
title [ RECEPCION SUITE ] - LANZANDO CONSOLA DE ADMINISTRACIÓN

echo  =======================================================
echo   RECEPCION SUITE - Consola de Administración
echo  =======================================================
echo.
echo   [1] Gestionar Servidor LOCAL (Este PC)
echo   [2] Gestionar Servidor REMOTO (Tenerife)
echo   [3] Abrir AMBOS
echo.
set /p opt="Selecciona una opcion [1-3]: "

if "%opt%"=="1" goto local
if "%opt%"=="2" goto remote
if "%opt%"=="3" goto both
goto local

:local
echo   [+] Abriendo consola LOCAL...
start http://localhost:3000/assets/admin/index.html?v=1
goto end

:remote
echo   [+] Abriendo consola REMOTA (Tenerife)...
start http://www.desdetenerife.com:3000/assets/admin/index.html?v=1
goto end

:both
echo   [+] Abriendo ambas consolas...
start http://localhost:3000/assets/admin/index.html?v=1
start http://www.desdetenerife.com:3000/assets/admin/index.html?v=1
goto end

:end
echo.
echo   [!] La consola requiere que el servidor correspondiente este activo.
echo.
timeout /t 5
exit
