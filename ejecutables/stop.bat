@echo off
setlocal
cd /d "%~dp0.."

echo Deteniendo Argos ERP...
call "%~dp0docker-env.bat"
if errorlevel 1 (
  pause
  exit /b 1
)

"%DOCKER_EXE%" compose stop
echo.
echo Contenedores apagados. La carpeta datos no fue modificada.
pause
