const CDN_BASE = import.meta.env.VITE_BUNDLE_CDN_URL?.replace(/\/$/, '') ?? ''

export function getTargetIdFromUrl(search = window.location.search): string | null {
  return new URLSearchParams(search).get('target')
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

export function getArPageUrl(targetId: string, origin = window.location.origin): string {
  return `${origin}/ar?target=${encodeURIComponent(targetId)}`
}
