import { useCallback, useRef, useState } from 'react'
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Plus, Save, Play, Upload, Trash2, Square } from 'lucide-react'
import { TopBar } from '../components/layout/TopBar'
import { PERSONAS, useAppStore } from '../store/useAppStore'

// ── Palette definition ────────────────────────────────────────────────────────

const NODE_PALETTE = [
  { nodeType: 'input',  label: 'Input',           color: '#22c55e', desc: 'Starting text for the workflow' },
  { nodeType: 'llm',    label: 'LLM Chat',         color: '#7c6ef7', desc: 'Send text to an AI persona' },
  { nodeType: 'tts',    label: 'TortoiseTTS',      color: '#5eead4', desc: 'Convert text to speech' },
  { nodeType: 'sd',     label: 'Stable Diffusion', color: '#fb923c', desc: 'Generate image from text' },
  { nodeType: 'n8n',    label: 'n8n Webhook',      color: '#3b82f6', desc: 'Trigger an n8n webhook' },
  { nodeType: 'output', label: 'Output',           color: '#ef4444', desc: 'Display the final result' },
]

const DEFAULT_CONFIG: Record<string, Record<string, unknown>> = {
  input:  { value: '' },
  llm:    { persona: 'central', model: 'mistral', server_host: 'localhost', server_port: 11434 },
  tts:    { voice: 'random' },
  sd:     { use_input: true, prompt: '', negative_prompt: '', steps: 20, width: 512, height: 512, cfg_scale: 7.0 },
  n8n:    { webhook_path: '/webhook/test', instance_id: 1, pass_input: true },
  output: {},
}

// ── Custom node visual ────────────────────────────────────────────────────────

type ExecStatus = 'idle' | 'running' | 'done' | 'error'

function WorkflowNode({ data, selected }: NodeProps) {
  const { label, color, nodeType, execStatus, execOutput } = data
  const statusBadge =
    execStatus === 'running' ? '⏳'
    : execStatus === 'done'  ? '✓'
    : execStatus === 'error' ? '✗'
    : null

  return (
    <div style={{
      background: color,
      border: `2px solid ${selected ? '#fff' : 'transparent'}`,
      borderRadius: 10,
      padding: '10px 14px',
      minWidth: 130,
      boxShadow: execStatus === 'running' ? `0 0 18px ${color}` : '0 4px 12px rgba(0,0,0,0.35)',
      transition: 'box-shadow 0.25s',
    }}>
      {nodeType !== 'input' && (
        <Handle type="target" position={Position.Left}
          style={{ background: 'rgba(255,255,255,0.55)', width: 10, height: 10 }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: '#fff', flex: 1 }}>{label}</span>
        {statusBadge && <span style={{ fontSize: 13 }}>{statusBadge}</span>}
      </div>
      {execStatus === 'running' && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>Running…</div>
      )}
      {(execStatus === 'done' || execStatus === 'error') && execOutput && (
        <div style={{
          fontSize: 9, marginTop: 4, maxWidth: 160, wordBreak: 'break-word', lineHeight: 1.4,
          color: execStatus === 'error' ? '#fca5a5' : 'rgba(255,255,255,0.85)',
        }}>
          {String(execOutput).slice(0, 100)}{String(execOutput).length > 100 ? '…' : ''}
        </div>
      )}
      {nodeType !== 'output' && (
        <Handle type="source" position={Position.Right}
          style={{ background: 'rgba(255,255,255,0.55)', width: 10, height: 10 }} />
      )}
    </div>
  )
}

