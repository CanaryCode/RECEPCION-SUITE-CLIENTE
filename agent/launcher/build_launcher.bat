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

:: 1. Cerrar el proceso si ya está abierto (evita error de acceso denegado)
echo [i] Cerrando instancias previas de !OUTPUT!...
taskkill /f /im "!OUTPUT!" >nul 2>&1

if not exist "!SOURCE!" (
    echo [!] ERROR: No se encuentra el archivo fuente '!SOURCE!' en esta carpeta.
    pause
    exit /b
)

echo [i] Intentando compilar !OUTPUT! via PowerShell...
echo.

:: 2. Asegurar que no haya restos de ejecuciones fallidas
if exist compile_tmp.ps1 del /f /q compile_tmp.ps1 >nul 2>&1

:: 3. Crear el script de PowerShell de forma más limpia
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
) > compile_tmp.ps1

:: 4. Ejecutar el script de PowerShell
powershell -ExecutionPolicy Bypass -File compile_tmp.ps1
set "EXIT_CODE=%errorlevel%"

:: 5. Limpiar
if exist compile_tmp.ps1 del /f /q compile_tmp.ps1 >nul 2>&1

echo.
if !EXIT_CODE! equ 0 (
    echo ===================================================
    echo   EXITO: SE HA CREADO "!OUTPUT!"
    echo ===================================================
    echo.
) else (
    echo.
    echo [!] ERROR: La compilacion ha fallado. 
    echo     Asegurate de que "!OUTPUT!" no este abierto.
    echo.
)

pause
