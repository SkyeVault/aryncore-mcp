import { useEffect, useState } from 'react'
import { Download, Trash2, RefreshCw, MessageSquare, GitBranch, Check, Power, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/layout/TopBar'
import { useAppStore } from '../store/useAppStore'
import { getModels, deleteModel } from '../lib/api'
import type { Server } from '../lib/api'

// ── Model Catalog ─────────────────────────────────────────────────────────────
const CATALOG: {
  id: string; name: string; tag: string; size: string
  description: string; category: 'general' | 'code' | 'vision' | 'fast' | 'large' | 'embed'
}[] = [
  { id: 'mistral',           name: 'Mistral 7B',          tag: 'mistral',             size: '4.1 GB', description: 'Fast, capable all-rounder. Great for chat and reasoning.',            category: 'general' },
  { id: 'llama3.2',          name: 'Llama 3.2 3B',        tag: 'llama3.2',            size: '2.0 GB', description: "Meta's compact model. Surprisingly capable for its size.",            category: 'fast'    },
  { id: 'llama3.1',          name: 'Llama 3.1 8B',        tag: 'llama3.1',            size: '4.7 GB', description: 'Meta 8B with 128k context. Great balance of speed and quality.',      category: 'general' },
  { id: 'llama3.1:70b',      name: 'Llama 3.1 70B',       tag: 'llama3.1:70b',        size: '40 GB',  description: 'Top-tier open model. Needs 48GB+ VRAM.',                             category: 'large'   },
  { id: 'gemma2',            name: 'Gemma 2 9B',          tag: 'gemma2',              size: '5.4 GB', description: "Google's well-rounded 9B. Excellent instruction following.",          category: 'general' },
  { id: 'gemma2:27b',        name: 'Gemma 2 27B',         tag: 'gemma2:27b',          size: '16 GB',  description: "Google's large Gemma. Strong reasoning and writing.",                category: 'large'   },
  { id: 'qwen2.5',           name: 'Qwen 2.5 7B',         tag: 'qwen2.5',             size: '4.4 GB', description: "Alibaba's multilingual model. Great for diverse tasks.",              category: 'general' },
  { id: 'qwen2.5:14b',       name: 'Qwen 2.5 14B',        tag: 'qwen2.5:14b',         size: '9.0 GB', description: 'Strong across reasoning, code, and writing.',                        category: 'general' },
  { id: 'deepseek-r1',       name: 'DeepSeek R1 7B',      tag: 'deepseek-r1',         size: '4.7 GB', description: 'Reasoning-focused. Shows step-by-step thinking.',                    category: 'general' },
  { id: 'neural-chat',       name: 'Neural Chat 7B',      tag: 'neural-chat',         size: '4.1 GB', description: 'Intel-tuned conversational model. Smooth and friendly.',              category: 'general' },
  { id: 'codellama',         name: 'CodeLlama 7B',        tag: 'codellama',           size: '3.8 GB', description: 'Meta code model. Good for most languages and debugging.',             category: 'code'    },
  { id: 'codellama:13b',     name: 'CodeLlama 13B',       tag: 'codellama:13b',       size: '7.4 GB', description: 'Larger CodeLlama. Better at complex code.',                          category: 'code'    },
  { id: 'qwen2.5-coder',     name: 'Qwen 2.5 Coder 7B',  tag: 'qwen2.5-coder',       size: '4.4 GB', description: 'Top-ranked open code model. Excellent for agentic coding.',           category: 'code'    },
  { id: 'qwen2.5-coder:14b', name: 'Qwen 2.5 Coder 14B', tag: 'qwen2.5-coder:14b',   size: '9.0 GB', description: 'Near GPT-4 on code benchmarks.',                                    category: 'code'    },
  { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2',  tag: 'deepseek-coder-v2',   size: '8.9 GB', description: 'Excellent at coding and math. Strong tool-use support.',              category: 'code'    },
  { id: 'starcoder2',        name: 'StarCoder2 7B',       tag: 'starcoder2',          size: '4.0 GB', description: '600+ programming languages. Great for niche langs.',                 category: 'code'    },
  { id: 'phi3',              name: 'Phi-3 Mini',          tag: 'phi3',                size: '2.3 GB', description: "Microsoft's tiny but smart model. Very fast on CPU.",                category: 'fast'    },
  { id: 'phi3:medium',       name: 'Phi-3 Medium',        tag: 'phi3:medium',         size: '7.9 GB', description: 'Bigger Phi-3. Strong reasoning for a mid-size model.',               category: 'fast'    },
  { id: 'tinyllama',         name: 'TinyLlama 1.1B',      tag: 'tinyllama',           size: '638 MB', description: 'Runs anywhere. Use for quick tests or low-RAM setups.',              category: 'fast'    },
  { id: 'smollm2',           name: 'SmolLM2 1.7B',        tag: 'smollm2',             size: '1.0 GB', description: "HuggingFace compact model. Surprisingly capable at 1.7B.",           category: 'fast'    },
  { id: 'llava',             name: 'LLaVA 7B',            tag: 'llava',               size: '4.5 GB', description: 'Understands images. Send a photo, get analysis.',                    category: 'vision'  },
  { id: 'llava:13b',         name: 'LLaVA 13B',           tag: 'llava:13b',           size: '8.0 GB', description: 'Larger vision model. Better at detailed image understanding.',       category: 'vision'  },
  { id: 'moondream',         name: 'Moondream 2',         tag: 'moondream',           size: '1.7 GB', description: 'Tiny vision model. Fast image captioning and Q&A.',                  category: 'vision'  },
  { id: 'bakllava',          name: 'BakLLaVA',            tag: 'bakllava',            size: '4.7 GB', description: 'Mistral + LLaVA. Vision with Mistral quality language.',              category: 'vision'  },
  { id: 'nomic-embed-text',  name: 'Nomic Embed',         tag: 'nomic-embed-text',    size: '274 MB', description: 'Text embeddings for RAG, semantic search, clustering.',               category: 'embed'   },
  { id: 'mxbai-embed-large', name: 'MxBAI Embed Large',  tag: 'mxbai-embed-large',   size: '670 MB', description: 'High quality embeddings. Best for retrieval tasks.',                  category: 'embed'   },
]

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All', general: 'General', code: 'Code',
  fast: 'Fast / Small', large: 'Large', vision: 'Vision', embed: 'Embeddings',
}
const CATEGORY_COLORS: Record<string, string> = {
  general: '#7c6ef7', code: '#5eead4', fast: '#22c55e',
  large: '#f59e0b', vision: '#f472b6', embed: '#3b82f6',
}

function formatSize(bytes: number) {
  const gb = bytes / 1e9
  return gb > 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1e6).toFixed(0)} MB`
}

// ── Server status banner ──────────────────────────────────────────────────────
function ServerBanner({ srv, onStartLocal }: {
  srv: { host: string; port: number }
  onStartLocal: () => void
}) {
  const [online, setOnline] = useState<boolean | null>(null)
  const [starting, setStarting] = useState(false)

  const check = async () => {
    setOnline(null)
    try {
      const r = await fetch(`/api/ollama/ping?host=${srv.host}&port=${srv.port}`)
      const j = await r.json()
      setOnline(j.online)
    } catch {
      setOnline(false)
    }
  }

  useEffect(() => { check() }, [srv.host, srv.port])

  const startLocal = async () => {
    setStarting(true)
    try {
      const r = await fetch('/api/ollama/start-local', { method: 'POST' })
      const j = await r.json()
      if (j.status === 'started' || j.status === 'already_running') {
        await check()
      } else {
        setOnline(false)
      }
    } catch {
      setOnline(false)
    } finally {
      setStarting(false)
      onStartLocal()
    }
  }

  const isLocal = srv.host === 'localhost' || srv.host === '127.0.0.1'

  if (online === null) return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: 'var(--text-muted)' }}>
      Checking {srv.host}:{srv.port}…
    </div>
  )

  if (online) return (
    <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)' }} />
      Ollama online at {srv.host}:{srv.port} — ready to pull
    </div>
  )

  return (
    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
      <AlertCircle size={15} color="var(--danger)" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 12, color: 'var(--danger)' }}>
        {isLocal
          ? 'Local Ollama is not running.'
          : `Cannot reach ${srv.host}:${srv.port}. Check the server is up and reachable.`}
      </div>
      {isLocal && (
        <button
          onClick={startLocal}
          disabled={starting}
          style={{ background: 'var(--success)', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
        >
          <Power size={12} /> {starting ? 'Starting…' : 'Start Ollama'}
        </button>
      )}
      <button onClick={check} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.4)', color: 'var(--danger)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 11, flexShrink: 0 }}>
        Retry
      </button>
    </div>
  )
}

// ── PullProgress ──────────────────────────────────────────────────────────────
function PullProgress({ name, srv, onDone, onError }: {
  name: string
  srv: { host: string; port: number }
  onDone: () => void
  onError: (msg: string) => void
}) {
  const [log, setLog] = useState(`Connecting to ${srv.host}:${srv.port}…`)
  const [done, setDone] = useState(false)
  const [pct, setPct] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const r = await fetch('/api/ollama/pull', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: name, server_host: srv.host, server_port: srv.port }),
        })
        if (!r.ok) {
          const text = await r.text()
          // Try to parse FastAPI detail
          try { const j = JSON.parse(text); onError(j.detail ?? text.slice(0, 160)) }
          catch { onError(text.slice(0, 160)) }
          return
        }
        const reader = r.body?.getReader()
        if (!reader) { onError('No response stream'); return }
        const dec = new TextDecoder()
        while (!cancelled) {
          const { done: rd, value } = await reader.read()
          if (rd) break
          for (const line of dec.decode(value).split('\n').filter(Boolean)) {
            try {
              const j = JSON.parse(line)
              if (cancelled) break
              const status: string = j.status ?? ''
              if (status.startsWith('error:')) { onError(status.slice(7)); return }
              setLog(status)
              if (j.total && j.completed) setPct(Math.round((j.completed / j.total) * 100))
              if (status === 'success') { setDone(true); onDone(); return }
            } catch {}
          }
        }
      } catch (e: any) {
        if (!cancelled) onError(e.message ?? 'Unknown error')
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{done ? '✓ Done' : log}</span>
        {pct > 0 && !done && <span style={{ fontSize: 10, color: 'var(--accent)' }}>{pct}%</span>}
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${done ? 100 : pct || 5}%`, background: done ? 'var(--success)' : 'var(--accent)', transition: 'width 0.4s', borderRadius: 2 }} />
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function ModelManager() {
  const { servers, activeModel, setActiveModel, setActiveConversationId } = useAppStore()
  const navigate = useNavigate()

  const [tab, setTab] = useState<'installed' | 'catalog'>('installed')
  const [models, setModels] = useState<{ name: string; size: number; details?: any }[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedServer, setSelectedServer] = useState<Server | null>(null)
  const [pulling, setPulling] = useState<Record<string, boolean>>({})
  const [pulled, setPulled] = useState<Record<string, boolean>>({})
  const [pullErrors, setPullErrors] = useState<Record<string, string>>({})
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [customPull, setCustomPull] = useState('')

  // Default: prefer the Remote Ollama server since local is offline
  const srv = selectedServer
    ? { host: selectedServer.host, port: selectedServer.port }
    : { host: 'localhost', port: 11434 }

  const load = async () => {
    setLoading(true)
    try {
      const data = await getModels(srv.host, srv.port)
      setModels(data.models ?? [])
    } catch {
      setModels([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [srv.host, srv.port])

  // Auto-select remote server if servers are loaded and local is likely offline
  useEffect(() => {
    if (servers.length > 0 && !selectedServer) {
      const remote = servers.find(s => s.type === 'ollama' && s.host !== 'localhost' && s.host !== '127.0.0.1')
      if (remote) setSelectedServer(remote)
    }
  }, [servers])

  const installedNames = new Set(models.map(m => m.name.split(':')[0]))

  const startPull = (tag: string) => {
    setPullErrors(e => { const n = { ...e }; delete n[tag]; return n })
    setPulling(p => ({ ...p, [tag]: true }))
  }
  const donePull = (tag: string) => {
    setPulling(p => ({ ...p, [tag]: false }))
    setPulled(p => ({ ...p, [tag]: true }))
    load()
  }
  const errorPull = (tag: string, msg: string) => {
    setPulling(p => ({ ...p, [tag]: false }))
    setPullErrors(e => ({ ...e, [tag]: msg }))
  }

  const del = async (name: string) => {
    if (!confirm(`Delete ${name}?`)) return
    await deleteModel(name, srv.host, srv.port)
    load()
  }

  const useInChat = (modelName: string) => {
    setActiveModel(modelName)
    setActiveConversationId(null)
    navigate('/chat')
  }
  const useInBuilder = (modelName: string) => {
    navigate('/builder', { state: { addModel: modelName } })
  }

  const filtered = categoryFilter === 'all' ? CATALOG : CATALOG.filter(m => m.category === categoryFilter)

  const tabBtn = (t: string) => ({
    padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600 as const,
    background: tab === t ? 'var(--accent)' : 'var(--surface2)',
    color: tab === t ? '#fff' : 'var(--text-muted)',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar title="Model Manager" />
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

        {/* Tabs + server selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <button style={tabBtn('installed')} onClick={() => setTab('installed')}>
            Installed ({models.length})
          </button>
          <button style={tabBtn('catalog')} onClick={() => setTab('catalog')}>
            Model Catalog
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ollama server:</span>
            <select
              value={selectedServer?.id ?? ''}
              onChange={e => setSelectedServer(servers.find(s => s.id === Number(e.target.value)) ?? null)}
              style={{ background: 'var(--surface2)', border: '1px solid var(--accent)', color: 'var(--text)', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600 }}
            >
              <option value="">Local (localhost:11434)</option>
              {servers.filter(s => s.type === 'ollama').map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.host}:{s.port})</option>
              ))}
            </select>
            <button onClick={load} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {/* Live server status */}
        <ServerBanner srv={srv} onStartLocal={load} />

        {/* ── INSTALLED TAB ── */}
        {tab === 'installed' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input
                value={customPull}
                onChange={e => setCustomPull(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && customPull.trim()) { startPull(customPull.trim()); setCustomPull('') } }}
                placeholder="Pull any model by name (e.g. llama3.2, qwen2.5:14b)…"
                style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}
              />
              <button
                onClick={() => { if (customPull.trim()) { startPull(customPull.trim()); setCustomPull('') } }}
                disabled={!customPull.trim()}
                style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Download size={13} /> Pull
              </button>
            </div>

            {Object.entries(pulling).filter(([, v]) => v).map(([tag]) => (
              <div key={tag} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Pulling {tag}</div>
                <PullProgress name={tag} srv={srv} onDone={() => donePull(tag)} onError={msg => errorPull(tag, msg)} />
                {pullErrors[tag] && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--danger)' }}>{pullErrors[tag]}</div>}
              </div>
            ))}

            {loading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {models.map(m => {
                  const isActive = activeModel === m.name
                  return (
                    <div key={m.name} style={{
                      background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px',
                      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{m.name}</span>
                          {isActive && <span style={{ fontSize: 10, background: 'rgba(124,110,247,0.2)', color: 'var(--accent)', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>ACTIVE</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 10 }}>
                          <span>{formatSize(m.size)}</span>
                          {m.details?.parameter_size && <span>{m.details.parameter_size}</span>}
                          {m.details?.quantization_level && <span>{m.details.quantization_level}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => useInChat(m.name)} style={{ background: isActive ? 'var(--accent)' : 'var(--surface)', border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`, color: isActive ? '#fff' : 'var(--text)', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MessageSquare size={12} /> Chat
                        </button>
                        <button onClick={() => useInBuilder(m.name)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <GitBranch size={12} /> Workflow
                        </button>
                        <button onClick={() => del(m.name)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '5px 6px' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
                {models.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
                    No models found on this server. Switch to <button onClick={() => setTab('catalog')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, padding: 0 }}>Model Catalog</button> to pull one.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── CATALOG TAB ── */}
        {tab === 'catalog' && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
              {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                <button key={k} onClick={() => setCategoryFilter(k)} style={{
                  padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: categoryFilter === k ? (CATEGORY_COLORS[k] ?? 'var(--accent)') : 'var(--surface2)',
                  color: categoryFilter === k ? '#fff' : 'var(--text-muted)',
                }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
              {filtered.map(m => {
                const isInstalled = installedNames.has(m.id) || pulled[m.tag]
                const isPulling = pulling[m.tag]
                const pullError = pullErrors[m.tag]
                const color = CATEGORY_COLORS[m.category]

                return (
                  <div key={m.id} style={{ background: 'var(--surface2)', border: `1px solid ${isInstalled ? color + '55' : 'var(--border)'}`, borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{m.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{m.tag} · {m.size}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: color + '22', color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {CATEGORY_LABELS[m.category]}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{m.description}</div>

                    {isPulling && <PullProgress name={m.tag} srv={srv} onDone={() => donePull(m.tag)} onError={msg => errorPull(m.tag, msg)} />}

                    {pullError && (
                      <div style={{ fontSize: 11, color: 'var(--danger)', background: 'rgba(239,68,68,0.08)', borderRadius: 6, padding: '6px 8px', lineHeight: 1.5 }}>
                        {pullError}
                        <button onClick={() => setPullErrors(e => { const n = { ...e }; delete n[m.tag]; return n })} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', marginLeft: 6, fontSize: 11 }}>dismiss</button>
                      </div>
                    )}

                    {!isPulling && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                        {isInstalled ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--success)' }}>
                              <Check size={12} /> Installed
                            </div>
                            <button onClick={() => useInChat(m.tag)} style={{ marginLeft: 'auto', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MessageSquare size={11} /> Chat
                            </button>
                            <button onClick={() => useInBuilder(m.tag)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <GitBranch size={11} /> Workflow
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startPull(m.tag)}
                            style={{ width: '100%', background: color + '22', border: `1px solid ${color}55`, color, borderRadius: 7, padding: '6px', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          >
                            <Download size={12} /> Pull {m.name}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
