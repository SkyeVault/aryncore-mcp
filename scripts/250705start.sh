#!/bin/bash

echo "Starting Aryncore MCP Toolchain Check..."

# === Shared Paths ===
TOOLS=~/tools
SADTALKER_DIR="$TOOLS/sad-talker"
TORTOISE_DIR="$TOOLS/tortoise-tts"
WHISPER_VENV="$TOOLS/whisper-venv"
CHATTERBOX_DIR=~/chatterbox

# === Ollama ===
echo "Checking Ollama..."
if pgrep -x "ollama" >/dev/null; then
    echo "Ollama is already running"
else
    echo "Starting Ollama..."
    nohup ollama serve > ~/.ollama/ollama.log 2>&1 &
    sleep 3
fi

echo "Available Ollama Models:"
ollama list || echo "Ollama is starting or failed to list models"

# === Stable Diffusion WebUI (Automatic1111) ===
echo "Launching A1111 Docker container..."
cd ~/services/a1111 || { echo "A1111 folder not found"; exit 1; }
docker compose up -d
echo "A1111 should be live at http://localhost:7860"

# === Whisper TTS ===
if [ -d "$WHISPER_VENV" ]; then
    echo "Whisper environment found at $WHISPER_VENV"
else
    echo "Whisper not found. To install:"
    echo "  python3 -m venv $WHISPER_VENV"
    echo "  source $WHISPER_VENV/bin/activate"
    echo "  pip install git+https://github.com/openai/whisper.git"
fi

# === Tortoise TTS ===
if [ -d "$TORTOISE_DIR" ]; then
    echo "Tortoise TTS is installed in $TORTOISE_DIR"
else
    echo "Tortoise TTS not found. To install:"
    echo "  cd $TOOLS"
    echo "  git clone https://github.com/neonbjb/tortoise-tts.git"
    echo "  cd tortoise-tts"
    echo "  pip install -r requirements.txt"
fi

# === SadTalker Auto-Setup ===
if [ ! -d "$SADTALKER_DIR" ]; then
    echo "Downloading SadTalker..."
    mkdir -p "$TOOLS"
    cd "$TOOLS"
    git clone https://github.com/OpenTalker/SadTalker.git sad-talker
    cd sad-talker
    pip install -r requirements.txt
    echo "SadTalker installed at $SADTALKER_DIR"
else
    echo "SadTalker already installed at $SADTALKER_DIR"
fi

# === SadTalker Test Run ===
if [ -f "$SADTALKER_DIR/inference.py" ]; then
    echo "Running SadTalker test with default input..."
    python3 "$SADTALKER_DIR/inference.py" \
        --driven_audio "$PWD/triggers/gpu_watch/audio_input/voice.wav" \
        --source_image "$PWD/triggers/gpu_watch/stable_input/talking_head.png" \
        --enhancer gfpgan \
        --result_dir "$PWD/triggers/gpu_watch/stable_output/sadtalker" \
        --still --preprocess full
    echo "SadTalker output saved to: triggers/gpu_watch/stable_output/sadtalker"
else
    echo "SadTalker inference.py not found or install failed"
fi

# === SadTalker Torch Dependencies Fix ===
echo "Checking SadTalker dependencies..."
pip show torchvision >/dev/null 2>&1 || {
    echo "Installing torchvision and torch..."
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
}

# === Chatterbox Test ===
echo "Checking Chatterbox installation..."
if [ -d "$CHATTERBOX_DIR" ]; then
    if [ -f "$CHATTERBOX_DIR/chatterbox/__init__.py" ]; then
        echo "Running Chatterbox test:"
        cd "$CHATTERBOX_DIR"
        python3 -c "import chatterbox; print('Chatterbox import successful')" || echo "Failed to import Chatterbox"
    else
        echo "Chatterbox directory exists, but module file not found"
    fi
else
    echo "Chatterbox not found at $CHATTERBOX_DIR"
fi

# === Wrap-Up ===
echo "Aryncore toolchain setup complete."
