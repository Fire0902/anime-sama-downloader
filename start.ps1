# Vérifier Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker n'est pas installé. Veuillez installer Docker Desktop."
    pause
    exit 1
}

# Vérifier l'architecture ARM
$arch = (Get-WmiObject Win32_OperatingSystem).OSArchitecture
if ($arch -eq "ARM 64-bit") {
    Write-Host "ARM n'est pas supporté."
    pause
    exit 1
}

# Vérifier si le port 3000 est déjà utilisé
$portInUse = netstat -ano | Select-String ":3000"
if ($portInUse) {
    Write-Host "Le port 3000 est déjà utilisé."
    pause
    exit 1
}

# Démarrer Docker Compose
Write-Host "Démarrage du conteneur Docker..."
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors du démarrage de Docker Compose."
    pause
    exit 1
}

Write-Host "Attente du démarrage du serveur..."
Start-Sleep -Seconds 5

Start-Process "http://localhost:3000"
Write-Host "Serveur accessible sur http://localhost:3000"
