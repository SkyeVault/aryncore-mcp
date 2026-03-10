import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Chat } from './pages/Chat'
import { ModelManager } from './pages/ModelManager'
import { Servers } from './pages/Servers'
import { N8nHub } from './pages/N8nHub'
import { ToolLibrary } from './pages/ToolLibrary'
import { WorkflowBuilder } from './pages/WorkflowBuilder'
import { Deploy } from './pages/Deploy'
import { P2PChat } from './pages/P2PChat'
import { useAppStore } from './store/useAppStore'
import { getServers, getN8nInstances, getTools } from './lib/api'

function AppInner() {
  const { setServers, setN8nInstances, setTools } = useAppStore()

  useEffect(() => {
    // Bootstrap global data
    getServers().then(setServers).catch(() => {})
    getN8nInstances().then(setN8nInstances).catch(() => {})
    getTools().then(setTools).catch(() => {})
  }, [setServers, setN8nInstances, setTools])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/models" element={<ModelManager />} />
          <Route path="/servers" element={<Servers />} />
          <Route path="/n8n" element={<N8nHub />} />
          <Route path="/tools" element={<ToolLibrary />} />
          <Route path="/builder" element={<WorkflowBuilder />} />
          <Route path="/publish" element={<Deploy />} />
          <Route path="/p2p" element={<P2PChat />} />
        </Routes>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}
