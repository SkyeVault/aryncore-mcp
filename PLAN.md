# ArynCore Desktop App — Implementation Plan

## Vision
A local-first desktop hub that unifies:
- Multi-model LLM chat (local Ollama + remote servers)
- n8n workflow management (local + networked instances)
- GPU tool library (SadTalker, TortoiseTTS, Whisper, SD, AnimateDiff)
- Remote server connections (multiple Ollama/API endpoints)
- Visual directory for all tools and workflow creation

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Tauri Desktop Shell                  │
│  ┌─────────────────────────────────────────────────┐ │
│  │           React Frontend (Vite + shadcn/ui)      │ │
│  │  Dashboard | Chat | Models | Servers | n8n | Tools│ │
│  └────────────────────┬────────────────────────────┘ │
└───────────────────────│─────────────────────────────┘
                        │ HTTP / WebSocket
┌───────────────────────▼─────────────────────────────┐
│              FastAPI Backend (port 8000)              │
│  - Ollama proxy & model manager                       │
│  - Remote server registry                             │
│  - n8n API bridge                                     │
│  - Tool orchestrator (SadTalker, TTS, Whisper, SD)   │
│  - WebSocket chat handler                             │
│  - System status monitor                             │
└──────┬──────────┬──────────┬──────────┬─────────────┘
       │          │          │          │
   Ollama     n8n API    Tools      Prometheus
  :11434      :5678     (Docker)     :9090
```

---

## Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Desktop shell | Tauri v2 | Lightweight, Rust-native, wraps web frontend |
| Frontend | React + Vite | Fast, component-based |
| UI library | shadcn/ui + Tailwind | Clean, dark-mode ready |
| State | Zustand | Lightweight, React-friendly |
| Backend | FastAPI (Python) | Natural fit for existing Python codebase |
| Real-time | WebSocket (FastAPI) | For chat streaming and status updates |
| Config storage | SQLite via aiosqlite | Store servers, settings, tool configs locally |

---

## App Sections (Screens)

### 1. Dashboard (Home)
- System health: Ollama status, GPU tool status, n8n reachability
- Quick-launch persona buttons (Aryn, Doc, Kona, Glyph, Estra)
- Active model indicator (which model is loaded)
- GPU usage widget (via Prometheus/nvidia-smi)
- Recent conversations list
- Recent n8n workflows

### 2. Chat
- Left sidebar: persona selector + conversation history
- Main: streaming chat with selected persona/model
- Model switcher (dropdown per conversation)
- Attach files for tool invocation (image → SadTalker, audio → Whisper)
- Tool output panel (video/audio/image preview inline)
- System prompt editor per persona

### 3. Model Manager
- Local tab: list installed Ollama models (size, quantization, last used)
  - Pull new model (search + download with progress bar)
  - Delete model
  - Set model tags / assign to persona
- Remote tab: models available on connected servers
- Compare tab: run same prompt across multiple models

### 4. Server Connections
- Add server panel: name, URL, type (Ollama | OpenAI-compatible | Custom API)
- Status indicator per server (green/red/latency)
- Test connection button
- Assign models from server to personas
- Support up to unlimited servers (local + remote)
- Fields: name, host, port, auth token (optional), type

### 5. n8n Hub
- Local n8n: connection to http://localhost:5678
- Network n8n: add additional n8n instances by URL
- Workflow list viewer (pulls from n8n API)
- Trigger webhook from chat (send job to n8n)
- Workflow status monitor (poll for completion)
- Quick "Create Workflow" button (opens n8n in embedded webview or browser)
- Saved webhook shortcuts (e.g., /blog, /video, /social)

### 6. Tool Library (Visual Directory)
- Card grid of available tools:
  - SadTalker (Video: image + audio → talking head mp4)
  - TortoiseTTS (Audio: text → speech)
  - Whisper (Audio: speech → text)
  - Stable Diffusion (Image: text → image via A1111 API)
  - AnimateDiff (Video: animation synthesis)
- Each card shows: name, status (running/stopped), port, description
- Launch / Stop tool button
- Config panel per tool (input/output paths, resolution, etc.)
- Run tool directly from UI (drag-and-drop file or text input)
- Output viewer (video player, audio player, image display)

### 7. Workflow Builder (Visual Canvas)
- Node-based canvas (React Flow)
- Drag tools onto canvas: LLM → TTS → SadTalker → n8n webhook
- Connect nodes to define data flow
- Save workflows as JSON
- Execute workflow → shows live progress per node
- Export to n8n workflow format

---

## File Structure (New)

```
aryncore-mcp/
├── backend/
│   ├── api.py              ← NEW: FastAPI app entry point
│   ├── routers/
│   │   ├── chat.py         ← WebSocket + REST chat endpoints
│   │   ├── ollama.py       ← Ollama model management
│   │   ├── servers.py      ← Remote server registry (SQLite)
│   │   ├── n8n.py          ← n8n API bridge
│   │   ├── tools.py        ← Tool orchestration endpoints
│   │   └── system.py       ← System status (Prometheus, GPU)
│   ├── services/
│   │   ├── ollama_client.py
│   │   ├── n8n_client.py
│   │   ├── tool_runner.py  ← Wraps existing run_*.py scripts
│   │   └── server_store.py ← SQLite CRUD for server registry
│   ├── db.py               ← SQLite init + schema
│   ├── mcp_orchestrator.py ← existing (keep)
│   └── persona_runner.py   ← existing (keep, refactor into service)
│
├── frontend/               ← NEW: React app
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Chat.tsx
│   │   │   ├── ModelManager.tsx
│   │   │   ├── Servers.tsx
│   │   │   ├── N8nHub.tsx
│   │   │   ├── ToolLibrary.tsx
│   │   │   └── WorkflowBuilder.tsx
│   │   ├── components/
│   │   │   ├── layout/     (Sidebar, TopBar, StatusBar)
│   │   │   ├── chat/       (MessageBubble, InputBar, PersonaSelect)
│   │   │   ├── tools/      (ToolCard, ToolRunner, OutputViewer)
│   │   │   ├── servers/    (ServerCard, AddServerForm)
│   │   │   └── n8n/        (WorkflowList, WebhookTrigger)
│   │   ├── store/          (Zustand stores)
│   │   └── lib/            (API client, WebSocket hook, utils)
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.ts
│
└── src-tauri/              ← NEW: Tauri app wrapper
    ├── src/main.rs
    ├── tauri.conf.json
    └── Cargo.toml
