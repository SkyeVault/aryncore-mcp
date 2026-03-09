#!/usr/bin/env bash
# ArynCore Desktop — start backend + frontend
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "╔══════════════════════════════════════╗"
echo "║          ArynCore MCP v1.0           ║"
echo "╚══════════════════════════════════════╝"

# --- Backend ---
echo "[1/2] Starting FastAPI backend on port 8000..."
cd "$ROOT"
python3 -m uvicorn backend.api:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "      Backend PID: $BACKEND_PID"

# Wait for backend to be ready
for i in $(seq 1 20); do
  if curl -s http://localhost:8000/ > /dev/null 2>&1; then
    echo "      Backend ready."
    break
  fi
  sleep 0.5
done

# --- Frontend ---
echo "[2/2] Starting React dev server on port 5173..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!
echo "      Frontend PID: $FRONTEND_PID"

echo ""
echo "  App:     http://localhost:5173"
echo "  API:     http://localhost:8000"
echo "  API docs: http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop all services."

trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait $BACKEND_PID $FRONTEND_PID
