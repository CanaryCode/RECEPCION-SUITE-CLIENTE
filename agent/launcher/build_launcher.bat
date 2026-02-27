@echo off
setlocal enabledelayedexpansion
title COMPILADOR DE LANZADOR - RECEPCION SUITE

:: Forzar que el script se ejecute siempre en su propia carpeta
cd /d "%~dp0"

echo ===================================================
echo   COMPILADOR DE LANZADOR - RECEPCION SUITE
echo ===================================================
echo.

set "SOURCE=Launcher.cs"
set "OUTPUT=RecepcionSuite.exe"
set "ICON=..\resources\images\icono.ico"

:: 1. Cerrar el proceso si ya está abierto
echo [i] Cerrando instancias previas de !OUTPUT!...
taskkill /f /im "!OUTPUT!" >nul 2>&1

if not exist "!SOURCE!" (
    echo [!] ERROR: No se encuentra el archivo fuente '!SOURCE!' en esta carpeta.
    pause
    exit /b
)

echo [i] Intentando compilar !OUTPUT! via PowerShell...
echo.

:: 2. Generar un nombre único para el script temporal para evitar bloqueos
set "TEMP_PS1=compile_%RANDOM%.ps1"
if exist "!TEMP_PS1!" del /f /q "!TEMP_PS1!" >nul 2>&1

:: 3. Crear el script de PowerShell
(
echo $source = Get-Content -Raw -Path "!SOURCE!" -Encoding UTF8
echo $params = New-Object System.CodeDom.Compiler.CompilerParameters
echo $params.GenerateExecutable = $true
echo $params.OutputAssembly = "!OUTPUT!"
echo $params.CompilerOptions = "/target:winexe /codepage:65001"
echo if (Test-Path "!ICON!"^) {
echo     $params.CompilerOptions += " /win32icon:!ICON!"
echo }
echo $params.ReferencedAssemblies.Add("System.Windows.Forms.dll"^) ^| Out-Null
echo $params.ReferencedAssemblies.Add("System.Drawing.dll"^) ^| Out-Null
echo $params.ReferencedAssemblies.Add("System.dll"^) ^| Out-Null
echo $provider = New-Object Microsoft.CSharp.CSharpCodeProvider
echo $results = $provider.CompileAssemblyFromSource($params, $source^)
echo if ($results.Errors.Count -gt 0^) {
echo    $results.Errors ^| ForEach-Object { Write-Error $_.ErrorText }
echo    exit 1
echo } else {
echo    exit 0
echo }
) > "!TEMP_PS1!"

:: 4. Ejecutar el script de PowerShell
powershell -ExecutionPolicy Bypass -File "!TEMP_PS1!"
set "EXIT_CODE=%errorlevel%"

:: 5. Limpiar
if exist "!TEMP_PS1!" del /f /q "!TEMP_PS1!" >nul 2>&1

echo.
if !EXIT_CODE! equ 0 (
    echo ===================================================
    echo   EXITO: SE HA CREADO "!OUTPUT!"
    echo ===================================================
    echo.
) else (
    echo.
    echo [!] ERROR: La compilacion ha fallado. 
    echo     Si el error es "Acceso denegado", asegúrate de que "!OUTPUT!" no esté en uso.
    echo.
)

pause
