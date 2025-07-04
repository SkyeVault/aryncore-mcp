#!/bin/bash
set -e

# === Aryncore MCP: Full Forge Rebuild Script ===
# Author: Lorelei Noble's Custom Infrastructure
# Purpose: Bootstraps local dev environment with Dockerized AI tools, n8n, NKN, and Tauri CLI for UI

# === System Update ===
echo "[+] Updating system..."
sudo apt update && sudo apt upgrade -y

# === Essential Packages ===
echo "[+] Installing base packages..."
sudo apt install -y \
  curl wget git unzip build-essential \
  libssl-dev libgtk-3-dev pkg-config \
  libwebkit2gtk-4.0-dev libappindicator3-dev \
  libayatana-appindicator3-dev librsvg2-dev \
  python3 python3-pip python3-venv zsh tilix \
  apt-transport-https ca-certificates gnupg lsb-release

# === Docker Setup ===
echo "[+] Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# === Node.js Setup ===
echo "[+] Installing Node.js (v20)..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# === Rust Setup ===
echo "[+] Installing Rust..."
curl https://sh.rustup.rs -sSf | sh -s -- -y
source $HOME/.cargo/env

# === Tauri CLI ===
echo "[+] Installing Tauri CLI..."
cargo install tauri-cli

# === Python Virtual Env ===
echo "[+] Creating Python venv..."
mkdir -p ~/forge/venv && cd ~/forge
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip

# === Directory Layout ===
echo "[+] Creating project directory structure..."
mkdir -p ~/{GitHub,models,services,projects,tools,mcp-bots}

# === GitHub Repos ===
cd ~/GitHub
git clone https://github.com/lorelei/aryncore-mcp.git || true
git clone https://github.com/lorelei/main.git || true

# === Ollama Installation ===
echo "[+] Installing Ollama..."
curl -fsSL https://ollama.com/install.sh | sh

# === Pull Latest Models ===
echo "[+] Pulling Ollama Models..."
declare -a models=(
  "llama3:8b-instruct-q4_0"
  "mistral:7b-instruct-q4_0"
  "codellama:7b-instruct-q4_0"
  "gemma:2b-instruct-q4_0"
  "tinyllama:1.1b-chat"
  "phi3:mini-128k-instruct-q4_0"
)

for model in "${models[@]}"; do
  ollama pull "$model"
done

# === Automatic1111 (Stable Diffusion WebUI) in Docker ===
echo "[+] Cloning Automatic1111 Docker setup..."
cd ~/forge/services
git clone https://github.com/AbdBarho/stable-diffusion-webui-docker.git a1111 || true
cd a1111
./setup.sh --all

# === Whisper + Tortoise TTS (CLI-based tools) ===
echo "[+] Installing Whisper and Tortoise TTS..."
cd ~/forge/tools

# Whisper
pip install git+https://github.com/openai/whisper.git

# Tortoise
git clone https://github.com/neonbjb/tortoise-tts.git || true
cd tortoise-tts
pip install -r requirements.txt

# === n8n in Docker ===
echo "[+] Deploying n8n in Docker..."
cd ~/services
mkdir -p n8n && cd n8n

echo "version: '3.8'
services:
  n8n:
    image: n8nio/n8n
    ports:
      - 5678:5678
    volumes:
      - ./data:/home/node/.n8n
    restart: unless-stopped" > docker-compose.yml

docker compose up -d

# === NKN Node in Docker ===
echo "[+] Deploying NKN node..."
cd ~/services
mkdir -p nkn && cd nkn

docker run -d \
  --name nkn-node \
  -v $PWD:/nkn \
  -p 30001-30003:30001-30003/udp \
  -p 30001-30003:30001-30003 \
  nknorg/nkn

# === Wrap-Up ===
echo "[✓] Aryncore MCP system rebuild complete. Reboot recommended."
echo "Next: Begin agent configuration or UI integration with Tauri."

