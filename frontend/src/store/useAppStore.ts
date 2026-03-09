import { create } from 'zustand'
import type { SystemStatus, Server, Conversation, N8nInstance, Tool } from '../lib/api'

interface AppState {
  // System
  status: SystemStatus | null
  setStatus: (s: SystemStatus) => void

  // Active selections
  activePersona: string
  setActivePersona: (p: string) => void
  activeModel: string
  setActiveModel: (m: string) => void
  activeServer: Server | null
  setActiveServer: (s: Server | null) => void

  // Conversations
  conversations: Conversation[]
  setConversations: (c: Conversation[]) => void
  activeConversationId: number | null
  setActiveConversationId: (id: number | null) => void

  // Servers
  servers: Server[]
  setServers: (s: Server[]) => void

  // n8n
  n8nInstances: N8nInstance[]
  setN8nInstances: (i: N8nInstance[]) => void

  // Tools
  tools: Tool[]
  setTools: (t: Tool[]) => void
}

export const PERSONAS = [
  { id: 'central', name: 'Aryn', role: 'Coordinator', color: '#7c6ef7' },
  { id: 'doc', name: 'Doc', role: 'Architect', color: '#3b82f6' },
  { id: 'kona', name: 'Kona', role: 'Creative', color: '#f472b6' },
  { id: 'glyph', name: 'Glyph', role: 'Automation', color: '#5eead4' },
  { id: 'estra', name: 'Estra', role: 'Writer', color: '#fb923c' },
]

export const useAppStore = create<AppState>((set) => ({
  status: null,
  setStatus: (status) => set({ status }),

  activePersona: 'central',
  setActivePersona: (activePersona) => set({ activePersona }),
  activeModel: 'mistral',
  setActiveModel: (activeModel) => set({ activeModel }),
  activeServer: null,
  setActiveServer: (activeServer) => set({ activeServer }),

  conversations: [],
  setConversations: (conversations) => set({ conversations }),
  activeConversationId: null,
  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),

  servers: [],
  setServers: (servers) => set({ servers }),

  n8nInstances: [],
  setN8nInstances: (n8nInstances) => set({ n8nInstances }),

  tools: [],
  setTools: (tools) => set({ tools }),
}))
