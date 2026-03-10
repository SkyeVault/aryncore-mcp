/**
 * ArynCore P2P Companion
 * Standalone NKN chat client — runs a local web server so you can chat
 * from any browser on the machine.
 *
 * Usage:
 *   NKN_IDENTIFIER=myname node app.js
 *   PORT=3000 NKN_IDENTIFIER=myname node app.js
 */

const NKNClient  = require('nkn-client');
const express    = require('express');
const WebSocket  = require('ws');
const http       = require('http');
const fs         = require('fs');
const path       = require('path');

const PORT       = parseInt(process.env.PORT  || '3000', 10);
const IDENTIFIER = process.env.NKN_IDENTIFIER || 'aryncore';
const DATA_FILE  = path.join(__dirname, 'data', 'state.json');

// ---------------------------------------------------------------------------
// Persistent state (contacts + message history)
// ---------------------------------------------------------------------------

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (_) {}
  return { contacts: [], history: {} };
}

function saveState() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

let state = loadState();

// ---------------------------------------------------------------------------
// Express + HTTP server
// ---------------------------------------------------------------------------

const app    = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Status & state
app.get('/api/status', (_req, res) => {
  res.json({ connected: nknConnected, addr: nknAddr, identifier: IDENTIFIER });
});

app.get('/api/state', (_req, res) => {
  res.json(state);
});

// Contacts
app.post('/api/contacts', (req, res) => {
  const { addr, label } = req.body;
  if (!addr) return res.status(400).json({ error: 'addr required' });
  if (!state.contacts.find(c => c.addr === addr)) {
    state.contacts.push({ addr, label: label || addr.slice(0, 18) + '…' });
    saveState();
  }
  res.json({ ok: true });
});

app.patch('/api/contacts/:addr', (req, res) => {
  const addr    = decodeURIComponent(req.params.addr);
  const contact = state.contacts.find(c => c.addr === addr);
  if (!contact) return res.status(404).json({ error: 'not found' });
  if (req.body.label) contact.label = req.body.label;
  saveState();
  res.json({ ok: true });
});

app.delete('/api/contacts/:addr', (req, res) => {
  const addr = decodeURIComponent(req.params.addr);
  state.contacts = state.contacts.filter(c => c.addr !== addr);
  saveState();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// NKN client
// ---------------------------------------------------------------------------

let nknClient    = null;
let nknAddr      = null;
let nknConnected = false;

function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
}

function connectNKN() {
  if (nknClient) return;
  console.log(`Connecting to NKN as "${IDENTIFIER}"…`);

  nknClient = new NKNClient({ identifier: IDENTIFIER });

  nknClient.on('connect', () => {
    nknAddr      = nknClient.addr;
    nknConnected = true;
    console.log('NKN connected:', nknAddr);
    broadcast({ type: 'connected', addr: nknAddr });
  });

  nknClient.on('message', (src, payload) => {
    let text = String(payload);
    try {
      const p = JSON.parse(payload);
      if (p.text != null) text = String(p.text);
    } catch (_) {}

    const ts  = Date.now();
    const msg = { type: 'message', src, text, timestamp: ts };
    broadcast(msg);

    // Persist
    if (!state.history[src]) state.history[src] = [];
    state.history[src].push({ from: 'them', text, timestamp: ts });

    // Auto-add unknown sender as contact
    if (!state.contacts.find(c => c.addr === src)) {
      state.contacts.push({ addr: src, label: src.slice(0, 18) + '…' });
    }
    saveState();
  });

  nknClient.on('error', err => {
    console.error('NKN error:', err);
    broadcast({ type: 'error', message: String(err) });
  });
}

function disconnectNKN() {
  // nkn-client 0.7.3 has no clean close; null the reference
  nknClient    = null;
  nknAddr      = null;
  nknConnected = false;
  broadcast({ type: 'disconnected' });
  console.log('NKN disconnected.');
}

function sendNKN(dest, text) {
  if (!nknClient) return Promise.reject(new Error('Not connected'));
  return nknClient.send(dest, JSON.stringify({ text }));
}

// ---------------------------------------------------------------------------
// WebSocket server (browser ↔ app bridge)
// ---------------------------------------------------------------------------

const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
  // Send current status immediately
  ws.send(JSON.stringify({ type: 'status', connected: nknConnected, addr: nknAddr }));

  ws.on('message', raw => {
    let cmd;
    try { cmd = JSON.parse(raw.toString()); } catch (_) { return; }

    switch (cmd.type) {
      case 'start':
        connectNKN();
        break;

      case 'stop':
        disconnectNKN();
        break;

      case 'send': {
        const { dest, text } = cmd;
        if (!dest || !text) {
          ws.send(JSON.stringify({ type: 'error', message: 'send requires dest and text' }));
          return;
        }
        if (!nknClient) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not connected to NKN' }));
          return;
        }
        sendNKN(dest, text)
          .then(() => {
            // Persist outgoing
            if (!state.history[dest]) state.history[dest] = [];
            state.history[dest].push({ from: 'me', text, timestamp: Date.now() });
            saveState();
          })
          .catch(err => {
            ws.send(JSON.stringify({ type: 'error', message: String(err) }));
          });
        break;
      }

      default:
        break;
    }
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ArynCore P2P Companion');
  console.log('  ─────────────────────────────────────');
  console.log(`  Web UI  →  http://localhost:${PORT}`);
  console.log(`  NKN ID  →  ${IDENTIFIER}`);
  console.log('');
  console.log('  Open the URL in a browser to start chatting.');
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});
