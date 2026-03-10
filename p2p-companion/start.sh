#!/usr/bin/env bash
# ArynCore P2P Companion — start script
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Install deps if needed
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

PORT="${PORT:-3000}"
NKN_IDENTIFIER="${NKN_IDENTIFIER:-aryncore}"

echo ""
echo "  ArynCore P2P Companion"
echo "  ──────────────────────────────────"
echo "  Web UI   →  http://localhost:$PORT"
echo "  NKN ID   →  $NKN_IDENTIFIER"
echo ""

PORT="$PORT" NKN_IDENTIFIER="$NKN_IDENTIFIER" node app.js
