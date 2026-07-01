import { getArPageUrl, getTargetIdFromUrl, resolveAssetUrl } from '../loader/config'

const KIOSK_API_BASE = import.meta.env.VITE_KIOSK_API_URL?.replace(/\/$/, '')

/** Booth ingest API — local PC only. Dev uses Vite /api proxy; production defaults to loopback. */
export function getKioskApiBaseUrl(): string {
  if (KIOSK_API_BASE) return KIOSK_API_BASE
  if (import.meta.env.DEV) return ''
  return 'http://127.0.0.1:8787'
}

export function isCaptureRoute(pathname = window.location.pathname): boolean {
  const path = pathname.replace(/\/$/, '')
  return path.endsWith('/capture')
}

export function getKioskTargetId(search = window.location.search): string | null {
  return new URLSearchParams(search).get('target')
}

export function getKioskPageUrl(targetId: string, origin?: string): string {
  const base = origin ?? import.meta.env.VITE_PUBLIC_APP_URL?.replace(/\/$/, '') ?? window.location.origin
  return `${base}/kiosk?target=${encodeURIComponent(targetId)}`
}

export function getBundleSourceUrl(_targetId: string, bundleBase: string): string {
  return resolveAssetUrl(bundleBase, 'source.jpg')
}

export { getArPageUrl, getTargetIdFromUrl }
