#!/bin/bash
echo "Starting Aryncore MCP Toolchain Check..."

# === Shared Paths ===
TOOLS=~/tools
SADTALKER_DIR="$TOOLS/sad-talker"
TORTOISE_DIR="$TOOLS/tortoise-tts"
WHISPER_VENV="$TOOLS/whisper-venv"

# === Ollama ===
echo "hecking Ollama..."
if pgrep -x "ollama" >/dev/null; then
    echo "✓ Ollama is already running"
else
    echo "→ Starting Ollama..."
    nohup ollama serve > ~/.ollama/ollama.log 2>&1 &
fi

echo "→ Available Ollama Models:"
ollama list

# === Stable Diffusion WebUI (Automatic1111) ===
echo "Checking A1111 Docker status..."
cd ~/services/a1111
docker compose up -d
echo "→ A1111 should be live at http://localhost:7860"

# ===  Whisper TTS (via venv) ===
if [ -d "$WHISPER_VENV" ]; then
    echo "Whisper found at $WHISPER_VENV"
else
    echo "⚠️ Whisper not found. Create with:"
    echo "    python3 -m venv $WHISPER_VENV && source $WHISPER_VENV/bin/activate && pip install git+https://github.com/openai/whisper.git"
fi

# === 🐢 Tortoise TTS ===
if [ -d "$TORTOISE_DIR" ]; then
    echo "🐢 Tortoise TTS is installed in $TORTOISE_DIR"
else
    echo "⚠️ Tortoise TTS not found. To install:"
    echo "    cd $TOOLS && git clone https://github.com/neonbjb/tortoise-tts.git && cd tortoise-tts && pip install -r requirements.txt"
fi

# === SadTalker Auto-Setup ===
if [ ! -d "$SADTALKER_DIR" ]; then
    echo "🎭 Installing SadTalker..."
    cd "$TOOLS"
    git clone https://github.com/OpenTalker/SadTalker.git sad-talker
    cd sad-talker
    pip install -r requirements.txt
    echo "✓ SadTalker installed at $SADTALKER_DIR"
fi

# === SadTalker Test Run ===
if [ -f "$SADTALKER_DIR/inference.py" ]; then
    echo "🎬 Running SadTalker test (mock input)..."
    python3 "$SADTALKER_DIR/inference.py" \
        --driven_audio "$PWD/triggers/gpu_watch/audio_input/voice.wav" \
        --source_image "$PWD/triggers/gpu_watch/stable_input/talking_head.png" \
        --enhancer gfpgan \
        --result_dir "$PWD/triggers/gpu_watch/stable_output/sadtalker" \
        --still --preprocess full
    echo "🎥 SadTalker video should be output to: triggers/gpu_watch/stable_output/sadtalker"
else
    echo "❌ SadTalker not correctly installed or missing inference.py"
fi

# === Wrap-Up ===
echo "✅ All startup routines completed. Check browser for A1111 and inspect logs if needed."
