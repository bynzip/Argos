@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "REPO_URL=https://github.com/bynzip/Argos.git"
set "REPO_ZIP_URL=https://github.com/bynzip/Argos/archive/refs/heads/docker.zip"
set "BRANCH=docker"
set "TMP_DIR=%TEMP%\argos_repo_%RANDOM%%RANDOM%"
set "ZIP_FILE=%TMP_DIR%\argos-docker.zip"

echo ==========================================
echo   Argos ERP - Descargar repositorio
echo ==========================================
echo.

where git >nul 2>nul
if not errorlevel 1 (
  if exist ".git" (
    echo Repositorio existente. Actualizando rama %BRANCH%...
    git fetch origin %BRANCH%
    if errorlevel 1 goto git_error
    git checkout %BRANCH%
    if errorlevel 1 goto git_error
    git pull --ff-only origin %BRANCH%
    if errorlevel 1 goto git_error
  ) else (
    echo Clonando rama %BRANCH% en esta carpeta...
    git clone --branch %BRANCH% --single-branch %REPO_URL% "%TMP_DIR%\repo"
    if errorlevel 1 goto git_error
    robocopy "%TMP_DIR%\repo" "." /E /XD .git /NFL /NDL /NJH /NJS /NP
    if %ERRORLEVEL% GEQ 8 goto copy_error
  )
  goto done
)

echo Git no esta instalado. Descargando ZIP de GitHub...
where curl >nul 2>nul
if errorlevel 1 (
  echo No se encontro git ni curl.
  echo Descarga manualmente el ZIP de la rama docker desde GitHub.
  pause
  exit /b 1
)

where tar >nul 2>nul
if errorlevel 1 (
  echo No se encontro tar para extraer el ZIP.
  echo Descarga manualmente el ZIP de la rama docker desde GitHub.
  pause
  exit /b 1
)

mkdir "%TMP_DIR%" >nul 2>nul
curl -L "%REPO_ZIP_URL%" -o "%ZIP_FILE%"
if errorlevel 1 (
  echo No se pudo descargar el ZIP del repositorio.
  pause
  exit /b 1
)

tar -xf "%ZIP_FILE%" -C "%TMP_DIR%"
if errorlevel 1 (
  echo No se pudo extraer el ZIP del repositorio.
  pause
  exit /b 1
)

for /d %%D in ("%TMP_DIR%\*") do set "EXTRACTED_DIR=%%D"
if not defined EXTRACTED_DIR (
  echo No se encontro la carpeta extraida del repositorio.
  pause
  exit /b 1
)

robocopy "!EXTRACTED_DIR!" "." /E /NFL /NDL /NJH /NJS /NP
if %ERRORLEVEL% GEQ 8 goto copy_error
goto done

:git_error
echo No se pudo descargar o actualizar el repositorio con Git.
pause
exit /b 1

:copy_error
echo No se pudieron copiar los archivos del repositorio.
pause
exit /b 1

:done
rmdir /s /q "%TMP_DIR%" >nul 2>nul
echo.
echo Repositorio listo.
echo Ahora ejecuta start.bat para iniciar Argos con Docker.
pause
