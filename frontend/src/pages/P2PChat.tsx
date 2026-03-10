import { useEffect, useRef, useState, useCallback } from 'react'
import { Radio, Copy, Check, Send, UserPlus, Trash2, Wifi, WifiOff, Users, Plus, X } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface P2PMessage {
  id: string
  from: 'me' | 'them'
  sender?: string   // set on group messages so we can show who said it
  text: string
  timestamp: number
}

interface Contact {
  addr: string
  label: string
}

interface Group {
  id: string
  name: string
  members: string[]  // NKN addresses
}

type WsEvent =
  | { type: 'status';       connected: boolean; addr: string | null }
  | { type: 'connected';    addr: string }
  | { type: 'disconnected' }
  | { type: 'message';      src: string; text: string; timestamp: number }
  | { type: 'error';        message: string }

// ---------------------------------------------------------------------------
// Local-storage helpers
// ---------------------------------------------------------------------------

const LS_CONTACTS = 'p2p_contacts'
const LS_HISTORY  = 'p2p_history'
const LS_GROUPS   = 'p2p_groups'

function loadContacts(): Contact[] {
  try { return JSON.parse(localStorage.getItem(LS_CONTACTS) || '[]') } catch { return [] }
}
function saveContacts(c: Contact[]) {
  localStorage.setItem(LS_CONTACTS, JSON.stringify(c))
}
function loadHistory(): Record<string, P2PMessage[]> {
  try { return JSON.parse(localStorage.getItem(LS_HISTORY) || '{}') } catch { return {} }
}
function saveHistory(h: Record<string, P2PMessage[]>) {
  localStorage.setItem(LS_HISTORY, JSON.stringify(h))
}
function loadGroups(): Group[] {
  try { return JSON.parse(localStorage.getItem(LS_GROUPS) || '[]') } catch { return [] }
}
function saveGroups(g: Group[]) {
  localStorage.setItem(LS_GROUPS, JSON.stringify(g))
}

