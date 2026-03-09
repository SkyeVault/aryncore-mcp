# ArynCore MCP

Local-first AI desktop hub. One app to manage all your models, tools, and workflows.

## Quick Start

```bash
./start.sh
```

Opens:
- **App** → http://localhost:5173
- **API** → http://localhost:8000
- **API docs** → http://localhost:8000/docs

## What's Inside

| Section | What it does |
|---------|-------------|
| **Dashboard** | Live service status, GPU stats (RTX 3060), quick-launch personas |
| **Chat** | Streaming LLM chat with 5 AI personas (Aryn, Doc, Kona, Glyph, Estra) |
| **Model Manager** | Browse, pull, delete Ollama models across all servers |
| **Servers** | Add/manage remote Ollama/OpenAI-compatible servers |
| **n8n Hub** | Connect local + network n8n instances, trigger webhooks, view workflows |
| **Tool Library** | Run SadTalker, TortoiseTTS, Stable Diffusion, Whisper inline |
| **Workflow Builder** | Visual node canvas to chain tools and LLMs |

## Personas

- **Aryn** – Central coordinator
- **Doc** – Senior mentor and planner
- **Kona** – Creative and coding assistant
- **Glyph** – Automation & data bot
- **Estra** – Writer, editor, fact-checker

## Stack

- **Backend**: FastAPI + aiosqlite (port 8000)
- **Frontend**: React + Vite + Tailwind + Zustand (port 5173)
- **Tools**: SadTalker, TortoiseTTS, Whisper, Stable Diffusion, AnimateDiff
- **LLMs**: Ollama (local + remote at 162.248.7.248:11434)
- **Automation**: n8n (local + networked)

## Adding Servers

Go to **Servers** → Add Server. Supports:
- `ollama` — Ollama API
- `openai-compatible` — OpenAI-format APIs
- `custom` — Any HTTP API

## GPU Tools

```bash
# Stable Diffusion (A1111) — :7860
cd ~/services/a1111 && docker compose up -d

# TortoiseTTS — :5003
docker compose up -d

# SadTalker — runs via script, no server needed
```
