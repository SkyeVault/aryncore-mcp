import asyncio
import base64
import io
import os
import subprocess
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import JSONResponse
import httpx
from pydantic import BaseModel

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── Tool registry ──────────────────────────────────────────────────────────────
# Each entry: id → { name, description, type, category, port?, endpoint?, script?, homepage, install }

TOOLS = {
    # ── Image ────────────────────────────────────────────────────────────────
    "stable_diffusion": {
        "name": "Stable Diffusion (A1111)",
        "description": "Text-to-image generation via AUTOMATIC1111 WebUI. Supports SD1.5, SDXL, ControlNet.",
        "type": "image", "category": "image",
        "port": 7860, "endpoint": "http://localhost:7860",
        "homepage": "http://localhost:7860",
        "install": "docker compose up -d  # or launch A1111 webui.sh",
    },
    "comfyui": {
        "name": "ComfyUI",
        "description": "Node-based image/video pipeline. Supports FLUX.1, SDXL, SD3, ControlNet, LoRA, Wan2.1.",
        "type": "image", "category": "image",
        "port": 8188, "endpoint": "http://localhost:8188",
        "homepage": "http://localhost:8188",
        "install": "pip install comfyui  OR  docker run -p 8188:8188 ghcr.io/ai-dock/comfyui",
    },
    "fooocus": {
        "name": "Fooocus",
        "description": "Simplified SDXL/FLUX UI. Midjourney-like quality with zero configuration.",
        "type": "image", "category": "image",
        "port": 7865, "endpoint": "http://localhost:7865",
        "homepage": "http://localhost:7865",
        "install": "git clone https://github.com/lllyasviel/Fooocus && python launch.py",
    },
    "realesrgan": {
        "name": "Real-ESRGAN",
        "description": "AI image upscaling (2×/4×). Works on photos, illustrations, and video frames.",
        "type": "image", "category": "image",
        "port": None,
        "script": os.path.join(BASE_DIR, "scripts", "run_realesrgan.py"),
        "install": "pip install realesrgan basicsr",
    },
    "rembg": {
        "name": "rembg",
        "description": "Background removal using U2-Net. Instant results with no GPU required.",
        "type": "image", "category": "image",
        "port": None,
        "install": "pip install rembg[gpu] onnxruntime-gpu",
    },
    # ── Audio ────────────────────────────────────────────────────────────────
    "tortoise_tts": {
        "name": "Tortoise TTS",
        "description": "High-quality multi-voice TTS. Slow but very natural-sounding.",
        "type": "audio", "category": "audio",
        "port": 5003, "endpoint": "http://localhost:5003",
        "install": "docker compose up -d  # tortoise service",
    },
    "alltalk_tts": {
        "name": "AllTalk TTS",
        "description": "Web UI wrapping XTTSv2 and Kokoro. Supports voice cloning from a 3s clip.",
        "type": "audio", "category": "audio",
        "port": 7851, "endpoint": "http://localhost:7851",
        "homepage": "http://localhost:7851",
        "install": "git clone https://github.com/erew123/alltalk_tts && pip install -r requirements.txt",
    },
    "kokoro_tts": {
        "name": "Kokoro TTS",
        "description": "Ultra-fast 82M-param TTS. Apache 2.0. Near-instant synthesis, runs on CPU or GPU.",
        "type": "audio", "category": "audio",
        "port": None,
        "script": os.path.join(BASE_DIR, "scripts", "run_kokoro.py"),
        "install": "pip install kokoro soundfile",
    },
    "f5_tts": {
        "name": "F5-TTS",
        "description": "Zero-shot voice cloning from a 3-second reference clip. State-of-the-art (2024).",
        "type": "audio", "category": "audio",
        "port": None,
        "script": os.path.join(BASE_DIR, "scripts", "run_f5tts.py"),
        "install": "pip install f5-tts",
    },
    "musicgen": {
        "name": "MusicGen (AudioCraft)",
        "description": "Meta's text-to-music model. Generate background music from a text description.",
        "type": "audio", "category": "audio",
        "port": None,
        "script": os.path.join(BASE_DIR, "scripts", "run_musicgen.py"),
        "install": "pip install audiocraft",
    },
    "whisper": {
        "name": "Whisper STT",
        "description": "OpenAI Whisper speech-to-text. Accurate transcription for any audio/video.",
        "type": "audio", "category": "audio",
        "port": None,
        "script": os.path.join(BASE_DIR, "scripts", "run_whisper.py"),
        "install": "pip install openai-whisper",
    },
    # ── Video ────────────────────────────────────────────────────────────────
    "sadtalker": {
        "name": "SadTalker",
        "description": "Talking-head video from a portrait image + audio file.",
        "type": "video", "category": "video",
        "port": None,
        "script": os.path.join(BASE_DIR, "scripts", "run_sadtalker.py"),
        "install": "See models/sad-talker/docs/",
    },
    "musetalk": {
        "name": "MuseTalk",
        "description": "Real-time talking head synthesis. Faster than SadTalker, same portrait+audio workflow.",
        "type": "video", "category": "video",
        "port": None,
        "script": os.path.join(BASE_DIR, "scripts", "run_musetalk.py"),
        "install": "git clone https://github.com/TMElyralab/MuseTalk && pip install -r requirements.txt",
    },
    "wan2": {
        "name": "Wan2.1 Video",
        "description": "Alibaba's SOTA open video generation (Jan 2025). Text→video and image→video. Runs on 8GB+ VRAM.",
        "type": "video", "category": "video",
        "port": None,
        "script": os.path.join(BASE_DIR, "scripts", "run_wan2.py"),
        "install": "pip install wandiffusers  OR  via ComfyUI node",
    },
    "animatediff": {
        "name": "AnimateDiff",
        "description": "Animate any SD1.5 model. Text→looping animation.",
        "type": "video", "category": "video",
        "port": None,
        "script": os.path.join(BASE_DIR, "scripts", "run_anim.py"),
        "install": "pip install animatediff",
    },
    # ── AI Infrastructure ────────────────────────────────────────────────────
    "localai": {
        "name": "LocalAI",
        "description": "OpenAI-compatible API for GGUF/GPTQ models, Whisper, SD, and TTS — all in one Docker container.",
        "type": "llm", "category": "ai",
        "port": 8080, "endpoint": "http://localhost:8080",
        "homepage": "http://localhost:8080",
        "install": "docker run -p 8080:8080 quay.io/go-skynet/local-ai:latest",
    },
    "open_webui": {
        "name": "Open WebUI",
        "description": "Full-featured Ollama chat UI with RAG, document upload, image gen, multi-user support.",
        "type": "llm", "category": "ai",
        "port": 3000, "endpoint": "http://localhost:3000",
        "homepage": "http://localhost:3000",
        "install": "docker run -p 3000:8080 ghcr.io/open-webui/open-webui",
    },
    "tabby": {
        "name": "Tabby",
        "description": "Self-hosted AI code completion server. OpenAI-compatible. Works with VS Code and JetBrains.",
        "type": "code", "category": "ai",
        "port": 11029, "endpoint": "http://localhost:11029",
        "homepage": "http://localhost:11029",
        "install": "docker run -p 11029:11029 tabbyml/tabby serve --model StarCoder-1B",
    },
    # ── 3D ───────────────────────────────────────────────────────────────────
    "triposr": {
        "name": "TripoSR",
        "description": "Image → 3D mesh in seconds. Exports .obj/.glb for Blender or OrcaSlicer. Needs ~3GB VRAM.",
        "type": "3d", "category": "3d",
        "port": None,
        "script": os.path.join(BASE_DIR, "scripts", "run_triposr.py"),
        "install": "pip install tsr  # github.com/VAST-AI-Research/TripoSR",
        "vram_gb": 3,
    },
    "instantmesh": {
        "name": "InstantMesh",
        "description": "High-quality image → 3D mesh via multi-view diffusion. Better geometry than TripoSR. ~8GB VRAM.",
        "type": "3d", "category": "3d",
        "port": None,
        "script": os.path.join(BASE_DIR, "scripts", "run_instantmesh.py"),
        "install": "git clone https://github.com/TencentARC/InstantMesh && pip install -r requirements.txt",
        "vram_gb": 8,
    },
    "shap_e": {
        "name": "Shap-E",
        "description": "Text or image → 3D (OpenAI, MIT). Generates .ply / .obj point clouds and meshes.",
        "type": "3d", "category": "3d",
        "port": None,
        "script": os.path.join(BASE_DIR, "scripts", "run_shape.py"),
        "install": "pip install shap-e",
        "vram_gb": 4,
    },
    "depth_anything": {
        "name": "Depth Anything V2",
        "description": "Monocular depth estimation from any image. Feeds 3D reconstruction and video pipelines. ~1GB VRAM.",
        "type": "image", "category": "3d",
        "port": None,
        "script": os.path.join(BASE_DIR, "scripts", "run_depth.py"),
        "install": "pip install depth-anything-v2  # or via transformers",
        "vram_gb": 1,
    },
    # ── Vision ────────────────────────────────────────────────────────────────
    "florence2": {
        "name": "Florence-2",
        "description": "Microsoft vision model (MIT). OCR, image captioning, object detection, grounding — all in one. ~1.5GB VRAM.",
        "type": "image", "category": "image",
        "port": None,
        "script": os.path.join(BASE_DIR, "scripts", "run_florence2.py"),
        "install": "pip install transformers timm einops",
        "vram_gb": 2,
    },
    # ── More Video ────────────────────────────────────────────────────────────
    "ltx_video": {
        "name": "LTX-Video",
        "description": "Lightricks fast text-to-video (Apache 2.0). 5B params distilled — generates 5s clips in <30s on RTX 3060. ~7GB VRAM.",
        "type": "video", "category": "video",
        "port": None,
        "script": os.path.join(BASE_DIR, "scripts", "run_ltxvideo.py"),
        "install": "pip install ltx-video diffusers transformers",
        "vram_gb": 7,
    },
    "cogvideox": {
        "name": "CogVideoX-2B",
        "description": "SAP/THUDM text-to-video (Apache 2.0). High quality 6s clips. 2B param model fits in 7-8GB VRAM.",
        "type": "video", "category": "video",
        "port": None,
        "script": os.path.join(BASE_DIR, "scripts", "run_cogvideo.py"),
        "install": "pip install diffusers transformers accelerate",
        "vram_gb": 8,
    },
    # ── More Audio ────────────────────────────────────────────────────────────
    "rvc": {
        "name": "RVC (Voice Conversion)",
        "description": "Retrieval-based Voice Conversion. Clone any voice from a short clip. Real-time capable on GPU.",
        "type": "audio", "category": "audio",
        "port": 7865,
        "endpoint": "http://localhost:7865",
        "homepage": "http://localhost:7865",
        "install": "git clone https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI && pip install -r requirements.txt",
        "vram_gb": 2,
    },
    "chatterbox": {
        "name": "Chatterbox TTS",
        "description": "Resemble AI zero-shot TTS (Apache 2.0, 2025). Clones voice from 5-10s reference. State-of-the-art quality.",
        "type": "audio", "category": "audio",
        "port": None,
        "script": os.path.join(BASE_DIR, "scripts", "run_chatterbox.py"),
        "install": "pip install chatterbox-tts",
        "vram_gb": 2,
    },
    # ── Agents & RAG ─────────────────────────────────────────────────────────
    "anythingllm": {
        "name": "AnythingLLM",
        "description": "All-in-one RAG hub. Document Q&A, agents, multi-user, works with Ollama. Best local RAG solution.",
        "type": "llm", "category": "ai",
        "port": 3001, "endpoint": "http://localhost:3001",
        "homepage": "http://localhost:3001",
        "install": "docker run -p 3001:3001 mintplexlabs/anythingllm",
    },
    "flowise": {
        "name": "Flowise",
        "description": "Visual LangChain flow builder (Apache 2.0). Build RAG pipelines, chatbots, and agents graphically.",
        "type": "llm", "category": "ai",
        "port": 3000, "endpoint": "http://localhost:3000",
        "homepage": "http://localhost:3000",
        "install": "npx flowise start  OR  docker run -p 3000:3000 flowiseai/flowise",
    },
    "aider": {
        "name": "Aider",
        "description": "AI pair programmer in your terminal (Apache 2.0). Works with local Ollama. Edit real codebases with AI.",
        "type": "code", "category": "ai",
        "port": None,
        "script": os.path.join(BASE_DIR, "scripts", "run_aider.py"),
        "install": "pip install aider-chat  # then: aider --model ollama/qwen2.5-coder:14b",
    },
    # ── Search & Data ────────────────────────────────────────────────────────
    "searxng": {
        "name": "SearXNG",
        "description": "Privacy-first metasearch engine. Used by AI agents (Perplexica, Open-WebUI) for live web search.",
        "type": "search", "category": "search",
        "port": 8888, "endpoint": "http://localhost:8888",
        "homepage": "http://localhost:8888",
        "install": "docker run -p 8888:8080 searxng/searxng",
    },
    "qdrant": {
        "name": "Qdrant",
        "description": "Local vector database for RAG workflows. Store and search embeddings from Ollama or LocalAI.",
        "type": "vector", "category": "data",
        "port": 6333, "endpoint": "http://localhost:6333",
        "install": "docker run -p 6333:6333 qdrant/qdrant",
    },
    "perplexica": {
        "name": "Perplexica",
        "description": "Local Perplexity alternative. AI-powered search combining SearXNG + Ollama.",
        "type": "search", "category": "search",
        "port": 3001, "endpoint": "http://localhost:3001",
        "homepage": "http://localhost:3001",
        "install": "git clone https://github.com/ItzCrazyKns/Perplexica && docker compose up -d",
    },
}


