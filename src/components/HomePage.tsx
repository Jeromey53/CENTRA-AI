import {
  ArrowDown, ArrowRight, ArrowUpRight, Camera, Download, Focus, ScanFace, ShieldCheck, Sparkles, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

type Props = { onLaunch: () => void }
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function HomePage({ onLaunch }: Props) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [appInstalled, setAppInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches)
  const [installHelpOpen, setInstallHelpOpen] = useState(false)

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const onAppInstalled = () => {
      setAppInstalled(true)
      setInstallPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  useEffect(() => {
    if (!installHelpOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInstallHelpOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [installHelpOpen])

  const addToHomeScreen = async () => {
    if (!installPrompt) {
      setInstallHelpOpen(true)
      return
    }
    try {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      setInstallPrompt(null)
      if (choice.outcome === 'accepted') setAppInstalled(true)
      else setInstallHelpOpen(true)
    } catch {
      setInstallHelpOpen(true)
    }
  }

  return (
    <main className="home-page">
      <header className="site-header">
        <a className="wordmark" href="#home" aria-label="CENTRA AI home"><span className="brand-mark"><Focus size={18} /></span>CENTRA<span>AI</span></a>
        <nav className="header-links"><a href="#approach">The approach</a><a href="#privacy">Privacy</a></nav>
        <div className="header-actions">
          <button className="header-install" onClick={() => void addToHomeScreen()} disabled={appInstalled}><Download size={14} />{appInstalled ? 'Added' : 'Install'}</button>
          <button className="header-launch" onClick={onLaunch}><span>Open studio</span> <ArrowUpRight size={15} /></button>
        </div>
      </header>

      <section className="hero-section" id="home">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> ON-DEVICE CAMERA INTELLIGENCE</div>
          <h1>Your camera.<br /><span>Your movement.</span><br />Always in frame.</h1>
          <p className="hero-description">A camera that follows the moment, not the other way around. CENTRA uses on-device AI to keep you naturally in frame as you move.</p>
          <div className="hero-actions"><button className="primary-button" onClick={onLaunch}><Camera size={17} /> Launch camera <ArrowRight size={16} /></button><a className="quiet-link" href="#approach">Meet CENTRA <ArrowDown size={14} /></a></div>
          <div className="hero-proof"><ShieldCheck size={15} /><span>Private by design</span><i />No account required<i />Works in your browser</div>
        </div>
        <div className="hero-art" aria-label="CENTRA AI subject tracking preview">
          <div className="orbit orbit-a" /><div className="orbit orbit-b" />
          <div className="tracking-window">
            <div className="window-top"><span><span className="live-dot" /> CENTRA LIVE</span><span>AI FRAME / 01</span></div>
            <div className="portrait-scene">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=960&q=85" alt="Portrait in a camera frame" />
              <div className="scene-grid" /><div className="portrait-shade" />
              <div className="focus-box"><span /><span /><span /><span /></div>
              <div className="tracking-label"><span className="live-dot" /> SUBJECT LOCKED <b>98%</b></div>
              <div className="frame-label frame-top">Y + 018</div><div className="frame-label frame-side">X − 004</div>
            </div>
            <div className="window-bottom"><span><ScanFace size={13} /> TRACKING ACTIVE</span><span>30 FPS <i /> LOCAL AI</span></div>
          </div>
          <div className="float-chip chip-face"><ScanFace size={15} /><span>Face detected</span><b /></div>
          <div className="float-chip chip-motion"><span className="motion-bars"><i /><i /><i /><i /><i /></span><span>Motion adaptive</span></div>
          <div className="art-caption">A LITTLE MORE ROOM TO BE IN THE MOMENT <span>01 — 03</span></div>
        </div>
      </section>

      <section className="signal-strip"><div><span className="strip-index">01</span><strong>Finds you</strong><span>Face and body tracking</span></div><div><span className="strip-index">02</span><strong>Follows smoothly</strong><span>Responsive, steady framing</span></div><div><span className="strip-index">03</span><strong>Stays yours</strong><span>Processing on your device</span></div></section>

      <section className="detail-section" id="approach">
        <div className="section-heading"><span className="eyebrow">A CAMERA THAT MOVES WITH YOU</span><h2>More presence.<br /><em>Less adjusting.</em></h2><p>Thoughtful software that helps you stay in the conversation, wherever it goes.</p></div>
        <div className="feature-list">
          <article><span className="feature-icon"><ScanFace size={19} /></span><div><h3>Intelligent framing</h3><p>Face and pose detection work together to keep the picture composed as you shift, stand, or lean in.</p></div><span className="feature-number">01</span></article>
          <article><span className="feature-icon blue"><Sparkles size={18} /></span><div><h3>A softer kind of tracking</h3><p>Movement-aware smoothing keeps the frame responsive without the abrupt corrections.</p></div><span className="feature-number">02</span></article>
          <article id="privacy"><span className="feature-icon green"><ShieldCheck size={18} /></span><div><h3>Your camera stays yours</h3><p>Video is processed locally in your browser. Nothing is uploaded or stored unless you choose to record.</p></div><span className="feature-number">03</span></article>
        </div>
      </section>

      <section className="closing-band"><div><span className="eyebrow">READY WHEN YOU ARE</span><h2>Step into the frame.</h2></div><button className="primary-button" onClick={onLaunch}><Camera size={17} /> Launch camera <ArrowUpRight size={15} /></button></section>
      <footer className="site-footer"><a className="wordmark" href="#home"><span className="brand-mark"><Focus size={16} /></span>CENTRA<span>AI</span></a><span className="site-tagline">Thoughtful camera technology, made personal.</span><span className="creator-credit">BUILT BY JERRY JEROME OJONG</span><button className="install-button" onClick={() => void addToHomeScreen()} disabled={appInstalled}><Download size={14} />{appInstalled ? 'Added to home screen' : 'Add to home screen'}</button></footer>
      {installHelpOpen && <div className="install-backdrop" onClick={() => setInstallHelpOpen(false)}>
        <section className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={(event) => event.stopPropagation()}>
          <button className="install-close" onClick={() => setInstallHelpOpen(false)} aria-label="Close install instructions"><X size={17} /></button>
          <span className="eyebrow">TAKE CENTRA WITH YOU</span>
          <h2 id="install-title">Add CENTRA AI to your home screen</h2>
          <p>Install this website for a full-screen app experience. You need to open it over HTTPS.</p>
          <div className="install-steps"><strong>iPhone or iPad</strong><ol><li>Open this page in Safari.</li><li>Tap the Share button.</li><li>Choose <b>Add to Home Screen</b>, then tap <b>Add</b>.</li></ol></div>
          <div className="install-steps"><strong>Android or desktop</strong><ol><li>Open your browser menu.</li><li>Choose <b>Install app</b> or <b>Add to Home screen</b>.</li></ol></div>
        </section>
      </div>}
    </main>
  )
}

export default HomePage