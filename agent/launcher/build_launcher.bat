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

if not exist "!SOURCE!" (
    echo [!] ERROR: No se encuentra el archivo fuente '!SOURCE!' en esta carpeta.
    pause
    exit /b
)

echo [i] Intentando compilar !OUTPUT! via PowerShell (Metodo Universal)...
echo.

:: Crear un pequeño script de PowerShell temporal para la compilación
echo $source = Get-Content -Raw -Path "!SOURCE!" -Encoding UTF8 > compile_tmp.ps1
echo $params = New-Object System.CodeDom.Compiler.CompilerParameters >> compile_tmp.ps1
echo $params.GenerateExecutable = $true >> compile_tmp.ps1
echo $params.OutputAssembly = "!OUTPUT!" >> compile_tmp.ps1
echo $params.CompilerOptions = "/target:winexe /codepage:65001" >> compile_tmp.ps1
if exist "!ICON!" (
    echo $params.CompilerOptions += " /win32icon:!ICON!" >> compile_tmp.ps1
)
echo $params.ReferencedAssemblies.Add("System.Windows.Forms.dll") ^| Out-Null >> compile_tmp.ps1
echo $params.ReferencedAssemblies.Add("System.Drawing.dll") ^| Out-Null >> compile_tmp.ps1
echo $params.ReferencedAssemblies.Add("System.dll") ^| Out-Null >> compile_tmp.ps1
echo $provider = New-Object Microsoft.CSharp.CSharpCodeProvider >> compile_tmp.ps1
echo $results = $provider.CompileAssemblyFromSource($params, $source) >> compile_tmp.ps1
echo if ($results.Errors.Count -gt 0) { >> compile_tmp.ps1
echo    $results.Errors ^| ForEach-Object { Write-Error $_.ErrorText } >> compile_tmp.ps1
echo    exit 1 >> compile_tmp.ps1
echo } else { >> compile_tmp.ps1
echo    exit 0 >> compile_tmp.ps1
echo } >> compile_tmp.ps1

:: Ejecutar el script de PowerShell
powershell -ExecutionPolicy Bypass -File compile_tmp.ps1
set "EXIT_CODE=%errorlevel%"

:: Limpiar
if exist compile_tmp.ps1 del compile_tmp.ps1

echo.
if !EXIT_CODE! equ 0 (
    echo ===================================================
    echo   EXITO: SE HA CREADO "!OUTPUT!"
    echo ===================================================
    echo.
) else (
    echo.
    echo [!] ERROR: La compilación ha fallado. 
    echo     Asegúrate de tener .NET Framework 4.0 o superior activado.
    echo.
)

pause
