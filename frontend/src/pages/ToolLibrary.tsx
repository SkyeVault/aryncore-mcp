import { useEffect, useRef, useState } from 'react'
import {
  RefreshCw, Image as ImageIcon, Video, Volume2, Search,
  Database, Code2, Cpu, ExternalLink, Copy, Check,
  Box, Zap, Terminal, ChevronDown, ChevronRight,
} from 'lucide-react'
import { TopBar } from '../components/layout/TopBar'
import { useAppStore } from '../store/useAppStore'
import {
  getTools, generateImage, generateTTS,
  removeBg, upscaleImg, searchSearx, listQdrant,
  generateAlltalk, generateKokoro,
  type Tool,
} from '../lib/api'

// ── Category meta ─────────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; Icon: any; color: string }> = {
  image:  { label: 'Image',             Icon: ImageIcon, color: '#fb923c' },
  audio:  { label: 'Audio',             Icon: Volume2,   color: '#5eead4' },
  video:  { label: 'Video',             Icon: Video,     color: '#f472b6' },
  '3d':   { label: '3D',                Icon: Box,       color: '#a78bfa' },
  ai:     { label: 'AI Infrastructure', Icon: Cpu,       color: '#7c6ef7' },
  search: { label: 'Search',            Icon: Search,    color: '#3b82f6' },
  data:   { label: 'Data / Vector',     Icon: Database,  color: '#22c55e' },
  code:   { label: 'Code',              Icon: Code2,     color: '#facc15' },
}

const STATUS_COLORS: Record<string, string> = {
  online:      '#22c55e',
  available:   '#7c6ef7',
  offline:     '#ef4444',
  unavailable: '#6b7280',
  error:       '#f59e0b',
}

const STATUS_LABELS: Record<string, string> = {
  online:      'online',
  available:   'installed',
  offline:     'offline',
  unavailable: 'not installed',
  error:       'error',
}

// ── Shared input style ────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: 6, padding: '6px 10px', fontSize: 12,
  width: '100%', boxSizing: 'border-box',
}

const runBtn = (disabled = false): React.CSSProperties => ({
  background: disabled ? 'var(--surface2)' : 'var(--accent)',
  border: 'none', color: '#fff', borderRadius: 6, padding: '8px 14px',
  cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
})

// ── Tool panels ───────────────────────────────────────────────────────────────

