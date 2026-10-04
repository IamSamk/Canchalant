import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Play, Pause, Camera, Zap, Eye, EyeOff,
  Settings, ChevronDown, ChevronUp,
  CheckCircle, XCircle, AlertCircle, Loader,
  Aperture, Focus, ScanLine, Upload, ExternalLink
} from 'lucide-react'
import { analyzeFrame, resolveImageUrl } from '../api'

const MODES = [
  { id: 'passive', label: 'Passive Ambient', desc: 'Hands-free auto-snap', icon: Eye },
  { id: 'manual', label: 'Manual Capture', desc: 'Tap to capture + auto-tag', icon: Camera },
  { id: 'burst', label: 'Burst Candid Hunt', desc: 'Rapid-fire candid detection', icon: Zap },
]

const STATUS_CONFIG = {
  idle: { color: 'var(--text-muted)', label: 'Idle', icon: Pause },
  scanning: { color: '#a78bfa', label: 'Scanning...', icon: ScanLine },
  analyzing: { color: '#60a5fa', label: 'Analyzing...', icon: Loader },
  captured: { color: '#34d399', label: 'Captured!', icon: CheckCircle },
  rejected_blur: { color: '#f59e0b', label: 'Too blurry', icon: AlertCircle },
  rejected_posed: { color: '#fbbf24', label: 'Posed/Junk', icon: XCircle },
  rejected_confidence: { color: '#f97316', label: 'Low confidence', icon: AlertCircle },
  error: { color: '#ef4444', label: 'Error', icon: XCircle },
}

