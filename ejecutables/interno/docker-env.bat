@echo off
set "DOCKER_EXE="

where docker >nul 2>nul
if not errorlevel 1 set "DOCKER_EXE=docker"

if not defined DOCKER_EXE if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" (
  set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\resources\bin\docker.exe"
)

if not defined DOCKER_EXE if exist "%ProgramFiles(x86)%\Docker\Docker\resources\bin\docker.exe" (
  set "DOCKER_EXE=%ProgramFiles(x86)%\Docker\Docker\resources\bin\docker.exe"
)

if not defined DOCKER_EXE (
  echo Docker no esta instalado o no se encontro docker.exe.
  echo Abre Docker Desktop. Si el problema sigue, agrega Docker al PATH o reinstala Docker Desktop.
  exit /b 1
)

"%DOCKER_EXE%" info >nul 2>nul
if errorlevel 1 (
  echo Docker esta instalado, pero el daemon no responde.
  echo Abre Docker Desktop y espera a que termine de iniciar.
  exit /b 1
)

exit /b 0
