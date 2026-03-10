# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

ArynCore MCP is a local-first AI desktop hub. It has a FastAPI backend and a React/Vite frontend. The goal is a unified UI for multi-model LLM chat, n8n workflow management, and GPU tool orchestration (SadTalker, TortoiseTTS, Whisper, Stable Diffusion).

## Running the App

```bash
# Start both backend and frontend together
./start.sh

# Or start individually:
# Backend (from repo root, with venv active)
source venv/bin/activate
uvicorn backend.api:app --host 0.0.0.0 --port 8000 --reload

# Frontend (from frontend/)
cd frontend && npm run dev
```

URLs: App → http://localhost:5173 | API → http://localhost:8000 | Docs → http://localhost:8000/docs

## Backend Structure

- **`backend/api.py`** — FastAPI entry point; registers all routers and initializes the DB on startup via `lifespan`
- **`backend/db.py`** — SQLite schema (`config/aryncore.db`) and `get_db()` dependency for routers; auto-seeded with local/remote Ollama servers and default settings on first run
- **`backend/routers/`** — one file per domain: `chat.py`, `ollama.py`, `servers.py`, `n8n.py`, `tools.py`, `system.py`; all mounted under `/api/<domain>`
- **`backend/persona_runner.py`** — legacy synchronous HTTP client to Ollama (still used by CLI); the routers use `httpx` async directly
- **`backend/mcp_orchestrator.py`** — CLI persona runner (not part of the web app)
- **`mcp/config/models.json`** — persona definitions (keys: `central`, `doc`, `kona`, `glyph`, `estra`); loaded at runtime by `chat.py`

## Frontend Structure

React 19 + Vite + Tailwind v4 + Zustand. All in `frontend/src/`.

- **`lib/api.ts`** — typed fetch wrapper; all API calls go through `request()` which prefixes `/api` (Vite proxies this to `localhost:8000` including WebSocket)
- **`lib/ws.ts`** — WebSocket client for streaming chat (`ws://localhost:8000/api/chat/ws`)
- **`store/useAppStore.ts`** — single Zustand store; holds system status, active persona/model/server, conversations, servers, n8n instances, tools
- **`pages/`** — one file per section: Dashboard, Chat, ModelManager, Servers, N8nHub, ToolLibrary, WorkflowBuilder
- **`components/layout/`** — Sidebar, TopBar, StatusBar

Key UI libraries: Radix UI (Dialog, DropdownMenu, Tabs), lucide-react icons, React Flow (WorkflowBuilder canvas).

## WebSocket Chat Protocol

Send JSON: `{ message, persona, model, server_host, server_port, conversation_id? }`

Receive JSON messages with `type`:
- `"conversation_id"` — echoed back when a new conversation is created
- `"token"` — streaming token; `done: true` signals completion
- `"error"` — error string

## Personas

Five personas defined in `mcp/config/models.json`, referenced by key:
- `central` → Aryn (coordinator)
- `doc` → Doc (architect)
- `kona` → Kona (creative)
- `glyph` → Glyph (automation)
- `estra` → Estra (writer)

All currently use the `mistral` model. The frontend `PERSONAS` constant in `store/useAppStore.ts` is the display source of truth.

## Services & Ports

| Service | Port | Notes |
|---|---|---|
| FastAPI backend | 8000 | |
| React frontend | 5173 | |
| Ollama (local) | 11434 | |
| Ollama (remote) | 11434 | at 162.248.7.248 |
| n8n | 5678 | |
| TortoiseTTS | 5003 | Docker |
| Stable Diffusion | 7860 | Docker, A1111 |
| Prometheus | 9090 | |

## Database

SQLite at `config/aryncore.db`. Tables: `servers`, `conversations`, `messages`, `n8n_instances`, `settings`, `workflows`. Use `get_db()` as a FastAPI dependency (yields an `aiosqlite` connection with `row_factory = aiosqlite.Row`). Schema is in `backend/db.py`.

## Frontend Dev Commands

```bash
cd frontend
npm run dev       # dev server with HMR
npm run build     # tsc + vite build
npm run lint      # eslint
npm run preview   # preview production build
```

## Implementation Status

Phases completed: 1 (FastAPI backend) and 2 (Frontend scaffold). Remaining phases per `PLAN.md`: Chat streaming (3), Model Manager + Servers (4), n8n Hub (5), Tool Library (6), Workflow Builder (7), Tauri packaging (8).

The `backend/services/` directory exists but is currently empty — service logic lives directly in the routers.
