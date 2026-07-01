import './style.css'
import { createARSession, type ARSession, type ARTrackingStatus } from './ar-core'
import {
  getTargetIdFromUrl,
  loadTargetBundle,
  resolveAssetUrl,
  TargetBundleError,
} from './loader'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <div class="ar-stage" id="ar-stage"></div>
  <div class="camera-overlay">
    <div>
      <div class="status-pill" id="status-pill" data-status="idle">
        Initializing…
      </div>
      <button class="retry-button" id="retry-button" type="button" hidden>
        Retry
      </button>
    </div>
  </div>
`

const arStage = document.querySelector<HTMLDivElement>('#ar-stage')!
const statusPill = document.querySelector<HTMLDivElement>('#status-pill')!
const retryButton = document.querySelector<HTMLButtonElement>('#retry-button')!

let activeSession: ARSession | null = null
let bootToken = 0

function setStatus(status: ARTrackingStatus | 'loading-bundle' | 'idle', message?: string): void {
  statusPill.dataset.status = status

  switch (status) {
    case 'loading-bundle':
      statusPill.textContent = message ?? 'Loading target bundle…'
      retryButton.hidden = true
      break
    case 'initializing':
      statusPill.textContent = message ?? 'Starting AR…'
      retryButton.hidden = true
      break
    case 'scanning':
      statusPill.textContent = message ?? 'Scan the printed image…'
      retryButton.hidden = true
      break
    case 'locked':
      statusPill.textContent = message ?? 'Target locked.'
      retryButton.hidden = true
      break
    case 'lost':
      statusPill.textContent = message ?? 'Target lost — scan again.'
      retryButton.hidden = true
      break
    case 'error':
      statusPill.textContent = message ?? 'Something went wrong.'
      retryButton.hidden = false
      break
    default:
      statusPill.textContent = message ?? 'Initializing…'
  }
}

async function boot(): Promise<void> {
  const token = ++bootToken
  const targetId = getTargetIdFromUrl()!

  if (activeSession) {
    activeSession.stop()
    activeSession = null
  }

  try {
    setStatus('loading-bundle', `Loading ${targetId}…`)
    const bundle = await loadTargetBundle(targetId)
    if (token !== bootToken) return

    const mindUrl = resolveAssetUrl(bundle.baseUrl, bundle.meta.mind_file)
    const sourceUrl = resolveAssetUrl(bundle.baseUrl, bundle.meta.source)
    const depthUrl = resolveAssetUrl(bundle.baseUrl, bundle.meta.depth)
    const maskBackgroundUrl = resolveAssetUrl(bundle.baseUrl, bundle.meta.layers.background.mask)
    const maskForegroundUrl = resolveAssetUrl(bundle.baseUrl, bundle.meta.layers.foreground.mask)

    await Promise.all([
      bundle.loadMind(),
      bundle.loadDepth(),
      bundle.loadMaskBackground(),
      bundle.loadMaskForeground(),
    ])
    if (token !== bootToken) return

    activeSession = await createARSession({
      container: arStage,
      mindUrl,
      sourceUrl,
      depthUrl,
      maskBackgroundUrl,
      maskForegroundUrl,
      meta: bundle.meta,
      onStatus: (status, message) => {
        if (token !== bootToken) return
        setStatus(status, message)
      },
    })

    await activeSession.start()
  } catch (error) {
    if (token !== bootToken) return

    if (error instanceof TargetBundleError) {
      const hint =
        error.status === 404
          ? `Target "${error.targetId}" not found.`
          : error.message
      setStatus('error', hint)
      return
    }

    setStatus('error', 'Failed to start AR session.')
    console.error('[WebAR] boot failed:', error)
  }
}

retryButton.addEventListener('click', () => {
  void boot()
})

window.addEventListener('beforeunload', () => {
  activeSession?.stop()
})

void boot()
