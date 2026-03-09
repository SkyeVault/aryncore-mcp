import { useEffect, useRef, useState } from 'react'
import {
  Plus, Trash2, Upload, FolderOpen, FolderPlus, Globe,
  Check, X, Wifi, WifiOff, Copy, ExternalLink, ChevronRight,
  File, FileImage, FileVideo, FileAudio, RefreshCw, Edit3,
} from 'lucide-react'
import { TopBar } from '../components/layout/TopBar'

// ── Types ──────────────────────────────────────────────────────────────────────

interface DeployTarget {
  id: number
  name: string
  host: string
  port: number
  username: string
  ssh_key_path: string
  password: string
  web_root: string
  public_url: string
}

interface RemoteEntry {
  name: string
  is_dir: boolean
  size: number | null
  mtime: number | null
  path: string
  public_url: string | null
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: 6, padding: '6px 10px',
  fontSize: 12, width: '100%', boxSizing: 'border-box',
}
const btn = (active = true, danger = false): React.CSSProperties => ({
  background: danger ? '#ef444420' : active ? 'var(--accent)' : 'var(--surface2)',
  border: `1px solid ${danger ? '#ef4444' : active ? 'var(--accent)' : 'var(--border)'}`,
  color: danger ? '#f87171' : '#fff',
  borderRadius: 6, padding: '6px 12px', cursor: active ? 'pointer' : 'not-allowed',
  fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5,
})

// ── File icon helper ──────────────────────────────────────────────────────────

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].includes(ext))
    return <FileImage size={14} color="#fb923c" />
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext))
    return <FileVideo size={14} color="#f472b6" />
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext))
    return <FileAudio size={14} color="#5eead4" />
  if (['html', 'htm'].includes(ext))
    return <Globe size={14} color="#7c6ef7" />
  return <File size={14} color="var(--text-muted)" />
}

function fmtSize(bytes: number | null): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(ts: number | null): string {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleDateString()
}

// ── Add / Edit server modal ───────────────────────────────────────────────────

const EMPTY: Omit<DeployTarget, 'id'> = {
  name: '', host: '', port: 22, username: 'root',
  ssh_key_path: '', password: '', web_root: '/var/www/html', public_url: '',
}