# ── Status checker ─────────────────────────────────────────────────────────────

async def check_tool_status(tool_key: str, info: dict) -> str:
    endpoint = info.get("endpoint")
    if endpoint:
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(endpoint, timeout=2.0)
                return "online" if 200 <= r.status_code < 500 else "error"
        except Exception:
            return "offline"
    # Script-based tool: check if script exists OR package importable
    script = info.get("script")
    if script and os.path.exists(script):
        return "available"
    # Check for rembg specially (importable package)
    if tool_key == "rembg":
        try:
            import rembg  # noqa
            return "available"
        except ImportError:
            return "unavailable"
    if tool_key == "kokoro_tts":
        try:
            import kokoro  # noqa
            return "available"
        except ImportError:
            return "unavailable"
    return "unavailable"


# ── List / get tools ───────────────────────────────────────────────────────────

@router.get("")
async def list_tools():
    statuses = await asyncio.gather(
        *[check_tool_status(k, v) for k, v in TOOLS.items()],
        return_exceptions=True,
    )
    return [
        {
            "id": key,
            "name": info["name"],
            "description": info["description"],
            "type": info["type"],
            "category": info["category"],
            "port": info.get("port"),
            "homepage": info.get("homepage"),
            "install": info.get("install"),
            "vram_gb": info.get("vram_gb"),
            "status": status if isinstance(status, str) else "error",
        }
        for (key, info), status in zip(TOOLS.items(), statuses)
    ]


