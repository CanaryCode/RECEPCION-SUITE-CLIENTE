@echo off
setlocal enabledelayedexpansion

@echo.
@echo   =======================================================
@echo   [PACK] GENERADOR DE INSTALACION DEL AGENTE LOCAL
@echo   =======================================================
@echo.

set INSTALL_DIR=RecepcionAgent_v1
set AGENT_FOLDER=agent

if not exist "%AGENT_FOLDER%" (
    echo [ERROR] No se encuentra la carpeta 'agent'. 
    echo Ejecuta este script desde la raiz del proyecto.
    pause
    exit
)

rmdir /s /q "%INSTALL_DIR%" 2>nul
mkdir "%INSTALL_DIR%"

echo   [1/4] Copiando archivos del Agente...
xcopy /s /e /y "%AGENT_FOLDER%" "%INSTALL_DIR%\agent\" >nul
copy /y "INICIAR_APP.bat" "%INSTALL_DIR%\" >nul 2>nul
copy /y "RecepcionSuite.exe" "%INSTALL_DIR%\" >nul 2>nul

echo   [2/4] Preparando scripts de arranque...
:: Script principal en la raiz del paquete
echo @echo off > "%INSTALL_DIR%\INICIAR_ESTACION.bat"
echo title RECEPCION SUITE - ESTACION >> "%INSTALL_DIR%\INICIAR_ESTACION.bat"
echo cd agent >> "%INSTALL_DIR%\INICIAR_ESTACION.bat"
echo call ENCENDER_AGENTE.bat >> "%INSTALL_DIR%\INICIAR_ESTACION.bat"
echo exit >> "%INSTALL_DIR%\INICIAR_ESTACION.bat"

echo   [3/4] Creando nota de instrucciones...
echo INSTRUCCIONES DE INSTALACION > "%INSTALL_DIR%\LEEME.txt"
echo ============================ >> "%INSTALL_DIR%\LEEME.txt"
echo. >> "%INSTALL_DIR%\LEEME.txt"
echo 1. Copia esta carpeta entera al PC donde quieras usar la web. >> "%INSTALL_DIR%\LEEME.txt"
echo 2. Ejecuta 'INICIAR_ESTACION.bat' para empezar. >> "%INSTALL_DIR%\LEEME.txt"
echo. >> "%INSTALL_DIR%\LEEME.txt"
echo NOTA: Requiere Node.js instalado en el PC o el archivo node.exe en la carpeta 'agent'. >> "%INSTALL_DIR%\LEEME.txt"

echo   [4/4] Limpieza final...
rmdir /s /q "%INSTALL_DIR%\agent\logs" 2>nul
mkdir "%INSTALL_DIR%\agent\logs"

echo.
echo   =======================================================
echo   [OK] EXITO: Carpeta "%INSTALL_DIR%" lista para USB.
echo   =======================================================
echo   Solo tienes que llevarte esa carpeta al nuevo ordenador.
echo.
pause
