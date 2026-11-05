import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, Camera, ChevronDown, CircleHelp, Download, FlipHorizontal,
  Focus, Maximize, MicOff, Minimize, Pause, Play, RotateCcw, ScanFace, Settings2,
  ShieldCheck, Sparkles, Video, X,
} from 'lucide-react'
import { AITrackingEngine, type TrackingBox } from '../engine/AITrackingEngine'
import { CameraEngine } from '../engine/CameraEngine'
import { readPreferences, saveRecording, writePreferences } from '../engine/LocalStore'
import type { CameraPreferences } from '../engine/LocalStore'
import { VideoRecorder, type Recording } from '../engine/VideoRecorder'

type Props = { onExit: () => void }

function errorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'Camera permission is blocked. Allow camera access in your browser settings, then try again.'
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') return 'No camera was found on this device.'
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') return 'The camera is already in use by another app.'
  }
  return error instanceof Error ? error.message : 'Something went wrong while starting the camera.'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function CameraStudio({ onExit }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef(new CameraEngine())
  const detectorRef = useRef<AITrackingEngine | null>(null)
  const recorderRef = useRef(new VideoRecorder())
  const cropRef = useRef({ x: 0.5, y: 0.5, width: 0.72, height: 0.72 })
  const detectedRef = useRef<TrackingBox | null>(null)
  const lastTrackRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const velocityRef = useRef({ x: 0, y: 0 })
  const sourceSizeRef = useRef('')
  const animationFrameRef = useRef(0)
  const lastDetectionRef = useRef(0)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [selectedDevice, setSelectedDevice] = useState('')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [trackingOn, setTrackingOn] = useState(true)
  const [faceOn, setFaceOn] = useState(true)
  const [bodyOn, setBodyOn] = useState(true)
  const [mirror, setMirror] = useState(true)
  const [sensitivity, setSensitivity] = useState(55)
  const [zoom, setZoom] = useState(1)
  const [error, setError] = useState('')
  const [aiReady, setAiReady] = useState(false)
  const [aiError, setAiError] = useState(false)
  const [subjectFound, setSubjectFound] = useState(false)
    const [sourceSize, setSourceSize] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [lastRecording, setLastRecording] = useState<Recording | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  const stopCamera = useCallback(() => {
    recorderRef.current.stop()
    setRecording(false)
    engineRef.current.stop()
    setCameraOn(false)
    setSubjectFound(false)
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const startCamera = useCallback(async (deviceId?: string, facing = facingMode) => {
    setError('')
    setPreviewMode(false)
    try {
      const video = videoRef.current
      if (!video) return
      await engineRef.current.start(video, facing, deviceId)
      const available = await engineRef.current.listCameras()
      setDevices(available)
      setSelectedDevice(deviceId ?? '')
      setCameraOn(true)
      if (!deviceId && available.length) {
        const activeTrack = (video.srcObject as MediaStream).getVideoTracks()[0]
        setSelectedDevice(activeTrack.getSettings().deviceId ?? '')
      }
    } catch (reason) {
      setError(errorMessage(reason))
      stopCamera()
    }
  }, [facingMode, stopCamera])

  useEffect(() => {
    const controller = new AbortController()
    const cameraEngine = engineRef.current
    const recorder = recorderRef.current
    let loadedEngine: AITrackingEngine | null = null
    AITrackingEngine.create().then((engine) => {
      if (controller.signal.aborted) engine.close()
      else {
        loadedEngine = engine
        detectorRef.current = engine
        setAiReady(true)
      }
    }).catch(() => {
      if (!controller.signal.aborted) setAiError(true)
    })
    return () => {
      controller.abort()
      loadedEngine?.close()
      if (detectorRef.current === loadedEngine) detectorRef.current = null
      cameraEngine.stop()
      recorder.stop()
    }
  }, [])

  useEffect(() => {
    let active = true
    readPreferences().then((preferences) => {
      if (!active) return
      if (preferences) {
        setTrackingOn(preferences.trackingOn)
        setFaceOn(preferences.faceOn)
        setBodyOn(preferences.bodyOn)
        setMirror(preferences.mirror)
        setSensitivity(preferences.sensitivity)
        setZoom(preferences.zoom)
      }
      setPreferencesLoaded(true)
    }).catch(() => {
      if (active) setPreferencesLoaded(true)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!preferencesLoaded) return
    const preferences: CameraPreferences = { trackingOn, faceOn, bodyOn, mirror, sensitivity, zoom }
    void writePreferences(preferences).catch(() => {})
  }, [bodyOn, faceOn, mirror, preferencesLoaded, sensitivity, trackingOn, zoom])

  useEffect(() => {
    if (!cameraOn) return
    const controller = new AbortController()
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', { alpha: false })
    if (!video || !canvas || !context) return

    const render = (now: number) => {
      if (controller.signal.aborted) return
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        const currentSize = `${video.videoWidth} × ${video.videoHeight}`
        if (sourceSizeRef.current !== currentSize) {
          sourceSizeRef.current = currentSize
          setSourceSize(currentSize)
        }
        if (trackingOn && aiReady && now - lastDetectionRef.current >= 160) {
          lastDetectionRef.current = now
          try {
            detectedRef.current = detectorRef.current?.detect(video, now, { face: faceOn, body: bodyOn }) ?? null
            const detection = detectedRef.current
            if (detection) {
              const centerX = detection.x + detection.width / 2
              const centerY = detection.y + detection.height / 2
              const previous = lastTrackRef.current
              if (previous) {
                const elapsed = Math.max((now - previous.time) / 1000, 0.04)
                velocityRef.current = {
                  x: clamp((centerX - previous.x) / elapsed, -0.8, 0.8),
                  y: clamp((centerY - previous.y) / elapsed, -0.8, 0.8),
                }
              }
              lastTrackRef.current = { x: centerX, y: centerY, time: now }
            } else {
              velocityRef.current = { x: 0, y: 0 }
              lastTrackRef.current = null
            }
            setSubjectFound(Boolean(detectedRef.current))
          } catch {
            detectedRef.current = null
          }
        }

        const sourceWidth = video.videoWidth
        const sourceHeight = video.videoHeight
        const sourceAspect = sourceWidth / sourceHeight
        const previewBounds = previewRef.current?.getBoundingClientRect()
        if (previewBounds?.width && previewBounds.height) {
          const portrait = previewBounds.height > previewBounds.width
          const width = portrait ? 720 : 1280
          const height = portrait ? 1280 : 720
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
          }
        }
        const outputAspect = canvas.width / canvas.height
        const target = trackingOn ? detectedRef.current : null
        const sensitivityFactor = 0.045 + sensitivity / 100 * 0.18
        let targetWidth = target ? Math.max(target.width * 2.4, target.height * outputAspect / sourceAspect * 1.8) : 0.72 / zoom
        let targetHeight = target ? Math.max(target.height * 2, target.width * sourceAspect / outputAspect * 1.8) : targetWidth * sourceAspect / outputAspect
        const ratio = outputAspect / sourceAspect
        if (targetWidth / targetHeight > ratio) targetHeight = targetWidth / ratio
        else targetWidth = targetHeight * ratio
        const maxWidth = Math.min(1, 1 / ratio)
        const maxHeight = Math.min(1, ratio)
        targetWidth = clamp(targetWidth / zoom, 0.24, maxWidth)
        targetHeight = targetWidth / ratio
        if (targetHeight > maxHeight) {
          targetHeight = maxHeight
          targetWidth = targetHeight * ratio
        }
        const targetX = target ? target.x + target.width / 2 + velocityRef.current.x * 0.12 : 0.5
        const targetY = target ? target.y + target.height / 2 + velocityRef.current.y * 0.12 : 0.5
        const nextX = clamp(targetX, targetWidth / 2, 1 - targetWidth / 2)
        const nextY = clamp(targetY, targetHeight / 2, 1 - targetHeight / 2)
        const crop = cropRef.current
        crop.width += (targetWidth - crop.width) * sensitivityFactor
        crop.height += (targetHeight - crop.height) * sensitivityFactor
        crop.x += (nextX - crop.x) * sensitivityFactor
        crop.y += (nextY - crop.y) * sensitivityFactor

        const sx = (crop.x - crop.width / 2) * sourceWidth
        const sy = (crop.y - crop.height / 2) * sourceHeight
        const sw = crop.width * sourceWidth
        const sh = crop.height * sourceHeight
        context.save()
        context.clearRect(0, 0, canvas.width, canvas.height)
        if (facingMode === 'user' && mirror) {
          context.translate(canvas.width, 0)
          context.scale(-1, 1)
        }
        context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
        context.restore()
      }
      animationFrameRef.current = requestAnimationFrame(render)
    }
    animationFrameRef.current = requestAnimationFrame(render)
    return () => {
      controller.abort()
      cancelAnimationFrame(animationFrameRef.current)
    }
  }, [aiReady, bodyOn, cameraOn, faceOn, facingMode, mirror, sensitivity, trackingOn, zoom])

  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000)
    return () => window.clearInterval(timer)
  }, [recording])

  useEffect(() => {
    const onFullscreen = () => setFullscreen(document.fullscreenElement === previewRef.current)
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => document.removeEventListener('fullscreenchange', onFullscreen)
  }, [])

  const switchFacing = async () => {
    const next = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(next)
    setSelectedDevice('')
    await startCamera(undefined, next)
  }

  const toggleRecording = () => {
    if (recording) {
      recorderRef.current.stop()
      setRecording(false)
      return
    }
    if (!cameraOn || !canvasRef.current) return
    try {
      recorderRef.current.start(canvasRef.current, (clip) => {
        setLastRecording(clip)
        void saveRecording(clip).catch(() => {})
      })
      setRecordingSeconds(0)
      setRecording(true)
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  const toggleFullscreen = async () => {
    if (!previewRef.current) return
    try {
      if (!document.fullscreenElement) await previewRef.current.requestFullscreen()
      else await document.exitFullscreen()
    } catch {
      setError('Fullscreen is not available in this browser.')
    }
  }

  const formatTime = (time: number) => `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`

  return (
    <main className="studio-page">
      <header className="studio-header">
        <button className="studio-back" onClick={onExit} aria-label="Back to home" title="Back to home"><ArrowLeft size={18} /></button>
        <a className="wordmark" href="#studio"><span className="brand-mark"><Focus size={17} /></span>CENTRA<span>AI</span></a>
        <div className="studio-header-right"><span className="local-badge"><ShieldCheck size={14} /> ON-DEVICE</span><button className="icon-button" title="Help and privacy" aria-label="Help and privacy" onClick={() => setError('Camera processing and recording stay on this device. Nothing is uploaded.')}><CircleHelp size={17} /></button></div>
      </header>

      <div className="studio-layout" id="studio">
        <section className="preview-column">
          <div className="preview-heading"><div><span className="eyebrow">CAMERA STUDIO / 01</span><h1>Find your frame.</h1></div><div className="preview-status"><span className={`status-pip ${cameraOn ? 'active' : ''}`} />{cameraOn ? (aiReady && trackingOn ? (subjectFound ? 'SUBJECT IN FRAME' : 'SEARCHING FOR SUBJECT') : 'CAMERA LIVE') : 'CAMERA OFF'}</div></div>
          <div className={`camera-preview ${fullscreen ? 'is-fullscreen' : ''}`} ref={previewRef}>
            <video ref={videoRef} className="source-video" playsInline muted />
            <canvas ref={canvasRef} className={`output-canvas ${cameraOn && !previewMode ? 'visible' : ''}`} width={1280} height={720} />
            {previewMode && lastRecording && <video className="recorded-preview" src={lastRecording.url} controls playsInline autoPlay />}
            {!cameraOn && !previewMode && <div className="camera-empty"><div className="empty-symbol"><Camera size={24} /></div><p>Your frame is waiting.</p><span>Start your camera to see the live reframed view.</span><button className="preview-start" onClick={() => void startCamera()}><Play size={15} fill="currentColor" /> Start camera</button></div>}
            {cameraOn && <div className="preview-overlay"><div className="overlay-top"><span className="recording-label"><span className={`status-pip ${recording ? 'recording-pip' : 'active'}`} />{recording ? `REC ${formatTime(recordingSeconds)}` : 'LIVE PREVIEW'}</span><span className="overlay-ai"><Sparkles size={13} />{aiReady && trackingOn ? (subjectFound ? 'TRACKING' : 'AI READY') : 'AI PAUSED'}</span></div><button className="fullscreen-control" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>{fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}</button><div className="overlay-bottom"><span>{facingMode === 'user' ? 'FRONT CAMERA' : 'REAR CAMERA'}</span><span>{sourceSize || '—'}</span></div></div>}
          </div>
          {error && <div className="error-banner" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button></div>}
          {aiError && <p className="ai-note">AI models could not load. The camera remains available, but automatic tracking is paused.</p>}
          <div className="preview-footer"><span><MicOff size={13} /> AUDIO NOT RECORDED</span><span><ShieldCheck size={13} /> VIDEO STAYS ON DEVICE</span><button onClick={() => setMirror((value) => !value)} className={`mirror-button ${mirror ? 'selected' : ''}`} title="Mirror front camera" aria-label="Toggle mirror"><FlipHorizontal size={14} /> MIRROR</button></div>
        </section>

        <aside className="control-rail">
          <div className="rail-heading"><div><span className="eyebrow">YOUR CAMERA</span><h2>Controls</h2></div><Settings2 size={17} /></div>
          <button className={`camera-main-button ${cameraOn ? 'is-on' : ''}`} onClick={() => cameraOn ? stopCamera() : void startCamera()}>{cameraOn ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}{cameraOn ? 'Stop camera' : 'Start camera'}<span>{cameraOn ? 'LIVE' : 'READY'}</span></button>

          <div className="control-group"><div className="group-title">CAMERA SOURCE</div><label className="select-wrap"><Camera size={15} /><select aria-label="Select camera" value={selectedDevice} onChange={(event) => { setSelectedDevice(event.target.value); void startCamera(event.target.value) }} disabled={!devices.length}><option value="">{devices.length ? 'Select camera' : 'Default camera'}</option>{devices.map((device, index) => <option value={device.deviceId} key={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}</select><ChevronDown size={14} /></label><button className="text-control" onClick={() => void switchFacing()}><RotateCcw size={14} /> Switch front / rear</button></div>

          <div className="control-group"><div className="group-title">SMART FRAMING <span className="group-live">{trackingOn && aiReady ? 'ACTIVE' : 'MANUAL'}</span></div><div className="toggle-row"><span className="toggle-icon"><Sparkles size={15} /></span><div className="toggle-copy"><strong>Auto framing</strong><small>Follow movement</small></div><button className={`switch ${trackingOn ? 'on' : ''}`} role="switch" aria-checked={trackingOn} aria-label="Toggle auto framing" onClick={() => setTrackingOn((value) => !value)}><i /></button></div><div className="toggle-row"><span className="toggle-icon"><ScanFace size={15} /></span><div className="toggle-copy"><strong>Face tracking</strong><small>Detect faces</small></div><button className={`switch ${faceOn ? 'on' : ''}`} role="switch" aria-checked={faceOn} aria-label="Toggle face tracking" onClick={() => setFaceOn((value) => !value)}><i /></button></div><div className="toggle-row"><span className="toggle-icon"><Focus size={15} /></span><div className="toggle-copy"><strong>Body tracking</strong><small>Follow full posture</small></div><button className={`switch ${bodyOn ? 'on' : ''}`} role="switch" aria-checked={bodyOn} aria-label="Toggle body tracking" onClick={() => setBodyOn((value) => !value)}><i /></button></div></div>

          <div className="control-group compact-group"><div className="range-label"><span>Tracking sensitivity</span><b>{sensitivity}%</b></div><input aria-label="Tracking sensitivity" type="range" min="10" max="100" value={sensitivity} onChange={(event) => setSensitivity(Number(event.target.value))} /><div className="range-hints"><span>STEADY</span><span>RESPONSIVE</span></div></div>

          <div className="control-group compact-group"><div className="range-label"><span>Framing zoom</span><b>{zoom.toFixed(1)}×</b></div><input aria-label="Framing zoom" type="range" min="1" max="2.4" step="0.1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><div className="range-hints"><span>WIDE</span><span>CLOSE</span></div></div>

          <div className="record-section"><div className="record-head"><div><span className="group-title">RECORDING</span><strong>{recording ? formatTime(recordingSeconds) : 'Capture your moment'}</strong></div><span className={`record-dot ${recording ? 'is-recording' : ''}`} /></div><button className={`record-button ${recording ? 'recording' : ''}`} onClick={toggleRecording} disabled={!cameraOn}>{recording ? <><span className="stop-square" /> Stop recording</> : <><Video size={16} /> Record reframed video</>}</button>{lastRecording && <div className="clip-actions"><button onClick={() => setPreviewMode((value) => !value)}><Play size={13} />{previewMode ? 'Back to camera' : 'Preview clip'}</button><a href={lastRecording.url} download={`centra-recording.${lastRecording.mimeType.includes('mp4') ? 'mp4' : 'webm'}`}><Download size={13} /> Save video</a></div>}</div>

          <button className="advanced-button" onClick={() => setSettingsOpen((value) => !value)}><Settings2 size={14} /> Camera settings <ChevronDown size={14} className={settingsOpen ? 'rotated' : ''} /></button>
          {settingsOpen && <div className="advanced-panel"><div><span>Resolution</span><b>Adaptive · up to 1280 × 720</b></div><div><span>Processing</span><b>{aiReady ? 'On-device MediaPipe' : 'Loading AI models'}</b></div><div><span>Connection</span><b>{window.isSecureContext ? 'Secure context' : 'HTTPS required for camera'}</b></div></div>}
          <p className="privacy-caption"><ShieldCheck size={13} /> Camera access ends when you leave the studio.</p>
        </aside>
      </div>
      <footer className="studio-footer"><span><span className="brand-mini"><Focus size={12} /></span> CENTRA AI</span><span>YOUR CAMERA. YOUR MOVEMENT. ALWAYS IN FRAME.</span><button onClick={() => { stopCamera(); onExit() }}><X size={13} /> EXIT STUDIO</button></footer>
    </main>
  )
}

export default CameraStudio