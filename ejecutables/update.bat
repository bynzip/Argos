@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo   Argos ERP - Actualizacion local
echo ==========================================

call "%~dp0docker-env.bat"
if errorlevel 1 (
  pause
  exit /b 1
)

if exist ".git" (
  echo Actualizando codigo desde git...
  git pull
  if errorlevel 1 (
    echo No se pudo actualizar desde git. Revisa la conexion o conflictos.
    pause
    exit /b 1
  )
) else (
  echo No se encontro .git. Se omitira git pull.
)

if not exist ".env" copy ".env.example" ".env" >nul
if not exist "datos" mkdir "datos"
if not exist "datos\postgres" mkdir "datos\postgres"
if not exist "datos\media" mkdir "datos\media"
if not exist "datos\backups" mkdir "datos\backups"

echo Reconstruyendo imagenes sin tocar datos...
"%DOCKER_EXE%" compose up --build -d
if errorlevel 1 (
  echo Fallo la actualizacion.
  pause
  exit /b 1
)

echo Actualizacion completada. Datos conservados.
pause
