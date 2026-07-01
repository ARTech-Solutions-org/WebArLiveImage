import QRCode from 'qrcode'
import './style.css'
import { getArPageUrl, getBundleSourceUrl, getKioskPageUrl, getKioskTargetId } from './config'

const app = document.querySelector<HTMLDivElement>('#app')!

function renderShell(content: string): void {
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
    <section class="panel">
      <h2>Booth display</h2>
      <p class="muted">Enter a target ID after ingest, or open a demo target.</p>
      <form class="row" id="target-form">
        <input id="target-input" type="text" placeholder="guest_20260701_123456" />
        <button type="submit">Show preview</button>
        <a class="button secondary" href="/kiosk?target=target_001">Demo target_001</a>
      </form>
    </section>
    <section class="panel">
      <h2>Two flows, one deployment</h2>
      <ul class="flow-list">
        <li><strong>Fixed targets</strong> — pre-ingested bundles like <code>target_001</code></li>
        <li><strong>Kiosk guests</strong> — <code>run_job.py</code> creates a new bundle per photo</li>
      </ul>
      <p class="muted">AR experience always opens at <code>/?target=ID</code>. This page is the booth screen at <code>/kiosk?target=ID</code>.</p>
    </section>
  `)

  document.querySelector<HTMLFormElement>('#target-form')!.addEventListener('submit', (event) => {
    event.preventDefault()
    const value = document.querySelector<HTMLInputElement>('#target-input')!.value.trim()
    if (!value) return
    window.location.search = `?target=${encodeURIComponent(value)}`
  })
}

async function renderTargetPreview(targetId: string): Promise<void> {
  const sourceUrl = getBundleSourceUrl(targetId)
  const arUrl = getArPageUrl(targetId)
  const kioskUrl = getKioskPageUrl(targetId)

  renderShell(`
    <section class="panel">
      <p class="muted">Target: <code>${targetId}</code></p>
      <div class="row" style="margin-bottom: 1rem;">
        <a class="button" href="${arUrl}" target="_blank" rel="noopener">Open AR experience</a>
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
    status.innerHTML = `<span class="error">Could not load bundle at ${sourceUrl}. Run ingest/upload first.</span>`
  })
  image.src = sourceUrl

  await QRCode.toCanvas(canvas, arUrl, {
    margin: 1,
    width: 280,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

async function boot(): Promise<void> {
  const targetId = getKioskTargetId()
  if (!targetId) {
    renderLanding()
    return
  }
  await renderTargetPreview(targetId)
}

void boot()
