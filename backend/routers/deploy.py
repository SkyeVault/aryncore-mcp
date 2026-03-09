"""
Deploy / Publish router — SSH/SFTP file management for remote web servers.
Handles IPv4 and IPv6 targets.
"""
import asyncio
import io
import os
import stat
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
import paramiko

from backend.db import get_db

router = APIRouter()
_executor = ThreadPoolExecutor(max_workers=4)


# ── SSH helpers ────────────────────────────────────────────────────────────────

def _open_sftp(target: dict) -> tuple[paramiko.SSHClient, paramiko.SFTPClient]:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    host = target["host"].strip()
    # Strip IPv6 brackets if present ([::1] → ::1)
    if host.startswith("[") and host.endswith("]"):
        host = host[1:-1]

    kwargs: dict = {
        "hostname": host,
        "port": int(target.get("port", 22)),
        "username": target.get("username", "root"),
        "timeout": 12,
    }
    key_path = target.get("ssh_key_path") or ""
    if key_path and os.path.exists(key_path):
        kwargs["key_filename"] = key_path
    elif target.get("password"):
        kwargs["password"] = target["password"]
    else:
        # Fall back to SSH agent / default key files
        kwargs["look_for_keys"] = True

    ssh.connect(**kwargs)
    return ssh, ssh.open_sftp()


def _run(fn):
    """Run a blocking function in the thread pool."""
    return asyncio.get_event_loop().run_in_executor(_executor, fn)


def _safe_path(web_root: str, path: str) -> str:
    """Ensure path stays within web_root."""
    root = web_root.rstrip("/")
    if not path.startswith(root):
        path = root + "/" + path.lstrip("/")
    # Collapse any /../ traversal
    norm = os.path.normpath(path)
    if not norm.startswith(root):
        return root
    return norm


def _public_url(target: dict, remote_path: str) -> str:
    pub = (target.get("public_url") or "").rstrip("/")
    root = target["web_root"].rstrip("/")
    rel = remote_path[len(root):]  # e.g. /subdir/file.png
    if pub:
        return pub + rel
    # IPv6 fallback
    host = target["host"]
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    return f"http://{host}{rel}"


# ── Pydantic models ────────────────────────────────────────────────────────────

class TargetIn(BaseModel):
    name: str
    host: str
    port: int = 22
    username: str = "root"
    ssh_key_path: Optional[str] = None
    password: Optional[str] = None
    web_root: str = "/var/www/html"
    public_url: str = ""


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/targets")
async def list_targets(db=Depends(get_db)):
    async with db.execute("SELECT * FROM deploy_targets ORDER BY name") as cur:
        rows = await cur.fetchall()
    # Never return passwords in list
    results = []
    for r in rows:
        d = dict(r)
        d["password"] = "••••" if d.get("password") else ""
        results.append(d)
    return results


@router.post("/targets")
async def create_target(t: TargetIn, db=Depends(get_db)):
    await db.execute(
        """INSERT INTO deploy_targets
           (name, host, port, username, ssh_key_path, password, web_root, public_url)
           VALUES (?,?,?,?,?,?,?,?)""",
        (t.name, t.host, t.port, t.username, t.ssh_key_path, t.password, t.web_root, t.public_url),
    )
    await db.commit()
    async with db.execute("SELECT last_insert_rowid() as id") as cur:
        row = await cur.fetchone()
    return {"id": row["id"], **t.model_dump(exclude={"password"})}


@router.patch("/targets/{tid}")
async def update_target(tid: int, t: TargetIn, db=Depends(get_db)):
    # Don't overwrite password if the placeholder was sent
    if t.password and t.password.startswith("•"):
        await db.execute(
            """UPDATE deploy_targets SET name=?,host=?,port=?,username=?,
               ssh_key_path=?,web_root=?,public_url=? WHERE id=?""",
            (t.name, t.host, t.port, t.username, t.ssh_key_path, t.web_root, t.public_url, tid),
        )
    else:
        await db.execute(
            """UPDATE deploy_targets SET name=?,host=?,port=?,username=?,
               ssh_key_path=?,password=?,web_root=?,public_url=? WHERE id=?""",
            (t.name, t.host, t.port, t.username, t.ssh_key_path, t.password, t.web_root, t.public_url, tid),
        )
    await db.commit()
    return {"id": tid}


