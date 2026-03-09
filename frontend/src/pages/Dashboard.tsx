import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/layout/TopBar'
import { useAppStore, PERSONAS } from '../store/useAppStore'
import { getStatus } from '../lib/api'

function StatusBadge({ online, label }: { online: boolean; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'var(--surface2)', borderRadius: 8,
      padding: '10px 14px',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: online ? 'var(--success)' : 'var(--danger)',
        flexShrink: 0,
      }} />
      <span style={{ color: 'var(--text)', fontSize: 13 }}>{label}</span>
    </div>
  )
}

export function Dashboard() {
  const { status, setStatus } = useAppStore()
  const navigate = useNavigate()

  useEffect(() => {
    const poll = async () => {
      try { setStatus(await getStatus()) } catch {}
    }
    poll()
    const id = setInterval(poll, 10000)
    return () => clearInterval(id)
  }, [setStatus])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar title="Dashboard" />
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

        {/* Service status */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Services
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {status ? (
              <>
                <StatusBadge online={status.ollama} label="Ollama" />
                <StatusBadge online={status.n8n} label="n8n" />
                <StatusBadge online={status.stable_diffusion} label="Stable Diffusion" />
                <StatusBadge online={status.tortoise_tts} label="TortoiseTTS" />
                <StatusBadge online={status.prometheus} label="Prometheus" />
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Checking services...</div>
            )}
          </div>
        </section>

        {/* GPU */}
        {status?.gpu?.available && (
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              GPU
            </h2>
            <div style={{
              background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)',
              padding: '16px 20px', display: 'flex', gap: 32,
            }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>GPU</div>
                <div style={{ color: 'var(--text)', fontWeight: 600 }}>{status.gpu.name}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Temp</div>
                <div style={{ color: 'var(--warning)', fontWeight: 600 }}>{status.gpu.temp}°C</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Utilization</div>
                <div style={{ color: 'var(--accent2)', fontWeight: 600 }}>{status.gpu.utilization}%</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>VRAM</div>
                <div style={{ color: 'var(--accent)', fontWeight: 600 }}>{status.gpu.memory_used} / {status.gpu.memory_total} MB</div>
              </div>
            </div>
          </section>
        )}

        {/* Quick launch personas */}
        <section>
          <h2 style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Quick Chat
          </h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {PERSONAS.map(p => (
              <button
                key={p.id}
                onClick={() => navigate('/chat', { state: { persona: p.id } })}
                style={{
                  background: 'var(--surface2)',
                  border: `1px solid ${p.color}44`,
                  color: p.color,
                  borderRadius: 10,
                  padding: '12px 20px',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  transition: 'all 0.15s',
                }}
              >
                {p.name}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
                  {p.role}
                </span>
              </button>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