@router.get("/{tool_id}")
async def get_tool(tool_id: str):
    if tool_id not in TOOLS:
        raise HTTPException(404, "Tool not found")
    info = TOOLS[tool_id]
    return {**info, "id": tool_id, "status": await check_tool_status(tool_id, info)}


# ── Stable Diffusion (A1111) ───────────────────────────────────────────────────

class SDRequest(BaseModel):
    prompt: str
    negative_prompt: str = ""
    steps: int = 20
    width: int = 512
    height: int = 512
    cfg_scale: float = 7.0


@router.post("/stable_diffusion/generate")
async def sd_generate(req: SDRequest):
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            r = await client.post("http://localhost:7860/sdapi/v1/txt2img", json={
                "prompt": req.prompt, "negative_prompt": req.negative_prompt,
                "steps": req.steps, "width": req.width, "height": req.height,
                "cfg_scale": req.cfg_scale,
            })
            r.raise_for_status()
            data = r.json()
            return {"images": data.get("images", []), "info": data.get("info", "")}
        except Exception as e:
            raise HTTPException(502, f"SD error: {e}")


# ── Tortoise TTS ───────────────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str
    voice: str = "random"


@router.post("/tortoise_tts/generate")
async def tts_generate(req: TTSRequest):
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            r = await client.post("http://localhost:5003/generate", json={"text": req.text, "voice": req.voice})
            r.raise_for_status()
            return r.json()
        except Exception as e:
            raise HTTPException(502, f"TTS error: {e}")


