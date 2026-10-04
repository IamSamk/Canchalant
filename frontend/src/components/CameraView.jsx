import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Play,
  Pause,
  Camera,
  Zap,
  Eye,
  Settings,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader,
  Aperture,
  ScanLine,
  Upload,
  ExternalLink,
  Sliders,
  Sparkles,
  ArrowRight
} from 'lucide-react'
import { analyzeFrame, resolveImageUrl } from '../api'

const MODES = [
  {
    id: 'passive',
    label: 'Passive Ambient',
    desc: 'Hands-free ambient sentinel',
    icon: Eye,
    color: '#8b5cf6',
  },
  {
    id: 'manual',
    label: 'Manual Shutter',
    desc: 'Instant snap & emotion tag',
    icon: Camera,
    color: '#38bdf8',
  },
  {
    id: 'burst',
    label: 'Burst Candid Hunt',
    desc: 'Rapid 500ms candidate search',
    icon: Zap,
    color: '#f59e0b',
  },
]

const STATUS_CONFIG = {
  idle: { color: '#94a3b8', label: 'Standby', icon: Pause },
  scanning: { color: '#a78bfa', label: 'Sampling Frame...', icon: ScanLine },
  analyzing: { color: '#60a5fa', label: 'AI Classifying...', icon: Loader },
  captured: { color: '#34d399', label: 'Candid Captured!', icon: CheckCircle },
  rejected_blur: { color: '#f59e0b', label: 'Motion Blurred', icon: AlertCircle },
  rejected_posed: { color: '#fbbf24', label: 'Posed / Direct Stare', icon: XCircle },
  rejected_confidence: { color: '#f97316', label: 'Below Confidence', icon: AlertCircle },
  error: { color: '#ef4444', label: 'Inference Error', icon: XCircle },
}

