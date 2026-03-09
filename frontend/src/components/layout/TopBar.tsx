import { useAppStore, PERSONAS } from '../../store/useAppStore'

export function TopBar({ title }: { title: string }) {
  const { activePersona, setActivePersona, activeModel, setActiveModel, status } = useAppStore()
  const persona = PERSONAS.find(p => p.id === activePersona)

  return (
    <header style={{
      height: 52,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 16,
      flexShrink: 0,
    }}>
      <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15 }}>{title}</span>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* GPU badge */}
        {status?.gpu?.available && (
          <div style={{ fontSize: 11, color: 'var(--accent2)', background: 'rgba(94,234,212,0.1)', padding: '2px 8px', borderRadius: 4 }}>
            GPU {status.gpu.utilization}% · {status.gpu.memory_used}MB
          </div>
        )}

        {/* Persona picker */}
        <select
          value={activePersona}
          onChange={e => setActivePersona(e.target.value)}
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            color: persona?.color ?? 'var(--text)',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {PERSONAS.map(p => (
            <option key={p.id} value={p.id}>{p.name} · {p.role}</option>
          ))}
        </select>

        {/* Model input */}
        <input
          value={activeModel}
          onChange={e => setActiveModel(e.target.value)}
          placeholder="model name"
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 12,
            width: 120,
          }}
        />
      </div>
    </header>
  )
}