function SDPanel() {
  const [prompt, setPrompt] = useState('')
  const [negative, setNegative] = useState('')
  const [steps, setSteps] = useState(20)
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [error, setError] = useState('')

  const run = async () => {
    if (!prompt) return
    setLoading(true); setError('')
    try {
      const r = await generateImage({ prompt, negative_prompt: negative, steps, width: 512, height: 512 })
      setImages(r.images)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Prompt…" rows={3} style={{ ...inp, resize: 'vertical' }} />
      <input value={negative} onChange={e => setNegative(e.target.value)} placeholder="Negative prompt…" style={inp} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Steps: {steps}</span>
        <input type="range" min={10} max={50} value={steps} onChange={e => setSteps(Number(e.target.value))} style={{ flex: 1 }} />
      </div>
      <button onClick={run} disabled={loading || !prompt} style={runBtn(loading || !prompt)}>
        {loading ? 'Generating…' : 'Generate Image'}
      </button>
      {error && <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>}
      {images.map((img, i) => (
        <img key={i} src={`data:image/png;base64,${img}`} alt="" style={{ maxWidth: '100%', borderRadius: 8 }} />
      ))}
    </div>
  )
}

function TTSPanel() {
  const [text, setText] = useState('')
  const [voice, setVoice] = useState('random')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    if (!text) return
    setLoading(true); setError('')
    try { await generateTTS({ text, voice }) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Text to synthesize…" rows={4} style={{ ...inp, resize: 'vertical' }} />
      <input value={voice} onChange={e => setVoice(e.target.value)} placeholder="Voice preset (random, train_lescault…)" style={inp} />
      <button onClick={run} disabled={loading || !text} style={runBtn(loading || !text)}>
        {loading ? 'Generating…' : 'Generate Speech'}
      </button>
      {error && <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>}
    </div>
  )
}

function AllTalkPanel() {
  const [text, setText] = useState('')
  const [voice, setVoice] = useState('default')
  const [lang, setLang] = useState('en')
  const [loading, setLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState('')
  const [error, setError] = useState('')

  const run = async () => {
    if (!text) return
    setLoading(true); setError(''); setAudioUrl('')
    try {
      const r = await generateAlltalk({ text, voice, language: lang })
      if (r.output_file_url) setAudioUrl(`http://localhost:7851${r.output_file_url}`)
      else setAudioUrl('')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Text to synthesize…" rows={4} style={{ ...inp, resize: 'vertical' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8 }}>
        <input value={voice} onChange={e => setVoice(e.target.value)} placeholder="Voice name (default)" style={inp} />
        <select value={lang} onChange={e => setLang(e.target.value)} style={inp}>
          {['en', 'es', 'fr', 'de', 'ja', 'zh', 'ru', 'pt', 'it', 'ko'].map(l => <option key={l}>{l}</option>)}
        </select>
      </div>
      <button onClick={run} disabled={loading || !text} style={runBtn(loading || !text)}>
        {loading ? 'Generating…' : 'Synthesize with AllTalk'}
      </button>
      {error && <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>}
      {audioUrl && (
        <audio controls src={audioUrl} style={{ width: '100%', marginTop: 4 }} />
      )}
    </div>
  )
}

function KokoroPanel() {
  const [text, setText] = useState('')
  const [voice, setVoice] = useState('af_heart')
  const [speed, setSpeed] = useState(1.0)
  const [loading, setLoading] = useState(false)
  const [audioB64, setAudioB64] = useState('')
  const [error, setError] = useState('')

  const VOICES = ['af_heart', 'af_bella', 'af_nicole', 'am_adam', 'am_michael', 'bf_emma', 'bm_george']

  const run = async () => {
    if (!text) return
    setLoading(true); setError(''); setAudioB64('')
    try {
      const r = await generateKokoro({ text, voice, speed })
      if (r.audio_base64) setAudioB64(r.audio_base64)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Text to synthesize…" rows={4} style={{ ...inp, resize: 'vertical' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
        <select value={voice} onChange={e => setVoice(e.target.value)} style={inp}>
          {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          Speed {speed.toFixed(1)}
          <input type="range" min={0.5} max={2} step={0.1} value={speed} onChange={e => setSpeed(Number(e.target.value))} style={{ display: 'block', marginTop: 2, width: 80 }} />
        </label>
      </div>
      <button onClick={run} disabled={loading || !text} style={runBtn(loading || !text)}>
        {loading ? 'Synthesizing…' : 'Synthesize with Kokoro'}
      </button>
      {error && <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>}
      {audioB64 && (
        <audio controls src={`data:audio/wav;base64,${audioB64}`} style={{ width: '100%', marginTop: 4 }} />
      )}
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Kokoro is extremely fast — most text generates in under a second.</div>
    </div>
  )
}

function RembgPanel() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onFile = (f: File) => {
    setFile(f); setResult('')
    setPreview(URL.createObjectURL(f))
  }

  const run = async () => {
    if (!file) return
    setLoading(true); setError('')
    try {
      const form = new FormData()
      form.append('image', file)
      const r = await removeBg(form)
      if (r.image_base64) setResult(`data:image/png;base64,${r.image_base64}`)
      else throw new Error(r.detail ?? 'No result')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', border: '1px dashed var(--border)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
        {file ? file.name : 'Click to upload image'}
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {preview && <img src={preview} alt="input" style={{ maxHeight: 160, objectFit: 'contain', borderRadius: 6 }} />}
      <button onClick={run} disabled={loading || !file} style={runBtn(loading || !file)}>
        {loading ? 'Removing background…' : 'Remove Background'}
      </button>
      {error && <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>}
      {result && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Result (transparent PNG):</div>
          <img src={result} alt="result" style={{ maxWidth: '100%', borderRadius: 8, background: 'repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 0 0 / 16px 16px' }} />
          <a href={result} download="no-bg.png" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>Download PNG</a>
        </>
      )}
    </div>
  )
}

function RealESRGANPanel() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [result, setResult] = useState('')
  const [scale, setScale] = useState(4)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onFile = (f: File) => { setFile(f); setResult(''); setPreview(URL.createObjectURL(f)) }

  const run = async () => {
    if (!file) return
    setLoading(true); setError('')
    try {
      const form = new FormData()
      form.append('image', file)
      form.append('scale', String(scale))
      const r = await upscaleImg(form)
      if (r.image_base64) setResult(`data:image/png;base64,${r.image_base64}`)
      else throw new Error(r.detail ?? 'No result')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', border: '1px dashed var(--border)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
        {file ? file.name : 'Click to upload image'}
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {preview && <img src={preview} alt="input" style={{ maxHeight: 160, objectFit: 'contain', borderRadius: 6 }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Scale:</span>
        {[2, 4].map(s => (
          <button key={s} onClick={() => setScale(s)} style={{ background: scale === s ? 'var(--accent)' : 'var(--surface2)', border: '1px solid var(--border)', color: scale === s ? '#fff' : 'var(--text)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>
            {s}×
          </button>
        ))}
      </div>
      <button onClick={run} disabled={loading || !file} style={runBtn(loading || !file)}>
        {loading ? `Upscaling ${scale}×…` : `Upscale ${scale}×`}
      </button>
      {error && <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>}
      {result && (
        <>
          <img src={result} alt="upscaled" style={{ maxWidth: '100%', borderRadius: 8 }} />
          <a href={result} download="upscaled.png" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>Download PNG</a>
        </>
      )}
    </div>
  )
}

function SadTalkerPanel() {
  const [image, setImage] = useState<File | null>(null)
  const [audio, setAudio] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const run = async () => {
    if (!image || !audio) return
    setLoading(true); setError('')
    const form = new FormData()
    form.append('image', image)
    form.append('audio', audio)
    try {
      const r = await fetch('/api/tools/sadtalker/run', { method: 'POST', body: form })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail)
      setResult(JSON.stringify(data, null, 2))
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Portrait Image:
        <input type="file" accept="image/*" onChange={e => setImage(e.target.files?.[0] ?? null)} style={{ display: 'block', marginTop: 4, color: 'var(--text)', fontSize: 12 }} />
      </label>
      <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Audio File:
        <input type="file" accept="audio/*" onChange={e => setAudio(e.target.files?.[0] ?? null)} style={{ display: 'block', marginTop: 4, color: 'var(--text)', fontSize: 12 }} />
      </label>
      <button onClick={run} disabled={loading || !image || !audio} style={runBtn(loading || !image || !audio)}>
        {loading ? 'Processing… (may take minutes)' : 'Generate Talking Head'}
      </button>
      {error && <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>}
      {result && <pre style={{ background: 'var(--surface)', borderRadius: 6, padding: 10, fontSize: 11, color: 'var(--text-muted)', overflow: 'auto' }}>{result}</pre>}
    </div>
  )
}

function SearXNGPanel() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    if (!query) return
    setLoading(true); setError('')
    try {
      const r = await searchSearx(query)
      setResults(r.results)
      setSuggestions(r.suggestions)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder="Search the web…" style={{ ...inp, flex: 1 }} />
        <button onClick={run} disabled={loading || !query} style={runBtn(loading || !query)}>Search</button>
      </div>
      {suggestions.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {suggestions.slice(0, 5).map(s => (
            <button key={s} onClick={() => { setQuery(s); }} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 20, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}>{s}</button>
          ))}
        </div>
      )}
      {error && <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>}
      {results.map((r, i) => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
          <a href={r.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>{r.title}</a>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{r.url}</div>
          {r.content && <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 4, lineHeight: 1.4 }}>{r.content.slice(0, 200)}</div>}
        </div>
      ))}
    </div>
  )
}

function QdrantPanel() {
  const [collections, setCollections] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const r = await listQdrant()
      setCollections(r.collections ?? [])
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button onClick={load} disabled={loading} style={runBtn(loading)}>
        {loading ? 'Loading…' : 'List Collections'}
      </button>
      {error && <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>}
      {collections.length === 0 && !loading && !error && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No collections yet. Use Qdrant to store vector embeddings for RAG workflows.</div>
      )}
      {collections.map(c => (
        <div key={c.name} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text)', fontFamily: 'monospace' }}>
          {c.name}
        </div>
      ))}
    </div>
  )
}

