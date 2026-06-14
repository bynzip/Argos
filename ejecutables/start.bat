@echo off
setlocal
cd /d "%~dp0.."

echo ==========================================
echo   Argos ERP - Inicio local portable
echo ==========================================

call "%~dp0interno\docker-env.bat"
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
"%DOCKER_EXE%" compose up -d
if errorlevel 1 (
  echo No se pudo levantar Argos ERP.
  pause
  exit /b 1
)

set "ARGOS_URL=http://localhost"
set "ARGOS_BROWSER_ROOT=%LOCALAPPDATA%\ArgosERP"
set "ARGOS_BROWSER_PROFILE=%ARGOS_BROWSER_ROOT%\browser-profile"
set "ARGOS_BROWSER_CACHE=%ARGOS_BROWSER_ROOT%\browser-cache"
set "BROWSER_EXE="

if not exist "%ARGOS_BROWSER_PROFILE%" mkdir "%ARGOS_BROWSER_PROFILE%"
if not exist "%ARGOS_BROWSER_CACHE%" mkdir "%ARGOS_BROWSER_CACHE%"

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
)
if not defined BROWSER_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
)
if not defined BROWSER_EXE if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
)
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  set "BROWSER_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
)

echo.
echo Argos ERP esta iniciando.
echo URL: %ARGOS_URL%
echo Admin: %ARGOS_URL%/admin/
echo.

if defined BROWSER_EXE (
  echo Abriendo navegador con perfil temporal controlado...
  start "" "%BROWSER_EXE%" --app="%ARGOS_URL%" "--user-data-dir=%ARGOS_BROWSER_PROFILE%" "--disk-cache-dir=%ARGOS_BROWSER_CACHE%" --disk-cache-size=104857600 --media-cache-size=52428800 --no-first-run --disable-background-mode
) else (
  echo No se encontro Edge ni Chrome. Abre manualmente: %ARGOS_URL%
)

echo.
echo Credenciales iniciales por defecto:
echo Usuario: admin
echo Contrasena: argos2025admin
echo.
pause