export default function CameraView() {
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

  const handleFileUpload = (e) => {
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
          mode: 'manual', // Force manual capture for user uploads
          confidenceThreshold,
          blurThreshold: Math.min(blurThreshold, 40),
        })
        setLastResult(result)
        setStatus(result.status)
        if (result.status === 'captured') {
          setCaptureCount(c => c + 1)
          setShowFlash(true)
          setTimeout(() => setShowFlash(false), 500)
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

  // Settings
  const [frameInterval, setFrameInterval] = useState(2.0)
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.65)
  const [blurThreshold, setBlurThreshold] = useState(80)

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment',
        },
        audio: false,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setStream(mediaStream)
    } catch (err) {
      console.error('Camera access denied:', err)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      setStream(null)
    }
  }, [stream])

  // Capture a frame
  const captureFrame = useCallback(async () => {
    if (!videoRef.current || isAnalyzing) return

    const video = videoRef.current
    const canvas = canvasRef.current
    if (!canvas || video.readyState < 2) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    // Get base64 (strip data URI prefix)
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
        // Flash effect
        setShowFlash(true)
        setTimeout(() => setShowFlash(false), 500)
      }
    } catch (err) {
      console.error('Analysis error:', err)
      setStatus('error')
      setLastResult({ message: err.message })
    } finally {
      setIsAnalyzing(false)
    }
  }, [isAnalyzing, mode, confidenceThreshold, blurThreshold])

  // Auto-capture loop for passive/burst modes
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

  // Toggle running state
  const toggleRunning = useCallback(() => {
    if (isRunning) {
      stopAutoCapture()
    } else if (mode === 'manual') {
      captureFrame()
    } else {
      startAutoCapture()
    }
  }, [isRunning, mode, startAutoCapture, stopAutoCapture, captureFrame])

  // Start camera on mount
  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
      stopAutoCapture()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Restart auto-capture when settings change
  useEffect(() => {
    if (isRunning && mode !== 'manual') {
      stopAutoCapture()
      startAutoCapture()
    }
  }, [frameInterval, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.idle
  const StatusIcon = statusConfig.icon

  return (
    <div className="relative flex flex-col lg:flex-row gap-4 p-4 h-[calc(100vh-64px)]">
      {/* ── Video Feed ────────────────────────────────────── */}
      <div className="relative flex-1 rounded-2xl overflow-hidden glass-card">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ minHeight: '400px' }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Flash overlay */}
        {showFlash && (
          <div
            className="absolute inset-0 bg-white capture-flash pointer-events-none"
            style={{ zIndex: 10 }}
          />
        )}

        {/* HUD Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Top status bar */}
          <div
            className="absolute top-4 left-4 right-4 flex items-center justify-between"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="glass rounded-xl px-4 py-2 flex items-center gap-3">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  background: isRunning ? '#34d399' : 'var(--text-muted)',
                  boxShadow: isRunning ? '0 0 8px rgba(52, 211, 153, 0.6)' : 'none',
                }}
              />
              <span className="text-sm font-medium" style={{ color: statusConfig.color }}>
                <StatusIcon size={14} className="inline mr-1" style={{ verticalAlign: '-2px' }} />
                {statusConfig.label}
              </span>
            </div>

            <div className="glass rounded-xl px-4 py-2 flex items-center gap-2">
              <Aperture size={14} style={{ color: 'var(--text-accent)' }} />
              <span className="text-sm font-mono font-medium" style={{ color: 'var(--text-accent)' }}>
                {captureCount}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>captured</span>
            </div>
          </div>

          {/* Center scanning indicator */}
          {isRunning && status === 'scanning' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-32 h-32 rounded-full border-2 scan-ring"
                style={{ borderColor: 'rgba(167, 139, 250, 0.4)' }}
              />
              <div
                className="absolute w-24 h-24 rounded-full border scan-ring"
                style={{
                  borderColor: 'rgba(167, 139, 250, 0.25)',
                  animationDelay: '0.5s',
                }}
              />
            </div>
          )}

          {/* Last result badge */}
          {lastResult && lastResult.vlm_result && (
            <div className="absolute bottom-4 left-4 right-4 flex justify-center" style={{ pointerEvents: 'auto' }}>
              <div className="glass rounded-xl px-5 py-3 max-w-lg fade-in-up">
                <div className="flex items-center gap-3 mb-1">
                  <span
                    className="mood-chip text-xs"
                    style={{
                      background: lastResult.vlm_result.classification === 'SPECIFIC_CANDID' ? 'rgba(16,185,129,0.15)' :
                        lastResult.vlm_result.classification === 'GENERAL_CANDID' ? 'rgba(59,130,246,0.15)' :
                          'rgba(245,158,11,0.15)',
                      color: lastResult.vlm_result.classification === 'SPECIFIC_CANDID' ? '#34d399' :
                        lastResult.vlm_result.classification === 'GENERAL_CANDID' ? '#60a5fa' :
                          '#fbbf24',
                    }}
                  >
                    {lastResult.vlm_result.classification.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {(lastResult.vlm_result.confidence * 100).toFixed(0)}% conf
                  </span>
                  {lastResult.moment?.cloudinary_url && (
                    <a
                      href={lastResult.moment.cloudinary_url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto text-xs flex items-center gap-1 hover:underline"
                      style={{ color: 'var(--text-accent)' }}
                    >
                      <span>Cloudinary</span>
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {lastResult.vlm_result.caption}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Main capture & upload button controls */}
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4"
          style={{ zIndex: 20 }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            id="upload-button"
            onClick={() => fileInputRef.current?.click()}
            title="Upload Photo for Analysis"
            className="w-12 h-12 rounded-full glass flex items-center justify-center transition-all duration-300 hover:scale-110"
            style={{ border: '1px solid var(--border-medium)' }}
          >
            <Upload size={18} style={{ color: 'var(--text-accent)' }} />
          </button>

          <button
            id="capture-button"
            onClick={toggleRunning}
            className="relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105"
            style={{
              background: isRunning ? 'rgba(239, 68, 68, 0.8)' : 'var(--gradient-primary)',
              boxShadow: isRunning
                ? '0 0 24px rgba(239, 68, 68, 0.4)'
                : '0 0 24px rgba(139, 92, 246, 0.4)',
            }}
          >
            {mode === 'manual' ? (
              <Camera size={24} className="text-white" />
            ) : isRunning ? (
              <Pause size={24} className="text-white" />
            ) : (
              <Play size={24} className="text-white ml-0.5" />
            )}
            {isRunning && (
              <span
                className="absolute inset-0 rounded-full glow-pulse"
                style={{ border: '2px solid rgba(239, 68, 68, 0.3)' }}
              />
            )}
          </button>
        </div>
      </div>

      {/* ── Controls Panel ────────────────────────────────── */}
      <div
        className="lg:w-80 flex flex-col gap-3"
        style={{ maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}
      >
        {/* Toggle header */}
        <button
          id="toggle-controls"
          onClick={() => setShowControls(!showControls)}
          className="glass-card px-4 py-3 flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <Settings size={16} style={{ color: 'var(--text-accent)' }} />
            <span className="text-sm font-semibold">Controls</span>
          </div>
          {showControls ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showControls && (
          <>
            {/* Mode Selector */}
            <div className="glass-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                Capture Mode
              </h3>
              <div className="flex flex-col gap-2">
                {MODES.map(({ id, label, desc, icon: Icon }) => (
                  <button
                    key={id}
                    id={`mode-${id}`}
                    onClick={() => {
                      setMode(id)
                      if (isRunning && id === 'manual') stopAutoCapture()
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200"
                    style={{
                      background: mode === id ? 'rgba(139, 92, 246, 0.12)' : 'transparent',
                      border: `1px solid ${mode === id ? 'rgba(139, 92, 246, 0.3)' : 'transparent'}`,
                    }}
                  >
                    <Icon size={16} style={{ color: mode === id ? '#a78bfa' : 'var(--text-muted)' }} />
                    <div>
                      <span className="text-sm font-medium block" style={{ color: mode === id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {label}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders */}
            <div className="glass-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                Sensitivity
              </h3>

              {/* Frame Interval */}
              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Frame Interval</label>
                  <span className="text-sm font-mono" style={{ color: 'var(--text-accent)' }}>
                    {frameInterval.toFixed(1)}s
                  </span>
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

              {/* Confidence Threshold */}
              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Confidence Threshold</label>
                  <span className="text-sm font-mono" style={{ color: 'var(--text-accent)' }}>
                    {(confidenceThreshold * 100).toFixed(0)}%
                  </span>
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

              {/* Blur Threshold */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Blur Sensitivity</label>
                  <span className="text-sm font-mono" style={{ color: 'var(--text-accent)' }}>
                    {blurThreshold}
                  </span>
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

            {/* Status Info */}
            {lastResult && (
              <div className="glass-card p-4 fade-in-up">
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                  Last Analysis
                </h3>

                {lastResult.filter_result && (
                  <div className="space-y-1.5 mb-3">
                    <div className="flex justify-between text-xs">
                      <span style={{ color: 'var(--text-muted)' }}>Blur Score</span>
                      <span className="font-mono" style={{ color: lastResult.filter_result.is_sharp ? '#34d399' : '#ef4444' }}>
                        {lastResult.filter_result.blur_score?.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span style={{ color: 'var(--text-muted)' }}>Faces</span>
                      <span className="font-mono">{lastResult.filter_result.faces_detected}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span style={{ color: 'var(--text-muted)' }}>Candid Score</span>
                      <span className="font-mono" style={{ color: 'var(--text-accent)' }}>
                        {lastResult.filter_result.candid_score?.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {lastResult.message}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
