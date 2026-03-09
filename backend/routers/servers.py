import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
import httpx
from pydantic import BaseModel
from backend.db import get_db

router = APIRouter()


class ServerCreate(BaseModel):
    name: str
    host: str
    port: int = 11434
    type: str = "ollama"
    auth_token: Optional[str] = None


class ServerUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    type: Optional[str] = None
    auth_token: Optional[str] = None
    enabled: Optional[int] = None


async def ping_server(host: str, port: int, type: str, auth_token: Optional[str] = None) -> dict:
    url = f"http://{host}:{port}"
    try:
        headers = {}
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
        endpoint = f"{url}/api/tags" if type == "ollama" else f"{url}/v1/models"
        async with httpx.AsyncClient() as client:
            r = await client.get(endpoint, headers=headers, timeout=3.0)
            return {"online": r.status_code < 500, "latency_ms": None}
    except Exception:
        return {"online": False, "latency_ms": None}


@router.get("")
async def list_servers(db=Depends(get_db)):
    async with db.execute("SELECT * FROM servers ORDER BY id") as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.post("")
async def create_server(body: ServerCreate, db=Depends(get_db)):
    await db.execute(
        "INSERT INTO servers (name, host, port, type, auth_token) VALUES (?,?,?,?,?)",
        (body.name, body.host, body.port, body.type, body.auth_token)
    )
    await db.commit()
    async with db.execute("SELECT * FROM servers WHERE id = last_insert_rowid()") as cur:
        row = await cur.fetchone()
    return dict(row)


@router.get("/{server_id}")
async def get_server(server_id: int, db=Depends(get_db)):
    async with db.execute("SELECT * FROM servers WHERE id=?", (server_id,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Server not found")
    return dict(row)


@router.patch("/{server_id}")
async def update_server(server_id: int, body: ServerUpdate, db=Depends(get_db)):
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(400, "No fields to update")
    set_clause = ", ".join(f"{k}=?" for k in fields)
    await db.execute(
        f"UPDATE servers SET {set_clause} WHERE id=?",
        (*fields.values(), server_id)
    )
    await db.commit()
    async with db.execute("SELECT * FROM servers WHERE id=?", (server_id,)) as cur:
        row = await cur.fetchone()
    return dict(row)


@router.delete("/{server_id}")
async def delete_server(server_id: int, db=Depends(get_db)):
    await db.execute("DELETE FROM servers WHERE id=?", (server_id,))
    await db.commit()
    return {"deleted": server_id}


@router.get("/{server_id}/ping")
async def ping(server_id: int, db=Depends(get_db)):
    async with db.execute("SELECT * FROM servers WHERE id=?", (server_id,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Server not found")
    s = dict(row)
    result = await ping_server(s["host"], s["port"], s["type"], s.get("auth_token"))
    return result
