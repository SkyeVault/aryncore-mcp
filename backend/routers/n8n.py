from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
import httpx
from pydantic import BaseModel
from backend.db import get_db

router = APIRouter()


class N8nCreate(BaseModel):
    name: str
    host: str
    port: int = 5678
    api_key: Optional[str] = None
    is_local: int = 0


class TriggerRequest(BaseModel):
    instance_id: int
    webhook_path: str
    payload: dict = {}


def n8n_base(host: str, port: int) -> str:
    return f"http://{host}:{port}"


async def n8n_headers(api_key: Optional[str]) -> dict:
    if api_key:
        return {"X-N8N-API-KEY": api_key}
    return {}


@router.get("/instances")
async def list_instances(db=Depends(get_db)):
    async with db.execute("SELECT * FROM n8n_instances ORDER BY id") as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.post("/instances")
async def create_instance(body: N8nCreate, db=Depends(get_db)):
    await db.execute(
        "INSERT INTO n8n_instances (name, host, port, api_key, is_local) VALUES (?,?,?,?,?)",
        (body.name, body.host, body.port, body.api_key, body.is_local)
    )
    await db.commit()
    async with db.execute("SELECT * FROM n8n_instances WHERE id = last_insert_rowid()") as cur:
        row = await cur.fetchone()
    return dict(row)


@router.delete("/instances/{instance_id}")
async def delete_instance(instance_id: int, db=Depends(get_db)):
    await db.execute("DELETE FROM n8n_instances WHERE id=?", (instance_id,))
    await db.commit()
    return {"deleted": instance_id}


@router.get("/instances/{instance_id}/workflows")
async def list_workflows(instance_id: int, db=Depends(get_db)):
    async with db.execute("SELECT * FROM n8n_instances WHERE id=?", (instance_id,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Instance not found")
    inst = dict(row)
    base = n8n_base(inst["host"], inst["port"])
    headers = await n8n_headers(inst.get("api_key"))
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(f"{base}/api/v1/workflows", headers=headers, timeout=5.0)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            raise HTTPException(502, f"Cannot reach n8n: {e}")


@router.get("/instances/{instance_id}/status")
async def instance_status(instance_id: int, db=Depends(get_db)):
    async with db.execute("SELECT * FROM n8n_instances WHERE id=?", (instance_id,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Instance not found")
    inst = dict(row)
    base = n8n_base(inst["host"], inst["port"])
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{base}/healthz", timeout=3.0)
            return {"online": r.status_code == 200, "instance": inst["name"]}
    except Exception:
        return {"online": False, "instance": inst["name"]}


@router.post("/trigger")
async def trigger_webhook(body: TriggerRequest, db=Depends(get_db)):
    async with db.execute("SELECT * FROM n8n_instances WHERE id=?", (body.instance_id,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Instance not found")
    inst = dict(row)
    base = n8n_base(inst["host"], inst["port"])
    url = f"{base}/webhook/{body.webhook_path.lstrip('/')}"
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(url, json=body.payload, timeout=10.0)
            return {"status": r.status_code, "response": r.text[:2000]}
        except Exception as e:
            raise HTTPException(502, str(e))
