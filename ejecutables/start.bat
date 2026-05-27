@echo off
setlocal
cd /d "%~dp0.."

echo ==========================================
echo   Argos ERP - Inicio local portable
echo ==========================================

call "%~dp0docker-env.bat"
if errorlevel 1 (
  pause
  exit /b 1
)

if not exist ".env" (
  echo No existe .env. Creando uno desde .env.example...
  copy ".env.example" ".env" >nul
)

if not exist "datos" mkdir "datos"
if not exist "datos\postgres" mkdir "datos\postgres"
if not exist "datos\media" mkdir "datos\media"
if not exist "datos\backups" mkdir "datos\backups"

echo Levantando contenedores...
"%DOCKER_EXE%" compose up --build -d
if errorlevel 1 (
  echo No se pudo levantar Argos ERP.
  pause
  exit /b 1
)

echo.
echo Argos ERP esta iniciando.
echo URL: http://localhost
echo Admin: http://localhost/admin/
echo.
echo Credenciales iniciales por defecto:
echo Usuario: admin
echo Contrasena: argos2025admin
echo.
pause
