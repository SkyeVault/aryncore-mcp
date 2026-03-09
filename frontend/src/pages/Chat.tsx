import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Send, Plus, Trash2 } from 'lucide-react'
import { TopBar } from '../components/layout/TopBar'
import { useAppStore, PERSONAS } from '../store/useAppStore'
import { getConversations, getMessages, deleteConversation } from '../lib/api'
import type { Message } from '../lib/api'
import { ChatSocket } from '../lib/ws'

export function Chat() {
  const location = useLocation()
  const {
    activePersona, setActivePersona, activeModel, activeServer,
    conversations, setConversations,
    activeConversationId, setActiveConversationId,
  } = useAppStore()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [wsReady, setWsReady] = useState(false)
  const wsRef = useRef<ChatSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Handle persona from navigate state
  useEffect(() => {
    if (location.state?.persona) setActivePersona(location.state.persona)
  }, [location.state, setActivePersona])

  // Init WebSocket
  useEffect(() => {
    const ws = new ChatSocket(
      (msg) => {
        if (msg.type === 'conversation_id') {
          setActiveConversationId(msg.id)
          loadConversations()
        } else if (msg.type === 'token') {
          setStreamBuffer(prev => prev + msg.token)
          if (msg.done) {
            setMessages(prev => [
              ...prev,
              { id: Date.now(), conversation_id: activeConversationId ?? 0, role: 'assistant', content: '', created_at: '' },
            ])
            setStreamBuffer('')
            setStreaming(false)
            loadMessages(activeConversationId)
          }
        } else if (msg.type === 'error') {
          setStreaming(false)
          setStreamBuffer('')
        }
      },
      () => setWsReady(true),
      () => setWsReady(false),
    )
    ws.connect()
    wsRef.current = ws
    return () => ws.disconnect()
  }, [])

  const loadConversations = useCallback(async () => {
    try { setConversations(await getConversations()) } catch {}
  }, [setConversations])

  const loadMessages = useCallback(async (id: number | null) => {
    if (!id) return
    try { setMessages(await getMessages(id)) } catch {}
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])
  useEffect(() => { loadMessages(activeConversationId) }, [activeConversationId, loadMessages])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streamBuffer])

  const send = () => {
    if (!input.trim() || streaming || !wsReady) return
    const text = input.trim()
    setInput('')
    setStreaming(true)
    setMessages(prev => [...prev, { id: Date.now(), conversation_id: activeConversationId ?? 0, role: 'user', content: text, created_at: '' }])
    wsRef.current?.send({
      message: text,
      persona: activePersona,
      model: activeModel,
      server_host: activeServer?.host ?? 'localhost',
      server_port: activeServer?.port ?? 11434,
      conversation_id: activeConversationId ?? undefined,
    })
  }

  const newChat = () => {
    setActiveConversationId(null)
    setMessages([])
  }

  const persona = PERSONAS.find(p => p.id === activePersona)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Conversation sidebar */}
      <div style={{
        width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 10px', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={newChat}
            style={{
              width: '100%', background: 'rgba(124,110,247,0.15)',
              border: '1px solid var(--accent)', color: 'var(--accent)',
              borderRadius: 8, padding: '8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 12, fontWeight: 600,
            }}
          >
            <Plus size={14} /> New Chat
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 6px' }}>
          {conversations.map(c => (
            <div
              key={c.id}
              onClick={() => setActiveConversationId(c.id)}
              style={{
                padding: '8px 10px', borderRadius: 7, cursor: 'pointer', marginBottom: 2,
                background: activeConversationId === c.id ? 'var(--surface2)' : 'transparent',
                border: activeConversationId === c.id ? '1px solid var(--border)' : '1px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.title ?? `Chat #${c.id}`}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.persona} · {c.model}</div>
              </div>
              <button
                onClick={async (e) => { e.stopPropagation(); await deleteConversation(c.id); loadConversations(); if (activeConversationId === c.id) newChat() }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar title={`Chat · ${persona?.name ?? 'Aryn'}`} />

        {/* Messages */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.length === 0 && !streaming && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Start a conversation with {persona?.name}
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'assistant' && (
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginRight: 10, marginTop: 2,
                  background: persona?.color ?? 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff',
                }}>
                  {persona?.name[0]}
                </div>
              )}
              <div style={{
                maxWidth: '72%', padding: '10px 14px', borderRadius: 12,
                background: m.role === 'user' ? 'var(--accent)' : 'var(--surface2)',
                color: 'var(--text)', fontSize: 13, lineHeight: 1.6,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                borderBottomRightRadius: m.role === 'user' ? 4 : 12,
                borderBottomLeftRadius: m.role === 'assistant' ? 4 : 12,
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {/* Streaming token */}
          {streaming && streamBuffer && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginRight: 10, marginTop: 2,
                background: persona?.color ?? 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff',
              }}>
                {persona?.name[0]}
              </div>
              <div style={{
                maxWidth: '72%', padding: '10px 14px', borderRadius: 12,
                background: 'var(--surface2)', color: 'var(--text)', fontSize: 13,
                lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                borderBottomLeftRadius: 4,
              }}>
                {streamBuffer}
                <span style={{ opacity: 0.5, marginLeft: 2 }}>▋</span>
              </div>
            </div>
          )}
          {streaming && !streamBuffer && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: persona?.color ?? 'var(--accent)', flexShrink: 0 }} />
              <span>Thinking...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          background: 'var(--surface)', display: 'flex', gap: 10, alignItems: 'flex-end',
        }}>
          <div style={{
            flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 12, display: 'flex', alignItems: 'flex-end',
          }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder={`Message ${persona?.name}... (Enter to send, Shift+Enter for newline)`}
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none', color: 'var(--text)',
                padding: '10px 14px', fontSize: 13, resize: 'none', outline: 'none',
                maxHeight: 160, overflow: 'auto', lineHeight: 1.5,
              }}
            />
          </div>
          <button
            onClick={send}
            disabled={!input.trim() || streaming || !wsReady}
            style={{
              width: 40, height: 40, borderRadius: 10, border: 'none',
              background: input.trim() && !streaming && wsReady ? 'var(--accent)' : 'var(--surface2)',
              color: input.trim() && !streaming && wsReady ? '#fff' : 'var(--text-muted)',
              cursor: input.trim() && !streaming && wsReady ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s', flexShrink: 0,
            }}
          >
            <Send size={16} />
          </button>
        </div>

        {/* WS status */}
        {!wsReady && (
          <div style={{ padding: '4px 20px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', fontSize: 11, textAlign: 'center' }}>
            Connecting to backend...
          </div>
        )}
      </div>
    </div>
  )
}
