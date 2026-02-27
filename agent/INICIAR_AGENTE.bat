@echo off
setlocal enabledelayedexpansion
title AGENTE LOCAL - RECEPCION SUITE
cd /d "%~dp0"

echo ===================================================
2: echo   LANZADOR AUTOMATICO - AGENTE LOCAL
3: echo ===================================================
4: echo.
5: 
6: :: 1. Verificar si Node.js está instalado
7: echo [i] Verificando Node.js...
8: node -v >nul 2>&1
9: if !errorlevel! neq 0 (
10:     echo [!] ERROR: Node.js no esta instalado. 
11:     echo     Por favor, instalelo desde https://nodejs.org/
12:     pause
13:     exit /b
14: )
15: 
16: :: 2. Verificar carpeta node_modules
17: if not exist "node_modules" (
18:     echo [i] No se encontraron dependencias (node_modules). 
19:     echo     Instalando librerias necesarias (npm install)...
20:     echo.
21:     call npm install
22:     if !errorlevel! neq 0 (
23:         echo.
24:         echo [!] ERROR: La instalacion de dependencias ha fallado.
25:         echo     Asegurese de tener conexion a internet.
26:         pause
27:         exit /b
28:     )
29:     echo.
30:     echo [i] Dependencias instaladas con exito.
31: )
32: 
33: :: 3. Iniciar el Agente
34: echo [i] Iniciando Agente Local (src/index.js)...
35: echo.
36: node src/index.js
37: 
38: if !errorlevel! neq 0 (
39:     echo.
40:     echo [!] El agente se ha detenido de forma inesperada.
41:     pause
42: )