export default function CameraView({ onMomentCaptured, onSwitchToGallery }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const intervalRef = useRef(null)

  const [stream, setStream] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [mode, setMode] = useState('passive')
  const [showControls, setShowControls] = useState(true)
  const [status, setStatus] = useState('idle')
  const [lastResult, setLastResult] = useState(null)
  const [captureCount, setCaptureCount] = useState(0)
  const [showFlash, setShowFlash] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Granular settings
  const [frameInterval, setFrameInterval] = useState(2.0)
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.65)
  const [blurThreshold, setBlurThreshold] = useState(80)

  // Start webcam
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setStream(mediaStream)
    } catch (err) {
      console.error('Camera access error:', err)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      setStream(null)
    }
  }, [stream])

  // Capture frame helper
  const captureFrame = useCallback(async () => {
    if (!videoRef.current || isAnalyzing) return

    const video = videoRef.current
    const canvas = canvasRef.current
    if (!canvas || video.readyState < 2) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    const base64 = dataUrl.split(',')[1]

    setIsAnalyzing(true)
    setStatus('analyzing')

    try {
      const result = await analyzeFrame(base64, {
        mode,
        confidenceThreshold,
        blurThreshold,
      })

      setLastResult(result)
      setStatus(result.status)

      if (result.status === 'captured') {
        setCaptureCount(c => c + 1)
        if (onMomentCaptured) onMomentCaptured()
        setShowFlash(true)
        setTimeout(() => setShowFlash(false), 450)
      }
    } catch (err) {
      console.error('Analysis error:', err)
      setStatus('error')
      setLastResult({ message: err.message })
    } finally {
      setIsAnalyzing(false)
    }
  }, [isAnalyzing, mode, confidenceThreshold, blurThreshold, onMomentCaptured])

  // File upload handler
  const handleFileUpload = e => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result
      const base64 = dataUrl.split(',')[1]

      setIsAnalyzing(true)
      setStatus('analyzing')

      try {
        const result = await analyzeFrame(base64, {
          mode: 'manual', // Force manual capture for uploaded pictures
          confidenceThreshold,
          blurThreshold: Math.min(blurThreshold, 40),
        })

        setLastResult(result)
        setStatus(result.status)

        if (result.status === 'captured') {
          setCaptureCount(c => c + 1)
          if (onMomentCaptured) onMomentCaptured()
          setShowFlash(true)
          setTimeout(() => setShowFlash(false), 450)
        }
      } catch (err) {
        setStatus('error')
        setLastResult({ message: err.message })
      } finally {
        setIsAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // Auto-capture cycle for passive/burst modes
  const startAutoCapture = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    const interval = mode === 'burst' ? 500 : frameInterval * 1000
    intervalRef.current = setInterval(() => {
      setStatus('scanning')
      captureFrame()
    }, interval)
    setIsRunning(true)
  }, [mode, frameInterval, captureFrame])

  const stopAutoCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsRunning(false)
    setStatus('idle')
  }, [])

  const toggleRunning = useCallback(() => {
    if (isRunning) {
      stopAutoCapture()
    } else if (mode === 'manual') {
      captureFrame()
    } else {
      startAutoCapture()
    }
  }, [isRunning, mode, startAutoCapture, stopAutoCapture, captureFrame])

  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
      stopAutoCapture()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isRunning && mode !== 'manual') {
      stopAutoCapture()
      startAutoCapture()
    }
  }, [frameInterval, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.idle
  const StatusIcon = statusConfig.icon

  return (
    <div className="w-full max-w-[1700px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row gap-6">
      {/* ── Main Viewfinder Stage ──────────────────────────── */}
      <div className="relative flex-1 rounded-3xl overflow-hidden glass-panel border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.7)] flex flex-col">
        {/* Flash Effect */}
        {showFlash && (
          <div className="absolute inset-0 bg-white camera-flash pointer-events-none z-30" />
        )}

        {/* Video Canvas Container */}
        <div className="relative w-full aspect-video min-h-[420px] lg:min-h-[580px] bg-slate-950 overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Reticle Focus Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Corner Optic Brackets */}
            <div className="absolute inset-12 md:inset-20 border border-white/10 rounded-2xl pointer-events-none">
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-violet-400" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-violet-400" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-violet-400" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-violet-400" />
            </div>

            {/* Scanning Radar Circle */}
            {isRunning && (
              <div className="relative flex items-center justify-center">
                <div className="w-36 h-36 rounded-full border border-violet-500/40 reticle-scan" />
                <div className="absolute w-24 h-24 rounded-full border border-sky-400/30 reticle-scan" style={{ animationDelay: '0.6s' }} />
                <div className="absolute w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_12px_#8b5cf6]" />
              </div>
            )}
          </div>

          {/* HUD Top Status Bar */}
          <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
            {/* Live Indicator */}
            <div className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-xl border border-white/10 shadow-lg">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: isRunning ? '#10b981' : '#64748b',
                  boxShadow: isRunning ? '0 0 10px #10b981' : 'none',
                }}
              />
              <span className="text-xs font-mono font-semibold" style={{ color: statusConfig.color }}>
                <StatusIcon size={13} className="inline mr-1.5 -mt-0.5" />
                {statusConfig.label}
              </span>
            </div>

            {/* Captured Photos Counter */}
            <div className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-xl border border-white/10 shadow-lg">
              <Aperture size={14} className="text-violet-400" />
              <span className="text-xs font-mono font-bold text-violet-300">
                {captureCount}
              </span>
              <span className="text-[11px] text-slate-400">candid captures</span>
            </div>
          </div>

          {/* Captured Moment Toast Overlay (Bottom Center) */}
          {lastResult && lastResult.moment && (
            <div className="absolute bottom-28 left-4 right-4 z-20 flex justify-center pointer-events-none">
              <div className="pointer-events-auto w-full max-w-xl p-4 rounded-2xl glass-panel-elevated border border-violet-500/40 shadow-2xl flex items-center gap-4 animate-fadeIn">
                <img
                  src={resolveImageUrl(lastResult.moment.cloudinary_url || lastResult.moment.filepath)}
                  alt="Captured moment preview"
                  className="w-16 h-16 rounded-xl object-cover border border-white/20 shadow-md shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="chip-base badge-specific-candid text-[10px]">
                      {lastResult.moment.classification.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {(lastResult.moment.confidence * 100).toFixed(0)}% AI Confidence
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 line-clamp-1 italic">
                    "{lastResult.moment.caption}"
                  </p>
                </div>
                {onSwitchToGallery && (
                  <button
                    onClick={onSwitchToGallery}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/40 text-violet-200 transition-all shrink-0"
                  >
                    <span>View in Vault</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Bottom Shutter Dock */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Photo Upload Option */}
            <button
              id="upload-button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload photo from disk for AI analysis"
              className="w-12 h-12 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/15 text-slate-300 hover:text-white hover:border-violet-500/50 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-xl"
            >
              <Upload size={18} />
            </button>

            {/* Glowing Shutter Button */}
            <button
              id="capture-button"
              onClick={toggleRunning}
              className={`relative w-18 h-18 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(139,92,246,0.45)] ${
                isRunning
                  ? 'bg-gradient-to-tr from-rose-600 to-amber-600'
                  : 'bg-gradient-to-tr from-violet-600 via-indigo-600 to-sky-500'
              }`}
            >
              {mode === 'manual' ? (
                <Camera size={26} className="text-white" />
              ) : isRunning ? (
                <Pause size={26} className="text-white" />
              ) : (
                <Play size={26} className="text-white ml-0.5" />
              )}

              {isRunning && (
                <span className="absolute inset-0 rounded-full border-2 border-white/40 pulse-glow" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right Controls & Telemetry Drawer ──────────────── */}
      <div className="w-full lg:w-96 flex flex-col gap-4">
        {/* Mode Selector Card */}
        <div className="canchalant-card p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-400">
              Capture Paradigm
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-violet-300 bg-violet-500/10 border border-violet-500/20">
              Active: {mode.toUpperCase()}
            </span>
          </div>

          <div className="space-y-2.5">
            {MODES.map(({ id, label, desc, icon: Icon, color }) => {
              const isSelected = mode === id
              return (
                <button
                  key={id}
                  id={`mode-${id}`}
                  onClick={() => {
                    setMode(id)
                    if (isRunning && id === 'manual') stopAutoCapture()
                  }}
                  className={`w-full p-3 rounded-2xl text-left flex items-start gap-3.5 transition-all ${
                    isSelected
                      ? 'bg-violet-600/20 border border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.2)]'
                      : 'bg-slate-900/60 border border-white/5 hover:border-white/10 hover:bg-slate-900/90'
                  }`}
                >
                  <div
                    className="p-2 rounded-xl mt-0.5"
                    style={{ backgroundColor: `${color}20`, color }}
                  >
                    <Icon size={18} />
                  </div>
                  <div>
                    <h5 className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                      {label}
                    </h5>
                    <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                      {desc}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Sliders Tuning Card */}
        <div className="canchalant-card p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-400">
              Heuristic Sensitivities
            </span>
            <Sliders size={14} className="text-slate-400" />
          </div>

          <div className="space-y-5">
            {/* Interval Slider */}
            <div>
              <div className="flex justify-between items-center text-xs mb-2">
                <span className="text-slate-300 font-medium">Sampling Interval</span>
                <span className="font-mono text-violet-300 font-bold">{frameInterval.toFixed(1)}s</span>
              </div>
              <input
                id="slider-interval"
                type="range"
                min="0.5"
                max="5.0"
                step="0.1"
                value={frameInterval}
                onChange={e => setFrameInterval(parseFloat(e.target.value))}
              />
            </div>

            {/* Confidence Slider */}
            <div>
              <div className="flex justify-between items-center text-xs mb-2">
                <span className="text-slate-300 font-medium">Candid Confidence</span>
                <span className="font-mono text-violet-300 font-bold">{(confidenceThreshold * 100).toFixed(0)}%</span>
              </div>
              <input
                id="slider-confidence"
                type="range"
                min="0.50"
                max="0.95"
                step="0.05"
                value={confidenceThreshold}
                onChange={e => setConfidenceThreshold(parseFloat(e.target.value))}
              />
            </div>

            {/* Blur Slider */}
            <div>
              <div className="flex justify-between items-center text-xs mb-2">
                <span className="text-slate-300 font-medium">Blur Cutoff (Laplacian)</span>
                <span className="font-mono text-violet-300 font-bold">{blurThreshold}</span>
              </div>
              <input
                id="slider-blur"
                type="range"
                min="20"
                max="200"
                step="5"
                value={blurThreshold}
                onChange={e => setBlurThreshold(parseInt(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Live Telemetry Metrics Card */}
        {lastResult?.filter_result && (
          <div className="canchalant-card p-5 animate-fadeIn">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-400 block mb-3">
              Last Frame Telemetry
            </span>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] text-slate-400 block mb-1">Blur Score</span>
                <span className="font-mono text-xs font-bold text-slate-100">
                  {lastResult.filter_result.blur_score?.toFixed(1) || '—'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] text-slate-400 block mb-1">Faces</span>
                <span className="font-mono text-xs font-bold text-slate-100">
                  {lastResult.filter_result.faces_detected ?? '0'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] text-slate-400 block mb-1">Candid Score</span>
                <span className="font-mono text-xs font-bold text-violet-300">
                  {lastResult.filter_result.candid_score?.toFixed(2) || '—'}
                </span>
              </div>
            </div>

            {lastResult.message && (
              <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-white/5">
                {lastResult.message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
