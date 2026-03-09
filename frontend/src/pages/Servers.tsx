import { useEffect, useState } from 'react'
import { Plus, Trash2, Wifi, WifiOff } from 'lucide-react'
import { TopBar } from '../components/layout/TopBar'
import { useAppStore } from '../store/useAppStore'
import { getServers, createServer, deleteServer, pingServer } from '../lib/api'

export function Servers() {
  const { servers, setServers, activeServer, setActiveServer } = useAppStore()
  const [pings, setPings] = useState<Record<number, boolean>>({})
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', host: '', port: 11434, type: 'ollama', auth_token: '' })

  const load = async () => {
    const list = await getServers()
    setServers(list)
    // Ping all
    const results = await Promise.allSettled(list.map(s => pingServer(s.id)))
    const map: Record<number, boolean> = {}
    list.forEach((s, i) => {
      const r = results[i]
      map[s.id] = r.status === 'fulfilled' ? r.value.online : false
    })
    setPings(map)
  }

  useEffect(() => { load() }, [])

  const add = async () => {
    if (!form.name || !form.host) return
    await createServer({ ...form, port: Number(form.port), enabled: 1 })
    setAdding(false)
    setForm({ name: '', host: '', port: 11434, type: 'ollama', auth_token: '' })
    load()
  }

  const del = async (id: number) => {
    if (!confirm('Delete this server?')) return
    await deleteServer(id)
    load()
  }

  const SERVER_TYPES = ['ollama', 'openai-compatible', 'custom']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar title="Server Connections" />
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

        {/* Add button */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => setAdding(!adding)}
            style={{
              background: 'rgba(124,110,247,0.15)', border: '1px solid var(--accent)',
              color: 'var(--accent)', borderRadius: 8, padding: '8px 16px',
              cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Plus size={14} /> Add Server
          </button>
        </div>

        {/* Add form */}
        {adding && (
          <div style={{
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '16px 20px', marginBottom: 20,
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
          }}>
            <input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ gridColumn: '1/-1', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '7px 12px', fontSize: 13 }} />
            <input placeholder="Host (e.g. 192.168.1.10)" value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '7px 12px', fontSize: 13 }} />
            <input placeholder="Port" type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: Number(e.target.value) }))}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '7px 12px', fontSize: 13 }} />
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '7px 12px', fontSize: 13 }}>
              {SERVER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Auth token (optional)" value={form.auth_token} onChange={e => setForm(f => ({ ...f, auth_token: e.target.value }))}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '7px 12px', fontSize: 13 }} />
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
              <button onClick={add} style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, padding: '7px 20px', cursor: 'pointer', fontSize: 13 }}>Save</button>
              <button onClick={() => setAdding(false)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '7px 20px', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Server list */}
        <div style={{ display: 'grid', gap: 10 }}>
          {servers.map(s => (
            <div key={s.id} style={{
              background: 'var(--surface2)', border: `1px solid ${activeServer?.id === s.id ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 12, padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 14,
              opacity: s.enabled ? 1 : 0.5,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: pings[s.id] ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {pings[s.id] ? <Wifi size={16} color="var(--success)" /> : <WifiOff size={16} color="var(--danger)" />}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  {s.type} · {s.host}:{s.port}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {/* Set active */}
                <button
                  onClick={() => setActiveServer(activeServer?.id === s.id ? null : s)}
                  style={{
                    background: activeServer?.id === s.id ? 'var(--accent)' : 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: activeServer?.id === s.id ? '#fff' : 'var(--text-muted)',
                    borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11,
                  }}
                >
                  {activeServer?.id === s.id ? 'Active' : 'Use'}
                </button>
                <button
                  onClick={() => del(s.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
