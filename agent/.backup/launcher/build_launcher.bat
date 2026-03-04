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

:: 2. Generar un nombre único para el script temporal
set "TEMP_PS1=compile_%RANDOM%.ps1"
if exist "!TEMP_PS1!" del /f /q "!TEMP_PS1!" >nul 2>&1

:: 3. Crear el script de PowerShell línea a línea para evitar errores de escape de CMD
echo $source = Get-Content -Raw -Path "%SOURCE%" -Encoding UTF8 > "!TEMP_PS1!"
echo $params = New-Object System.CodeDom.Compiler.CompilerParameters >> "!TEMP_PS1!"
echo $params.GenerateExecutable = $true >> "!TEMP_PS1!"
echo $params.OutputAssembly = "%OUTPUT%" >> "!TEMP_PS1!"
echo $params.CompilerOptions = "/target:winexe /codepage:65001" >> "!TEMP_PS1!"
echo if (Test-Path "%ICON%") { >> "!TEMP_PS1!"
echo     $params.CompilerOptions += " /win32icon:%ICON%" >> "!TEMP_PS1!"
echo } >> "!TEMP_PS1!"

:: El carácter pipe (|) debe escaparse con ^ en Batch si no está entre comillas
echo $params.ReferencedAssemblies.Add("System.Windows.Forms.dll") ^| Out-Null >> "!TEMP_PS1!"
echo $params.ReferencedAssemblies.Add("System.Drawing.dll") ^| Out-Null >> "!TEMP_PS1!"
echo $params.ReferencedAssemblies.Add("System.dll") ^| Out-Null >> "!TEMP_PS1!"

echo $provider = New-Object Microsoft.CSharp.CSharpCodeProvider >> "!TEMP_PS1!"
echo $results = $provider.CompileAssemblyFromSource($params, $source) >> "!TEMP_PS1!"

echo if ($results.Errors.Count -gt 0) { >> "!TEMP_PS1!"
echo    foreach ($err in $results.Errors) { >> "!TEMP_PS1!"
echo        Write-Host "ERROR: $($err.ErrorText)" -ForegroundColor Red >> "!TEMP_PS1!"
echo    } >> "!TEMP_PS1!"
echo    exit 1 >> "!TEMP_PS1!"
echo } else { >> "!TEMP_PS1!"
echo    exit 0 >> "!TEMP_PS1!"
echo } >> "!TEMP_PS1!"

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
    echo [!] ERROR: La compilación ha fallado. 
    echo.
)

pause
