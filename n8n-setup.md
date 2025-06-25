
n8n-setup.txt

Overview
--------
This guide shows how to integrate n8n webhook-triggered workflows into your ArynCore MCP system. 
Users/admins issue commands (/blog, /video, etc.) from the WebSocket-based chat UI. 
The FastAPI orchestrator receives them, forwards to n8n via webhook, and streams back the response.

1. Create n8n Workflow with Webhook Trigger
-------------------------------------------
1. Open n8n UI.
2. Add a Webhook Trigger node.
   - HTTP Method: POST
   - Path: e.g. trigger-blog
   - Response: When Last Node Finishes
3. Connect the Webhook node to downstream nodes:
   - AI generation (OpenAI, local LLM via HTTP)
   - File writer (Markdown, Notion, Ghost, etc.)
   - Social media or video services
4. Activate workflow.
5. Copy the Production Webhook URL, e.g.:
   https://n8n.arynwood.com/webhook/trigger-blog
6. Optionally secure with header auth, JWT, or IP whitelist.

2. FastAPI Orchestrator Integration
-----------------------------------
In your orchestrator.py (FastAPI + WebSocket setup):

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import requests, os

app = FastAPI()
N8N_TOKEN = os.getenv("N8N_SECRET")
N8N_BASE = "https://n8n.arynwood.com/webhook"

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = await ws.receive_text()

            if data.startswith("/blog"):
                prompt = data[len("/blog"):].strip()
                res = requests.post(
                    f"{N8N_BASE}/trigger-blog",
                    json={"prompt": prompt, "user": "admin"},
                    headers={"X-Auth-Token": N8N_TOKEN},
                    timeout=60
                )
                content = res.json().get("content", "Error")
                await ws.send_text(f"/blog â¤\n{content}")

            else:
                await ws.send_text("â ï¸ Unknown command.")
    except WebSocketDisconnect:
        pass

3. Secure n8n Workflows
-----------------------
- Use Header Auth or JWT on Webhook node.
- Set environment variables in n8n:
  N8N_PAYLOAD_SIZE_MAX=16MB
  WEBHOOK_URL=https://n8n.arynwood.com
- Serve n8n behind the same SSL domain as orchestrator (via NGINX).

4. Add More Workflows & Commands
--------------------------------
| Command     | n8n Webhook Path    | Description                                  |
|-------------|---------------------|----------------------------------------------|
| /video      | trigger-video       | Generate short video, return link            |
| /social     | trigger-social      | Post to Twitter/X, return status or link     |
| /img        | trigger-img         | Generate image gallery via Stable Diffusion  |

For each:
- Build corresponding n8n workflow
- Add Python route in orchestrator.py

5. Full Example: /video
-----------------------
elif data.startswith("/video"):
    prompt = data[len("/video"):].strip()
    res = requests.post(
        f"{N8N_BASE}/trigger-video",
        json={"prompt": prompt},
        headers={"X-Auth-Token": N8N_TOKEN},
        timeout=120
    )
    result = res.json()
    await ws.send_text(f"/video â¤ {result.get('mediaUrl', 'Error')}")

Summary
-------
1. Use n8n Webhook Trigger node
2. Secure the webhook
3. In FastAPI:
   - Route /commands
   - Forward to n8n
   - Send back response
4. Add UI handling in WebSocket client
5. Extend with more workflows
