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

if not exist "datos\backups" mkdir "datos\backups"

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%I"
set "BACKUP_FILE=datos\backups\argos_%STAMP%.dump"

echo Creando backup: %BACKUP_FILE%
docker compose exec -T postgres pg_dump -U "%POSTGRES_USER%" -d "%POSTGRES_DB%" -Fc > "%BACKUP_FILE%"
if errorlevel 1 (
  echo Fallo el backup.
  if exist "%BACKUP_FILE%" del "%BACKUP_FILE%"
  pause
  exit /b 1
)

echo Backup creado correctamente.
pause
