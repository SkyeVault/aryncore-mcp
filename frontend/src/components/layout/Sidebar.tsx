import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, MessageSquare, Cpu, Server, Workflow,
  Wrench, GitBranch, Upload, Radio,
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chat', icon: MessageSquare, label: 'Chat' },
  { to: '/models', icon: Cpu, label: 'Models' },
  { to: '/servers', icon: Server, label: 'Servers' },
  { to: '/n8n', icon: Workflow, label: 'n8n Hub' },
  { to: '/tools', icon: Wrench, label: 'Tools' },
  { to: '/builder', icon: GitBranch, label: 'Builder' },
  { to: '/publish', icon: Upload, label: 'Publish' },
  { to: '/p2p', icon: Radio, label: 'P2P Chat' },
]

export function Sidebar() {
  const status     = useAppStore(s => s.status)
  const p2pUnread  = useAppStore(s => s.p2pUnread)
  const p2pTotal   = Object.values(p2pUnread).reduce((a, b) => a + b, 0)

  return (
    <aside style={{
      width: 64,
      minHeight: '100vh',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 16,
      gap: 4,
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: 'var(--accent)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 16, color: '#fff',
        marginBottom: 16,
      }}>A</div>

      {/* Nav */}
      {NAV.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          title={label}
          style={({ isActive }) => ({
            width: 44, height: 44,
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
            background: isActive ? 'rgba(124,110,247,0.12)' : 'transparent',
            textDecoration: 'none',
            transition: 'all 0.15s',
            position: 'relative',
          })}
        >
          <Icon size={20} />
          {to === '/p2p' && p2pTotal > 0 && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              minWidth: 16, height: 16, borderRadius: 8,
              background: 'var(--danger)', color: '#fff',
              fontSize: 10, fontWeight: 700, lineHeight: '16px',
              textAlign: 'center', padding: '0 3px',
            }}>
              {p2pTotal > 99 ? '99+' : p2pTotal}
            </span>
          )}
        </NavLink>
      ))}

      {/* Status dot */}
      <div style={{ marginTop: 'auto', marginBottom: 12 }}>
        <div
          title={status?.ollama ? 'Ollama online' : 'Ollama offline'}
          style={{
            width: 10, height: 10, borderRadius: '50%',
            background: status?.ollama ? 'var(--success)' : 'var(--danger)',
          }}
        />
      </div>
    </aside>
  )
}
