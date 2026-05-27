@echo off
setlocal
cd /d "%~dp0"

echo Deteniendo Argos ERP...
docker compose stop
echo.
echo Contenedores apagados. La carpeta datos no fue modificada.
pause
