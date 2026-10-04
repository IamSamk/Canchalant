import { useState } from 'react'
import { X, Loader } from 'lucide-react'
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
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] bg-[#0c0c0c] border border-white/15 rounded-2xl p-8 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-1 rounded-md text-white/40 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <p className="text-xs font-normal tracking-wide text-white/50 mb-1.5 uppercase">
            Atlas Vault Security
          </p>
          <h3 className="text-xl font-medium text-white tracking-tight">
            {isSignUp ? 'Create private vault' : 'Access private vault'}
          </h3>
          <p className="text-sm text-white/55 mt-1 leading-relaxed">
            {isSignUp
              ? 'Your captures will be isolated and encrypted for your account.'
              : 'Sign in to access your personal candid memory vault.'}
          </p>
        </div>

        {/* Mode Switch Tabs */}
        <div className="flex p-1 rounded-lg bg-white/[0.04] border border-white/10 mb-6">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false)
              setError('')
            }}
            className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
              !isSignUp ? 'bg-white text-black font-semibold' : 'text-white/50 hover:text-white'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true)
              setError('')
            }}
            className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
              isSignUp ? 'bg-white text-black font-semibold' : 'text-white/50 hover:text-white'
            }`}
          >
            Create account
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-5 p-3 rounded-lg bg-white/[0.06] border border-white/20 text-xs text-white leading-relaxed">
            {error}
          </div>
        )}

        {/* Form Fields with Generous Spacing */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isSignUp && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-white/70">
                Full name
              </label>
              <input
                type="text"
                placeholder="e.g. Samarth"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg bg-[#111111] border border-white/15 text-sm text-white placeholder-white/30 focus:border-white focus:outline-none transition-colors"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/70">
              Email address
            </label>
            <input
              id="auth-email-input"
              type="email"
              required
              placeholder="you@domain.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full h-11 px-3.5 rounded-lg bg-[#111111] border border-white/15 text-sm text-white placeholder-white/30 focus:border-white focus:outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/70">
              Password
            </label>
            <input
              id="auth-password-input"
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full h-11 px-3.5 rounded-lg bg-[#111111] border border-white/15 text-sm text-white placeholder-white/30 focus:border-white focus:outline-none transition-colors"
            />
          </div>

          <button
            id="auth-submit-button"
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-white/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading && <Loader size={15} className="animate-spin" />}
            <span>{isSignUp ? 'Create account' : 'Sign in to vault'}</span>
          </button>
        </form>

        <p className="text-xs text-white/35 text-center mt-6">
          Encrypted with bcrypt on MongoDB Atlas
        </p>
      </div>
    </div>
  )
}