# ── AllTalk TTS ────────────────────────────────────────────────────────────────

class AllTalkRequest(BaseModel):
    text: str
    voice: str = "default"
    language: str = "en"


@router.post("/alltalk_tts/generate")
async def alltalk_generate(req: AllTalkRequest):
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            r = await client.post("http://localhost:7851/api/tts-generate", json={
                "text_input": req.text,
                "character_voice_gen": req.voice,
                "language": req.language,
                "output_file_name": "output",
            })
            r.raise_for_status()
            return r.json()
        except Exception as e:
            raise HTTPException(502, f"AllTalk error: {e}")


# ── Kokoro TTS ─────────────────────────────────────────────────────────────────

class KokoroRequest(BaseModel):
    text: str
    voice: str = "af_heart"
    speed: float = 1.0


@router.post("/kokoro/generate")
async def kokoro_generate(req: KokoroRequest):
    try:
        from kokoro import KPipeline
        import soundfile as sf
        import numpy as np
        import tempfile

        pipeline = KPipeline(lang_code="a")
        audio_chunks = []
        for _, _, audio in pipeline(req.text, voice=req.voice, speed=req.speed, split_pattern=r"\n+"):
            audio_chunks.append(audio)

        if not audio_chunks:
            raise HTTPException(500, "No audio generated")

        combined = np.concatenate(audio_chunks)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            sf.write(f.name, combined, 24000)
            with open(f.name, "rb") as audio_f:
                audio_b64 = base64.b64encode(audio_f.read()).decode()
        os.unlink(f.name)
        return {"audio_base64": audio_b64, "sample_rate": 24000, "format": "wav"}
    except ImportError:
        raise HTTPException(503, "Kokoro not installed. Run: pip install kokoro soundfile")
    except Exception as e:
        raise HTTPException(500, f"Kokoro error: {e}")


