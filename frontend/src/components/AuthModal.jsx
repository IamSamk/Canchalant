import { useState } from 'react'
import { X, Lock, Mail, User, Loader, ShieldCheck } from 'lucide-react'
import { login, register } from '../api'

export default function AuthModal({ isOpen, onClose, onSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let data
      if (isSignUp) {
        data = await register(email, password, name)
      } else {
        data = await login(email, password)
      }
      if (onSuccess) {
        onSuccess(data.user)
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Authentication error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-black border border-white/15 rounded-2xl p-7 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1 rounded text-white/40 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center">
              <ShieldCheck size={13} className="text-white" />
            </span>
            <span className="text-[12px] font-mono tracking-widest uppercase text-white/50">
              ATLAS VAULT SECURITY
            </span>
          </div>
          <h3 className="text-xl font-semibold text-white tracking-tight">
            {isSignUp ? 'Create Private Vault' : 'Access Private Vault'}
          </h3>
          <p className="text-[13px] text-white/50 mt-1 font-sans">
            {isSignUp
              ? 'Your captures will be encrypted and accessible only to your account.'
              : 'Sign in to decrypt and browse your private candid memory vault.'}
          </p>
        </div>

        {/* Mode Switch Tabs */}
        <div className="flex items-center p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.08] mb-5">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false)
              setError('')
            }}
            className={`flex-1 py-1.5 rounded-md text-[12px] font-medium transition-all ${
              !isSignUp ? 'bg-white text-black font-semibold' : 'text-white/50 hover:text-white'
            }`}
          >
            SIGN IN
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true)
              setError('')
            }}
            className={`flex-1 py-1.5 rounded-md text-[12px] font-medium transition-all ${
              isSignUp ? 'bg-white text-black font-semibold' : 'text-white/50 hover:text-white'
            }`}
          >
            CREATE ACCOUNT
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-white/[0.04] border border-white/20 text-[12px] font-mono text-white/90">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isSignUp && (
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-white/50 block mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User size={15} className="absolute top-1/2 -translate-y-1/2 left-3 text-white/30" />
                <input
                  type="text"
                  placeholder="e.g. Samarth"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-black border border-white/15 text-[13px] text-white placeholder-white/25 focus:outline-none focus:border-white transition-all font-sans"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-white/50 block mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail size={15} className="absolute top-1/2 -translate-y-1/2 left-3 text-white/30" />
              <input
                id="auth-email-input"
                type="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-black border border-white/15 text-[13px] text-white placeholder-white/25 focus:outline-none focus:border-white transition-all font-sans"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-white/50 block mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock size={15} className="absolute top-1/2 -translate-y-1/2 left-3 text-white/30" />
              <input
                id="auth-password-input"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-black border border-white/15 text-[13px] text-white placeholder-white/25 focus:outline-none focus:border-white transition-all font-sans"
              />
            </div>
          </div>

          <button
            id="auth-submit-button"
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-lg text-[13px] font-semibold bg-white text-black hover:bg-white/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 font-sans"
          >
            {loading && <Loader size={14} className="animate-spin" />}
            <span>{isSignUp ? 'CREATE ACCOUNT & OPEN VAULT' : 'SIGN IN TO VAULT'}</span>
          </button>
        </form>

        {/* Footer Note */}
        <p className="text-[11px] font-mono text-white/30 text-center mt-5">
          CREDENTIALS SECURED VIA BCRYPT & ATLAS CLOUD
        </p>
      </div>
    </div>
  )
}
