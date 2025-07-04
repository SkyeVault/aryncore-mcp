import subprocess
import os

def run_sadtalker(img_path, audio_path, out_dir):
    cmd = [
        "python", "inference.py",
        "--driven_audio", audio_path,
        "--source_image", img_path,
        "--enhancer", "gfpgan",  # Optional: use face enhancer
        "--result_dir", out_dir,
        "--still",  # Use a single still image
        "--preprocess", "full"
    ]

    subprocess.run(cmd, cwd="models/sad-talker")

# Example local run:
if __name__ == "__main__":
    img = "triggers/gpu_watch/stable_input/talking_head.png"
    audio = "triggers/gpu_watch/audio_input/voice.wav"
    out = "triggers/gpu_watch/stable_output/sadtalker"

    os.makedirs(out, exist_ok=True)
    run_sadtalker(img, audio, out)
