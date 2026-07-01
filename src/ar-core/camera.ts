export type CameraStatus = 'idle' | 'requesting' | 'active' | 'error'

export interface CameraFeedOptions {
  video: HTMLVideoElement
  onStatus?: (status: CameraStatus, message?: string) => void
  constraints?: MediaStreamConstraints
}

const PREFERRED_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
}

export async function startCameraFeed({
  video,
  onStatus,
  constraints = PREFERRED_CONSTRAINTS,
}: CameraFeedOptions): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    const message = 'Camera API is not available in this browser.'
    onStatus?.('error', message)
    throw new Error(message)
  }

  onStatus?.('requesting')

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints)
  } catch (primaryError) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    } catch (fallbackError) {
      const message = describeCameraError(primaryError, fallbackError)
      onStatus?.('error', message)
      throw new Error(message)
    }
  }

  video.srcObject = stream
  video.setAttribute('playsinline', '')
  video.muted = true

  await video.play()
  onStatus?.('active')
  return stream
}

export function stopCameraFeed(stream: MediaStream | null, video: HTMLVideoElement): void {
  stream?.getTracks().forEach((track) => track.stop())
  video.srcObject = null
}

function describeCameraError(primary: unknown, fallback: unknown): string {
  const error = primary instanceof DOMException ? primary : fallback
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
        return 'Camera permission was denied. Allow camera access and reload.'
      case 'NotFoundError':
        return 'No camera was found on this device.'
      case 'NotReadableError':
        return 'Camera is in use by another application.'
      case 'SecurityError':
        return 'Camera access requires a secure (HTTPS) connection.'
      default:
        return error.message || 'Unable to access the camera.'
    }
  }

  return 'Unable to access the camera.'
}
