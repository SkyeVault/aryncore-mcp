import { useEffect, useState } from 'react'
import { Plus, Trash2, Zap, ExternalLink, RefreshCw } from 'lucide-react'
import { TopBar } from '../components/layout/TopBar'
import { useAppStore } from '../store/useAppStore'
import {
  getN8nInstances, createN8nInstance, deleteN8nInstance,
  getWorkflows, getN8nStatus, triggerWebhook,
} from '../lib/api'

const QUICK_TRIGGERS = [
  { label: '/blog', path: 'blog', description: 'Generate blog post' },
  { label: '/video', path: 'video', description: 'Create video workflow' },
  { label: '/social', path: 'social', description: 'Social media post' },
  { label: '/img', path: 'img', description: 'Generate image' },
]

export function N8nHub() {
  const { n8nInstances, setN8nInstances } = useAppStore()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', host: 'localhost', port: 5678, api_key: '', is_local: 0 })
  const [statuses, setStatuses] = useState<Record<number, boolean>>({})
  const [workflows, setWorkflows] = useState<Record<number, any[]>>({})
  const [selectedInstance, setSelectedInstance] = useState<number | null>(null)
  const [triggerInput, setTriggerInput] = useState('')
  const [triggerPayload, setTriggerPayload] = useState('')
  const [triggerResult, setTriggerResult] = useState('')

  const load = async () => {
    const list = await getN8nInstances()
    setN8nInstances(list)
    // Check statuses
    const results = await Promise.allSettled(list.map(i => getN8nStatus(i.id)))
    const map: Record<number, boolean> = {}
    list.forEach((inst, idx) => {
      const r = results[idx]
      map[inst.id] = r.status === 'fulfilled' ? r.value.online : false
    })
    setStatuses(map)
    if (list.length > 0 && !selectedInstance) setSelectedInstance(list[0].id)
  }

  const loadWorkflows = async (instanceId: number) => {
    try {
      const data = await getWorkflows(instanceId)
      setWorkflows(prev => ({ ...prev, [instanceId]: data?.data ?? [] }))
    } catch {
      setWorkflows(prev => ({ ...prev, [instanceId]: [] }))
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (selectedInstance) loadWorkflows(selectedInstance)
  }, [selectedInstance])

  const add = async () => {
    if (!form.name || !form.host) return
    await createN8nInstance({ ...form, port: Number(form.port) })
    setAdding(false)
    setForm({ name: '', host: 'localhost', port: 5678, api_key: '', is_local: 0 })
    load()
  }

  const del = async (id: number) => {
    if (!confirm('Delete this n8n instance?')) return
    await deleteN8nInstance(id)
    load()
  }

  const doTrigger = async (path: string, payload: object = {}) => {
    if (!selectedInstance) return
    setTriggerResult('Triggering...')
    try {
      const r = await triggerWebhook(selectedInstance, path, payload)
      setTriggerResult(JSON.stringify(r, null, 2))
    } catch (e: any) {
      setTriggerResult(`Error: ${e.message}`)
    }
  }

  const instance = n8nInstances.find(i => i.id === selectedInstance)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar title="n8n Hub" />
      <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>

        {/* Left: instance list */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Instances</span>
            <button onClick={() => setAdding(!adding)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}>
              <Plus size={16} />
            </button>
          </div>

          {adding && (
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '6px 10px', fontSize: 12 }} />
              <input placeholder="Host" value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '6px 10px', fontSize: 12 }} />
              <input placeholder="Port" type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: Number(e.target.value) }))}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '6px 10px', fontSize: 12 }} />
              <input placeholder="API Key (optional)" value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '6px 10px', fontSize: 12 }} />
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={!!form.is_local} onChange={e => setForm(f => ({ ...f, is_local: e.target.checked ? 1 : 0 }))} />
                Local instance
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={add} style={{ flex: 1, background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, padding: '6px', cursor: 'pointer', fontSize: 12 }}>Save</button>
                <button onClick={() => setAdding(false)} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '6px', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
              </div>
            </div>
          )}

          {n8nInstances.map(inst => (
            <div
              key={inst.id}
              onClick={() => setSelectedInstance(inst.id)}
              style={{
                background: selectedInstance === inst.id ? 'var(--surface2)' : 'transparent',
                border: `1px solid ${selectedInstance === inst.id ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 10, padding: '10px 12px', marginBottom: 6, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: statuses[inst.id] ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inst.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{inst.host}:{inst.port}</div>
              </div>
              <button onClick={e => { e.stopPropagation(); del(inst.id) }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Right: workflows + trigger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {instance && (
            <>
              {/* Instance header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)' }}>{instance.name}</span>
                <a
                  href={`http://${instance.host}:${instance.port}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                >
                  Open n8n <ExternalLink size={12} />
                </a>
                <button onClick={() => loadWorkflows(instance.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <RefreshCw size={14} />
                </button>
              </div>

              {/* Quick triggers */}
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Quick Triggers</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {QUICK_TRIGGERS.map(t => (
                    <button
                      key={t.path}
                      onClick={() => doTrigger(t.path)}
                      title={t.description}
                      style={{
                        background: 'var(--surface2)', border: '1px solid var(--border)',
                        color: 'var(--accent2)', borderRadius: 8, padding: '6px 14px',
                        cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      <Zap size={12} /> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom trigger */}
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Custom Webhook</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    value={triggerInput}
                    onChange={e => setTriggerInput(e.target.value)}
                    placeholder="webhook-path"
                    style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}
                  />
                  <button onClick={() => { try { doTrigger(triggerInput, triggerPayload ? JSON.parse(triggerPayload) : {}) } catch { setTriggerResult('Invalid JSON payload') } }}
                    style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12 }}>
                    Trigger
                  </button>
                </div>
                <textarea
                  value={triggerPayload}
                  onChange={e => setTriggerPayload(e.target.value)}
                  placeholder='{"key": "value"}'
                  rows={2}
                  style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '6px 10px', fontSize: 12, resize: 'vertical' }}
                />
                {triggerResult && (
                  <pre style={{ marginTop: 8, background: 'var(--surface)', borderRadius: 6, padding: 10, fontSize: 11, color: 'var(--text-muted)', overflow: 'auto', maxHeight: 120 }}>
                    {triggerResult}
                  </pre>
                )}
              </div>

              {/* Workflow list */}
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Workflows ({(workflows[instance.id] ?? []).length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(workflows[instance.id] ?? []).map((wf: any) => (
                    <div key={wf.id} style={{
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '10px 14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{wf.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {wf.active ? '● Active' : '○ Inactive'} · {wf.nodes?.length ?? 0} nodes
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: wf.active ? 'var(--success)' : 'var(--text-muted)' }}>
                        {wf.active ? 'ACTIVE' : 'PAUSED'}
                      </div>
                    </div>
                  ))}
                  {(workflows[instance.id] ?? []).length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      No workflows found. Check your n8n API key or add workflows in n8n.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          {!instance && n8nInstances.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Add an n8n instance to get started.</div>
          )}
        </div>
      </div>
    </div>
  )
}
