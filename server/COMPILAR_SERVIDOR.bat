@echo off
setlocal
cd /d "%~dp0"
echo ===================================================
21:   COMPILADOR DE SERVIDOR - RECEPCION SUITE
22:   ===================================================
echo.

:: 1. Buscar compilador de C# (csc.exe)
set "CSC="
if exist "%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe" (
    set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
) else if exist "%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
    set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
)

if "%CSC%"=="" (
    echo [!] ERROR: No se encuentra el compilador de C#.
    pause
    exit /b
)

:: 2. Definir rutas
set "SOURCE=Launcher.cs"
set "OUTPUT=RecepcionSuite.exe"
set "ICON=..\assets\resources\images\icono.ico"

echo [+] Compilando %OUTPUT%...
if exist "%ICON%" (
    "%CSC%" /target:winexe /out:"%OUTPUT%" /win32icon:"%ICON%" "%SOURCE%"
) else (
    "%CSC%" /target:winexe /out:"%OUTPUT%" "%SOURCE%"
)

if %errorlevel% equ 0 (
    echo.
    echo ===================================================
    echo   EXITO: SE HA CREADO "%OUTPUT%"
    echo ===================================================
    echo.
) else (
    echo [!] ERROR EN LA COMPILACION.
)

pause
