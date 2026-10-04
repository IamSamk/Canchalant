import { useState, useEffect } from 'react'
import {
  Camera,
  Sparkles,
  Database,
  Cloud,
  Cpu,
  HeartHandshake,
  LayoutGrid
} from 'lucide-react'
import CameraView from './components/CameraView'
import Gallery from './components/Gallery'
import { getGallery, healthCheck } from './api'

export default function App() {
  const [activeTab, setActiveTab] = useState('camera')
  const [memoryCount, setMemoryCount] = useState(0)
  const [healthStatus, setHealthStatus] = useState({
    mongodb: 'checking',
    cloudinary: 'checking',
    device: 'checking',
  })

  // Poll health and count on mount
  useEffect(() => {
    async function loadStats() {
      try {
        const [gData, hData] = await Promise.all([
          getGallery(1, 1).catch(() => ({ total: 0 })),
          healthCheck().catch(() => ({})),
        ])
        if (gData && typeof gData.total === 'number') {
          setMemoryCount(gData.total)
        }
        if (hData) {
          setHealthStatus(hData)
        }
      } catch (e) {
        console.error('App init error:', e)
      }
    }
    loadStats()
  }, [activeTab])

  return (
    <div className="min-h-screen flex flex-col bg-[#07070b] text-slate-100 selection:bg-purple-600 selection:text-white">
      {/* ── Top Header Navigation ────────────────────────── */}
      <header className="sticky top-0 z-50 glass-panel border-b border-white/10 px-4 md:px-8 py-3.5 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gradient-to-br from-violet-500 via-indigo-500 to-sky-400 shadow-[0_0_20px_rgba(139,92,246,0.35)]">
            <HeartHandshake size={20} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg md:text-xl font-bold tracking-tight text-gradient-brand">
                Canchalant
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-wide bg-violet-500/15 border border-violet-500/30 text-violet-300">
                PaliGemma + Atlas
              </span>
            </div>
            <p className="text-xs text-slate-400 tracking-wide">
              Candid + Nonchalant Memory Assistant
            </p>
          </div>
        </div>

        {/* Live Service Status (Desktop) */}
        <div className="hidden lg:flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-white/10 text-slate-300">
            <Database size={13} className={healthStatus.mongodb === 'connected' ? 'text-emerald-400' : 'text-amber-400'} />
            <span>Atlas:</span>
            <span className={healthStatus.mongodb === 'connected' ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
              {healthStatus.mongodb === 'connected' ? 'Online' : 'Standby'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-white/10 text-slate-300">
            <Cloud size={13} className="text-sky-400" />
            <span>Cloudinary:</span>
            <span className="text-sky-400 font-semibold">Active</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-white/10 text-slate-300">
            <Cpu size={13} className="text-violet-400" />
            <span>CUDA:</span>
            <span className="text-violet-400 font-semibold">{healthStatus.device?.toUpperCase() || 'GPU'}</span>
          </div>
        </div>

        {/* Main View Mode Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/90 border border-white/10 shadow-inner">
          <button
            id="nav-camera"
            onClick={() => setActiveTab('camera')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-medium transition-all duration-300 ${
              activeTab === 'camera'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_16px_rgba(139,92,246,0.45)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Camera size={16} />
            <span>Studio</span>
          </button>

          <button
            id="nav-gallery"
            onClick={() => setActiveTab('gallery')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-medium transition-all duration-300 ${
              activeTab === 'gallery'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_16px_rgba(139,92,246,0.45)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <LayoutGrid size={16} />
            <span>Vault</span>
            {memoryCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono font-bold ${
                activeTab === 'gallery' ? 'bg-white/20 text-white' : 'bg-violet-500/20 text-violet-300'
              }`}>
                {memoryCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Content View ─────────────────────────────────── */}
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
