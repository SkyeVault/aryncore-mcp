#!/bin/bash

echo "Starting Aryncore MCP Environment..."

# Set up environment
export PATH=$HOME/.cargo/bin:$PATH  # Rust env
export PATH=$HOME/.local/bin:$PATH  # Python packages
export DOCKER_HOST=unix:///var/run/docker.sock

# Start Ollama if not already running
if ! pgrep -x "ollama" > /dev/null; then
  echo "→ Starting Ollama..."
  nohup ollama serve > ~/.ollama/ollama.log 2>&1 &
else
  echo "✓ Ollama already running"
fi

# Start Docker services
cd ~/services/a1111 && docker compose up -d
cd ~/services/n8n && docker compose up -d
cd ~/services/nkn && docker compose up -d  # if applicable

# Confirm services are running
echo "Docker Containers Running:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Return to project folder
cd ~/GitHub/aryncore-mcp
