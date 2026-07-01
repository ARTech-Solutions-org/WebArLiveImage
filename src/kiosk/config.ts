import { getArPageUrl, getTargetIdFromUrl, resolveAssetUrl, resolveBundleBaseUrl } from '../loader/config'

export function getKioskTargetId(search = window.location.search): string | null {
  return new URLSearchParams(search).get('target')
}

export function getKioskPageUrl(targetId: string, origin = window.location.origin): string {
  return `${origin}/kiosk?target=${encodeURIComponent(targetId)}`
}

export function getBundleSourceUrl(targetId: string): string {
  const base = resolveBundleBaseUrl(targetId)
  return resolveAssetUrl(base, 'source.jpg')
}

export { getArPageUrl, getTargetIdFromUrl }
