const BASE = '/api'

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  if (!r.ok) {
    const err = await r.text()
    throw new Error(err || `HTTP ${r.status}`)
  }
  return r.json()
}

// System
export const getStatus = () => request<SystemStatus>('/system/status')

// Ollama
export const getModels = (host = 'localhost', port = 11434) =>
  request<{ models: OllamaModel[] }>(`/ollama/models?host=${host}&port=${port}`)
export const getRunning = (host = 'localhost', port = 11434) =>
  request<any>(`/ollama/running?host=${host}&port=${port}`)
export const deleteModel = (model: string, host = 'localhost', port = 11434) =>
  request<any>('/ollama/model', { method: 'DELETE', body: JSON.stringify({ model, server_host: host, server_port: port }) })
export const showModel = (model: string, host = 'localhost', port = 11434) =>
  request<any>(`/ollama/show?model=${encodeURIComponent(model)}&host=${host}&port=${port}`)

// Servers
export const getServers = () => request<Server[]>('/servers')
export const createServer = (data: Partial<Server>) =>
  request<Server>('/servers', { method: 'POST', body: JSON.stringify(data) })
export const updateServer = (id: number, data: Partial<Server>) =>
  request<Server>(`/servers/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteServer = (id: number) =>
  request<any>(`/servers/${id}`, { method: 'DELETE' })
export const pingServer = (id: number) =>
  request<{ online: boolean }>(`/servers/${id}/ping`)

// Chat
export const getConversations = () => request<Conversation[]>('/chat/conversations')
export const getMessages = (id: number) => request<Message[]>(`/chat/conversations/${id}/messages`)
export const deleteConversation = (id: number) =>
  request<any>(`/chat/conversations/${id}`, { method: 'DELETE' })

// n8n
export const getN8nInstances = () => request<N8nInstance[]>('/n8n/instances')
export const createN8nInstance = (data: Partial<N8nInstance>) =>
  request<N8nInstance>('/n8n/instances', { method: 'POST', body: JSON.stringify(data) })
export const deleteN8nInstance = (id: number) =>
  request<any>(`/n8n/instances/${id}`, { method: 'DELETE' })
export const getWorkflows = (instanceId: number) =>
  request<any>(`/n8n/instances/${instanceId}/workflows`)
export const getN8nStatus = (instanceId: number) =>
  request<{ online: boolean; instance: string }>(`/n8n/instances/${instanceId}/status`)
export const triggerWebhook = (instanceId: number, webhookPath: string, payload: object) =>
  request<any>('/n8n/trigger', { method: 'POST', body: JSON.stringify({ instance_id: instanceId, webhook_path: webhookPath, payload }) })

// Tools
export const getTools = () => request<Tool[]>('/tools')
export const generateImage = (data: object) =>
  request<{ images: string[] }>('/tools/stable_diffusion/generate', { method: 'POST', body: JSON.stringify(data) })
export const generateTTS = (data: object) =>
  request<any>('/tools/tortoise_tts/generate', { method: 'POST', body: JSON.stringify(data) })

// Types
export interface SystemStatus {
  ollama: boolean
  tortoise_tts: boolean
  stable_diffusion: boolean
  n8n: boolean
  prometheus: boolean
  gpu: { available: boolean; name?: string; temp?: string; utilization?: string; memory_used?: string; memory_total?: string }
  platform: string
}

export interface OllamaModel {
  name: string
  size: number
  digest: string
  modified_at: string
  details?: { parameter_size?: string; quantization_level?: string }
}

export interface Server {
  id: number
  name: string
  host: string
  port: number
  type: string
  auth_token?: string
  enabled: number
  created_at: string
}

export interface Conversation {
  id: number
  title?: string
  persona: string
  model: string
  server_id?: number
  created_at: string
  updated_at: string
}

export interface Message {
  id: number
  conversation_id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface N8nInstance {
  id: number
  name: string
  host: string
  port: number
  api_key?: string
  is_local: number
  enabled: number
  created_at: string
}

export interface Tool {
  id: string
  name: string
  description: string
  type: string
  category: string
  port?: number
  homepage?: string
  install?: string
  status: 'online' | 'offline' | 'available' | 'unavailable' | 'error'
}

// Tool-specific API calls
export const removeBg    = (form: FormData) => fetch('/api/tools/rembg/remove',    { method: 'POST', body: form }).then(r => r.json())
export const upscaleImg  = (form: FormData) => fetch('/api/tools/realesrgan/upscale', { method: 'POST', body: form }).then(r => r.json())
export const searchSearx = (q: string, engines = '') =>
  request<SearXResult>(`/tools/searxng/search?q=${encodeURIComponent(q)}&engines=${engines}`)
export const listQdrant  = () => request<{ collections: { name: string }[] }>('/tools/qdrant/collections')
export const generateAlltalk = (data: object) =>
  request<any>('/tools/alltalk_tts/generate', { method: 'POST', body: JSON.stringify(data) })
export const generateKokoro = (data: object) =>
  request<any>('/tools/kokoro/generate', { method: 'POST', body: JSON.stringify(data) })

export interface SearXResult {
  query: string
  results: { title: string; url: string; content: string; engine: string }[]
  suggestions: string[]
  answers: string[]
}
