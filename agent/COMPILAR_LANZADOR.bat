@echo off
setlocal
cd /d "%~dp0"
echo ===================================================
// turbo
echo   COMPILADOR DE LANZADOR - RECEPCION SUITE
echo ===================================================
echo.

:: 1. Buscar compilador de C# (csc.exe)
set "CSC="
if exist "%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe" (
    set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
) else if exist "%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
    set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
)

if "%CSC%"=="" (
    echo [!] ERROR: No se encuentra el compilador de .NET Framework (csc.exe).
    echo     Asegúrate de tener .NET Framework 4.0 o superior instalado.
    pause
    exit /b
)

:: 2. Definir rutas
set "SOURCE=RecepcionSuiteLauncher.cs"
set "OUTPUT=RecepcionSuite.exe"
set "ICON=..\assets\resources\images\icono.ico"

echo [+] Compilando %OUTPUT%...

:: Referencias necesarias para WinForms y Drawing
set "REFS=/reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.dll"

if exist "%ICON%" (
    "%CSC%" /target:winexe /out:"%OUTPUT%" /win32icon:"%ICON%" %REFS% "%SOURCE%"
) else (
    "%CSC%" /target:winexe /out:"%OUTPUT%" %REFS% "%SOURCE%"
)

if %errorlevel% equ 0 (
    echo.
    echo ===================================================
    echo   EXITO: SE HA CREADO "%OUTPUT%"
    echo ===================================================
    echo.
) else (
    echo.
    echo [!] ERROR EN LA COMPILACION. REVISA EL CODIGO O LAS REFERENCIAS.
    echo.
)

pause
