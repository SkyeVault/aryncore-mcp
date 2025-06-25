# Estra Persona Instructions Guide

Welcome to the Estra persona inside the `aryncore-mcp` system. This document will guide you through how to launch, use, train, and maintain Estra as part of your daily AI toolkit.

---

## Folder Structure Overview

Your working directory is:

```
~/forge/aryncore-mcp
```

Estra is integrated into a modular system that includes:

- **`backend/`** – where the persona orchestrator lives.
- **`mcp/`** – houses trigger logic and agents.
- **`models/`** – includes all AI models (SadTalker, Stable Diffusion, Whisper, etc).
- **`scripts/`** – run helpers for inference and utilities.
- **`venv/`** – your Python virtual environment.
- **`docker/`** – Dockerized services like n8n and Prometheus.
- **`triggers/`** – watches folders and routes tasks to appropriate tools.

---

## 🚀 Launching Estra

From your `aryncore-mcp` directory:

```bash
source venv/bin/activate
python3 -m backend.mcp_orchestrator
```

Choose the persona `estra` when prompted. Estra is your:
> **Writer, Editor, and Fact-checker** – best used for writing clarity, blog editing, code documentation, and structured facts.

---

## What Estra Can Do

- **Edit and summarize** long technical documentation
- **Fact-check** claims with search augmentation (optional future feature)
- **Write** devlogs, changelogs, and instructions
- **Collaborate** with other personas for multi-modal tasks (e.g., image + caption)

---

## 🛠Using Estra Daily

You can chat directly with Estra in terminal or route tasks programmatically.

Example conversation:

```text
You: How can I help you learn more about me?
Estra: Ask me to rewrite any document, summarize research, or document your progress!
```

Or pipe tasks from `mcp_orchestrator` or n8n workflows by assigning task labels like:

- `"write_devlog"`
- `"summarize_article"`
- `"format_readme"`

---

## Training Estra

Estra responds based on:

1. Your coded personality definitions in `backend/persona_map.json`
2. Prompt templates (WIP: store in `mcp/config`)
3. Input data (your writing, Git logs, notes)

To fine-tune Estra long-term:

- Create a vector store of previous writing (coming soon)
- Let Estra review and rephrase your notes over time
- Train with Whisper/TTS input and validate writing style

---

## Maintaining Estra

- Keep `requirements.txt` up to date.
- Periodically rebuild the virtual environment:
  ```bash
  deactivate
  rm -rf venv
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  ```

- Monitor Estra’s logic inside:
  - `backend/persona_runner.py`
  - `backend/mcp_orchestrator.py`
  - `mcp/config/paths.json` for model routing

---

## Experimental Features

| Feature           | Status     | Notes                                   |
|------------------|------------|-----------------------------------------|
| Style adaptation | In Progress| Based on your notes + commit messages   |
| Long-term memory | Planned    | Store context in vector DB              |
| Voice + caption  | Working    | Combine Whisper + SadTalker + Estra     |

---

## Next Steps

- Test Estra’s response quality by sending raw blog drafts.
- Start building prompt templates that Estra can follow.
- Build an automation trigger from `n8n` that launches Estra to generate release notes or instructions.

> Estra is not just a writer—she’s a system mind, a synthesis engine, and your factual shield. Use her daily.
