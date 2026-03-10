# NKN-p2p

A lightweight, self-hosted P2P chat client built on the [NKN](https://nkn.org) (New Kind of Network) overlay network. Run one instance per machine, open a browser, and send messages directly to any other NKN-p2p node — no accounts, no central server, no sign-up required.

Each node gets a unique cryptographic address derived from its identifier. Messages route through the NKN mesh and are delivered peer-to-peer regardless of NAT or firewall configuration.

## Features

- Browser-based UI — works on any machine with Node.js and a browser
- True P2P — no relay server, no account, no port forwarding needed
- Persistent contacts and message history saved locally to `data/state.json`
- Unknown senders are automatically added as contacts
- Multiple browser tabs stay in sync via WebSocket
- Configurable identity and port via environment variables

## Requirements

- [Node.js](https://nodejs.org) v14 or newer
- Internet access (to reach the NKN network)

## Install

```bash
git clone https://github.com/skyevault/NKN-p2p.git
cd NKN-p2p
npm install
```

## Run

```bash
NKN_IDENTIFIER=yourname ./start.sh
```

Then open **http://localhost:3000** in a browser.

### Options

| Variable | Default | Description |
|---|---|---|
| `NKN_IDENTIFIER` | `aryncore` | Your node's name — combined with a public key to form your address |
| `PORT` | `3000` | Port for the local web server |

Example with both set:

```bash
PORT=8080 NKN_IDENTIFIER=basement-box ./start.sh
```

## Usage

1. Click **Connect to NKN** — your full NKN address appears in the top bar
2. Copy your address and share it with whoever you want to message
3. Click the **+** button to add a contact by their NKN address
4. Select the contact and start chatting

Incoming messages from new addresses create a contact automatically.

## How addresses work

Your address looks like:

```
yourname.a1b2c3d4e5f6...
```

It is `NKN_IDENTIFIER` combined with a public key generated the first time you connect. The same identifier on the same machine will always produce the same address. Use distinct identifiers on each machine so addresses don't collide.

## Data

Contacts and message history are saved to `data/state.json`. Delete this file to start fresh.

## API

The local server exposes a small REST API if you want to script anything:

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/status` | Connection status and current NKN address |
| `GET` | `/api/state` | All contacts and message history |
| `POST` | `/api/contacts` | Add a contact `{ addr, label }` |
| `PATCH` | `/api/contacts/:addr` | Rename a contact `{ label }` |
| `DELETE` | `/api/contacts/:addr` | Remove a contact |

## Notes

- This project uses `nkn-client` v0.7.3. NKN now recommends `nkn-sdk-js` as its successor — if you hit connectivity issues, replacing the dependency and updating the `require` in `app.js` should resolve them.
- Messages are not end-to-end encrypted in this implementation. NKN provides transport-layer encryption but the message payload is plaintext JSON.
- The web UI binds to `0.0.0.0`, so it is reachable from other devices on your local network. Do not expose port 3000 to the public internet without adding authentication.
