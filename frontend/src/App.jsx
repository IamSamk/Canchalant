import { useState, useEffect } from 'react'
import { Camera, LayoutGrid } from 'lucide-react'
import CameraView from './components/CameraView'
import Gallery from './components/Gallery'
import { getGallery, healthCheck } from './api'

export default function App() {
  const [activeTab, setActiveTab] = useState('camera')
  const [memoryCount, setMemoryCount] = useState(0)

  useEffect(() => {
    async function loadStats() {
      try {
        const [gData] = await Promise.all([
          getGallery(1, 1).catch(() => ({ total: 0 })),
          healthCheck().catch(() => ({})),
        ])
        if (gData && typeof gData.total === 'number') {
          setMemoryCount(gData.total)
        }
      } catch (e) {
        console.error('App init error:', e)
      }
    }
    loadStats()
  }, [activeTab])

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-black">
        <div className="w-full px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold tracking-[-0.02em]">
              Canchalant
            </span>
            <span className="text-[11px] font-mono text-white/30 hidden sm:inline">
              candid memory assistant
            </span>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <button
              id="nav-camera"
              onClick={() => setActiveTab('camera')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150 ${
                activeTab === 'camera'
                  ? 'bg-white text-black'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              <Camera size={14} />
              <span>Studio</span>
            </button>

            <button
              id="nav-gallery"
              onClick={() => setActiveTab('gallery')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150 ${
                activeTab === 'gallery'
                  ? 'bg-white text-black'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              <LayoutGrid size={14} />
              <span>Vault</span>
              {memoryCount > 0 && (
                <span className={`text-[11px] font-mono ${
                  activeTab === 'gallery' ? 'text-black/60' : 'text-white/30'
                }`}>
                  {memoryCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────── */}
      <main className="flex-1 w-full overflow-x-hidden">
        {activeTab === 'camera' && (
          <CameraView onMomentCaptured={() => setMemoryCount(c => c + 1)} onSwitchToGallery={() => setActiveTab('gallery')} />
        )}
        {activeTab === 'gallery' && (
          <Gallery onCountChange={setMemoryCount} />
        )}
      </main>
    </div>
  )
}
