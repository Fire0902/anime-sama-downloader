@echo off
setlocal

set "ROOT=%~dp0"

echo Demarrage du backend (adapters\web\back)...
start "anime-sama back" cmd /k "cd /d "%ROOT%adapters\web\back" && node server.ts"

echo Demarrage du frontend (adapters\web\front)...
start "anime-sama front" cmd /k "cd /d "%ROOT%adapters\web\front" && ng serve"

echo.
echo Deux fenetres ont ete ouvertes : backend et frontend.
echo Fermez-les pour arreter les serveurs.

endlocal
