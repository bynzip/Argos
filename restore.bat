@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

if not exist ".env" (
  echo Falta .env. Ejecuta start.bat una vez para crearlo.
  pause
  exit /b 1
)

for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do set "%%A=%%B"

if not defined POSTGRES_DB set "POSTGRES_DB=argos_db"
if not defined POSTGRES_USER set "POSTGRES_USER=admin"

set "BACKUP_FILE=%~1"
if "%BACKUP_FILE%"=="" (
  echo Backups disponibles:
  dir /b /o-d "datos\backups\*.dump" "datos\backups\*.sql" 2>nul
  echo.
  set /p "BACKUP_FILE=Escribe la ruta del backup a restaurar: "
)

if not exist "%BACKUP_FILE%" (
  echo No existe el archivo: %BACKUP_FILE%
  pause
  exit /b 1
)

echo.
echo ATENCION: se reemplazara la base de datos %POSTGRES_DB%.
echo La carpeta datos\media no sera borrada.
set /p "CONFIRM=Escribe RESTAURAR para continuar: "
if /i not "%CONFIRM%"=="RESTAURAR" (
  echo Restauracion cancelada.
  pause
  exit /b 0
)

echo Deteniendo backend para restaurar...
docker compose stop backend >nul

echo Recreando base de datos...
docker compose exec -T postgres dropdb --if-exists -U "%POSTGRES_USER%" "%POSTGRES_DB%"
docker compose exec -T postgres createdb -U "%POSTGRES_USER%" "%POSTGRES_DB%"

echo Restaurando %BACKUP_FILE%...
echo "%BACKUP_FILE%" | findstr /i "\.sql$" >nul
if errorlevel 1 (
  docker compose exec -T postgres pg_restore -U "%POSTGRES_USER%" -d "%POSTGRES_DB%" --no-owner < "%BACKUP_FILE%"
) else (
  docker compose exec -T postgres psql -U "%POSTGRES_USER%" -d "%POSTGRES_DB%" < "%BACKUP_FILE%"
)

if errorlevel 1 (
  echo Fallo la restauracion.
  pause
  exit /b 1
)

echo Reiniciando servicios...
docker compose up -d

echo Restauracion completada.
pause
