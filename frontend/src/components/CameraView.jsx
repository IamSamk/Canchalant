import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Play,
  Pause,
  Camera,
  Zap,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader,
  ScanLine,
  Upload,
  Sliders,
  ArrowRight,
  Clock,
  Shield,
} from 'lucide-react'
import { analyzeFrame, resolveImageUrl } from '../api'

const MODES = [
  {
    id: 'passive',
    label: 'Passive ambient',
    desc: 'Autonomous background sentinel capturing natural candid moments.',
    icon: Eye,
  },
  {
    id: 'manual',
    label: 'Manual shutter',
    desc: 'Instant manual snap with automated vision analysis and emotion tagging.',
    icon: Camera,
  },
  {
    id: 'burst',
    label: 'Burst candid hunt',
    desc: 'High-frequency 500ms sampling cycle for dynamic group interactions.',
    icon: Zap,
  },
]

const STATUS_CONFIG = {
  idle: { label: 'Standby', icon: Pause },
  scanning: { label: 'Sampling frame', icon: ScanLine },
  analyzing: { label: 'Analyzing frame', icon: Loader },
  captured: { label: 'Candid captured', icon: CheckCircle },
  cooldown: { label: 'Cooldown', icon: Clock },
  rejected_blur: { label: 'Motion blurred', icon: AlertCircle },
  rejected_posed: { label: 'Camera-facing / Posed', icon: XCircle },
  rejected_confidence: { label: 'Below confidence cutoff', icon: AlertCircle },
  error: { label: 'Inference warning', icon: XCircle },
}

