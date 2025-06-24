import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from scripts.run_sadtalker import run_sadtalker

# Define where your audio input is located
AUDIO_FILE = "triggers/gpu_watch/audio_input/voice.wav"
OUTPUT_DIR = "triggers/gpu_watch/stable_output/sadtalker"

class SadTalkerHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory:
            return
        if event.src_path.endswith(".png") or event.src_path.endswith(".jpg"):
            print(f"[Watcher] Detected image: {event.src_path}")
            run_sadtalker(event.src_path, AUDIO_FILE, OUTPUT_DIR)

if __name__ == "__main__":
    watch_path = "triggers/gpu_watch/stable_input"
    event_handler = SadTalkerHandler()
    observer = Observer()
    observer.schedule(event_handler, watch_path, recursive=False)
    observer.start()
    print(f"[Watcher] Monitoring for new image files in: {watch_path}")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

