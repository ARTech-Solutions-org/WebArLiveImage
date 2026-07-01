import { resolveAssetUrl, resolveBundleBaseUrl } from './config'
import type { BundleMeta, LoadedAsset, TargetBundle } from './types'

export class TargetBundleError extends Error {
  readonly targetId: string
  readonly status?: number

  constructor(message: string, targetId: string, status?: number) {
    super(message)
    this.name = 'TargetBundleError'
    this.targetId = targetId
    this.status = status
  }
}

async function fetchAsset(
  baseUrl: string,
  targetId: string,
  filename: string,
): Promise<LoadedAsset> {
  const url = resolveAssetUrl(baseUrl, filename)
  const response = await fetch(url)

  if (!response.ok) {
    throw new TargetBundleError(`Failed to load ${filename} (${response.status})`, targetId, response.status)
  }

  const blob = await response.blob()
  return {
    name: filename,
    url,
    byteLength: blob.size,
    contentType: response.headers.get('content-type'),
  }
}

function lazyAsset(baseUrl: string, targetId: string, filename: string): () => Promise<LoadedAsset> {
  let pending: Promise<LoadedAsset> | null = null
  return () => {
    pending ??= fetchAsset(baseUrl, targetId, filename)
    return pending
  }
}

export async function loadTargetBundle(targetId: string): Promise<TargetBundle> {
  const baseUrl = resolveBundleBaseUrl(targetId)
  const metaUrl = resolveAssetUrl(baseUrl, 'meta.json')
  const response = await fetch(metaUrl)

  if (response.status === 404) {
    throw new TargetBundleError(`Target not found: ${targetId}`, targetId, 404)
  }

  if (!response.ok) {
    throw new TargetBundleError(
      `Failed to load meta.json (${response.status})`,
      targetId,
      response.status,
    )
  }

  const meta = (await response.json()) as BundleMeta

  if (meta.target_id && meta.target_id !== targetId) {
    console.warn(
      `[loader] URL target "${targetId}" differs from meta.target_id "${meta.target_id}"`,
    )
  }

  const loadSource = lazyAsset(baseUrl, targetId, meta.source)
  const loadDepth = lazyAsset(baseUrl, targetId, meta.depth)
  const loadMaskForeground = lazyAsset(baseUrl, targetId, meta.layers.foreground.mask)
  const loadMaskBackground = lazyAsset(baseUrl, targetId, meta.layers.background.mask)
  const loadMind = lazyAsset(baseUrl, targetId, meta.mind_file)

  return {
    targetId,
    baseUrl,
    meta,
    loadSource,
    loadDepth,
    loadMaskForeground,
    loadMaskBackground,
    loadMind,
    loadAllAssets: async () =>
      Promise.all([
        loadSource(),
        loadDepth(),
        loadMaskForeground(),
        loadMaskBackground(),
        loadMind(),
      ]),
  }
}

export function logTargetBundle(bundle: TargetBundle, assets: LoadedAsset[]): void {
  const { meta } = bundle

  console.group(`[WebAR] Target bundle: ${bundle.targetId}`)
  console.log('baseUrl:', bundle.baseUrl)
  console.log('meta:', meta)
  console.table(
    assets.map((asset) => ({
      file: asset.name,
      bytes: asset.byteLength,
      type: asset.contentType ?? 'unknown',
    })),
  )
  console.log('layers:', {
    background: meta.layers.background,
    foreground: meta.layers.foreground,
  })
  console.log('tracking:', meta.tracking)
  console.groupEnd()
}
