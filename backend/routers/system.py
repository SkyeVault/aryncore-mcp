import asyncio
import platform
import subprocess
import re
from fastapi import APIRouter
import httpx

router = APIRouter()

TOOL_PORTS = {
    "tortoise_tts": 5003,
    "stable_diffusion": 7860,
    "n8n": 5678,
    "prometheus": 9090,
}


async def ping_http(url: str, timeout: float = 2.0) -> bool:
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(url, timeout=timeout)
            return r.status_code < 500
    except Exception:
        return False


async def ping_port(host: str, port: int) -> bool:
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=2.0
        )
        writer.close()
        await writer.wait_closed()
        return True
    except Exception:
        return False


def get_gpu_info() -> dict:
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            parts = result.stdout.strip().split(", ")
            return {
                "available": True,
                "name": parts[0] if len(parts) > 0 else "Unknown",
                "temp": parts[1] if len(parts) > 1 else "?",
                "utilization": parts[2] if len(parts) > 2 else "?",
                "memory_used": parts[3] if len(parts) > 3 else "?",
                "memory_total": parts[4] if len(parts) > 4 else "?",
            }
    except Exception:
        pass
    return {"available": False}


@router.get("/status")
async def get_status():
    checks = await asyncio.gather(
        ping_http("http://localhost:11434"),
        ping_port("localhost", TOOL_PORTS["tortoise_tts"]),
        ping_http("http://localhost:7860"),
        ping_http("http://localhost:5678"),
        ping_http("http://localhost:9090"),
    )
    return {
        "ollama": checks[0],
        "tortoise_tts": checks[1],
        "stable_diffusion": checks[2],
        "n8n": checks[3],
        "prometheus": checks[4],
        "gpu": get_gpu_info(),
        "platform": platform.system(),
    }


@router.get("/gpu")
async def get_gpu():
    return get_gpu_info()


@router.get("/hardware")
async def get_hardware():
    """Returns hardware profile with capability hints for the UI."""
    gpu = get_gpu_info()
    vram_mb = 0
    if gpu.get("available"):
        try:
            vram_mb = int(gpu.get("memory_total", 0))
        except (ValueError, TypeError):
            pass

    # CPU info
    cpu_name, cpu_cores = "Unknown", 0
    try:
        r = subprocess.run(["lscpu"], capture_output=True, text=True, timeout=3)
        for line in r.stdout.splitlines():
            if "Model name" in line:
                cpu_name = line.split(":", 1)[1].strip()
            if re.match(r"^CPU\(s\):", line):
                cpu_cores = int(line.split(":", 1)[1].strip())
    except Exception:
        pass

    # RAM
    ram_gb = 0
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    ram_gb = round(int(line.split()[1]) / 1024 / 1024)
                    break
    except Exception:
        pass

    # Disk (root)
    disk_free_gb = 0
    try:
        r = subprocess.run(["df", "-BG", "/"], capture_output=True, text=True, timeout=3)
        lines = r.stdout.strip().splitlines()
        if len(lines) > 1:
            parts = lines[1].split()
            disk_free_gb = int(parts[3].rstrip("G"))
    except Exception:
        pass

    # What VRAM tier enables
    vram_gb = vram_mb / 1024
    can_run = []
    if vram_gb >= 4:  can_run += ["7B models (q4)", "Whisper large", "Kokoro TTS", "rembg", "SD 1.5"]
    if vram_gb >= 6:  can_run += ["SDXL", "Wan2.1 1.3B", "CogVideoX-2B", "LTX-Video"]
    if vram_gb >= 8:  can_run += ["13B models (q4)", "FLUX.1 schnell", "SD3.5 Medium", "TripoSR", "Florence-2"]
    if vram_gb >= 10: can_run += ["14B models (q4)", "SDXL + ControlNet"]
    if vram_gb >= 12: can_run += ["FLUX.1 dev (q8)", "Wan2.1 14B (q4 — tight)"]

    too_large = []
    if vram_gb < 24:  too_large += ["Wan2.1 14B (fp16)", "FLUX.1 dev (fp16)", "Llama 70B on GPU"]

    # RAM enables CPU offload
    ram_notes = []
    if ram_gb >= 32: ram_notes.append("Can CPU-offload 30B models via Ollama")
    if ram_gb >= 64: ram_notes.append("Can CPU-run 70B models (q4 ~40GB) — slow but works")

    # Recommended Ollama models for this GPU tier
    recommended_models = [
        {"name": "deepseek-r1:8b",      "size": "4.9GB", "desc": "Reasoning / chain-of-thought",    "pull": "ollama pull deepseek-r1:8b"},
        {"name": "gemma3:9b",           "size": "5.8GB", "desc": "Google Gemma 3 — great all-rounder", "pull": "ollama pull gemma3:9b"},
        {"name": "llava:13b",           "size": "8.0GB", "desc": "Vision LLM — chat about images",  "pull": "ollama pull llava:13b"},
        {"name": "moondream2",          "size": "1.7GB", "desc": "Lightweight vision model",         "pull": "ollama pull moondream2"},
        {"name": "nomic-embed-text",    "size": "274MB", "desc": "Embeddings for RAG workflows",     "pull": "ollama pull nomic-embed-text"},
        {"name": "phi4",                "size": "9.1GB", "desc": "Microsoft Phi-4, excellent coding","pull": "ollama pull phi4"},
        {"name": "qwen2.5:14b",         "size": "9.0GB", "desc": "Qwen 2.5 14B — strong reasoning", "pull": "ollama pull qwen2.5:14b"},
        {"name": "mistral-nemo:12b",    "size": "7.1GB", "desc": "Mistral NeMo, multilingual",      "pull": "ollama pull mistral-nemo:12b"},
    ]

    return {
        "cpu": {"name": cpu_name, "cores": cpu_cores},
        "ram_gb": ram_gb,
        "gpu": {**gpu, "vram_gb": round(vram_gb, 1)},
        "disk_free_gb": disk_free_gb,
        "can_run": can_run,
        "too_large": too_large,
        "ram_notes": ram_notes,
        "recommended_models": recommended_models,
    }
