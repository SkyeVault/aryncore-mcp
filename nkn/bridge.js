/**
 * NKN Bridge — communicates with the FastAPI backend via stdin/stdout JSON lines.
 *
 * Commands (stdin):
 *   { "type": "send", "dest": "<nkn-addr>", "text": "<message>" }
 *
 * Events (stdout):
 *   { "type": "connected", "addr": "<our-nkn-addr>" }
 *   { "type": "message",   "src": "<sender-addr>", "text": "<message>", "timestamp": <ms> }
 *   { "type": "error",     "message": "<string>" }
 *   { "type": "disconnected" }
 */

const { Client } = require('nkn-sdk');
const readline   = require('readline');

const identifier = process.env.NKN_IDENTIFIER || 'aryncore';

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

const client = new Client({ identifier });

client.onConnect((nodeInfo) => {
  emit({ type: 'connected', addr: client.addr });
});

client.onConnectFailed(() => {
  emit({ type: 'error', message: 'Failed to connect to NKN network' });
});

client.onMessage(({ src, payload }) => {
  let text = payload;
  try {
    const parsed = JSON.parse(payload);
    text = parsed.text != null ? parsed.text : payload;
  } catch (_) {}
  emit({ type: 'message', src, text: String(text), timestamp: Date.now() });
});

// Read send commands from stdin
const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', (line) => {
  line = line.trim();
  if (!line) return;
  let cmd;
  try { cmd = JSON.parse(line); } catch (_) { return; }

  if (cmd.type === 'send' && cmd.dest && cmd.text) {
    client.send(cmd.dest, JSON.stringify({ text: cmd.text }))
      .catch((err) => emit({ type: 'error', message: String(err) }));
  }
});

rl.on('close', () => {
  emit({ type: 'disconnected' });
  process.exit(0);
});
