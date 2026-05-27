@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "REPO_ZIP_URL=https://github.com/bynzip/Argos/archive/refs/heads/docker.zip"
set "TMP_DIR=%TEMP%\argos_repo_%RANDOM%%RANDOM%"
set "ZIP_FILE=%TMP_DIR%\argos-docker.zip"

echo ==========================================
echo   Argos ERP - Instalador desde GitHub
echo ==========================================
echo.

if exist ".git" (
  where git >nul 2>nul
  if not errorlevel 1 (
    echo Repositorio Git detectado. Actualizando rama docker...
    git fetch origin docker
    if errorlevel 1 goto git_failed
    git checkout docker
    if errorlevel 1 goto git_failed
    git pull --ff-only origin docker
    if errorlevel 1 goto git_failed
    goto start_argos
  )
)

echo Descargando rama docker desde GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "New-Item -ItemType Directory -Force -Path '%TMP_DIR%' | Out-Null;" ^
  "Invoke-WebRequest -Uri '%REPO_ZIP_URL%' -OutFile '%ZIP_FILE%';" ^
  "Expand-Archive -LiteralPath '%ZIP_FILE%' -DestinationPath '%TMP_DIR%' -Force;"
if errorlevel 1 (
  echo No se pudo descargar o extraer el repositorio.
  pause
  exit /b 1
)

for /d %%D in ("%TMP_DIR%\*") do set "EXTRACTED_DIR=%%D"
if not defined EXTRACTED_DIR (
  echo No se encontro la carpeta extraida del repositorio.
  pause
  exit /b 1
)

echo Instalando archivos en esta carpeta...
robocopy "!EXTRACTED_DIR!" "." /E /NFL /NDL /NJH /NJS /NP
if %ERRORLEVEL% GEQ 8 (
  echo No se pudieron copiar los archivos del repositorio.
  pause
  exit /b 1
)

rmdir /s /q "%TMP_DIR%" >nul 2>nul
goto start_argos

:git_failed
echo No se pudo actualizar con Git. Puedes intentar de nuevo o usar una carpeta limpia.
pause
exit /b 1

:start_argos
if not exist "start.bat" (
  echo No se encontro start.bat despues de instalar el repositorio.
  pause
  exit /b 1
)

echo.
echo Repositorio listo. Iniciando Argos ERP...
call start.bat