function ServerModal({ initial, onSave, onClose }: {
  initial?: Partial<DeployTarget>
  onSave: (data: Omit<DeployTarget, 'id'>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({ ...EMPTY, ...initial })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const field = (key: keyof typeof EMPTY, label: string, type = 'text', placeholder = '') => (
    <div key={key} style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</label>
      <input type={type} value={String((form as any)[key] ?? '')} placeholder={placeholder}
        onChange={e => set(key, type === 'number' ? Number(e.target.value) : e.target.value)}
        style={inp} />
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, width: 460, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 18 }}>
          {initial?.id ? 'Edit Server' : 'Add Publish Server'}
        </div>

        {field('name', 'Display Name', 'text', 'My VPS')}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Host (IPv4 or IPv6)</label>
            <input value={form.host} placeholder="203.0.113.1  or  2001:db8::1"
              onChange={e => set('host', e.target.value)} style={inp} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>SSH Port</label>
            <input type="number" value={form.port} onChange={e => set('port', Number(e.target.value))} style={inp} />
          </div>
        </div>
        <div style={{ marginBottom: 10 }} />

        {field('username', 'SSH Username', 'text', 'root')}

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>SSH Key Path <span style={{ color: '#6b7280' }}>(preferred)</span></label>
          <input value={form.ssh_key_path} placeholder="/home/lorelei/.ssh/id_rsa"
            onChange={e => set('ssh_key_path', e.target.value)} style={inp} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Password <span style={{ color: '#6b7280' }}>(only if no key)</span></label>
          <input type="password" value={form.password}
            onChange={e => set('password', e.target.value)} style={inp} />
        </div>

        {field('web_root', 'Web Root Path', 'text', '/var/www/html')}
        {field('public_url', 'Public Base URL', 'text', 'https://mysite.com  or  http://[2001:db8::1]')}

        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
          For IPv6 addresses, you can enter the raw address — brackets are handled automatically.
          The Public Base URL is used to generate clickable links after upload.
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn(false)}>Cancel</button>
          <button onClick={() => onSave(form)} disabled={!form.name || !form.host} style={btn(!(!form.name || !form.host))}>
            <Check size={13} /> {initial?.id ? 'Save Changes' : 'Add Server'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Publish page modal ────────────────────────────────────────────────────────

function PublishPageModal({ targetId, onClose }: { targetId: number; onClose: () => void }) {
  const [form, setForm] = useState({ title: '', description: '', media_url: '', media_type: 'image', slug: '' })
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const publish = async () => {
    setLoading(true); setError('')
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    try {
      const r = await fetch(`/api/deploy/targets/${targetId}/publish-page`, { method: 'POST', body: fd })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail)
      setResult(data)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, width: 440 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 16 }}>Publish HTML Page</div>
        {!result ? (
          <>
            {(['title', 'description', 'media_url', 'slug'] as const).map(k => (
              <div key={k} style={{ marginBottom: 9 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                  {k === 'media_url' ? 'Media URL (image/video/audio)' : k === 'slug' ? 'Filename slug (e.g. my-post → my-post.html)' : k.charAt(0).toUpperCase() + k.slice(1)}
                </label>
                <input value={(form as any)[k]} onChange={e => set(k, e.target.value)} style={inp} />
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Media Type</label>
              <select value={form.media_type} onChange={e => set('media_type', e.target.value)} style={inp}>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
              </select>
            </div>
            {error && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={btn(false)}>Cancel</button>
              <button onClick={publish} disabled={loading} style={btn(!loading)}>
                {loading ? 'Publishing…' : <><Globe size={13} /> Publish</>}
              </button>
            </div>
          </>
        ) : (
          <div>
            <div style={{ color: '#22c55e', fontWeight: 600, marginBottom: 10 }}>✓ Published!</div>
            <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Public URL</div>
              <a href={result.public_url} target="_blank" rel="noreferrer"
                style={{ fontSize: 13, color: 'var(--accent)', wordBreak: 'break-all' }}>
                {result.public_url}
              </a>
            </div>
            <button onClick={onClose} style={btn()}>Done</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function Deploy() {
  const [targets, setTargets] = useState<DeployTarget[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [testResults, setTestResults] = useState<Record<number, { ok: boolean; msg: string }>>({})
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<DeployTarget | null>(null)
  const [showPublishPage, setShowPublishPage] = useState(false)

  // File browser
  const [browsePath, setBrowsePath] = useState('')
  const [entries, setEntries] = useState<RemoteEntry[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [webRoot, setWebRoot] = useState('')

  // Upload
  const [uploadDir, setUploadDir] = useState('')
  const [uploading, setUploading] = useState(false)
  const [lastUpload, setLastUpload] = useState<any>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)

  // New folder
  const [newFolder, setNewFolder] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)

  const loadTargets = () =>
    fetch('/api/deploy/targets').then(r => r.json()).then(setTargets).catch(() => {})

  useEffect(() => { loadTargets() }, [])

  const activeTarget = targets.find(t => t.id === activeId)

  // ── Select server → browse its root ────────────────────────────────────────
  const selectTarget = async (t: DeployTarget) => {
    setActiveId(t.id)
    setEntries([])
    setLastUpload(null)
    setBrowsePath(t.web_root)
    setUploadDir(t.web_root)
    await browse(t.id, t.web_root)
  }

  // ── Browse ─────────────────────────────────────────────────────────────────
  const browse = async (tid: number, path: string) => {
    setBrowseLoading(true)
    try {
      const r = await fetch(`/api/deploy/targets/${tid}/browse?path=${encodeURIComponent(path)}`)
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail)
      setEntries(data.entries)
      setBrowsePath(data.path)
      setUploadDir(data.path)
      setWebRoot(data.web_root)
    } catch (e: any) {
      setEntries([])
    } finally {
      setBrowseLoading(false)
    }
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleUpload = async (files: FileList | null) => {
    if (!files || !activeId) return
    setUploading(true); setLastUpload(null)
    const results = []
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('remote_dir', uploadDir)
      try {
        const r = await fetch(`/api/deploy/targets/${activeId}/upload`, { method: 'POST', body: fd })
        const data = await r.json()
        if (r.ok) results.push(data)
      } catch { }
    }
    setLastUpload(results)
    setUploading(false)
    if (activeId) browse(activeId, browsePath)
  }

  // ── Test connection ────────────────────────────────────────────────────────
  const testConnection = async (t: DeployTarget) => {
    setTestResults(prev => ({ ...prev, [t.id]: { ok: false, msg: 'Testing…' } }))
    const r = await fetch(`/api/deploy/targets/${t.id}/test`, { method: 'POST' })
    const data = await r.json()
    setTestResults(prev => ({
      ...prev,
      [t.id]: { ok: data.ok, msg: data.ok ? `Connected · ${data.web_root_files ?? ''} files` : data.error },
    }))
  }

  // ── Delete file ─────────────────────────────────────────────────────────────
  const deleteFile = async (path: string) => {
    if (!activeId || !confirm(`Delete ${path}?`)) return
    await fetch(`/api/deploy/targets/${activeId}/file?remote_path=${encodeURIComponent(path)}`, { method: 'DELETE' })
    browse(activeId, browsePath)
  }

  // ── Create folder ──────────────────────────────────────────────────────────
  const createFolder = async () => {
    if (!newFolder.trim() || !activeId) return
    setCreatingFolder(true)
    const fd = new FormData()
    fd.append('path', browsePath.replace(/\/+$/, '') + '/' + newFolder.trim())
    await fetch(`/api/deploy/targets/${activeId}/mkdir`, { method: 'POST', body: fd })
    setNewFolder('')
    setCreatingFolder(false)
    browse(activeId, browsePath)
  }

  // ── Save server ────────────────────────────────────────────────────────────
  const saveServer = async (data: Omit<DeployTarget, 'id'>) => {
    if (editTarget) {
      await fetch(`/api/deploy/targets/${editTarget.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
    } else {
      await fetch('/api/deploy/targets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
    }
    setShowModal(false); setEditTarget(null)
    loadTargets()
  }

  const deleteTarget = async (id: number) => {
    if (!confirm('Remove this server?')) return
    await fetch(`/api/deploy/targets/${id}`, { method: 'DELETE' })
    if (activeId === id) { setActiveId(null); setEntries([]) }
    loadTargets()
  }

  // ── Breadcrumb ─────────────────────────────────────────────────────────────
  const breadcrumbs = () => {
    if (!webRoot || !browsePath) return []
    const rel = browsePath.slice(webRoot.length) || '/'
    const parts = rel.split('/').filter(Boolean)
    const crumbs = [{ label: '/', path: webRoot }]
    let cur = webRoot
    for (const p of parts) {
      cur = cur.replace(/\/+$/, '') + '/' + p
      crumbs.push({ label: p, path: cur })
    }
    return crumbs
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar title="Publish" />
      {(showModal || editTarget) && (
        <ServerModal
          initial={editTarget ?? undefined}
          onSave={saveServer}
          onClose={() => { setShowModal(false); setEditTarget(null) }}
        />
      )}
      {showPublishPage && activeId && (
        <PublishPageModal targetId={activeId} onClose={() => setShowPublishPage(false)} />
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left: server list ────────────────────────────────────────────── */}
        <div style={{ width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Servers</span>
            <button onClick={() => setShowModal(true)} title="Add server"
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex' }}>
              <Plus size={16} />
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            {targets.length === 0 && (
              <div style={{ padding: '20px 8px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
                No servers yet.<br />Click + to add your first server.
              </div>
            )}
            {targets.map(t => {
              const test = testResults[t.id]
              const isActive = activeId === t.id
              return (
                <div key={t.id} onClick={() => selectTarget(t)} style={{
                  background: isActive ? 'rgba(124,110,247,0.12)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                  borderRadius: 8, padding: '10px 10px', cursor: 'pointer', marginBottom: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t.name}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={e => { e.stopPropagation(); testConnection(t) }} title="Test connection"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                        <Wifi size={12} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setEditTarget(t); setShowModal(true) }} title="Edit"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                        <Edit3 size={12} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); deleteTarget(t.id) }} title="Remove"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: 2 }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                    {t.username}@{t.host.includes(':') ? `[${t.host}]` : t.host}:{t.port}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{t.web_root}</div>
                  {test && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 10, color: test.ok ? '#22c55e' : '#f87171' }}>
                      {test.ok ? <Wifi size={10} /> : <WifiOff size={10} />} {test.msg}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Center: file browser ─────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!activeTarget ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Select a server to browse its files
            </div>
          ) : (
            <>
              {/* Browser toolbar */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Breadcrumb */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  {breadcrumbs().map((c, i, arr) => (
                    <span key={c.path} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <button onClick={() => browse(activeId!, c.path)} style={{ background: 'none', border: 'none', color: i === arr.length - 1 ? 'var(--text)' : 'var(--accent)', cursor: 'pointer', fontSize: 12, padding: '2px 4px', borderRadius: 4 }}>
                        {c.label}
                      </button>
                      {i < arr.length - 1 && <ChevronRight size={11} color="var(--text-muted)" />}
                    </span>
                  ))}
                </div>
                <button onClick={() => browse(activeId!, browsePath)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                  <RefreshCw size={14} />
                </button>
              </div>

              {/* File list */}
              <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
                {browseLoading && (
                  <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>Loading…</div>
                )}
                {!browseLoading && entries.length === 0 && (
                  <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>Empty directory</div>
                )}
                {!browseLoading && entries.map(e => (
                  <div key={e.path} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: e.is_dir ? 'pointer' : 'default' }}
                    onClick={() => e.is_dir && browse(activeId!, e.path)}>
                    <span style={{ flexShrink: 0 }}>
                      {e.is_dir ? <FolderOpen size={14} color="#fb923c" /> : <FileIcon name={e.name} />}
                    </span>
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{fmtSize(e.size)}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, width: 72, textAlign: 'right' }}>{fmtDate(e.mtime)}</span>
                    {e.public_url && (
                      <a href={e.public_url} target="_blank" rel="noreferrer" onClick={ev => ev.stopPropagation()}
                        title="Open" style={{ color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
                        <ExternalLink size={11} />
                      </a>
                    )}
                    {!e.is_dir && (
                      <button onClick={ev => { ev.stopPropagation(); deleteFile(e.path) }} title="Delete"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', display: 'flex', flexShrink: 0, padding: 0 }}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Right: upload panel ──────────────────────────────────────────── */}
        {activeTarget && (
          <div style={{ width: 240, background: 'var(--surface)', borderLeft: '1px solid var(--border)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto', flexShrink: 0 }}>

            {/* Upload */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Upload to</div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--accent)', background: 'var(--surface2)', borderRadius: 5, padding: '4px 8px', marginBottom: 8, wordBreak: 'break-all' }}>
                {uploadDir || browsePath}
              </div>
              <div
                onClick={() => uploadRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files) }}
                style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '20px 12px', textAlign: 'center', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                {uploading ? 'Uploading…' : <><Upload size={18} style={{ marginBottom: 4, display: 'block', margin: '0 auto 6px' }} /> Drop files here or click</>}
              </div>
              <input ref={uploadRef} type="file" multiple style={{ display: 'none' }}
                onChange={e => handleUpload(e.target.files)} />
            </div>

            {/* Last upload result */}
            {lastUpload && lastUpload.length > 0 && (
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, color: '#22c55e', marginBottom: 6, fontWeight: 600 }}>✓ {lastUpload.length} uploaded</div>
                {lastUpload.map((u: any) => (
                  <div key={u.filename} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text)', marginBottom: 3 }}>{u.filename}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <a href={u.public_url} target="_blank" rel="noreferrer"
                        style={{ fontSize: 10, color: 'var(--accent)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                        {u.public_url}
                      </a>
                      <button onClick={() => { navigator.clipboard.writeText(u.public_url); setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 1500) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedUrl ? '#22c55e' : 'var(--text-muted)', flexShrink: 0 }}>
                        {copiedUrl ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Create folder */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>New Folder</div>
              <div style={{ display: 'flex', gap: 5 }}>
                <input value={newFolder} onChange={e => setNewFolder(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createFolder()}
                  placeholder="folder-name" style={{ ...inp, flex: 1 }} />
                <button onClick={createFolder} disabled={!newFolder.trim() || creatingFolder}
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0 8px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  <FolderPlus size={14} />
                </button>
              </div>
            </div>

            {/* Publish HTML page */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Publish Page</div>
              <button onClick={() => setShowPublishPage(true)} style={{ ...btn(), width: '100%', justifyContent: 'center' }}>
                <Globe size={13} /> Generate HTML Page
              </button>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                Wrap any image, video, or audio URL in a dark-themed HTML page and upload it instantly.
              </div>
            </div>

            {/* Server info */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Server</div>
              <div style={{ fontSize: 11, color: 'var(--text)', fontFamily: 'monospace', lineHeight: 1.8 }}>
                <div>{activeTarget.username}@{activeTarget.host.includes(':') ? `[${activeTarget.host}]` : activeTarget.host}</div>
                <div style={{ color: 'var(--text-muted)' }}>:{activeTarget.port}</div>
                {activeTarget.public_url && (
                  <a href={activeTarget.public_url} target="_blank" rel="noreferrer"
                    style={{ color: 'var(--accent)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none', marginTop: 4 }}>
                    <ExternalLink size={10} /> {activeTarget.public_url}
                  </a>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
