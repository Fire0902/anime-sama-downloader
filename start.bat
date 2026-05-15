@echo off

setlocal enabledelayedexpansion

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker n'est pas installé. Veuillez installer Docker Desktop.
    pause
    exit /b 1
)

REM Check for ARM architecture
for /f "tokens=*" %%A in ('wmic os get osarchitecture ^| findstr /R ".*"') do set ARCH=%%A
if "%ARCH%"=="ARM64" (
    echo ARM n'est pas supporté.
    pause
    exit /b 1
)

REM Check if port 3000 is already in use
netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo Le port 3000 est déjà utilisé.
    pause
    exit /b 1
)

REM Start Docker Compose
echo Démarrage du conteneur Docker...
docker compose up -d
if %errorlevel% neq 0 (
    echo Erreur lors du démarrage de Docker Compose.
    pause
    exit /b 1
)

echo Attente du démarrage du serveur...
timeout /t 5 /nobreak

REM Open browser
start http://localhost:3000
echo Serveur accessible sur http://localhost:3000