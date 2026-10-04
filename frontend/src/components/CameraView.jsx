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
  ArrowRight,
  Clock,
  Maximize2,
  RefreshCw,
} from 'lucide-react'
import { analyzeFrame, resolveImageUrl } from '../api'

const MODES = [
  {
    id: 'passive',
    label: 'Passive Ambient',
    desc: 'Autonomous background sentinel',
    icon: Eye,
  },
  {
    id: 'manual',
    label: 'Manual Shutter',
    desc: 'Instant snap & emotion tag',
    icon: Camera,
  },
  {
    id: 'burst',
    label: 'Burst Candid Hunt',
    desc: 'Rapid 500ms candidate search',
    icon: Zap,
  },
]

const STATUS_CONFIG = {
  idle: { label: 'STANDBY', icon: Pause },
  scanning: { label: 'SAMPLING FRAME', icon: ScanLine },
  analyzing: { label: 'AI CLASSIFYING', icon: Loader },
  captured: { label: 'CANDID CAPTURED', icon: CheckCircle },
  cooldown: { label: 'COOLDOWN', icon: Clock },
  rejected_blur: { label: 'MOTION BLURRED', icon: AlertCircle },
  rejected_posed: { label: 'CAMERA FACING / POSED', icon: XCircle },
  rejected_confidence: { label: 'BELOW CONFIDENCE', icon: AlertCircle },
  error: { label: 'INFERENCE ERROR', icon: XCircle },
}

