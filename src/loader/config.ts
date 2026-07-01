const CDN_BASE = import.meta.env.VITE_BUNDLE_CDN_URL?.replace(/\/$/, '') ?? ''
const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''
const DEFAULT_TARGET = import.meta.env.VITE_DEFAULT_TARGET?.trim() || 'target_001'

export function getTargetIdFromUrl(search = window.location.search): string | null {
  return new URLSearchParams(search).get('target') ?? DEFAULT_TARGET
}

/** Base URL for a target bundle (CDN root or same-origin /targets/{id}). */
export function resolveBundleBaseUrl(targetId: string): string {
  if (CDN_BASE) {
    return `${CDN_BASE}/${targetId}`
  }
  return `/targets/${targetId}`
}

export function resolveAssetUrl(baseUrl: string, filename: string): string {
  return `${baseUrl}/${filename.replace(/^\//, '')}`
}

export function getPublicAppOrigin(fallback = window.location.origin): string {
  return PUBLIC_APP_URL || fallback
}

export function getArPageUrl(targetId: string, origin = getPublicAppOrigin()): string {
  return `${origin}/?target=${encodeURIComponent(targetId)}`
}
