@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

call "%~dp0docker-env.bat"
if errorlevel 1 (
  pause
  exit /b 1
)

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
  for /f "delims=" %%F in ('dir /b /a-d /o-d "datos\backups\*.dump" "datos\backups\*.sql" 2^>nul') do (
    set "BACKUP_FILE=datos\backups\%%F"
    goto backup_found
  )
)

:backup_found
if "%BACKUP_FILE%"=="" (
  echo No se encontraron backups en datos\backups.
  echo Copia un archivo .dump o .sql en esa carpeta y vuelve a ejecutar restore.bat.
  pause
  exit /b 1
)

if not exist "%BACKUP_FILE%" (
  echo No existe el archivo: %BACKUP_FILE%
  pause
  exit /b 1
)

echo.
echo ATENCION: se reemplazara la base de datos %POSTGRES_DB%.
echo La carpeta datos\media no sera borrada.
echo Backup seleccionado: %BACKUP_FILE%
echo.
set /p "CONFIRM=Escribe RESTAURAR para continuar: "
if /i not "%CONFIRM%"=="RESTAURAR" (
  echo Restauracion cancelada.
  pause
  exit /b 0
)

echo Deteniendo backend para restaurar...
"%DOCKER_EXE%" compose stop backend >nul

echo Recreando base de datos...
"%DOCKER_EXE%" compose exec -T postgres dropdb --if-exists -U "%POSTGRES_USER%" "%POSTGRES_DB%"
"%DOCKER_EXE%" compose exec -T postgres createdb -U "%POSTGRES_USER%" "%POSTGRES_DB%"

echo Restaurando %BACKUP_FILE%...
echo "%BACKUP_FILE%" | findstr /i "\.sql$" >nul
if errorlevel 1 (
  "%DOCKER_EXE%" compose exec -T postgres pg_restore -U "%POSTGRES_USER%" -d "%POSTGRES_DB%" --no-owner < "%BACKUP_FILE%"
) else (
  "%DOCKER_EXE%" compose exec -T postgres psql -U "%POSTGRES_USER%" -d "%POSTGRES_DB%" < "%BACKUP_FILE%"
)

if errorlevel 1 (
  echo Fallo la restauracion.
  pause
  exit /b 1
)

echo Reiniciando servicios...
"%DOCKER_EXE%" compose up -d

echo Restauracion completada.
pause
