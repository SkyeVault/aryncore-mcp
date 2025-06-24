
# aryncore-mcp — Instruction Manual

This manual covers everything needed to configure your router, run your AI models with Ollama, and use ArynCore as a modular command center.

---

## 1. Router Configuration (Port Forwarding)

To expose your AI model externally, you need to forward **port 11434** to your Forge device.

### Steps:
1. Visit `http://192.168.1.1` in a browser (Verizon router default).
2. Login with your admin credentials.
3. Navigate to: `Firewall Settings > Port Forwarding`
4. Set up a new rule:
   - Device: `LoreForge - 192.168.1.4`
   - Protocol: `TCP`
   - Source Port: `11434`
   - Destination Port: `11434`
   - WAN Connection: `All Broadband Devices`
   - Schedule: `Always`
5. Click `Add` and apply changes.
6. Restart the router if needed.

---

## 2. Start Ollama with External Access

### One-time setup (model install):
```bash
ollama pull mistral
```

### Run it in server mode:
```bash
OLLAMA_HOST=0.0.0.0:11434 ollama serve &
```

Then load the model:
```bash
ollama run mistral &
```

You may optionally set these as background services with systemd or a `boot_aryn` script.

---

## 3. Directory & File Structure

```
~/forge/aryncore-mcp/
├── backend/
│   ├── mcp_orchestrator.py       # Entry point for local AI assistant
│   ├── personas/                 # Individual persona behavior definitions
├── scripts/
│   ├── boot_aryn.sh              # Your launcher script (sets env + runs)
├── .local_logs/                  # Conversations + logs not tracked by Git
├── venv/                         # Python virtual environment
└── README.md                     # Project instructions
```

---

## 4. Running the System (Manual)

### Activate Virtual Environment:
```bash
cd ~/forge/aryncore-mcp
source venv/bin/activate
```

### Start the Orchestrator:
```bash
python3 -m backend.mcp_orchestrator
```

You will see:

```
Choose a persona:
- central: Aryn
- doc: Doc
- kona: Kona
- glyph: Glyph
- estra: Estra

Enter key: estra
```

---

## 5. Conversation Logging (Local-Only)

All conversations are stored in:
```
~/forge/aryncore-mcp/.local_logs/
```

These are excluded from GitHub via `.gitignore`. Each session is timestamped and appended per persona.

---

## 6. Tips & Troubleshooting

| Problem                             | Fix                                                             |
|-------------------------------------|------------------------------------------------------------------|
| curl says "connection refused"    | Ensure `ollama serve` is running AND model is loaded            |
| {"models":[]}                     | Run: `ollama run mistral &`                                     |
| Still blocked externally            | Check that your public IP hasn’t changed (use `ifconfig.me`)    |
| Port still closed                   | Verify router rule + check `ss -tuln | grep 11434`              |
| Slow model loading                  | Happens on first run or if GPU is memory-swapped                |

---

## 7. Confirm the System is Ready

Run:
```bash
curl http://localhost:11434/api/tags
```
Or from another machine:
```bash
curl http://<YOUR_PUBLIC_IP>:11434/api/tags
```

Should return:
```json
{"models":[{"name":"mistral",...}]}
```