function Florence2Panel() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [task, setTask] = useState('caption')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const TASKS = ['caption', 'detailed_caption', 'more_detailed_caption', 'ocr', 'detect']

  const run = async () => {
    if (!file) return
    setLoading(true); setError('')
    const form = new FormData()
    form.append('image', file)
    form.append('task', task)
    try {
      const r = await fetch('/api/tools/florence2/caption', { method: 'POST', body: form })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail)
      setResult(data.result)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', border: '1px dashed var(--border)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
        {file ? file.name : 'Click to upload image'}
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); setResult(null) } }} />
      </label>
      {preview && <img src={preview} alt="input" style={{ maxHeight: 160, objectFit: 'contain', borderRadius: 6 }} />}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TASKS.map(t => (
          <button key={t} onClick={() => setTask(t)} style={{ background: task === t ? '#fb923c22' : 'var(--surface2)', border: `1px solid ${task === t ? '#fb923c' : 'var(--border)'}`, color: task === t ? '#fb923c' : 'var(--text-muted)', borderRadius: 20, padding: '3px 10px', cursor: 'pointer', fontSize: 11 }}>{t.replace(/_/g, ' ')}</button>
        ))}
      </div>
      <button onClick={run} disabled={loading || !file} style={runBtn(loading || !file)}>
        {loading ? 'Running Florence-2…' : 'Analyze Image'}
      </button>
      {error && <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>}
      {result && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
        </div>
      )}
    </div>
  )
}

