@echo off
cd /d "%~dp0..\.."
setlocal
echo ===================================================
echo   COMPILADOR DE RECEPCION SUITE
echo ===================================================
echo.

:: 1. Buscar compilador de C# (csc.exe)
set "CSC="

:: Intentar versiones comunes de .NET Framework
if exist "%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe" (
    set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
) else if exist "%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
    set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
) else (
    echo [!] ERROR: No se encuentra el compilador de C# (.NET Framework 4.0 o superior).
    echo     Esto es muy raro en Windows moderno.
    pause
    exit /b
)

echo [+] Compilador encontrado: 
echo     %CSC%
echo.

:: 2. Definir rutas
set "SOURCE=%~dp0server\Launcher.cs"
set "ICON=%~dp0assets\resources\images\icono.ico"
set "OUTPUT=%~dp0RecepcionSuite.exe"

if not exist "%SOURCE%" (
    echo [!] ERROR: No encuentro el codigo fuente: %SOURCE%
    pause
    exit /b
)

if not exist "%ICON%" (
    echo [!] ERROR: No encuentro el icono: %ICON%
    pause
    exit /b
)

:: 3. Compilar
echo [+] Compilando...
"%CSC%" /target:winexe /out:"%OUTPUT%" /win32icon:"%ICON%" "%SOURCE%"

if %errorlevel% equ 0 (
    echo.
    echo ===================================================
    echo   EXITO: SE HA CREADO "RecepcionSuite.exe"
    echo ===================================================
    echo.
    echo   Ahora puedes borrar 'INICIAR_APP.bat' si quieres.
    echo   Usa 'RecepcionSuite.exe' para abrir el programa.
    echo.
) else (
    echo.
    echo [!] ERROR EN LA COMPILACION.
    echo.
)

pause
