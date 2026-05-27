@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo   Argos ERP - Inicio local portable
echo ==========================================

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker no esta instalado o no esta en el PATH.
  echo Instala Docker Desktop y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo Docker esta instalado, pero el daemon no responde.
  echo Abre Docker Desktop y espera a que termine de iniciar.
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
docker compose up --build -d
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
