import { useState } from 'react'
import { Camera, Images, Heart } from 'lucide-react'
import CameraView from './components/CameraView'
import Gallery from './components/Gallery'

const TABS = [
  { id: 'camera', label: 'Camera', icon: Camera },
  { id: 'gallery', label: 'Memories', icon: Images },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('camera')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Header ──────────────────────────────────────────── */}
      <header
        className="glass sticky top-0 z-50 px-6 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <Heart size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight gradient-text">
              Canchalant
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Candid + Nonchalant
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`tab-${id}`}
              onClick={() => setActiveTab(id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: activeTab === id ? 'var(--gradient-primary)' : 'transparent',
                color: activeTab === id ? '#fff' : 'var(--text-secondary)',
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Main Content ────────────────────────────────────── */}
      <main className="flex-1">
        {activeTab === 'camera' && <CameraView />}
        {activeTab === 'gallery' && <Gallery />}
      </main>
    </div>
  )
}
