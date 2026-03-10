from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db import init_db
from backend.routers import chat, ollama, servers, n8n, tools, system, deploy, p2p


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="ArynCore MCP", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system.router, prefix="/api/system", tags=["system"])
app.include_router(ollama.router, prefix="/api/ollama", tags=["ollama"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(servers.router, prefix="/api/servers", tags=["servers"])
app.include_router(n8n.router, prefix="/api/n8n", tags=["n8n"])
app.include_router(tools.router, prefix="/api/tools", tags=["tools"])
app.include_router(deploy.router, prefix="/api/deploy", tags=["deploy"])
app.include_router(p2p.router, prefix="/api/p2p", tags=["p2p"])


@app.get("/")
async def root():
    return {"status": "ArynCore MCP running"}
