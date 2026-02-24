#!/bin/bash
echo "Starting Aryncore MCP Toolchain Check..."

# === Shared Paths ===
TOOLS=~/tools
SADTALKER_DIR="$TOOLS/sad-talker"
TORTOISE_DIR="$TOOLS/tortoise-tts"
WHISPER_VENV="$TOOLS/whisper-venv"
CHATTERBOX_DIR=~/chatterbox
ANIMDIFF_DIR="$TOOLS/AnimateDiff"

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

# === Stable Diffusion WebUI (A1111) ===
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

# === SadTalker Checkpoint Only ===
if [ ! -d "$SADTALKER_DIR" ]; then
    echo "Downloading SadTalker..."
    mkdir -p "$TOOLS"
    cd "$TOOLS"
    git clone https://github.com/OpenTalker/SadTalker.git sad-talker
    cd sad-talker
    pip install -r requirements.txt
    echo "SadTalker installed"
else
    echo "SadTalker already present"
fi

echo "Checking PyTorch and torchvision (CUDA) for SadTalker..."
pip show torchvision >/dev/null 2>&1 || \
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

echo "Testing SadTalker module load only..."
cd "$SADTALKER_DIR"
python3 - <<EOF
try:
    import sys
    sys.path.append("$SADTALKER_DIR/src")
    import utils.audio, utils.preprocess
    print("SadTalker core modules loaded successfully")
except Exception as e:
    print("SadTalker module check failed:", e)
EOF

# === Chatterbox ===
echo "Checking Chatterbox installation..."
if [ -d "$CHATTERBOX_DIR" ] && python3 -c "import chatterbox" >/dev/null 2>&1; then
    echo "Chatterbox import successful"
else
    echo "Chatterbox not installed or failed to import"
fi

# === AnimateDiff ===
echo "Checking AnimateDiff installation..."
if [ ! -d "$ANIMDIFF_DIR" ]; then
    echo "Cloning AnimateDiff..."
    mkdir -p "$TOOLS"
    cd "$TOOLS"
    git clone https://github.com/guoyww/AnimateDiff.git AnimateDiff
    cd AnimateDiff
    pip install -r requirements.txt
    echo "AnimateDiff installed"
else
    echo "AnimateDiff already present"
fi

echo "Testing AnimateDiff import..."
python3 - <<EOF
import sys
sys.path.append("$ANIMDIFF_DIR")
try:
    import animatediff
    print("AnimateDiff import successful")
except Exception as e:
    print("AnimateDiff import error:", e)
EOF

# === Wrap-Up ===
echo "Aryncore toolchain setup complete. All systems checkpointed."

