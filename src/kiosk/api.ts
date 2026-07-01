import { getKioskApiBaseUrl } from './config'

export interface KioskServerConfig {
  appUrl: string | null
  bundleCdnUrl: string | null
  hasCdn: boolean
}

export type JobState = 'queued' | 'processing' | 'complete' | 'failed'

export interface CreateJobResponse {
  jobId: string
  targetId: string
  status: JobState
  arUrl: string
  kioskUrl: string
}

export interface JobStatusResponse extends CreateJobResponse {
  error: string | null
}

export interface CaptureCompleteResult {
  targetId: string
  kioskUrl: string
  arUrl: string
}

function apiUrl(path: string): string {
  const base = getKioskApiBaseUrl()
  return `${base}${path}`
}

export async function fetchKioskConfig(): Promise<KioskServerConfig> {
  const response = await fetch(apiUrl('/api/config'))
  if (!response.ok) {
    throw new Error(`Config unavailable (${response.status})`)
  }
  return (await response.json()) as KioskServerConfig
}

export async function checkKioskApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(apiUrl('/api/health'), { method: 'GET' })
    if (!response.ok) return false
    const data = (await response.json()) as { ok?: boolean }
    return data.ok === true
  } catch {
    return false
  }
}

export async function createPhotoJob(photo: Blob): Promise<CreateJobResponse> {
  const formData = new FormData()
  formData.append('photo', photo, 'capture.jpg')

  const response = await fetch(apiUrl('/api/jobs'), {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Upload failed (${response.status})`)
  }

  return (await response.json()) as CreateJobResponse
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const response = await fetch(apiUrl(`/api/jobs/${jobId}`))
  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Status check failed (${response.status})`)
  }
  return (await response.json()) as JobStatusResponse
}

const POLL_MS = 1500

export async function waitForLocalBundle(targetId: string): Promise<void> {
  const apiBase = getKioskApiBaseUrl()
  const url = apiBase
    ? `${apiBase}/api/bundles/${encodeURIComponent(targetId)}/source.jpg`
    : `/api/bundles/${encodeURIComponent(targetId)}/source.jpg`

  for (let attempt = 0; attempt < 24; attempt += 1) {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (response.ok) return
    } catch {
      // retry
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1500))
  }

  throw new Error(
    `Bundle ${targetId} was not created. Check the kiosk server terminal for ingest/upload errors.`,
  )
}

export async function waitForBundleOnCdn(targetId: string, bundleCdnUrl: string): Promise<void> {
  const url = `${bundleCdnUrl.replace(/\/$/, '')}/${encodeURIComponent(targetId)}/source.jpg`
  for (let attempt = 0; attempt < 24; attempt += 1) {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (response.ok) return
    } catch {
      // retry
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1500))
  }
  throw new Error(
    `Bundle ${targetId} is not on CDN yet. Check the kiosk server terminal for upload errors, then retry.`,
  )
}

export async function waitForJob(
  jobId: string,
  onUpdate?: (status: JobStatusResponse) => void,
): Promise<JobStatusResponse> {
  for (;;) {
    const status = await getJobStatus(jobId)
    onUpdate?.(status)
    if (status.status === 'complete' || status.status === 'failed') {
      return status
    }
    await new Promise((resolve) => window.setTimeout(resolve, POLL_MS))
  }
}