function ChatterboxPanel() {
  const [text, setText] = useState('')
  const [exag, setExag] = useState(0.5)
  const [loading, setLoading] = useState(false)
  const [audioB64, setAudioB64] = useState('')
  const [error, setError] = useState('')

  const run = async () => {
    if (!text) return
    setLoading(true); setError(''); setAudioB64('')
    try {
      const r = await fetch('/api/tools/chatterbox/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, exaggeration: exag }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail)
      setAudioB64(data.audio_base64)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Text to synthesize…" rows={4} style={{ ...inp, resize: 'vertical' }} />
      <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        Expressiveness: {exag.toFixed(2)}
        <input type="range" min={0} max={1} step={0.05} value={exag} onChange={e => setExag(Number(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 4 }} />
      </label>
      <button onClick={run} disabled={loading || !text} style={runBtn(loading || !text)}>
        {loading ? 'Generating…' : 'Generate with Chatterbox'}
      </button>
      {error && <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>}
      {audioB64 && <audio controls src={`data:audio/wav;base64,${audioB64}`} style={{ width: '100%' }} />}
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Zero-shot voice cloning — add a reference_audio_url to clone a specific voice.</div>
    </div>
  )
}

// ── Open-in-browser panel (for tools with web UIs) ────────────────────────────

function BrowserPanel({ url, name }: { url: string; name: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{name} runs its own web UI. Click below to open it.</div>
      <a href={url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: '#fff', borderRadius: 6, padding: '8px 14px', textDecoration: 'none', fontSize: 12, fontWeight: 600, width: 'fit-content' }}>
        <ExternalLink size={13} /> Open {name}
      </a>
    </div>
  )
}

// ── Install snippet panel ─────────────────────────────────────────────────────

function InstallPanel({ install }: { install: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(install)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text)', position: 'relative' }}>
      <button onClick={copy} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', gap: 3, alignItems: 'center', fontSize: 10 }}>
        {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? 'Copied' : 'Copy'}
      </button>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', paddingRight: 60 }}>{install}</pre>
    </div>
  )
}

// ── Panel registry ────────────────────────────────────────────────────────────

const TOOL_PANELS: Record<string, (tool: Tool) => React.ReactNode> = {
  stable_diffusion: () => <SDPanel />,
  tortoise_tts:     () => <TTSPanel />,
  alltalk_tts:      () => <AllTalkPanel />,
  kokoro_tts:       () => <KokoroPanel />,
  chatterbox:       () => <ChatterboxPanel />,
  sadtalker:        () => <SadTalkerPanel />,
  rembg:            () => <RembgPanel />,
  realesrgan:       () => <RealESRGANPanel />,
  florence2:        () => <Florence2Panel />,
  searxng:          () => <SearXNGPanel />,
  qdrant:           () => <QdrantPanel />,
  comfyui:          (t) => <BrowserPanel url={t.homepage!} name={t.name} />,
  fooocus:          (t) => <BrowserPanel url={t.homepage!} name={t.name} />,
  localai:          (t) => <BrowserPanel url={t.homepage!} name={t.name} />,
  open_webui:       (t) => <BrowserPanel url={t.homepage!} name={t.name} />,
  tabby:            (t) => <BrowserPanel url={t.homepage!} name={t.name} />,
  perplexica:       (t) => <BrowserPanel url={t.homepage!} name={t.name} />,
  anythingllm:      (t) => <BrowserPanel url={t.homepage!} name={t.name} />,
  flowise:          (t) => <BrowserPanel url={t.homepage!} name={t.name} />,
  rvc:              (t) => <BrowserPanel url={t.homepage!} name={t.name} />,
}

// ── Hardware profile card ─────────────────────────────────────────────────────

function HardwareCard() {
  const [hw, setHw] = useState<any>(null)
  const [modelsOpen, setModelsOpen] = useState(false)
  const [copying, setCopying] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/system/hardware').then(r => r.json()).then(setHw).catch(() => {})
  }, [])

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopying(key)
    setTimeout(() => setCopying(null), 1500)
  }

  if (!hw) return null

  const vramFree = hw.gpu?.available
    ? Math.round((parseInt(hw.gpu.memory_total) - parseInt(hw.gpu.memory_used)) / 1024 * 10) / 10
    : 0

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Zap size={14} color="#7c6ef7" />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your Hardware</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
        {hw.gpu?.available && (
          <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>GPU</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{hw.gpu.name}</div>
            <div style={{ fontSize: 11, color: '#22c55e', marginTop: 2 }}>{vramFree}GB free / {hw.gpu.vram_gb}GB total</div>
            {hw.gpu.temp && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{hw.gpu.temp}°C · {hw.gpu.utilization}% util</div>}
          </div>
        )}
        <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>CPU</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{hw.cpu.name?.replace(/\(R\)|\(TM\)/g, '')}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{hw.cpu.cores} threads</div>
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>RAM</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{hw.ram_gb}GB</div>
          {hw.ram_notes?.map((n: string) => <div key={n} style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{n}</div>)}
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Disk Free</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: hw.disk_free_gb > 100 ? '#22c55e' : '#f59e0b' }}>{hw.disk_free_gb}GB</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>SATA SSD (root)</div>
        </div>
      </div>

      {hw.can_run?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>GPU CAN RUN</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {hw.can_run.map((item: string) => (
              <span key={item} style={{ background: '#22c55e18', border: '1px solid #22c55e44', color: '#22c55e', borderRadius: 20, padding: '2px 8px', fontSize: 10 }}>{item}</span>
            ))}
          </div>
        </div>
      )}

      {hw.too_large?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>NEEDS MORE VRAM</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {hw.too_large.map((item: string) => (
              <span key={item} style={{ background: '#ef444418', border: '1px solid #ef444444', color: '#f87171', borderRadius: 20, padding: '2px 8px', fontSize: 10 }}>{item}</span>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => setModelsOpen(o => !o)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
        {modelsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Recommended Ollama models for your GPU
      </button>

      {modelsOpen && hw.recommended_models && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {hw.recommended_models.map((m: any) => (
            <div key={m.name} style={{ background: 'var(--surface)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: 'monospace' }}>{m.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface2)', borderRadius: 4, padding: '1px 5px' }}>{m.size}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{m.desc}</div>
              </div>
              <button onClick={() => copy(m.pull, m.name)} title="Copy pull command" style={{ background: 'none', border: '1px solid var(--border)', color: copying === m.name ? '#22c55e' : 'var(--text-muted)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                {copying === m.name ? <Check size={11} /> : <Terminal size={11} />}
                {copying === m.name ? 'Copied!' : 'Copy pull'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tool card ─────────────────────────────────────────────────────────────────

function ToolCard({ tool, selected, onClick }: { tool: Tool & { vram_gb?: number }; selected: boolean; onClick: () => void }) {
  const cat = CATEGORY_META[tool.category] ?? CATEGORY_META['image']
  const { Icon } = cat
  const statusColor = STATUS_COLORS[tool.status] ?? '#6b7280'
  const statusLabel = STATUS_LABELS[tool.status] ?? tool.status
  const hasPanel = !!TOOL_PANELS[tool.id]

  return (
    <div onClick={onClick} style={{
      background: 'var(--surface2)',
      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
      transition: 'border-color 0.15s',
      opacity: tool.status === 'unavailable' ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <Icon size={16} color={cat.color} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
          <span style={{ fontSize: 9, color: statusColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{statusLabel}</span>
        </div>
      </div>
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{tool.name}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{tool.description}</div>
      <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
        {tool.port && <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 4, padding: '2px 6px' }}>:{tool.port}</span>}
        {(tool as any).vram_gb && <span style={{ fontSize: 10, color: '#a78bfa', background: '#a78bfa18', borderRadius: 4, padding: '2px 6px' }}>{(tool as any).vram_gb}GB VRAM</span>}
        {hasPanel && <span style={{ fontSize: 10, color: cat.color, background: `${cat.color}18`, borderRadius: 4, padding: '2px 6px' }}>interactive</span>}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ToolLibrary() {
  const { tools, setTools } = useAppStore()
  const [selected, setSelected] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState<string>('all')
  const detailRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    try { setTools(await getTools()) } catch {}
  }

  useEffect(() => { load() }, [])

  const selectedTool = tools.find(t => t.id === selected)
  const categories = ['all', ...Object.keys(CATEGORY_META).filter(c => tools.some(t => t.category === c))]
  const visible = filterCat === 'all' ? tools : tools.filter(t => t.category === filterCat)

  const handleSelect = (id: string) => {
    setSelected(prev => prev === id ? null : id)
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
  }

  // Count by status
  const online = tools.filter(t => t.status === 'online').length
  const available = tools.filter(t => t.status === 'available').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar title="Tool Library" />
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

        <HardwareCard />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {tools.length} tools — {online} online, {available} installed
            </div>
          </div>
          <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center', fontSize: 12 }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {categories.map(cat => {
            const meta = cat === 'all' ? null : CATEGORY_META[cat]
            const active = filterCat === cat
            return (
              <button key={cat} onClick={() => setFilterCat(cat)} style={{
                background: active ? (meta?.color ?? 'var(--accent)') + '22' : 'var(--surface2)',
                border: `1px solid ${active ? (meta?.color ?? 'var(--accent)') : 'var(--border)'}`,
                color: active ? (meta?.color ?? 'var(--accent)') : 'var(--text-muted)',
                borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              }}>
                {cat === 'all' ? 'All' : meta?.label}
              </button>
            )
          })}
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
          {visible.map(t => (
            <ToolCard key={t.id} tool={t} selected={selected === t.id} onClick={() => handleSelect(t.id)} />
          ))}
        </div>

        {/* Detail panel */}
        {selectedTool && (
          <div ref={detailRef} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: '0 0 4px', color: 'var(--text)', fontSize: 16 }}>{selectedTool.name}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedTool.description}</div>
              </div>
              {selectedTool.homepage && (
                <a href={selectedTool.homepage} target="_blank" rel="noreferrer"
                  style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, textDecoration: 'none' }}>
                  <ExternalLink size={13} /> Open
                </a>
              )}
            </div>

            {/* Interactive panel or install info */}
            {TOOL_PANELS[selectedTool.id]
              ? (
                <>
                  {(selectedTool.status === 'offline' || selectedTool.status === 'unavailable') && selectedTool.install && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 6 }}>
                        ⚠ {selectedTool.status === 'offline' ? 'Service is offline — start it first.' : 'Not installed. Install with:'}
                      </div>
                      <InstallPanel install={selectedTool.install} />
                    </div>
                  )}
                  {TOOL_PANELS[selectedTool.id](selectedTool)}
                </>
              )
              : selectedTool.install && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                    {selectedTool.status === 'unavailable' ? 'Install:' : selectedTool.status === 'offline' ? 'Start with:' : 'Setup:'}
                  </div>
                  <InstallPanel install={selectedTool.install} />
                </div>
              )
            }
          </div>
        )}

      </div>
    </div>
  )
}
