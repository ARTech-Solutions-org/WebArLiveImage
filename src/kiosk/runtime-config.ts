import { resolveBundleBaseUrl } from '../loader/config'
import { fetchKioskConfig, type KioskServerConfig } from './api'
import { getKioskApiBaseUrl } from './config'

export interface KioskPublicConfig {
  appOrigin: string
  bundleCdnUrl: string | null
  hasCdn: boolean
}

let cached: KioskPublicConfig | null = null

export function resetKioskPublicConfigCache(): void {
  cached = null
}

export async function loadKioskPublicConfig(): Promise<KioskPublicConfig> {
  if (cached) return cached

  const envAppOrigin = import.meta.env.VITE_PUBLIC_APP_URL?.replace(/\/$/, '') || null
  const envCdnUrl = import.meta.env.VITE_BUNDLE_CDN_URL?.replace(/\/$/, '') || null

  let remote: KioskServerConfig | null = null
  try {
    remote = await fetchKioskConfig()
  } catch {
    remote = null
  }

  cached = {
    appOrigin:
      envAppOrigin ||
      remote?.appUrl?.replace(/\/$/, '') ||
      window.location.origin,
    bundleCdnUrl: envCdnUrl || remote?.bundleCdnUrl?.replace(/\/$/, '') || null,
    hasCdn: Boolean(envCdnUrl || remote?.hasCdn),
  }

  return cached
}

/** Bundle base for kiosk preview — CDN, local API proxy, or same-origin /targets. */
export function resolveKioskBundleBase(targetId: string, cfg: KioskPublicConfig): string {
  if (cfg.bundleCdnUrl) {
    return `${cfg.bundleCdnUrl}/${targetId}`
  }

  const apiBase = getKioskApiBaseUrl()
  if (apiBase) {
    return `${apiBase}/api/bundles/${encodeURIComponent(targetId)}`
  }

  return resolveBundleBaseUrl(targetId)
}
