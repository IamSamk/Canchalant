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
    <div className="min-h-screen flex flex-col bg-black text-white font-sans">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/95 backdrop-blur-md">
        <div className="w-full max-w-[1600px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold tracking-tight text-white">
              Canchalant
            </span>
            <span className="text-xs text-white/40 hidden sm:inline">
              candid memory assistant
            </span>
          </div>

          {/* Navigation & Controls */}
          <div className="flex items-center gap-4">
            {/* Tab Switcher */}
            <div className="flex items-center p-1 rounded-lg bg-white/[0.04] border border-white/10">
              <button
                id="nav-camera"
                onClick={() => setActiveTab('camera')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === 'camera'
                    ? 'bg-white text-black'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Camera size={14} />
                <span>Studio</span>
              </button>

              <button
                id="nav-gallery"
                onClick={() => setActiveTab('gallery')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === 'gallery'
                    ? 'bg-white text-black'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <LayoutGrid size={14} />
                <span>Vault</span>
                {user && memoryCount > 0 && (
                  <span className={`text-xs ml-1 ${
                    activeTab === 'gallery' ? 'text-black/70 font-semibold' : 'text-white/40'
                  }`}>
                    {memoryCount}
                  </span>
                )}
              </button>
            </div>

            {/* Auth Profile / Sign In Button */}
            {user ? (
              <div className="flex items-center gap-2.5 pl-3 border-l border-white/10">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/10">
                  <UserIcon size={13} className="text-white/50" />
                  <span className="text-xs text-white/80 max-w-[120px] truncate">
                    {user.name || user.email.split('@')[0]}
                  </span>
                </div>
                <button
                  id="btn-signout"
                  onClick={handleSignOut}
                  title="Sign out of private vault"
                  className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <button
                id="btn-signin"
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium bg-white text-black hover:bg-white/90 transition-all"
              >
                <Shield size={13} />
                <span>Sign in</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main View Stage ─────────────────────────────────── */}
      <main className="flex-1 w-full">
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
