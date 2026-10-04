import { useState, useEffect } from 'react'
import { Camera, LayoutGrid, LogOut, User as UserIcon, Shield } from 'lucide-react'
import CameraView from './components/CameraView'
import Gallery from './components/Gallery'
import AuthModal from './components/AuthModal'
import { getGallery, getMe, clearToken } from './api'

export default function App() {
  const [activeTab, setActiveTab] = useState('camera')
  const [memoryCount, setMemoryCount] = useState(0)
  const [user, setUser] = useState(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  // Fetch authenticated user profile on initial mount
  useEffect(() => {
    async function initAuth() {
      try {
        const profile = await getMe()
        if (profile) {
          setUser(profile)
        }
      } catch (err) {
        console.debug('No active session:', err)
      }
    }
    initAuth()
  }, [])

  // Sync stats when activeTab or user changes
  useEffect(() => {
    async function loadStats() {
      if (!user) {
        setMemoryCount(0)
        return
      }
      try {
        const gData = await getGallery(1, 1).catch(() => ({ total: 0 }))
        if (gData && typeof gData.total === 'number') {
          setMemoryCount(gData.total)
        }
      } catch (e) {
        console.error('App init error:', e)
      }
    }
    loadStats()
  }, [activeTab, user])

  const handleSignOut = () => {
    clearToken()
    setUser(null)
    setMemoryCount(0)
  }

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

          {/* Navigation & Controls */}
          <div className="flex items-center gap-3">
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
                {user && memoryCount > 0 && (
                  <span className={`text-[11px] font-mono ${
                    activeTab === 'gallery' ? 'text-black/60' : 'text-white/30'
                  }`}>
                    {memoryCount}
                  </span>
                )}
              </button>
            </div>

            {/* Auth Profile / Sign In Button */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-white/[0.08]">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.08]">
                  <UserIcon size={12} className="text-white/50" />
                  <span className="text-[11px] font-mono text-white/80 max-w-[120px] truncate">
                    {user.name || user.email.split('@')[0]}
                  </span>
                </div>
                <button
                  id="btn-signout"
                  onClick={handleSignOut}
                  title="Sign out of private vault"
                  className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button
                id="btn-signin"
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium bg-white text-black hover:bg-white/90 transition-all font-sans"
              >
                <Shield size={12} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────── */}
      <main className="flex-1 w-full overflow-x-hidden">
        {activeTab === 'camera' && (
          <CameraView
            user={user}
            onMomentCaptured={() => setMemoryCount(c => c + 1)}
            onSwitchToGallery={() => setActiveTab('gallery')}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}
        {activeTab === 'gallery' && (
          <Gallery
            user={user}
            onCountChange={setMemoryCount}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}
      </main>

      {/* ── Auth Modal ─────────────────────────────────────── */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={newUser => {
          setUser(newUser)
        }}
      />
    </div>
  )
}