const NODE_TYPES = { workflowNode: WorkflowNode }

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNode(nodeType: string, position = { x: 200, y: 200 }): Node {
  const def = NODE_PALETTE.find(d => d.nodeType === nodeType)!
  return {
    id: `${nodeType}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    type: 'workflowNode',
    position,
    data: {
      label: def.label,
      color: def.color,
      nodeType,
      config: structuredClone(DEFAULT_CONFIG[nodeType] ?? {}),
      execStatus: 'idle',
      execOutput: null,
    },
  }
}

const INITIAL_NODES: Node[] = [
  makeNode('input',  { x: 60,  y: 200 }),
  makeNode('llm',    { x: 280, y: 200 }),
  makeNode('output', { x: 500, y: 200 }),
]

/** Topological sort — returns node IDs in execution order. */
function topoSort(nodes: Node[], edges: Edge[]): string[] {
  const adj: Record<string, string[]> = {}
  const inDeg: Record<string, number> = {}
  for (const n of nodes) { adj[n.id] = []; inDeg[n.id] = 0 }
  for (const e of edges) {
    adj[e.source].push(e.target)
    inDeg[e.target] = (inDeg[e.target] ?? 0) + 1
  }
  const queue = nodes.filter(n => inDeg[n.id] === 0).map(n => n.id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const next of adj[id]) {
      if (--inDeg[next] === 0) queue.push(next)
    }
  }
  return order
}

// ── Shared button style ───────────────────────────────────────────────────────

const btn: React.CSSProperties = {
  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: 6, padding: '6px 8px', cursor: 'pointer',
  fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 4, marginBottom: 5,
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: 6, padding: '5px 8px', fontSize: 11,
  boxSizing: 'border-box',
}

const label11: React.CSSProperties = {
  display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3,
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function WorkflowBuilder() {
  const servers = useAppStore(s => s.servers)

  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [workflowName, setWorkflowName] = useState('My Workflow')
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const loadRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef(false)

  const selectedNode = nodes.find(n => n.id === selectedId) ?? null

  const onConnect = useCallback(
    (p: Connection) => setEdges(es => addEdge({
      ...p, animated: true,
      style: { stroke: '#7c6ef7', strokeWidth: 2 },
    }, es)),
    [setEdges],
  )

  // ── Node config helpers ─────────────────────────────────────────────────────

  const updateConfig = (key: string, value: unknown) => {
    if (!selectedId) return
    setNodes(ns => ns.map(n =>
      n.id !== selectedId ? n
        : { ...n, data: { ...n.data, config: { ...n.data.config, [key]: value } } }
    ))
  }

  const deleteSelected = () => {
    if (!selectedId) return
    setNodes(ns => ns.filter(n => n.id !== selectedId))
    setEdges(es => es.filter(e => e.source !== selectedId && e.target !== selectedId))
    setSelectedId(null)
  }

  // ── Execution engine ────────────────────────────────────────────────────────

  const setExec = (id: string, execStatus: ExecStatus, execOutput: string | null = null) =>
    setNodes(ns => ns.map(n => n.id !== id ? n : { ...n, data: { ...n.data, execStatus, execOutput } }))

  const resetExec = () =>
    setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, execStatus: 'idle', execOutput: null } })))

  const runWorkflow = async () => {
    resetExec()
    setLog([])
    setRunning(true)
    abortRef.current = false

    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))
    const order = topoSort(nodes, edges)
    const outputs: Record<string, string> = {}

    // Build predecessors map
    const preds: Record<string, string[]> = {}
    for (const e of edges) {
      if (!preds[e.target]) preds[e.target] = []
      preds[e.target].push(e.source)
    }

    const addLog = (msg: string) => setLog(prev => [...prev, msg])

    for (const id of order) {
      if (abortRef.current) { addLog('— Stopped —'); break }
      const node = nodeMap[id]
      if (!node) continue

      const { nodeType, config } = node.data
      const predInput = (preds[id] ?? []).map(pid => outputs[pid]).filter(Boolean).join('\n')

      setExec(id, 'running')
      addLog(`▶ ${node.data.label}`)

      try {
        let out = ''

        if (nodeType === 'input') {
          out = config.value as string || ''
          addLog(`  → "${out.slice(0, 80)}${out.length > 80 ? '…' : ''}"`)

        } else if (nodeType === 'output') {
          out = predInput
          addLog(`  → "${out.slice(0, 120)}${out.length > 120 ? '…' : ''}"`)

        } else if (nodeType === 'llm') {
          const r = await fetch('/api/chat/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: predInput || '(no input)',
              persona: config.persona ?? 'central',
              model: config.model ?? 'mistral',
              server_host: config.server_host ?? 'localhost',
              server_port: config.server_port ?? 11434,
            }),
          })
          if (!r.ok) throw new Error(await r.text())
          const data = await r.json()
          out = data.response ?? ''
          addLog(`  → ${out.length} chars`)

        } else if (nodeType === 'tts') {
          const r = await fetch('/api/tools/tortoise_tts/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: predInput, voice: config.voice ?? 'random' }),
          })
          if (!r.ok) throw new Error(await r.text())
          out = JSON.stringify(await r.json())
          addLog(`  → TTS generated`)

        } else if (nodeType === 'sd') {
          const prompt = config.use_input ? (predInput || String(config.prompt)) : String(config.prompt)
          const r = await fetch('/api/tools/stable_diffusion/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              negative_prompt: config.negative_prompt ?? '',
              steps: config.steps ?? 20,
              width: config.width ?? 512,
              height: config.height ?? 512,
              cfg_scale: config.cfg_scale ?? 7.0,
            }),
          })
          if (!r.ok) throw new Error(await r.text())
          const data = await r.json()
          out = `[image] ${data.images?.length ?? 0} image(s) generated`
          addLog(`  → ${out}`)

        } else if (nodeType === 'n8n') {
          const payload = config.pass_input ? { input: predInput } : {}
          const r = await fetch('/api/n8n/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instance_id: config.instance_id ?? 1,
              webhook_path: config.webhook_path ?? '/webhook/test',
              payload,
            }),
          })
          if (!r.ok) throw new Error(await r.text())
          out = JSON.stringify(await r.json())
          addLog(`  → n8n: ${out.slice(0, 80)}`)

        } else {
          out = predInput
        }

        outputs[id] = out
        setExec(id, 'done', out)

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        addLog(`  ✗ ${msg.slice(0, 120)}`)
        setExec(id, 'error', msg)
      }
    }

    if (!abortRef.current) addLog('— Done —')
    setRunning(false)
  }

  // ── Save / Load ─────────────────────────────────────────────────────────────

  const saveWorkflow = () => {
    const blob = new Blob(
      [JSON.stringify({ name: workflowName, nodes, edges }, null, 2)],
      { type: 'application/json' }
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${workflowName.replace(/\s+/g, '-')}.json`
    a.click()
  }

  const loadWorkflow = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target?.result as string)
        if (d.name) setWorkflowName(d.name)
        if (d.nodes) setNodes(d.nodes)
        if (d.edges) setEdges(d.edges)
        setLog([`Loaded: ${d.name ?? file.name}`])
      } catch {
        setLog(['Error: invalid workflow JSON'])
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const clearCanvas = () => {
    setNodes([makeNode('input', { x: 60, y: 200 }), makeNode('llm', { x: 280, y: 200 }), makeNode('output', { x: 500, y: 200 })])
    setEdges([])
    setLog([])
    setSelectedId(null)
  }

  // ── Config panel (inline JSX, not a component, to avoid remount/focus loss) ─

  const serverHostOptions = ['localhost', '162.248.7.248', ...servers.map(s => s.host)]

  const configPanel = (() => {
    if (!selectedNode) return (
      <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>
        Click a node on the canvas to configure it.
        <div style={{ marginTop: 12, fontSize: 11 }}>
          <strong style={{ color: 'var(--text)' }}>Tips</strong>
          <ul style={{ paddingLeft: 14, marginTop: 6 }}>
            <li>Drag nodes to rearrange</li>
            <li>Connect outputs → inputs by dragging between handles</li>
            <li>Each node passes its output text to connected nodes</li>
            <li>Run executes nodes in order from Input to Output</li>
          </ul>
        </div>
      </div>
    )

    const { nodeType, config, label, execOutput } = selectedNode.data

    return (
      <div style={{ padding: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 12 }}>
          {label}
        </div>

        {nodeType === 'input' && (
          <>
            <label style={label11}>Input Text</label>
            <textarea
              value={String(config.value ?? '')}
              rows={5}
              placeholder="Enter text that flows into the workflow…"
              onChange={e => updateConfig('value', e.target.value)}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              This text is passed as input to all connected nodes.
            </div>
          </>
        )}

        {nodeType === 'llm' && (
          <>
            <label style={label11}>Persona</label>
            <select value={String(config.persona ?? 'central')} onChange={e => updateConfig('persona', e.target.value)} style={{ ...inputStyle, marginBottom: 8 }}>
              {PERSONAS.map(p => <option key={p.id} value={p.id}>{p.name} — {p.role}</option>)}
            </select>

            <label style={label11}>Model</label>
            <input value={String(config.model ?? 'mistral')} onChange={e => updateConfig('model', e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} placeholder="mistral" />

            <label style={label11}>Server Host</label>
            <select value={String(config.server_host ?? 'localhost')} onChange={e => updateConfig('server_host', e.target.value)} style={{ ...inputStyle, marginBottom: 8 }}>
              {[...new Set(serverHostOptions)].map(h => <option key={h} value={h}>{h}</option>)}
            </select>

            <label style={label11}>Server Port</label>
            <input type="number" value={Number(config.server_port ?? 11434)} onChange={e => updateConfig('server_port', Number(e.target.value))} style={{ ...inputStyle, marginBottom: 4 }} />

            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              Receives text from previous node as the prompt.
            </div>
          </>
        )}

        {nodeType === 'tts' && (
          <>
            <label style={label11}>Voice</label>
            <select value={String(config.voice ?? 'random')} onChange={e => updateConfig('voice', e.target.value)} style={{ ...inputStyle, marginBottom: 8 }}>
              {['random', 'train_lescault', 'emma', 'geralt', 'halle', 'mol', 'tim_reynolds'].map(v =>
                <option key={v} value={v}>{v}</option>
              )}
            </select>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              TortoiseTTS must be running on port 5003. Input text from the previous node is spoken.
            </div>
          </>
        )}

        {nodeType === 'sd' && (
          <>
            <label style={{ ...label11, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <input type="checkbox" checked={!!config.use_input} onChange={e => updateConfig('use_input', e.target.checked)} />
              Use incoming text as prompt
            </label>
            {!config.use_input && (
              <>
                <label style={label11}>Prompt</label>
                <textarea value={String(config.prompt ?? '')} rows={3} onChange={e => updateConfig('prompt', e.target.value)} style={{ ...inputStyle, resize: 'vertical', marginBottom: 8 }} />
              </>
            )}
            <label style={label11}>Negative Prompt</label>
            <textarea value={String(config.negative_prompt ?? '')} rows={2} onChange={e => updateConfig('negative_prompt', e.target.value)} style={{ ...inputStyle, resize: 'vertical', marginBottom: 8 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              {(['steps', 'width', 'height', 'cfg_scale'] as const).map(k => (
                <div key={k}>
                  <label style={label11}>{k}</label>
                  <input type="number" value={Number(config[k] ?? DEFAULT_CONFIG.sd[k])} onChange={e => updateConfig(k, Number(e.target.value))} style={inputStyle} />
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Stable Diffusion (A1111) must be running on port 7860.
            </div>
          </>
        )}

        {nodeType === 'n8n' && (
          <>
            <label style={label11}>Webhook Path</label>
            <input value={String(config.webhook_path ?? '/webhook/test')} onChange={e => updateConfig('webhook_path', e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} placeholder="/webhook/your-path" />

            <label style={label11}>n8n Instance ID</label>
            <input type="number" value={Number(config.instance_id ?? 1)} onChange={e => updateConfig('instance_id', Number(e.target.value))} style={{ ...inputStyle, marginBottom: 8 }} />

            <label style={{ ...label11, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <input type="checkbox" checked={!!config.pass_input} onChange={e => updateConfig('pass_input', e.target.checked)} />
              Pass input text as payload
            </label>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Triggers the webhook and passes the previous node's output as <code style={{ background: 'var(--surface2)', padding: '1px 3px', borderRadius: 3 }}>input</code> in the body.
            </div>
          </>
        )}

        {nodeType === 'output' && (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              Displays the final result. No configuration needed.
            </div>
            {execOutput && (
              <div style={{
                background: 'var(--surface2)', borderRadius: 6, padding: 10,
                fontSize: 11, color: 'var(--text)', whiteSpace: 'pre-wrap',
                wordBreak: 'break-word', maxHeight: 300, overflow: 'auto',
                border: '1px solid var(--border)',
              }}>
                {String(execOutput)}
              </div>
            )}
          </>
        )}

        <button onClick={deleteSelected} style={{ ...btn, marginTop: 14, color: '#f87171', borderColor: '#ef444433' }}>
          <Trash2 size={11} /> Delete Node
        </button>
      </div>
    )
  })()

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar title="Workflow Builder" />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left sidebar — palette + controls */}
        <div style={{
          width: 186, background: 'var(--surface)', borderRight: '1px solid var(--border)',
          padding: 12, overflow: 'auto', flexShrink: 0,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Add Nodes
          </div>
          {NODE_PALETTE.map(def => (
            <button key={def.nodeType} onClick={() => setNodes(ns => [...ns, makeNode(def.nodeType, { x: 80 + Math.random() * 320, y: 60 + Math.random() * 260 })])} title={def.desc}
              style={{ ...btn, background: `${def.color}18`, borderColor: `${def.color}44`, color: def.color, justifyContent: 'flex-start' }}>
              <Plus size={11} /> {def.label}
            </button>
          ))}

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 10 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Workflow
            </div>
            <input
              value={workflowName}
              onChange={e => setWorkflowName(e.target.value)}
              style={{ ...inputStyle, marginBottom: 6 }}
            />
            <button onClick={saveWorkflow} style={btn}><Save size={11} /> Save JSON</button>
            <button onClick={() => loadRef.current?.click()} style={btn}><Upload size={11} /> Load JSON</button>
            <input ref={loadRef} type="file" accept=".json" style={{ display: 'none' }} onChange={loadWorkflow} />
            <button onClick={clearCanvas} style={{ ...btn, color: '#fb923c', borderColor: '#fb923c33' }}>
              <Trash2 size={11} /> Clear
            </button>

            {running
              ? <button onClick={() => { abortRef.current = true }} style={{ ...btn, background: '#ef444420', borderColor: '#ef4444', color: '#ef4444' }}>
                  <Square size={11} /> Stop
                </button>
              : <button onClick={runWorkflow} style={{ ...btn, background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff', fontWeight: 700 }}>
                  <Play size={11} /> Run Workflow
                </button>
            }
          </div>

          {/* Execution log */}
          {log.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 4 }}>Log</div>
              <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: 8, maxHeight: 200, overflow: 'auto' }}>
                {log.map((l, i) => (
                  <div key={i} style={{
                    fontSize: 10, marginBottom: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    color: l.includes('✗') ? '#f87171' : l.startsWith('  →') ? 'var(--text)' : 'var(--text-muted)',
                  }}>{l}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div style={{ flex: 1 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
            style={{ background: '#0d0d0f' }}
          >
            <Background color="#2a2a35" gap={20} />
            <Controls style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }} />
            <MiniMap
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              nodeColor={n => n.data?.color ?? '#7c6ef7'}
            />
          </ReactFlow>
        </div>

        {/* Right sidebar — config panel */}
        <div style={{
          width: 230, background: 'var(--surface)', borderLeft: '1px solid var(--border)',
          overflow: 'auto', flexShrink: 0,
        }}>
          {configPanel}
        </div>

      </div>
    </div>
  )
}