```

---

## Implementation Phases

### Phase 1 — FastAPI Backend (Foundation)
1. Create `backend/api.py` — FastAPI app with CORS, lifespan
2. Create `backend/db.py` — SQLite schema (servers, settings, conversations)
3. `routers/ollama.py` — GET /models, POST /pull, DELETE /model
4. `routers/chat.py` — POST /chat (REST), WS /ws/chat (streaming)
5. `routers/servers.py` — CRUD for remote server registry
6. `routers/system.py` — GET /status (ollama ping, tool pings, GPU info)
7. Wrap existing persona_runner.py as a service

### Phase 2 — Frontend Scaffold
1. Init React + Vite project in `frontend/`
2. Install shadcn/ui, Tailwind, Zustand, React Router
3. Create sidebar layout with 7 navigation items
4. Implement API client lib (`lib/api.ts` + `lib/ws.ts`)
5. Build Dashboard with system status cards

### Phase 3 — Chat
1. WebSocket chat with streaming token display
2. Persona selector sidebar
3. Conversation history (stored in SQLite)
4. Model switcher per chat

### Phase 4 — Model Manager + Servers
1. Model list with pull/delete (progress via SSE)
2. Server add/test/remove UI
3. Remote model browsing

### Phase 5 — n8n Hub
1. n8n API client (connect, list workflows)
2. Webhook trigger UI
3. Multi-instance support

### Phase 6 — Tool Library
1. Tool status cards (ping each tool's port)
2. Tool runner UI (upload file, run, preview output)
3. Launch/stop scripts integration

### Phase 7 — Workflow Builder
1. React Flow canvas
2. Drag-and-drop tool nodes
3. Save/load workflows as JSON
4. Execute workflow

### Phase 8 — Tauri Packaging
1. Init Tauri in `src-tauri/`
2. Configure to serve frontend + launch FastAPI on startup
3. Build desktop binary

---

## Phase 1 Start: FastAPI Dependencies

Add to requirements.txt:
```
fastapi
uvicorn[standard]
aiosqlite
httpx
python-multipart
```

Start command: `uvicorn backend.api:app --reload --port 8000`

---

## Quick Wins (What to Build First)

1. FastAPI `/api/status` → pings Ollama, n8n, tools → Dashboard works
2. FastAPI `/api/models` + `/ws/chat` → Chat + Model Manager work
3. FastAPI `/api/servers` CRUD → Server Connections work
4. Everything else builds on top of this foundation
