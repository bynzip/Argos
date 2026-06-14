@echo off
setlocal
cd /d "%~dp0.."

echo Deteniendo Argos ERP...
call "%~dp0interno\docker-env.bat"
if errorlevel 1 (
  pause
  exit /b 1
)

set "ARGOS_BROWSER_ROOT=%LOCALAPPDATA%\ArgosERP"
set "ARGOS_BROWSER_PROFILE=%ARGOS_BROWSER_ROOT%\browser-profile"
set "ARGOS_BROWSER_CACHE=%ARGOS_BROWSER_ROOT%\browser-cache"

echo Cerrando ventana del navegador de Argos...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='%ARGOS_BROWSER_PROFILE%'; Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'msedge.exe' -or $_.Name -eq 'chrome.exe') -and $_.CommandLine -like ('*' + $p + '*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul

echo Limpiando temporales del navegador de Argos...
call :delete_dir "%ARGOS_BROWSER_CACHE%"
call :delete_dir "%ARGOS_BROWSER_PROFILE%\Default\Cache"
call :delete_dir "%ARGOS_BROWSER_PROFILE%\Default\Code Cache"
call :delete_dir "%ARGOS_BROWSER_PROFILE%\Default\GPUCache"
call :delete_dir "%ARGOS_BROWSER_PROFILE%\Default\Service Worker\CacheStorage"
call :delete_dir "%ARGOS_BROWSER_PROFILE%\Default\Service Worker\ScriptCache"
call :delete_dir "%ARGOS_BROWSER_PROFILE%\Default\blob_storage"

echo Apagando contenedores y redes temporales...
"%DOCKER_EXE%" compose down --remove-orphans
if errorlevel 1 (
  echo No se pudo apagar Argos ERP correctamente.
  pause
  exit /b 1
)

echo.
echo Argos ERP apagado. La carpeta datos no fue modificada.
pause
exit /b 0

:delete_dir
if exist "%~1" (
  rmdir /s /q "%~1" 2>nul
)
exit /b 0