@router.delete("/targets/{tid}")
async def delete_target(tid: int, db=Depends(get_db)):
    await db.execute("DELETE FROM deploy_targets WHERE id=?", (tid,))
    await db.commit()
    return {"deleted": tid}


# ── Connection test ────────────────────────────────────────────────────────────

@router.post("/targets/{tid}/test")
async def test_connection(tid: int, db=Depends(get_db)):
    async with db.execute("SELECT * FROM deploy_targets WHERE id=?", (tid,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Target not found")
    target = dict(row)

    def _test():
        ssh, sftp = _open_sftp(target)
        try:
            # Try listing the web root
            entries = sftp.listdir(target["web_root"])
            return {"ok": True, "web_root_files": len(entries)}
        except Exception as e:
            return {"ok": True, "web_root_note": str(e)}
        finally:
            sftp.close()
            ssh.close()

    try:
        result = await _run(_test)
        return result
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ── Browse ─────────────────────────────────────────────────────────────────────

@router.get("/targets/{tid}/browse")
async def browse(tid: int, path: str = "", db=Depends(get_db)):
    async with db.execute("SELECT * FROM deploy_targets WHERE id=?", (tid,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404)
    target = dict(row)
    browse_path = _safe_path(target["web_root"], path or target["web_root"])

    def _browse():
        ssh, sftp = _open_sftp(target)
        try:
            entries = []
            for attr in sftp.listdir_attr(browse_path):
                is_dir = stat.S_ISDIR(attr.st_mode or 0)
                entries.append({
                    "name": attr.filename,
                    "is_dir": is_dir,
                    "size": attr.st_size if not is_dir else None,
                    "mtime": attr.st_mtime,
                    "path": browse_path.rstrip("/") + "/" + attr.filename,
                    "public_url": _public_url(target, browse_path.rstrip("/") + "/" + attr.filename) if not is_dir else None,
                })
            entries.sort(key=lambda e: (not e["is_dir"], e["name"].lower()))
            return entries
        finally:
            sftp.close()
            ssh.close()

    try:
        entries = await _run(_browse)
        return {
            "path": browse_path,
            "web_root": target["web_root"],
            "entries": entries,
        }
    except Exception as e:
        raise HTTPException(500, f"Browse error: {e}")


# ── Upload ─────────────────────────────────────────────────────────────────────

@router.post("/targets/{tid}/upload")
async def upload_file(
    tid: int,
    file: UploadFile = File(...),
    remote_dir: str = Form(""),
    db=Depends(get_db),
):
    async with db.execute("SELECT * FROM deploy_targets WHERE id=?", (tid,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404)
    target = dict(row)

    remote_dir = _safe_path(target["web_root"], remote_dir or target["web_root"])
    filename = file.filename or "upload"
    full_path = remote_dir.rstrip("/") + "/" + filename
    data = await file.read()

    def _upload():
        ssh, sftp = _open_sftp(target)
        try:
            # Ensure remote dir exists
            try:
                sftp.stat(remote_dir)
            except FileNotFoundError:
                _sftp_makedirs(sftp, remote_dir)
            sftp.putfo(io.BytesIO(data), full_path)
            return full_path
        finally:
            sftp.close()
            ssh.close()

    try:
        result_path = await _run(_upload)
        return {
            "uploaded": result_path,
            "filename": filename,
            "size": len(data),
            "public_url": _public_url(target, result_path),
        }
    except Exception as e:
        raise HTTPException(500, f"Upload error: {e}")


def _sftp_makedirs(sftp: paramiko.SFTPClient, path: str):
    parts = path.split("/")
    current = ""
    for part in parts:
        if not part:
            current = "/"
            continue
        current = current.rstrip("/") + "/" + part
        try:
            sftp.stat(current)
        except FileNotFoundError:
            sftp.mkdir(current)


# ── Delete file ────────────────────────────────────────────────────────────────

@router.delete("/targets/{tid}/file")
async def delete_file(tid: int, remote_path: str, db=Depends(get_db)):
    async with db.execute("SELECT * FROM deploy_targets WHERE id=?", (tid,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404)
    target = dict(row)
    if not remote_path.startswith(target["web_root"]):
        raise HTTPException(403, "Path is outside web root")

    def _delete():
        ssh, sftp = _open_sftp(target)
        try:
            sftp.remove(remote_path)
        finally:
            sftp.close()
            ssh.close()

    try:
        await _run(_delete)
        return {"deleted": remote_path}
    except Exception as e:
        raise HTTPException(500, f"Delete error: {e}")


# ── Create directory ───────────────────────────────────────────────────────────

@router.post("/targets/{tid}/mkdir")
async def make_dir(tid: int, path: str = Form(...), db=Depends(get_db)):
    async with db.execute("SELECT * FROM deploy_targets WHERE id=?", (tid,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404)
    target = dict(row)
    safe = _safe_path(target["web_root"], path)

    def _mkdir():
        ssh, sftp = _open_sftp(target)
        try:
            sftp.mkdir(safe)
        finally:
            sftp.close()
            ssh.close()

    try:
        await _run(_mkdir)
        return {"created": safe}
    except Exception as e:
        raise HTTPException(500, f"Mkdir error: {e}")


# ── Publish HTML page ──────────────────────────────────────────────────────────

@router.post("/targets/{tid}/publish-page")
async def publish_page(
    tid: int,
    title: str = Form(""),
    description: str = Form(""),
    media_url: str = Form(""),
    media_type: str = Form("image"),   # image | video | audio
    extra_html: str = Form(""),         # optional raw HTML block
    slug: str = Form("index"),
    db=Depends(get_db),
):
    async with db.execute("SELECT * FROM deploy_targets WHERE id=?", (tid,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404)
    target = dict(row)

    slug = (slug.strip().replace(" ", "-") or "page")
    filename = slug if slug.endswith(".html") else slug + ".html"

    media_block = ""
    if media_url:
        if media_type == "image":
            media_block = f'<img src="{media_url}" alt="{title}" style="max-width:100%;border-radius:8px;">'
        elif media_type == "video":
            media_block = f'<video src="{media_url}" controls playsinline style="max-width:100%;border-radius:8px;"></video>'
        elif media_type == "audio":
            media_block = f'<audio src="{media_url}" controls style="width:100%;margin-top:12px;"></audio>'

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{description}">
  <title>{title or slug}</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{background:#0d0d0f;color:#e5e5e5;font-family:system-ui,sans-serif;
         min-height:100vh;display:flex;flex-direction:column;align-items:center;
         justify-content:flex-start;padding:32px 16px}}
    .card{{max-width:860px;width:100%;background:#1a1a24;border:1px solid #2a2a35;
           border-radius:14px;padding:28px}}
    h1{{font-size:1.6rem;margin-bottom:10px;color:#c4b5fd;line-height:1.3}}
    .desc{{color:#9ca3af;font-size:0.95rem;margin-bottom:20px;line-height:1.6}}
    .media{{margin-top:4px}}
    footer{{margin-top:28px;font-size:0.75rem;color:#4b5563;text-align:center}}
    a{{color:#7c6ef7}}
  </style>
</head>
<body>
  <div class="card">
    <h1>{title or slug}</h1>
    {f'<div class="desc">{description}</div>' if description else ''}
    <div class="media">{media_block}</div>
    {extra_html}
  </div>
  <footer>Published with <a href="https://github.com/aryn" target="_blank">ArynCore</a></footer>
</body>
</html>"""

    remote_path = target["web_root"].rstrip("/") + "/" + filename
    data = html.encode("utf-8")

    def _publish():
        ssh, sftp = _open_sftp(target)
        try:
            sftp.putfo(io.BytesIO(data), remote_path)
        finally:
            sftp.close()
            ssh.close()

    try:
        await _run(_publish)
        return {
            "uploaded": remote_path,
            "filename": filename,
            "public_url": _public_url(target, remote_path),
        }
    except Exception as e:
        raise HTTPException(500, f"Publish error: {e}")