export default function CameraView({ onMomentCaptured, onSwitchToGallery }) {
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

    // Cooldown check for passive mode: avoid capturing the exact same pose rapidly
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

    // Downscale frame to max 640px to keep payload under 30KB for fast cloud transfer
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
    <div className="w-full h-[calc(100vh-3.5rem)] flex flex-col lg:flex-row bg-black text-white overflow-hidden">
      {/* ── Full Stage Viewfinder (Left / Dominant) ──────────── */}
      <div className="relative flex-1 h-full min-h-[460px] bg-black flex items-center justify-center overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10">
        {/* Flash Effect */}
        {showFlash && (
          <div className="absolute inset-0 bg-white camera-flash pointer-events-none z-40" />
        )}

        {/* Video Canvas Element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform -scale-x-100"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Minimalist Optical Reticle Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8 md:p-14">
          <div className="relative w-full h-full border border-white/[0.08] rounded-xl flex items-center justify-center">
            {/* Corner Bracket Accents */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white/40" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white/40" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white/40" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white/40" />

            {/* Center Focus Reticle */}
            <div className="relative flex items-center justify-center">
              <div className={`w-20 h-20 rounded-full border border-white/20 transition-all duration-300 ${
                isRunning ? 'reticle-scan border-white/40' : ''
              }`} />
              <div className="absolute w-1.5 h-1.5 rounded-full bg-white/60" />
            </div>
          </div>
        </div>

        {/* Top HUD Telemetry Bar */}
        <div className="absolute top-6 left-6 right-6 z-20 flex items-center justify-between pointer-events-none">
          {/* Status Capsule */}
          <div className="pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-black/80 backdrop-blur-md border border-white/15">
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning ? 'bg-white shadow-[0_0_8px_#ffffff]' : 'bg-white/30'
              }`}
            />
            <span className="text-[11px] font-mono tracking-wider text-white/90 uppercase flex items-center gap-1.5">
              <StatusIcon size={12} className={status === 'analyzing' ? 'animate-spin' : ''} />
              {status === 'cooldown' ? `COOLDOWN (${cooldownSec}S)` : statusConfig.label}
            </span>
          </div>

          {/* Captured Photos Counter */}
          <div className="pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-black/80 backdrop-blur-md border border-white/15">
            <span className="text-[11px] font-mono tracking-wider text-white/40 uppercase">
              CAPTURED:
            </span>
            <span className="text-[12px] font-mono font-bold text-white">
              {captureCount}
            </span>
          </div>
        </div>

        {/* Captured Moment Notification Toast */}
        {lastResult && lastResult.moment && (
          <div className="absolute bottom-28 left-6 right-6 z-20 flex justify-center pointer-events-none">
            <div className="pointer-events-auto w-full max-w-lg p-3.5 rounded-xl bg-black/95 backdrop-blur-xl border border-white/25 shadow-2xl flex items-center gap-3.5 animate-fadeIn">
              <img
                src={resolveImageUrl(lastResult.moment.cloudinary_url || lastResult.moment.filepath)}
                alt="Captured moment preview"
                className="w-14 h-14 rounded-lg object-cover border border-white/20 shrink-0 grayscale hover:grayscale-0 transition-all"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-white font-medium uppercase">
                    {lastResult.moment.classification.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-mono text-white/40">
                    {(lastResult.moment.confidence * 100).toFixed(0)}% CONF
                  </span>
                </div>
                <p className="text-xs text-white/90 line-clamp-1 italic">
                  "{lastResult.moment.caption}"
                </p>
              </div>
              {onSwitchToGallery && (
                <button
                  onClick={onSwitchToGallery}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-medium bg-white text-black hover:bg-white/90 transition-all shrink-0"
                >
                  <span>VAULT</span>
                  <ArrowRight size={11} />
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
            className="w-11 h-11 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white/70 hover:text-white hover:border-white/60 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          >
            <Upload size={16} />
          </button>

          {/* Stark Monochrome Shutter Button */}
          <button
            id="capture-button"
            onClick={toggleRunning}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 border hover:scale-105 active:scale-95 ${
              isRunning
                ? 'bg-black border-white text-white'
                : 'bg-white border-white text-black hover:bg-white/90'
            }`}
          >
            {mode === 'manual' ? (
              <Camera size={22} />
            ) : isRunning ? (
              <Pause size={20} />
            ) : (
              <Play size={20} className="ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* ── Minimalist Hardware Dock (Right Panel) ───────────── */}
      <div className="w-full lg:w-[380px] h-auto lg:h-full bg-black flex flex-col justify-between p-6 overflow-y-auto">
        <div className="space-y-6">
          {/* Mode Selector */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono uppercase tracking-widest text-white/40">
                CAPTURE MODE
              </span>
              <span className="text-[10px] font-mono text-white/70 px-1.5 py-0.5 rounded border border-white/15">
                {mode.toUpperCase()}
              </span>
            </div>

            <div className="space-y-1.5">
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
                    className={`w-full p-3 rounded-lg text-left flex items-start gap-3 transition-all border ${
                      isSelected
                        ? 'bg-white text-black border-white'
                        : 'bg-white/[0.02] text-white border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon size={16} className={`mt-0.5 ${isSelected ? 'text-black' : 'text-white/60'}`} />
                    <div>
                      <h5 className={`text-[13px] font-medium leading-none ${isSelected ? 'text-black font-semibold' : 'text-white'}`}>
                        {label}
                      </h5>
                      <p className={`text-[11px] mt-1 leading-snug ${isSelected ? 'text-black/60' : 'text-white/40'}`}>
                        {desc}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Heuristic Parameter Sliders */}
          <div className="pt-4 border-t border-white/[0.08]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-mono uppercase tracking-widest text-white/40">
                SENSITIVITY THRESHOLDS
              </span>
              <Sliders size={12} className="text-white/40" />
            </div>

            <div className="space-y-4">
              {/* Interval Slider */}
              <div>
                <div className="flex justify-between items-center text-[12px] mb-1.5">
                  <span className="text-white/70">Sampling Rate</span>
                  <span className="font-mono text-white text-[11px]">{frameInterval.toFixed(1)}s</span>
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
                <div className="flex justify-between items-center text-[12px] mb-1.5">
                  <span className="text-white/70">Confidence Cutoff</span>
                  <span className="font-mono text-white text-[11px]">{(confidenceThreshold * 100).toFixed(0)}%</span>
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
                <div className="flex justify-between items-center text-[12px] mb-1.5">
                  <span className="text-white/70">Sharpness Cutoff</span>
                  <span className="font-mono text-white text-[11px]">{blurThreshold}</span>
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

          {/* Last Frame Live Metrics */}
          {lastResult?.filter_result && (
            <div className="pt-4 border-t border-white/[0.08] animate-fadeIn">
              <span className="text-[11px] font-mono uppercase tracking-widest text-white/40 block mb-2.5">
                TELEMETRY FEED
              </span>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                  <span className="text-[10px] font-mono text-white/40 block mb-0.5">SHARPNESS</span>
                  <span className="font-mono text-xs font-semibold text-white">
                    {lastResult.filter_result.blur_score?.toFixed(1) || '—'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                  <span className="text-[10px] font-mono text-white/40 block mb-0.5">FACES</span>
                  <span className="font-mono text-xs font-semibold text-white">
                    {lastResult.filter_result.faces_detected ?? '0'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                  <span className="text-[10px] font-mono text-white/40 block mb-0.5">CANDID</span>
                  <span className="font-mono text-xs font-semibold text-white">
                    {lastResult.filter_result.candid_score?.toFixed(2) || '—'}
                  </span>
                </div>
              </div>

              {lastResult.message && (
                <p className="text-[11px] font-mono text-white/50 mt-2.5">
                  {lastResult.message}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Minimal Footer Info */}
        <div className="pt-4 border-t border-white/[0.08] text-[11px] font-mono text-white/30 flex justify-between items-center">
          <span>CANCHALANT V2</span>
          <span>EDGE SENTINEL</span>
        </div>
      </div>
    </div>
  )
}
