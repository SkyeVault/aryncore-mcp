/**
 * NKN Bridge — communicates with the FastAPI backend via stdin/stdout JSON lines.
 *
 * Commands (stdin):
 *   { "type": "send", "dest": "<addr>", "content": "<text|base64>", "contentType": "text|image", "id": "<uuid>" }
 *
 * Events (stdout):
 *   { "type": "connected",    "addr": "<our-nkn-addr>" }
 *   { "type": "message",      "id": "<uuid>", "src": "<addr>", "contentType": "text|image", "content": "<…>", "timestamp": <ms> }
 *   { "type": "receipt",      "targetId": "<original-msg-id>", "src": "<addr>", "timestamp": <ms> }
 *   { "type": "error",        "message": "<string>" }
 *   { "type": "disconnected" }
 */

const { MultiClient, Wallet } = require('nkn-sdk');
const readline  = require('readline');
const fs        = require('fs');
const path      = require('path');
const crypto    = require('crypto');

const IDENTIFIER  = process.env.NKN_IDENTIFIER || 'aryncore';
const WALLET_FILE = path.join(__dirname, 'wallet.json');

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function genId() {
  return crypto.randomBytes(8).toString('hex');
}

// ---------------------------------------------------------------------------
// Persistent wallet — stable NKN address across restarts
// ---------------------------------------------------------------------------

function loadOrCreateWallet() {
  if (fs.existsSync(WALLET_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
      // Seed-only stub written by the wallet import endpoint
      if (raw.__seed) {
        const wallet = new Wallet({ seed: raw.__seed, password: '' });
        fs.writeFileSync(WALLET_FILE, JSON.stringify(wallet.toJSON()));
        return wallet;
      }
      return Wallet.fromJSON(JSON.stringify(raw), { password: '' });
    } catch (e) {
      emit({ type: 'error', message: 'Wallet file unreadable, generating new identity' });
    }
  }
  const wallet = new Wallet({ password: '' });
  fs.writeFileSync(WALLET_FILE, JSON.stringify(wallet.toJSON()));
  return wallet;
}

const wallet = loadOrCreateWallet();

// ---------------------------------------------------------------------------
// MultiClient — 4 sub-clients for redundancy, 100-day message holding
// ---------------------------------------------------------------------------

const client = new MultiClient({
  identifier:        IDENTIFIER,
  seed:              wallet.getSeed(),
  numSubClients:     4,
  originalClient:    true,
  msgHoldingSeconds: 8_640_000,   // 100 days
});

client.onConnect(() => {
  emit({ type: 'connected', addr: client.addr });
});

client.onConnectFailed(() => {
  emit({ type: 'error', message: 'Failed to connect to NKN network' });
});

client.onMessage(({ src, payload }) => {
  let msg = {};
  try { msg = JSON.parse(payload); } catch (_) {}

  const contentType = msg.contentType || 'text';
  const content     = msg.content ?? msg.text ?? String(payload);
  const msgId       = msg.id;

  // Incoming receipt — update a sent message's delivery status
  if (contentType === 'receipt') {
    emit({ type: 'receipt', targetId: msg.targetId, src, timestamp: Date.now() });
    return;
  }

  // Send a receipt back to the sender
  if (msgId) {
    client.send(src, JSON.stringify({
      id:          genId(),
      contentType: 'receipt',
      targetId:    msgId,
      timestamp:   Date.now(),
    }), { msgHoldingSeconds: 0 }).catch(() => {});
  }

  emit({ type: 'message', id: msgId, src, contentType, content, timestamp: Date.now() });
});

// ---------------------------------------------------------------------------
// Stdin — commands from the Python backend
// ---------------------------------------------------------------------------

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', (line) => {
  line = line.trim();
  if (!line) return;
  let cmd;
  try { cmd = JSON.parse(line); } catch (_) { return; }

  if (cmd.type === 'send' && cmd.dest) {
    const payload = {
      id:          cmd.id || genId(),
      contentType: cmd.contentType || 'text',
      content:     cmd.content ?? cmd.text ?? '',
      timestamp:   Date.now(),
    };
    client.send(cmd.dest, JSON.stringify(payload), { msgHoldingSeconds: 8_640_000 })
      .catch((err) => emit({ type: 'error', message: String(err) }));
  }
});

rl.on('close', () => {
  emit({ type: 'disconnected' });
  process.exit(0);
});
