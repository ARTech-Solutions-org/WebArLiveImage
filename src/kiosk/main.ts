import QRCode from 'qrcode'
import './style.css'
import { getArPageUrl, getBundleSourceUrl, getKioskPageUrl, getKioskTargetId, isCaptureRoute } from './config'
import { mountCaptureView } from './capture'
import { loadKioskPublicConfig, resetKioskPublicConfigCache, resolveKioskBundleBase } from './runtime-config'

const app = document.querySelector<HTMLDivElement>('#app')!

let captureCleanup: (() => void) | null = null

function renderShell(content: string): void {
  captureCleanup?.()
  captureCleanup = null

  app.innerHTML = `
    <div class="kiosk">
      <header class="kiosk-header">
        <h1>Photo Comes Alive — Kiosk</h1>
        <a href="/">Open AR app</a>
      </header>
      ${content}
    </div>
  `
}

function renderLanding(): void {
  renderShell(`
    <section class="panel hero-panel">
      <h2>Welcome</h2>
      <p class="muted">Step up to the booth and take your photo. We will turn it into a live AR experience.</p>
      <div class="row">
        <a class="button capture-cta" href="/kiosk/capture">Take photo</a>
        <a class="button secondary" href="/kiosk?target=target_001">Demo target_001</a>
      </div>
    </section>
    <section class="panel">
      <h2>Already processed?</h2>
      <p class="muted">Enter a target ID to show the booth preview screen.</p>
      <form class="row" id="target-form">
        <input id="target-input" type="text" placeholder="guest_20260701_123456" />
        <button type="submit">Show preview</button>
      </form>
    </section>
  `)

  document.querySelector<HTMLFormElement>('#target-form')!.addEventListener('submit', (event) => {
    event.preventDefault()
    const value = document.querySelector<HTMLInputElement>('#target-input')!.value.trim()
    if (!value) return
    window.location.href = `/kiosk?target=${encodeURIComponent(value)}`
  })
}

function renderCapture(): void {
  renderShell('<div id="capture-root"></div>')
  const root = document.querySelector<HTMLDivElement>('#capture-root')!
  captureCleanup = mountCaptureView(root, (result) => {
    window.location.href = `/kiosk?target=${encodeURIComponent(result.targetId)}`
  })
}

async function renderTargetPreview(targetId: string): Promise<void> {
  resetKioskPublicConfigCache()
  const publicConfig = await loadKioskPublicConfig()
  const bundleBase = resolveKioskBundleBase(targetId, publicConfig)
  const sourceUrl = getBundleSourceUrl(targetId, bundleBase)
  const arUrl = getArPageUrl(targetId, publicConfig.appOrigin)
  const kioskUrl = getKioskPageUrl(targetId, publicConfig.appOrigin)
  const isGuest = targetId.startsWith('guest_')
  const cdnWarning =
    isGuest && !publicConfig.hasCdn
      ? `<p class="error">Guest targets need CDN upload. Set <code>cdn</code> in <code>kiosk/config.json</code> and <code>VITE_BUNDLE_CDN_URL</code> on Vercel so phones can load the bundle.</p>`
      : ''

  renderShell(`
    <section class="panel">
      <p class="muted">Target: <code>${targetId}</code></p>
      ${cdnWarning}
      <div class="row" style="margin-bottom: 1rem;">
        <a class="button" href="${arUrl}" target="_blank" rel="noopener">Open AR experience</a>
        <a class="button secondary" href="/kiosk/capture">Take another photo</a>
        <a class="button secondary" href="/kiosk">Back</a>
      </div>
      <div class="preview-grid">
        <div>
          <h2>Print / display this photo</h2>
          <div class="photo-frame">
            <img id="source-preview" alt="Target source" />
          </div>
          <p id="photo-status" class="muted" style="margin-top: 0.75rem;"></p>
        </div>
        <div class="qr-wrap">
          <h2>Scan to open AR</h2>
          <canvas id="qr-canvas" width="280" height="280" aria-label="QR code"></canvas>
          <p class="code">${arUrl}</p>
          <p class="muted">Booth URL:<br /><span class="code">${kioskUrl}</span></p>
        </div>
      </div>
    </section>
    <section class="panel">
      <h2>On-site steps</h2>
      <ol class="flow-list">
        <li>Show the photo on this screen (or hand the guest a print of the same image).</li>
        <li>Guest scans the QR or opens the AR link on their phone.</li>
        <li>They point the phone at this photo to lock tracking and see the 2.5D effect.</li>
      </ol>
    </section>
  `)

  const image = document.querySelector<HTMLImageElement>('#source-preview')!
  const status = document.querySelector<HTMLParagraphElement>('#photo-status')!
  const canvas = document.querySelector<HTMLCanvasElement>('#qr-canvas')!

  image.addEventListener('load', () => {
    status.textContent = 'Photo loaded. Ready for guest scan.'
  })
  image.addEventListener('error', () => {
    status.innerHTML = `<span class="error">Could not load bundle at ${sourceUrl}. ${
      isGuest
        ? 'Ensure ingest finished and CDN upload succeeded (or booth API is running).'
        : 'Run ingest/upload first.'
    }</span>`
  })
  image.src = sourceUrl

  await QRCode.toCanvas(canvas, arUrl, {
    margin: 1,
    width: 280,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

async function boot(): Promise<void> {
  if (isCaptureRoute()) {
    renderCapture()
    return
  }

  const targetId = getKioskTargetId()
  if (!targetId) {
    renderLanding()
    return
  }
  await renderTargetPreview(targetId)
}

void boot()
