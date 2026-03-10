"""
P2P Chat router — bridges the NKN network to the frontend via WebSocket.

The NKN bridge (nkn/bridge.js) is spawned as a subprocess; it communicates
with this router via JSON lines on stdin/stdout.  All connected browser clients
share a single NKN identity per backend process.
"""

import asyncio
import json
import logging
import os
from typing import Optional, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Bridge state (module-level singletons)
# ---------------------------------------------------------------------------

_bridge_proc: Optional[asyncio.subprocess.Process] = None
_bridge_addr: Optional[str] = None
_bridge_connected: bool = False
_ws_clients: Set[WebSocket] = set()

BRIDGE_SCRIPT = os.path.join(
    os.path.dirname(__file__), "..", "..", "nkn", "bridge.js"
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _broadcast(msg: dict) -> None:
    dead: Set[WebSocket] = set()
    for ws in list(_ws_clients):
        try:
            await ws.send_json(msg)
        except Exception:
            dead.add(ws)
    _ws_clients.difference_update(dead)


async def _read_bridge_output(proc: asyncio.subprocess.Process) -> None:
    global _bridge_addr, _bridge_connected
    while True:
        line = await proc.stdout.readline()
        if not line:
            break
        try:
            data = json.loads(line.decode().strip())
            if data.get("type") == "connected":
                _bridge_addr = data.get("addr")
                _bridge_connected = True
            await _broadcast(data)
        except Exception as e:
            logger.debug("Bridge parse error: %s", e)
    _bridge_connected = False
    _bridge_addr = None
    await _broadcast({"type": "disconnected"})


async def _log_bridge_stderr(proc: asyncio.subprocess.Process) -> None:
    while True:
        line = await proc.stderr.readline()
        if not line:
            break
        logger.warning("NKN bridge: %s", line.decode().rstrip())


async def _start_bridge() -> None:
    global _bridge_proc, _bridge_connected, _bridge_addr
    if _bridge_proc and _bridge_proc.returncode is None:
        return  # already running

    identifier = os.environ.get("NKN_IDENTIFIER", "aryncore")
    env = {**os.environ, "NKN_IDENTIFIER": identifier}

    # Resolve node_modules relative to the nkn/bridge.js location
    bridge_dir = os.path.dirname(os.path.abspath(BRIDGE_SCRIPT))
    repo_root = os.path.join(bridge_dir, "..")

    _bridge_proc = await asyncio.create_subprocess_exec(
        "node",
        os.path.abspath(BRIDGE_SCRIPT),
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
        cwd=os.path.abspath(repo_root),
    )
    asyncio.create_task(_read_bridge_output(_bridge_proc))
    asyncio.create_task(_log_bridge_stderr(_bridge_proc))


async def _send_to_bridge(dest: str, text: str) -> bool:
    if not _bridge_proc or _bridge_proc.returncode is not None:
        return False
    cmd = json.dumps({"type": "send", "dest": dest, "text": text}) + "\n"
    _bridge_proc.stdin.write(cmd.encode())
    await _bridge_proc.stdin.drain()
    return True


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@router.get("/status")
async def p2p_status():
    return {
        "connected": _bridge_connected,
        "addr": _bridge_addr,
        "running": _bridge_proc is not None and _bridge_proc.returncode is None,
    }


@router.post("/start")
async def p2p_start():
    await _start_bridge()
    return {"started": True}


@router.post("/stop")
async def p2p_stop():
    global _bridge_proc, _bridge_connected, _bridge_addr
    if _bridge_proc and _bridge_proc.returncode is None:
        _bridge_proc.terminate()
        try:
            await asyncio.wait_for(_bridge_proc.wait(), timeout=3)
        except asyncio.TimeoutError:
            _bridge_proc.kill()
    _bridge_connected = False
    _bridge_addr = None
    return {"stopped": True}


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws")
async def p2p_ws(websocket: WebSocket):
    await websocket.accept()
    _ws_clients.add(websocket)

    # Send current status immediately so the UI can render correctly
    await websocket.send_json({
        "type": "status",
        "connected": _bridge_connected,
        "addr": _bridge_addr,
    })

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            cmd_type = data.get("type")

            if cmd_type == "start":
                await _start_bridge()

            elif cmd_type == "stop":
                await p2p_stop()

            elif cmd_type == "send":
                dest = data.get("dest", "").strip()
                text = data.get("text", "").strip()
                if dest and text:
                    ok = await _send_to_bridge(dest, text)
                    if not ok:
                        await websocket.send_json({
                            "type": "error",
                            "message": "NKN bridge not running — start it first",
                        })
                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": "send requires dest and text",
                    })

            elif cmd_type == "send_multi":
                dests = [d.strip() for d in data.get("dests", []) if d.strip()]
                text = data.get("text", "").strip()
                if dests and text:
                    bridge_ok = True
                    for dest in dests:
                        ok = await _send_to_bridge(dest, text)
                        if not ok:
                            bridge_ok = False
                            break
                    if not bridge_ok:
                        await websocket.send_json({
                            "type": "error",
                            "message": "NKN bridge not running — start it first",
                        })
                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": "send_multi requires dests (list) and text",
                    })

    except WebSocketDisconnect:
        pass
    finally:
        _ws_clients.discard(websocket)
