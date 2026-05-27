@echo off
setlocal
cd /d "%~dp0"

echo Deteniendo Argos ERP...
docker compose down
echo.
echo Contenedores detenidos. La carpeta datos no fue modificada.
pause
