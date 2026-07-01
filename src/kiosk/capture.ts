import { startCameraFeed, stopCameraFeed } from '../ar-core/camera'
import { checkKioskApiHealth, createPhotoJob, waitForJob } from './api'
import { getKioskApiBaseUrl } from './config'

const BOOTH_CAMERA: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'user' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
}

type CapturePhase = 'camera' | 'review' | 'processing'

export function mountCaptureView(root: HTMLElement, onComplete: (targetId: string) => void): () => void {
  let stream: MediaStream | null = null
  let capturedBlob: Blob | null = null
  let phase: CapturePhase = 'camera'
  let disposed = false

  root.innerHTML = `
    <section class="panel capture-panel">
      <div class="capture-header">
        <h2>Take your photo</h2>
        <a class="button secondary" href="/kiosk">Cancel</a>
      </div>
      <p id="capture-status" class="muted">Checking booth service…</p>
      <div class="capture-stage">
        <div class="camera-wrap" id="camera-wrap">
          <video id="capture-video" playsinline muted></video>
          <div class="camera-guide" aria-hidden="true"></div>
        </div>
        <canvas id="capture-canvas" class="hidden" aria-hidden="true"></canvas>
        <img id="capture-preview" class="capture-preview hidden" alt="Captured photo preview" />
      </div>
      <div class="capture-actions row" id="capture-actions"></div>
    </section>
    <section class="panel">
      <h2>What happens next</h2>
      <ol class="flow-list">
        <li>We process depth and tracking on this booth PC (about 1–3 minutes).</li>
        <li>Your photo appears on screen with a QR code.</li>
        <li>Scan the QR on your phone and point it at this photo to see the AR effect.</li>
      </ol>
    </section>
  `

  const statusEl = root.querySelector<HTMLParagraphElement>('#capture-status')!
  const video = root.querySelector<HTMLVideoElement>('#capture-video')!
  const canvas = root.querySelector<HTMLCanvasElement>('#capture-canvas')!
  const preview = root.querySelector<HTMLImageElement>('#capture-preview')!
  const cameraWrap = root.querySelector<HTMLDivElement>('#camera-wrap')!
  const actions = root.querySelector<HTMLDivElement>('#capture-actions')!

  function setStatus(message: string, isError = false): void {
    statusEl.textContent = message
    statusEl.classList.toggle('error', isError)
    statusEl.classList.toggle('muted', !isError)
  }

  function renderActions(): void {
    if (phase === 'camera') {
      actions.innerHTML = `
        <button type="button" class="capture-cta" id="btn-capture">Take photo</button>
      `
      actions.querySelector<HTMLButtonElement>('#btn-capture')!.addEventListener('click', () => {
        void takeSnapshot()
      })
      return
    }

    if (phase === 'review') {
      actions.innerHTML = `
        <button type="button" class="capture-cta" id="btn-use">Use this photo</button>
        <button type="button" class="secondary" id="btn-retake">Retake</button>
      `
      actions.querySelector<HTMLButtonElement>('#btn-retake')!.addEventListener('click', () => {
        void retake()
      })
      actions.querySelector<HTMLButtonElement>('#btn-use')!.addEventListener('click', () => {
        void submitPhoto()
      })
      return
    }

    actions.innerHTML = `<p class="muted processing-note">Please wait — do not close this page.</p>`
  }

  async function startCamera(): Promise<void> {
    if (disposed) return
    try {
      stream = await startCameraFeed({
        video,
        constraints: BOOTH_CAMERA,
        onStatus: (cameraStatus, message) => {
          if (cameraStatus === 'requesting') setStatus('Starting camera…')
          if (cameraStatus === 'error' && message) setStatus(message, true)
        },
      })
      setStatus('Position yourself in the frame, then tap Take photo.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Camera unavailable.', true)
    }
  }

  async function takeSnapshot(): Promise<void> {
    if (!stream || video.videoWidth === 0) {
      setStatus('Camera is not ready yet.', true)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    capturedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92)
    })

    if (!capturedBlob) {
      setStatus('Could not capture photo.', true)
      return
    }

    stopCameraFeed(stream, video)
    stream = null

    preview.src = URL.createObjectURL(capturedBlob)
    preview.classList.remove('hidden')
    cameraWrap.classList.add('hidden')
    phase = 'review'
    setStatus('Happy with this shot?')
    renderActions()
  }

  async function retake(): Promise<void> {
    if (preview.src) URL.revokeObjectURL(preview.src)
    preview.src = ''
    preview.classList.add('hidden')
    cameraWrap.classList.remove('hidden')
    capturedBlob = null
    phase = 'camera'
    renderActions()
    await startCamera()
  }

  async function submitPhoto(): Promise<void> {
    if (!capturedBlob) return

    phase = 'processing'
    renderActions()
    setStatus('Uploading photo…')

    try {
      const created = await createPhotoJob(capturedBlob)
      setStatus('Processing depth and AR target — this can take a few minutes…')

      const finalStatus = await waitForJob(created.jobId, (job) => {
        if (job.status === 'processing') {
          setStatus('Processing depth and AR target — this can take a few minutes…')
        }
        if (job.status === 'queued') {
          setStatus('Queued for processing…')
        }
      })

      if (finalStatus.status === 'failed') {
        throw new Error(finalStatus.error || 'Processing failed.')
      }

      setStatus('Done! Opening your preview…')
      onComplete(finalStatus.targetId)
    } catch (error) {
      phase = 'review'
      renderActions()
      setStatus(error instanceof Error ? error.message : 'Upload failed.', true)
    }
  }

  void (async () => {
    const apiReady = await checkKioskApiHealth()
    if (!apiReady) {
      const apiBase = getKioskApiBaseUrl() || window.location.origin
      setStatus(
        `Booth service is offline (${apiBase}/api/health). In a terminal on this PC run: npm run kiosk:server`,
        true,
      )
      actions.innerHTML = `
        <button type="button" class="secondary" id="btn-retry">Retry connection</button>
        <a class="button secondary" href="/kiosk">Back</a>
      `
      actions.querySelector<HTMLButtonElement>('#btn-retry')!.addEventListener('click', () => {
        window.location.reload()
      })
      return
    }

    renderActions()
    await startCamera()
  })()

  return () => {
    disposed = true
    stopCameraFeed(stream, video)
    if (preview.src) URL.revokeObjectURL(preview.src)
  }
}