// ---------------------------------------------------------------------------
// Shared input style
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'inherit', fontSize: 13, outline: 'none',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function P2PChat() {
  const wsRef       = useRef<WebSocket | null>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const activeKeyRef = useRef<string | null>(null)   // kept in sync for WS closure

  const p2pUnread    = useAppStore(s => s.p2pUnread)
  const setP2pUnread = useAppStore(s => s.setP2pUnread)

  const [connected,   setConnected]   = useState(false)
  const [connecting,  setConnecting]  = useState(false)
  const [myAddr,      setMyAddr]      = useState<string | null>(null)
  const [contacts,   setContacts]   = useState<Contact[]>(loadContacts)
  const [groups,     setGroups]     = useState<Group[]>(loadGroups)
  const [history,    setHistory]    = useState<Record<string, P2PMessage[]>>(loadHistory)
  const [activeKey,  setActiveKey]  = useState<string | null>(null)   // addr or "group:<id>"
  const [input,      setInput]      = useState('')
  const [copied,     setCopied]     = useState(false)
  const [errMsg,     setErrMsg]     = useState<string | null>(null)

  // Add-contact dialog
  const [addContactOpen, setAddContactOpen] = useState(false)
  const [newAddr,        setNewAddr]        = useState('')
  const [newLabel,       setNewLabel]       = useState('')

  // Create-group dialog
  const [createGroupOpen,  setCreateGroupOpen]  = useState(false)
  const [newGroupName,     setNewGroupName]     = useState('')
  const [selectedMembers,  setSelectedMembers]  = useState<Set<string>>(new Set())

  // Manage-group dialog
  const [manageGroupId, setManageGroupId] = useState<string | null>(null)
  const [addMemberAddr, setAddMemberAddr] = useState('')

  // -------------------------------------------------------------------------
  // WebSocket
  // -------------------------------------------------------------------------

  // Keep ref in sync and clear unread when switching conversations
  function switchActiveKey(key: string | null) {
    activeKeyRef.current = key
    setActiveKey(key)
    if (key) {
      setP2pUnread({ ...useAppStore.getState().p2pUnread, [key]: 0 })
    }
  }

  function bumpUnread(key: string) {
    const cur = useAppStore.getState().p2pUnread
    if (activeKeyRef.current === key) return   // currently viewing — no badge
    setP2pUnread({ ...cur, [key]: (cur[key] ?? 0) + 1 })
  }

  const connectWs = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return

    const ws = new WebSocket('ws://localhost:8000/api/p2p/ws')
    wsRef.current = ws

    ws.onmessage = (ev) => {
      let data: WsEvent
      try { data = JSON.parse(ev.data) } catch { return }

      if (data.type === 'status') {
        setConnected(data.connected)
        setMyAddr(data.addr)
        if (data.connected) setConnecting(false)
      } else if (data.type === 'connected') {
        setConnected(true)
        setConnecting(false)
        setMyAddr(data.addr)
      } else if (data.type === 'disconnected') {
        setConnected(false)
        setConnecting(false)
        setMyAddr(null)
      } else if (data.type === 'message') {
        const { src, text, timestamp } = data
        const baseMsg: P2PMessage = {
          id: `${src}-${timestamp}`,
          from: 'them',
          text,
          timestamp,
        }

        // Route to individual contact thread
        setHistory(prev => {
          const updated = { ...prev, [src]: [...(prev[src] || []), baseMsg] }
          saveHistory(updated)
          return updated
        })
        bumpUnread(src)

        // Also route to any groups that contain this sender
        setGroups(currentGroups => {
          const matching = currentGroups.filter(g => g.members.includes(src))
          if (matching.length > 0) {
            setHistory(prev => {
              let updated = { ...prev }
              for (const g of matching) {
                const gKey = `group:${g.id}`
                const groupMsg: P2PMessage = { ...baseMsg, id: `${src}-${timestamp}-${g.id}`, sender: src }
                updated = { ...updated, [gKey]: [...(updated[gKey] || []), groupMsg] }
                bumpUnread(gKey)
              }
              saveHistory(updated)
              return updated
            })
          }
          return currentGroups   // groups themselves unchanged
        })

        // Auto-add sender as contact if unknown
        setContacts(prev => {
          if (prev.some(c => c.addr === src)) return prev
          const updated = [...prev, { addr: src, label: src.slice(0, 16) + '…' }]
          saveContacts(updated)
          return updated
        })
      } else if (data.type === 'error') {
        setErrMsg(data.message)
        setTimeout(() => setErrMsg(null), 4000)
      }
    }

    ws.onclose = () => { setTimeout(connectWs, 3000) }
  }, [])

  useEffect(() => {
    connectWs()
    return () => { wsRef.current?.close() }
  }, [connectWs])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, activeKey])

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  function wsSend(obj: object) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(obj))
    }
  }

  function handleStartStop() {
    if (connected) {
      wsSend({ type: 'stop' })
    } else if (!connecting) {
      setConnecting(true)
      wsSend({ type: 'start' })
    }
  }

  function handleSend() {
    const text = input.trim()
    if (!text || !activeKey || !connected) return

    const myMsg: P2PMessage = { id: `me-${Date.now()}`, from: 'me', text, timestamp: Date.now() }

    if (activeKey.startsWith('group:')) {
      const group = groups.find(g => `group:${g.id}` === activeKey)
      if (!group || group.members.length === 0) return
      wsSend({ type: 'send_multi', dests: group.members, text })
    } else {
      wsSend({ type: 'send', dest: activeKey, text })
    }

    setHistory(prev => {
      const updated = { ...prev, [activeKey]: [...(prev[activeKey] || []), myMsg] }
      saveHistory(updated)
      return updated
    })
    setInput('')
  }

  function handleCopyAddr() {
    if (!myAddr) return
    navigator.clipboard.writeText(myAddr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleAddContact() {
    const addr  = newAddr.trim()
    const label = newLabel.trim() || addr.slice(0, 16) + '…'
    if (!addr) return
    setContacts(prev => {
      if (prev.some(c => c.addr === addr)) return prev
      const updated = [...prev, { addr, label }]
      saveContacts(updated)
      return updated
    })
    setNewAddr('')
    setNewLabel('')
    setAddContactOpen(false)
    switchActiveKey(addr)
  }

  function handleDeleteContact(addr: string) {
    setContacts(prev => {
      const updated = prev.filter(c => c.addr !== addr)
      saveContacts(updated)
      return updated
    })
    if (activeKey === addr) switchActiveKey(null)
  }

  function handleCreateGroup() {
    const name = newGroupName.trim()
    if (!name) return
    const group: Group = { id: Date.now().toString(), name, members: Array.from(selectedMembers) }
    setGroups(prev => {
      const updated = [...prev, group]
      saveGroups(updated)
      return updated
    })
    setNewGroupName('')
    setSelectedMembers(new Set())
    setCreateGroupOpen(false)
    switchActiveKey(`group:${group.id}`)
  }

  function handleDeleteGroup(id: string) {
    setGroups(prev => {
      const updated = prev.filter(g => g.id !== id)
      saveGroups(updated)
      return updated
    })
    if (activeKey === `group:${id}`) switchActiveKey(null)
  }

  function addMemberToGroup(groupId: string, addr: string) {
    if (!addr) return
    setGroups(prev => {
      const updated = prev.map(g =>
        g.id === groupId
          ? { ...g, members: g.members.includes(addr) ? g.members : [...g.members, addr] }
          : g
      )
      saveGroups(updated)
      return updated
    })
    // Ensure they exist as a contact too
    setContacts(prev => {
      if (prev.some(c => c.addr === addr)) return prev
      const updated = [...prev, { addr, label: addr.slice(0, 16) + '…' }]
      saveContacts(updated)
      return updated
    })
  }

  function handleAddMemberFromInput(groupId: string) {
    const addr = addMemberAddr.trim()
    if (!addr) return
    addMemberToGroup(groupId, addr)
    setAddMemberAddr('')
  }

  function handleRemoveMember(groupId: string, addr: string) {
    setGroups(prev => {
      const updated = prev.map(g =>
        g.id === groupId ? { ...g, members: g.members.filter(m => m !== addr) } : g
      )
      saveGroups(updated)
      return updated
    })
  }

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  const activeMessages = activeKey ? (history[activeKey] || []) : []
  const activeContact  = activeKey && !activeKey.startsWith('group:')
    ? contacts.find(c => c.addr === activeKey) : null
  const activeGroup    = activeKey?.startsWith('group:')
    ? groups.find(g => `group:${g.id}` === activeKey) : null
  const manageGroup    = manageGroupId ? groups.find(g => g.id === manageGroupId) : null

  function contactLabel(addr: string) {
    return contacts.find(c => c.addr === addr)?.label || addr.slice(0, 16) + '…'
  }

  function fmtTime(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // -------------------------------------------------------------------------
  // Layout
  // -------------------------------------------------------------------------

  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <Radio size={18} style={{ color: 'var(--accent)' }} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>P2P Chat</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>via NKN</span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {myAddr && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '4px 10px', fontSize: 12,
            }}>
              <span style={{ color: 'var(--text-muted)' }}>Your address:</span>
              <span style={{ fontFamily: 'monospace', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {myAddr}
              </span>
              <button onClick={handleCopyAddr} title="Copy address"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                {copied ? <Check size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
              </button>
            </div>
          )}
          <button onClick={handleStartStop} disabled={connecting} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8, border: 'none',
            cursor: connecting ? 'default' : 'pointer', fontSize: 13, fontWeight: 600,
            background: connected ? 'rgba(239,68,68,0.12)' : connecting ? 'rgba(124,110,247,0.2)' : 'var(--accent)',
            color: connected ? 'var(--danger)' : connecting ? 'var(--accent)' : '#fff',
            opacity: connecting ? 0.8 : 1,
          }}>
            {connected
              ? <><WifiOff size={14} /> Disconnect</>
              : connecting
              ? <><Wifi size={14} style={{ animation: 'pulse 1.2s ease-in-out infinite' }} /> Connecting…</>
              : <><Wifi size={14} /> Connect to NKN</>
            }
          </button>
        </div>
      </div>

      {/* Error banner */}
      {errMsg && (
        <div style={{
          background: 'rgba(239,68,68,0.12)', color: 'var(--danger)',
          padding: '8px 20px', fontSize: 13, borderBottom: '1px solid var(--border)',
        }}>
          {errMsg}
        </div>
      )}

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{
          width: 240, flexShrink: 0, borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>

          {/* — Contacts — */}
          <div style={{
            padding: '10px 12px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>CONTACTS</span>
            <button onClick={() => setAddContactOpen(true)} title="Add contact"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'flex' }}>
              <UserPlus size={16} />
            </button>
          </div>

          <div style={{ overflowY: 'auto', maxHeight: '45%' }}>
            {contacts.length === 0 && (
              <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                No contacts yet.
              </div>
            )}
            {contacts.map(c => (
              <div key={c.addr} onClick={() => switchActiveKey(c.addr)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', cursor: 'pointer',
                background: activeKey === c.addr ? 'rgba(124,110,247,0.12)' : 'transparent',
                borderLeft: activeKey === c.addr ? '2px solid var(--accent)' : '2px solid transparent',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.label}</div>
                  <div style={{
                    fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace',
                    maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{c.addr}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {(p2pUnread[c.addr] ?? 0) > 0 && (
                    <span style={{
                      minWidth: 18, height: 18, borderRadius: 9,
                      background: 'var(--danger)', color: '#fff',
                      fontSize: 10, fontWeight: 700, lineHeight: '18px',
                      textAlign: 'center', padding: '0 4px',
                    }}>
                      {p2pUnread[c.addr] > 99 ? '99+' : p2pUnread[c.addr]}
                    </span>
                  )}
                  <button onClick={e => { e.stopPropagation(); handleDeleteContact(c.addr) }} title="Remove"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', opacity: 0.6 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* — Groups — */}
          <div style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>GROUPS</span>
            <button onClick={() => setCreateGroupOpen(true)} title="Create group"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'flex' }}>
              <Plus size={16} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {groups.length === 0 && (
              <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                No groups yet.
              </div>
            )}
            {groups.map(g => (
              <div key={g.id} onClick={() => switchActiveKey(`group:${g.id}`)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', cursor: 'pointer',
                background: activeKey === `group:${g.id}` ? 'rgba(124,110,247,0.12)' : 'transparent',
                borderLeft: activeKey === `group:${g.id}` ? '2px solid var(--accent)' : '2px solid transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Users size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {g.members.length} member{g.members.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                  {(p2pUnread[`group:${g.id}`] ?? 0) > 0 && (
                    <span style={{
                      minWidth: 18, height: 18, borderRadius: 9,
                      background: 'var(--danger)', color: '#fff',
                      fontSize: 10, fontWeight: 700, lineHeight: '18px',
                      textAlign: 'center', padding: '0 4px',
                    }}>
                      {p2pUnread[`group:${g.id}`] > 99 ? '99+' : p2pUnread[`group:${g.id}`]}
                    </span>
                  )}
                  <button onClick={e => { e.stopPropagation(); setManageGroupId(g.id) }} title="Manage members"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', opacity: 0.6 }}>
                    <UserPlus size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDeleteGroup(g.id) }} title="Delete group"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', opacity: 0.6 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat window */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!activeKey ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', flexDirection: 'column', gap: 8,
            }}>
              <Radio size={32} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: 14 }}>Select a contact or group</span>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{
                padding: '10px 16px', borderBottom: '1px solid var(--border)',
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
              }}>
                {activeGroup && <Users size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {activeGroup ? activeGroup.name : activeContact?.label}
                  </div>
                  {activeGroup ? (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                      {activeGroup.members.length === 0
                        ? 'No members — add some via the manage button'
                        : activeGroup.members.map(contactLabel).join(', ')}
                    </div>
                  ) : (
                    <div style={{
                      fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{activeKey}</div>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeMessages.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 20 }}>
                    No messages yet
                  </div>
                )}
                {activeMessages.map(msg => (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.from === 'me' ? 'flex-end' : 'flex-start' }}>
                    {msg.from === 'them' && activeGroup && msg.sender && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, paddingLeft: 4 }}>
                        {contactLabel(msg.sender)}
                      </div>
                    )}
                    <div style={{
                      maxWidth: '70%',
                      background: msg.from === 'me' ? 'var(--accent)' : 'var(--surface)',
                      color: msg.from === 'me' ? '#fff' : 'inherit',
                      border: msg.from === 'me' ? 'none' : '1px solid var(--border)',
                      borderRadius: msg.from === 'me' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      padding: '8px 12px',
                    }}>
                      <div style={{ fontSize: 14, lineHeight: 1.4 }}>{msg.text}</div>
                      <div style={{ fontSize: 11, marginTop: 4, textAlign: 'right', opacity: 0.6 }}>
                        {fmtTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{
                padding: '12px 16px', borderTop: '1px solid var(--border)',
                display: 'flex', gap: 8, flexShrink: 0,
              }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder={activeGroup ? `Message ${activeGroup.name}…` : 'Type a message…'}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    color: 'inherit', fontSize: 14, outline: 'none',
                  }}
                />
                <button onClick={handleSend} disabled={!connected || !input.trim()} style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: 'var(--accent)', color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  opacity: (!connected || !input.trim()) ? 0.5 : 1,
                }}>
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Add-contact dialog                                                   */}
      {/* ------------------------------------------------------------------ */}
      {addContactOpen && (
        <div onClick={() => setAddContactOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 24, width: 380,
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Add Contact</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>NKN Address</label>
              <input autoFocus value={newAddr} onChange={e => setNewAddr(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddContact() }}
                placeholder="identifier.pubkey" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Label (optional)</label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddContact() }}
                placeholder="Nickname" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setAddContactOpen(false)}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={handleAddContact} disabled={!newAddr.trim()}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13, opacity: !newAddr.trim() ? 0.5 : 1 }}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Create-group dialog                                                  */}
      {/* ------------------------------------------------------------------ */}
      {createGroupOpen && (
        <div onClick={() => { setCreateGroupOpen(false); setSelectedMembers(new Set()) }} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 24, width: 400,
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Create Group</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Group Name</label>
              <input autoFocus value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                placeholder="e.g. My Nodes" style={inputStyle} />
            </div>

            {contacts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Add Members</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                  {contacts.map(c => (
                    <label key={c.addr} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer',
                    }}>
                      <input type="checkbox" checked={selectedMembers.has(c.addr)}
                        onChange={e => {
                          const next = new Set(selectedMembers)
                          if (e.target.checked) next.add(c.addr)
                          else next.delete(c.addr)
                          setSelectedMembers(next)
                        }}
                      />
                      <span style={{ fontSize: 13, flex: 1 }}>{c.label}</span>
                      <span style={{
                        fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace',
                        maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{c.addr}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {contacts.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Add contacts first, or add members after creating the group.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setCreateGroupOpen(false); setSelectedMembers(new Set()) }}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={handleCreateGroup} disabled={!newGroupName.trim()}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13, opacity: !newGroupName.trim() ? 0.5 : 1 }}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Manage-group dialog                                                  */}
      {/* ------------------------------------------------------------------ */}
      {manageGroup && (
        <div onClick={() => { setManageGroupId(null); setAddMemberAddr('') }} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 24, width: 440,
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{manageGroup.name}</h3>
              <button onClick={() => { setManageGroupId(null); setAddMemberAddr('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            {/* Current members */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>MEMBERS</span>
              {manageGroup.members.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No members yet.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                {manageGroup.members.map(addr => (
                  <div key={addr} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', borderRadius: 8, background: 'var(--surface)',
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13 }}>{contactLabel(addr)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {addr}
                      </div>
                    </div>
                    <button onClick={() => handleRemoveMember(manageGroup.id, addr)} title="Remove"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', flexShrink: 0, opacity: 0.8 }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add by address */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>ADD MEMBER</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={addMemberAddr} onChange={e => setAddMemberAddr(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddMemberFromInput(manageGroup.id) }}
                  placeholder="NKN address" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => handleAddMemberFromInput(manageGroup.id)} disabled={!addMemberAddr.trim()}
                  style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13, opacity: !addMemberAddr.trim() ? 0.5 : 1 }}>
                  Add
                </button>
              </div>

              {/* Quick-add from existing contacts */}
              {contacts.filter(c => !manageGroup.members.includes(c.addr)).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {contacts
                    .filter(c => !manageGroup.members.includes(c.addr))
                    .map(c => (
                      <button key={c.addr} onClick={() => addMemberToGroup(manageGroup.id, c.addr)} style={{
                        padding: '3px 10px', borderRadius: 20,
                        border: '1px solid var(--border)', background: 'var(--surface)',
                        color: 'inherit', cursor: 'pointer', fontSize: 12,
                      }}>
                        + {c.label}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
