export type WsMessage =
  | { type: 'token'; token: string; done: boolean }
  | { type: 'conversation_id'; id: number }
  | { type: 'error'; message: string }

export type ChatPayload = {
  message: string
  persona: string
  model: string
  server_host: string
  server_port: number
  conversation_id?: number
}

export class ChatSocket {
  private ws: WebSocket | null = null
  private onMessage: (msg: WsMessage) => void
  private onOpen?: () => void
  private onClose?: () => void

  constructor(
    onMessage: (msg: WsMessage) => void,
    onOpen?: () => void,
    onClose?: () => void,
  ) {
    this.onMessage = onMessage
    this.onOpen = onOpen
    this.onClose = onClose
  }

  connect() {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location.host
    this.ws = new WebSocket(`${proto}://${host}/api/chat/ws`)
    this.ws.onopen = () => this.onOpen?.()
    this.ws.onclose = () => this.onClose?.()
    this.ws.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(e.data))
      } catch {}
    }
  }

  send(payload: ChatPayload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }

  disconnect() {
    this.ws?.close()
    this.ws = null
  }

  get ready() {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
