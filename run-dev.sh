#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
    echo ""
    echo "Arrêt des serveurs..."
    [ -n "$BACK_PID" ] && kill "$BACK_PID" 2>/dev/null || true
    [ -n "$FRONT_PID" ] && kill "$FRONT_PID" 2>/dev/null || true
    wait 2>/dev/null || true
    exit 0
}
trap cleanup INT TERM

echo "Démarrage du backend (adapters/web/back)..."
cd "$SCRIPT_DIR/adapters/web/back"
node server.ts &
BACK_PID=$!

echo "Démarrage du frontend (adapters/web/front)..."
cd "$SCRIPT_DIR/adapters/web/front"
ng serve &
FRONT_PID=$!

echo ""
echo "Backend PID  : $BACK_PID"
echo "Frontend PID : $FRONT_PID"
echo "Ctrl+C pour arrêter les deux."
echo ""

wait