# ── rembg background removal ───────────────────────────────────────────────────

@router.post("/rembg/remove")
async def rembg_remove(image: UploadFile = File(...)):
    try:
        from rembg import remove as rembg_remove_fn
        from PIL import Image as PILImage
    except ImportError:
        raise HTTPException(503, "rembg not installed. Run: pip install rembg[gpu] onnxruntime-gpu")
    try:
        img_bytes = await image.read()
        input_img = PILImage.open(io.BytesIO(img_bytes)).convert("RGBA")
        output_img = rembg_remove_fn(input_img)
        buf = io.BytesIO()
        output_img.save(buf, format="PNG")
        result_b64 = base64.b64encode(buf.getvalue()).decode()
        return {"image_base64": result_b64, "format": "png"}
    except Exception as e:
        raise HTTPException(500, f"rembg error: {e}")


# ── Real-ESRGAN upscaling ──────────────────────────────────────────────────────

@router.post("/realesrgan/upscale")
async def realesrgan_upscale(
    image: UploadFile = File(...),
    scale: int = Form(4),
):
    script = TOOLS["realesrgan"]["script"]
    if not os.path.exists(script):
        raise HTTPException(404, "Real-ESRGAN script not found. Create scripts/run_realesrgan.py")
    try:
        import tempfile, shutil, uuid
        tmp = tempfile.mkdtemp()
        in_path = os.path.join(tmp, f"input_{uuid.uuid4().hex}.png")
        out_path = os.path.join(tmp, f"output.png")
        img_bytes = await image.read()
        with open(in_path, "wb") as f:
            f.write(img_bytes)
        proc = await asyncio.create_subprocess_exec(
            "python3", script, in_path, out_path, "--scale", str(scale),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
        if proc.returncode != 0:
            raise HTTPException(500, f"Real-ESRGAN error: {stderr.decode()[:400]}")
        with open(out_path, "rb") as f:
            result_b64 = base64.b64encode(f.read()).decode()
        shutil.rmtree(tmp, ignore_errors=True)
        return {"image_base64": result_b64, "format": "png", "scale": scale}
    except asyncio.TimeoutError:
        raise HTTPException(504, "Real-ESRGAN timed out")
    except Exception as e:
        raise HTTPException(500, f"Upscale error: {e}")


# ── SearXNG search proxy ───────────────────────────────────────────────────────

@router.get("/searxng/search")
async def searxng_search(
    q: str = Query(...),
    engines: str = Query(""),
    pageno: int = Query(1),
):
    params = {"q": q, "format": "json", "pageno": pageno}
    if engines:
        params["engines"] = engines
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            r = await client.get("http://localhost:8888/search", params=params)
            r.raise_for_status()
            data = r.json()
            return {
                "query": q,
                "results": data.get("results", [])[:10],
                "suggestions": data.get("suggestions", []),
                "answers": data.get("answers", []),
            }
        except httpx.ConnectError:
            raise HTTPException(503, "SearXNG is not running. Start it with: docker run -p 8888:8080 searxng/searxng")
        except Exception as e:
            raise HTTPException(502, f"SearXNG error: {e}")


# ── Qdrant collections ─────────────────────────────────────────────────────────

@router.get("/qdrant/collections")
async def qdrant_collections():
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            r = await client.get("http://localhost:6333/collections")
            r.raise_for_status()
            return r.json()
        except httpx.ConnectError:
            raise HTTPException(503, "Qdrant is not running. Start it with: docker run -p 6333:6333 qdrant/qdrant")
        except Exception as e:
            raise HTTPException(502, f"Qdrant error: {e}")


# ── SadTalker ─────────────────────────────────────────────────────────────────

@router.post("/florence2/caption")
async def florence2_caption(image: UploadFile = File(...), task: str = Form("caption")):
    """Run Florence-2 on an image. task: caption | detailed_caption | ocr | detect"""
    TASK_MAP = {
        "caption": "<CAPTION>",
        "detailed_caption": "<DETAILED_CAPTION>",
        "more_detailed_caption": "<MORE_DETAILED_CAPTION>",
        "ocr": "<OCR>",
        "detect": "<OD>",
    }
    prompt = TASK_MAP.get(task, "<CAPTION>")
    try:
        from transformers import AutoProcessor, AutoModelForCausalLM
        import torch
        from PIL import Image as PILImage
        img_bytes = await image.read()
        img = PILImage.open(io.BytesIO(img_bytes)).convert("RGB")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = AutoModelForCausalLM.from_pretrained(
            "microsoft/Florence-2-base", trust_remote_code=True, torch_dtype=torch.float16
        ).to(device)
        processor = AutoProcessor.from_pretrained("microsoft/Florence-2-base", trust_remote_code=True)
        inputs = processor(text=prompt, images=img, return_tensors="pt").to(device, torch.float16)
        generated_ids = model.generate(
            input_ids=inputs["input_ids"], pixel_values=inputs["pixel_values"],
            max_new_tokens=512, num_beams=3,
        )
        result = processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
        parsed = processor.post_process_generation(result, task=prompt, image_size=(img.width, img.height))
        return {"task": task, "result": parsed}
    except ImportError:
        raise HTTPException(503, "Florence-2 requires: pip install transformers timm einops")
    except Exception as e:
        raise HTTPException(500, f"Florence-2 error: {e}")


class ChatterboxRequest(BaseModel):
    text: str
    reference_audio_url: Optional[str] = None
    exaggeration: float = 0.5
    speed: float = 1.0


@router.post("/chatterbox/generate")
async def chatterbox_generate(req: ChatterboxRequest):
    try:
        import torchaudio
        from chatterbox.tts import ChatterboxTTS
        import torch, tempfile

        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = ChatterboxTTS.from_pretrained(device=device)
        wav = model.generate(
            req.text,
            exaggeration=req.exaggeration,
            cfg_weight=req.speed,
        )
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            torchaudio.save(f.name, wav, model.sr)
            with open(f.name, "rb") as af:
                audio_b64 = base64.b64encode(af.read()).decode()
        os.unlink(f.name)
        return {"audio_base64": audio_b64, "sample_rate": model.sr, "format": "wav"}
    except ImportError:
        raise HTTPException(503, "Chatterbox not installed. Run: pip install chatterbox-tts")
    except Exception as e:
        raise HTTPException(500, f"Chatterbox error: {e}")


@router.post("/sadtalker/run")
async def sadtalker_run(
    image: UploadFile = File(...),
    audio: UploadFile = File(...),
    pose_style: int = Form(0),
    expression_scale: float = Form(1.0),
):
    import tempfile, shutil, uuid
    tmp = tempfile.mkdtemp()
    img_path = os.path.join(tmp, f"input_{uuid.uuid4().hex}.jpg")
    aud_path = os.path.join(tmp, f"audio_{uuid.uuid4().hex}.wav")
    with open(img_path, "wb") as f:
        shutil.copyfileobj(image.file, f)
    with open(aud_path, "wb") as f:
        shutil.copyfileobj(audio.file, f)

    output_dir = TOOLS["sadtalker"].get("output_dir",
        os.path.join(BASE_DIR, "triggers", "gpu_watch", "sadtalker_output"))
    os.makedirs(output_dir, exist_ok=True)
    script = TOOLS["sadtalker"]["script"]

    if not os.path.exists(script):
        raise HTTPException(404, "SadTalker script not found. Check scripts/run_sadtalker.py")
    try:
        proc = await asyncio.create_subprocess_exec(
            "python3", script, img_path, aud_path,
            "--output_dir", output_dir,
            f"--pose_style={pose_style}",
            f"--expression_scale={expression_scale}",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
        if proc.returncode != 0:
            raise HTTPException(500, f"SadTalker error: {stderr.decode()[:500]}")
        return {"status": "ok", "output_dir": output_dir, "log": stdout.decode()[:500]}
    except asyncio.TimeoutError:
        raise HTTPException(504, "SadTalker timed out")