export default function CameraView({ user, onMomentCaptured, onSwitchToGallery, onOpenAuth }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const intervalRef = useRef(null)
  const lastCaptureTimeRef = useRef(0)

  const [stream, setStream] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [mode, setMode] = useState('passive')
  const [status, setStatus] = useState('idle')
  const [cooldownSec, setCooldownSec] = useState(0)
  const [lastResult, setLastResult] = useState(null)
  const [captureCount, setCaptureCount] = useState(0)
  const [showFlash, setShowFlash] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Granular settings
  const [frameInterval, setFrameInterval] = useState(2.5)
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.65)
  const [blurThreshold, setBlurThreshold] = useState(80)

  // Start webcam
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
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
  const captureFrame = useCallback(async (isManualSnap = false) => {
    if (!videoRef.current || isAnalyzing) return

    // Cooldown check for passive mode
    if (!isManualSnap && mode === 'passive') {
      const elapsed = Date.now() - lastCaptureTimeRef.current
      if (elapsed < 20000) {
        const remaining = Math.ceil((20000 - elapsed) / 1000)
        setCooldownSec(remaining)
        setStatus('cooldown')
        return
      }
    }
    setCooldownSec(0)

    const video = videoRef.current
    const canvas = canvasRef.current
    if (!canvas || video.readyState < 2) return

    const MAX_DIM = 640
    let w = video.videoWidth || 640
    let h = video.videoHeight || 480
    if (w > MAX_DIM || h > MAX_DIM) {
      if (w > h) {
        h = Math.round((h * MAX_DIM) / w)
        w = MAX_DIM
      } else {
        w = Math.round((w * MAX_DIM) / h)
        h = MAX_DIM
      }
    }

    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, w, h)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.72)
    const base64 = dataUrl.split(',')[1]

    setIsAnalyzing(true)
    setStatus('analyzing')

    try {
      const result = await analyzeFrame(base64, {
        mode: isManualSnap ? 'manual' : mode,
        confidenceThreshold,
        blurThreshold,
      })

      setLastResult(result)
      setStatus(result.status)

      if (result.status === 'captured') {
        lastCaptureTimeRef.current = Date.now()
        setCaptureCount(c => c + 1)
        if (onMomentCaptured) onMomentCaptured()
        setShowFlash(true)
        setTimeout(() => setShowFlash(false), 350)
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
      const img = new window.Image()
      img.onload = async () => {
        const canvas = canvasRef.current || document.createElement('canvas')
        const MAX_DIM = 800
        let w = img.width
        let h = img.height
        if (w > MAX_DIM || h > MAX_DIM) {
          if (w > h) {
            h = Math.round((h * MAX_DIM) / w)
            w = MAX_DIM
          } else {
            w = Math.round((w * MAX_DIM) / h)
            h = MAX_DIM
          }
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78)
        const base64 = dataUrl.split(',')[1]

        setIsAnalyzing(true)
        setStatus('analyzing')

        try {
          const result = await analyzeFrame(base64, {
            mode: 'manual',
            confidenceThreshold,
            blurThreshold: Math.min(blurThreshold, 40),
          })

          setLastResult(result)
          setStatus(result.status)

          if (result.status === 'captured') {
            setCaptureCount(c => c + 1)
            if (onMomentCaptured) onMomentCaptured()
            setShowFlash(true)
            setTimeout(() => setShowFlash(false), 350)
          }
        } catch (err) {
          setStatus('error')
          setLastResult({ message: err.message })
        } finally {
          setIsAnalyzing(false)
        }
      }
      img.src = reader.result
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
      captureFrame(true)
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
    <div className="w-full min-h-[calc(100vh-4rem)] flex flex-col lg:flex-row bg-black text-white">
      {/* ── Main Viewfinder Stage ──────────────────────────── */}
      <div className="relative flex-1 min-h-[460px] lg:min-h-[640px] bg-black flex items-center justify-center overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10 p-6 lg:p-10">
        {/* Flash Effect */}
        {showFlash && (
          <div className="absolute inset-0 bg-white camera-flash pointer-events-none z-40" />
        )}

        {/* Video Canvas Container */}
        <div className="relative w-full h-full max-w-[1200px] aspect-video bg-[#0a0a0a] rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Minimal Corner Optic Brackets */}
          <div className="absolute inset-8 pointer-events-none rounded-xl border border-white/[0.06] flex items-center justify-center">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white/30" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white/30" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white/30" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white/30" />

            {/* Center Reticle */}
            <div className="relative flex items-center justify-center">
              <div className={`w-16 h-16 rounded-full border border-white/20 transition-all ${
                isRunning ? 'scale-110 border-white/40' : ''
              }`} />
              <div className="absolute w-1.5 h-1.5 rounded-full bg-white/60" />
            </div>
          </div>

          {/* Top HUD Bar */}
          <div className="absolute top-5 left-5 right-5 z-20 flex items-center justify-between pointer-events-none">
            {/* Status Capsule */}
            <div className="pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-black/85 backdrop-blur-md border border-white/15">
              <span
                className={`w-2 h-2 rounded-full ${
                  isRunning ? 'bg-white' : 'bg-white/30'
                }`}
              />
              <span className="text-xs text-white/90 flex items-center gap-1.5">
                <StatusIcon size={13} className={status === 'analyzing' ? 'animate-spin' : ''} />
                <span>{status === 'cooldown' ? `Cooldown (${cooldownSec}s)` : statusConfig.label}</span>
              </span>
            </div>

            {/* Right Telemetry Capsule */}
            <div className="flex items-center gap-2 pointer-events-auto">
              {!user ? (
                <button
                  onClick={onOpenAuth}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white text-black text-xs font-medium hover:bg-white/90 transition-all"
                >
                  <Shield size={12} />
                  <span>Sign in to secure</span>
                </button>
              ) : (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-black/85 backdrop-blur-md border border-white/15 text-xs text-white/70">
                  <Shield size={12} className="text-white" />
                  <span>Vault: {user.name || user.email.split('@')[0]}</span>
                </div>
              )}

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-black/85 backdrop-blur-md border border-white/15 text-xs">
                <span className="text-white/40">Captured:</span>
                <span className="text-white font-medium">{captureCount}</span>
              </div>
            </div>
          </div>

          {/* Captured Moment Notification Toast */}
          {lastResult && lastResult.moment && (
            <div className="absolute bottom-24 left-6 right-6 z-20 flex justify-center pointer-events-none">
              <div className="pointer-events-auto w-full max-w-md p-4 rounded-xl bg-[#0c0c0c]/95 backdrop-blur-md border border-white/20 shadow-2xl flex items-center gap-3.5 animate-fadeIn">
                <img
                  src={resolveImageUrl(lastResult.moment.cloudinary_url || lastResult.moment.filepath)}
                  alt="Captured moment preview"
                  className="w-14 h-14 rounded-lg object-cover border border-white/15 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white font-medium">
                      {lastResult.moment.classification.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-white/40">
                      {(lastResult.moment.confidence * 100).toFixed(0)}% conf
                    </span>
                  </div>
                  <p className="text-xs text-white/90 line-clamp-1 italic">
                    "{lastResult.moment.caption}"
                  </p>
                </div>
                {onSwitchToGallery && (
                  <button
                    onClick={onSwitchToGallery}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-white text-black hover:bg-white/90 transition-all shrink-0"
                  >
                    <span>Vault</span>
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Bottom Shutter Controls Dock */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Upload Button */}
            <button
              id="upload-button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload photo from disk for AI analysis"
              className="w-11 h-11 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white/70 hover:text-white hover:border-white/50 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            >
              <Upload size={16} />
            </button>

            {/* Shutter Button */}
            <button
              id="capture-button"
              onClick={toggleRunning}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 border hover:scale-105 active:scale-95 ${
                isRunning
                  ? 'bg-black border-white text-white'
                  : 'bg-white border-white text-black hover:bg-white/90'
              }`}
            >
              {mode === 'manual' ? (
                <Camera size={20} />
              ) : isRunning ? (
                <Pause size={18} />
              ) : (
                <Play size={18} className="ml-0.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right Controls Drawer with Generous Spacing ──────── */}
      <div className="w-full lg:w-[380px] bg-black p-8 flex flex-col justify-between overflow-y-auto">
        <div className="flex flex-col gap-8">
          {/* Mode Selector */}
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-xs font-medium uppercase tracking-wider text-white/50">
                Capture mode
              </span>
              <span className="text-xs text-white/70 px-2 py-0.5 rounded border border-white/15">
                {mode}
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {MODES.map(({ id, label, desc, icon: Icon }) => {
                const isSelected = mode === id
                return (
                  <button
                    key={id}
                    id={`mode-${id}`}
                    onClick={() => {
                      setMode(id)
                      if (isRunning && id === 'manual') stopAutoCapture()
                    }}
                    className={`w-full p-4 rounded-xl text-left flex items-start gap-3.5 transition-all border ${
                      isSelected
                        ? 'bg-white text-black border-white'
                        : 'bg-white/[0.02] text-white border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon size={16} className={`mt-0.5 shrink-0 ${isSelected ? 'text-black' : 'text-white/60'}`} />
                    <div>
                      <h5 className={`text-sm font-medium ${isSelected ? 'text-black font-semibold' : 'text-white'}`}>
                        {label}
                      </h5>
                      <p className={`text-xs mt-1 leading-relaxed ${isSelected ? 'text-black/70' : 'text-white/45'}`}>
                        {desc}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Sensitivity Controls */}
          <div className="pt-6 border-t border-white/10">
            <div className="flex items-center justify-between mb-5">
              <span className="text-xs font-medium uppercase tracking-wider text-white/50">
                Sensitivity controls
              </span>
              <Sliders size={13} className="text-white/40" />
            </div>

            <div className="flex flex-col gap-5">
              {/* Interval Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/70">Sampling interval</span>
                  <span className="text-white font-medium">{frameInterval.toFixed(1)}s</span>
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
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/70">Confidence cutoff</span>
                  <span className="text-white font-medium">{(confidenceThreshold * 100).toFixed(0)}%</span>
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
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/70">Sharpness cutoff</span>
                  <span className="text-white font-medium">{blurThreshold}</span>
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

          {/* Live Telemetry */}
          {lastResult?.filter_result && (
            <div className="pt-6 border-t border-white/10 animate-fadeIn">
              <span className="text-xs font-medium uppercase tracking-wider text-white/50 block mb-3">
                Telemetry feed
              </span>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
                  <span className="text-xs text-white/45 block mb-1">Sharpness</span>
                  <span className="text-sm font-medium text-white">
                    {lastResult.filter_result.blur_score?.toFixed(1) || '—'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
                  <span className="text-xs text-white/45 block mb-1">Faces</span>
                  <span className="text-sm font-medium text-white">
                    {lastResult.filter_result.faces_detected ?? '0'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
                  <span className="text-xs text-white/45 block mb-1">Candid</span>
                  <span className="text-sm font-medium text-white">
                    {lastResult.filter_result.candid_score?.toFixed(2) || '—'}
                  </span>
                </div>
              </div>

              {lastResult.message && (
                <p className="text-xs text-white/50 mt-3 leading-relaxed">
                  {lastResult.message}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Minimal Footer */}
        <div className="pt-6 border-t border-white/10 text-xs text-white/35 flex justify-between items-center">
          <span>Canchalant Studio</span>
          <span>Edge Sentinel</span>
        </div>
      </div>
    </div>
  )
}
