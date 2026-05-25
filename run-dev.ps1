$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Install dependencies if needed
foreach ($dir in @("adapters\web\back", "adapters\web\front")) {
    $fullPath = Join-Path $Root $dir
    if (-not (Test-Path (Join-Path $fullPath "node_modules"))) {
        Write-Host "npm install dans $dir..."
        Push-Location $fullPath
        npm install
        Pop-Location
    }
}

Write-Host "Demarrage du backend (adapters\web\back)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\adapters\web\back'; node server.ts" -WindowStyle Normal

Write-Host "Demarrage du frontend (adapters\web\front)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\adapters\web\front'; ng serve" -WindowStyle Normal

Write-Host ""
Write-Host "Deux fenetres ont ete ouvertes : backend et frontend."
Write-Host "Fermez-les pour arreter les serveurs."
