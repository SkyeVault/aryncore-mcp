# ArynCore MCP

**ArynCore** is a local-first Master Control Program (MCP) designed to interface with multiple local LLMs, including automation, writing, and creative tools. This project uses a central bot (Aryn) to route conversations, tasks, and commands to specialized agents hosted on both CPU and GPU systems.

## Agents

- **Aryn** – Central coordinator (chat UI)
- **Doc** – Senior mentor and planner
- **Kona** – Creative and coding assistant
- **Glyph** – Automation & spreadsheet bot
- **Estra** – Writer, editor, and fact-checker

## Features

- Runs local models via Ollama
- Triggers GPU tasks (video, SDXL, audio) via file system events
- Exposes LLMs via one central interface
- Connects via NKN and is orchestrated with Docker & n8n

---

