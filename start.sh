#!/bin/bash

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker n'est pas installé. Veuillez installer Docker."
    exit 1
fi

# Check for ARM architecture
ARCH=$(uname -m)
if [[ "$ARCH" == "arm64" ]] || [[ "$ARCH" == "armv7l" ]]; then
    echo "ARM n'est pas supporté."
    exit 1
fi

# Check if port 3000 is already in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Le port 3000 est déjà utilisé."
    exit 1
fi

# Start Docker Compose
echo "Démarrage du conteneur Docker..."
docker compose up -d
if [ $? -ne 0 ]; then
    echo "Erreur lors du démarrage de Docker Compose."
    exit 1
fi

echo "Attente du démarrage du serveur..."
sleep 5

# Open browser
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000
elif command -v open &> /dev/null; then
    open http://localhost:3000
fi
echo "Serveur accessible sur http://localhost:3000"