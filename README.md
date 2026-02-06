
# ArynCore MCP

**ArynCore** is a local-first Master Control Program (MCP) designed to interface with multiple local LLMs, including automation, writing, and creative tools. This project uses a central bot (Aryn) to route conversations, tasks, and commands to specialized agents hosted on both CPU and GPU systems.

## Agents

- **Aryn** – Central coordinator (chat UI) - Gemma2b
- **Doc** – Codellama
- **tiny-bot** – irc chat bot

## Features

- Runs local models via Ollama
- Triggers GPU tasks (video, SDXL, audio) via file system events
- Exposes LLMs via one central interface
- Orchestrated with Docker & n8n

---


# aryncore-mcp

