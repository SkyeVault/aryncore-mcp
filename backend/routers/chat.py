import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
import httpx
from pydantic import BaseModel
from backend.db import get_db

router = APIRouter()

PERSONAS: dict = {}


def load_personas() -> dict:
    import os
    path = os.path.join(os.path.dirname(__file__), "..", "..", "mcp", "config", "models.json")
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return {}


def get_personas():
    global PERSONAS
    if not PERSONAS:
        PERSONAS = load_personas()
    return PERSONAS


class ChatRequest(BaseModel):
    message: str
    persona: str = "central"
    model: Optional[str] = None
    server_host: str = "localhost"
    server_port: int = 11434
    conversation_id: Optional[int] = None
    stream: bool = True


async def save_message(db, conversation_id: int, role: str, content: str):
    await db.execute(
        "INSERT INTO messages (conversation_id, role, content) VALUES (?,?,?)",
        (conversation_id, role, content)
    )
    await db.execute(
        "UPDATE conversations SET updated_at=datetime('now') WHERE id=?",
        (conversation_id,)
    )
    await db.commit()


async def ensure_conversation(db, persona: str, model: str, server_id: Optional[int] = None) -> int:
    await db.execute(
        "INSERT INTO conversations (persona, model, server_id) VALUES (?,?,?)",
        (persona, model, server_id)
    )
    await db.commit()
    async with db.execute("SELECT last_insert_rowid() as id") as cur:
        row = await cur.fetchone()
    return row["id"]


@router.post("/complete")
async def chat_complete(req: ChatRequest):
    """Non-streaming LLM call for workflow execution."""
    personas = get_personas()
    persona = personas.get(req.persona, {})
    system_prompt = (
        f"You are {persona.get('name', 'Aryn')}. "
        f"Role: {persona.get('role', '')}. "
        f"Personality: {persona.get('personality', '')}"
    )
    model = req.model or "mistral"
    base_url = f"http://{req.server_host}:{req.server_port}"
    payload = {
        "model": model,
        "prompt": req.message,
        "system": system_prompt,
        "stream": False,
        "options": {"temperature": 0.7},
    }
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(f"{base_url}/api/generate", json=payload)
            r.raise_for_status()
            return {"response": r.json().get("response", "")}
    except httpx.ConnectError:
        raise HTTPException(502, f"Cannot connect to Ollama at {base_url}")
    except httpx.TimeoutException:
        raise HTTPException(504, f"Ollama at {base_url} timed out")
    except Exception as e:
        raise HTTPException(502, f"LLM error: {e}")


@router.get("/conversations")
async def list_conversations(db=Depends(get_db)):
    async with db.execute(
        "SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 50"
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.get("/conversations/{conv_id}/messages")
async def get_messages(conv_id: int, db=Depends(get_db)):
    async with db.execute(
        "SELECT * FROM messages WHERE conversation_id=? ORDER BY id",
        (conv_id,)
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: int, db=Depends(get_db)):
    await db.execute("DELETE FROM conversations WHERE id=?", (conv_id,))
    await db.commit()
    return {"deleted": conv_id}


@router.websocket("/ws")
async def chat_ws(websocket: WebSocket):
    await websocket.accept()
    db_gen = get_db()
    db = await db_gen.__anext__()
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            message = data.get("message", "")
            persona_key = data.get("persona", "central")
            model = data.get("model", "mistral")
            server_host = data.get("server_host", "localhost")
            server_port = data.get("server_port", 11434)
            conversation_id = data.get("conversation_id")

            personas = get_personas()
            persona = personas.get(persona_key, {})
            system_prompt = (
                f"You are {persona.get('name', 'Aryn')}. "
                f"Role: {persona.get('role', '')}. "
                f"Personality: {persona.get('personality', '')}"
            )

            if not conversation_id:
                conversation_id = await ensure_conversation(db, persona_key, model)
                await websocket.send_json({"type": "conversation_id", "id": conversation_id})

            await save_message(db, conversation_id, "user", message)

            base_url = f"http://{server_host}:{server_port}"
            payload = {
                "model": model,
                "prompt": message,
                "system": system_prompt,
                "stream": True,
                "options": {"temperature": 0.7},
            }

            full_response = ""
            try:
                async with httpx.AsyncClient(timeout=None) as client:
                    async with client.stream("POST", f"{base_url}/api/generate", json=payload) as r:
                        async for line in r.aiter_lines():
                            if line:
                                chunk = json.loads(line)
                                token = chunk.get("response", "")
                                full_response += token
                                done = chunk.get("done", False)
                                await websocket.send_json({"type": "token", "token": token, "done": done})
                                if done:
                                    break
            except Exception as e:
                await websocket.send_json({"type": "error", "message": str(e)})
                continue

            await save_message(db, conversation_id, "assistant", full_response)

    except WebSocketDisconnect:
        pass
    finally:
        await db.close()
