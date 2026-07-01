import { MindARThree } from 'mind-ar/src/image-target/three.js'
import type { BundleMeta } from '../loader/types'
import {
  createDepthLayerMeshes,
  disposeDepthLayerMeshes,
  loadDepthLayerAssets,
} from './depth-layers'

export type ARTrackingStatus = 'initializing' | 'scanning' | 'locked' | 'lost' | 'error'

export interface ARSessionOptions {
  container: HTMLElement
  mindUrl: string
  sourceUrl: string
  depthUrl: string
  maskBackgroundUrl: string
  maskForegroundUrl: string
  meta: BundleMeta
  onStatus?: (status: ARTrackingStatus, message?: string) => void
  uiScanning?: 'yes' | 'no'
}

export interface ARSession {
  start: () => Promise<void>
  stop: () => void
}

/** MindAR stacks video under WebGL; canvas must clear transparent or the feed looks black. */
function configureMindARDisplay(mindarThree: MindARThree): void {
  const { renderer, cssRenderer, video } = mindarThree

  renderer.setClearColor(0x000000, 0)
  renderer.domElement.style.pointerEvents = 'none'
  renderer.domElement.style.zIndex = '2'

  cssRenderer.domElement.style.display = 'none'
  cssRenderer.domElement.style.pointerEvents = 'none'

  video.style.zIndex = '1'
  video.style.objectFit = 'cover'
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  video.muted = true

  void video.play().catch(() => {
    // iOS may require a user gesture; MindAR start() is usually enough.
  })

  mindarThree.resize()
}

export async function createARSession({
  container,
  mindUrl,
  sourceUrl,
  depthUrl,
  maskBackgroundUrl,
  maskForegroundUrl,
  meta,
  onStatus,
  uiScanning = 'yes',
}: ARSessionOptions): Promise<ARSession> {
  const mindarThree = new MindARThree({
    container,
    imageTargetSrc: mindUrl,
    uiLoading: 'no',
    uiScanning,
    uiError: 'yes',
    warmupTolerance: 0,
    missTolerance: 10,
  })

  const { renderer, scene, camera } = mindarThree
  const anchor = mindarThree.addAnchor(0)

  anchor.onTargetFound = () => {
    onStatus?.('locked', 'Target locked — move your phone to feel the depth.')
  }
  anchor.onTargetLost = () => {
    onStatus?.('lost', 'Target lost — scan the printed image again.')
  }

  const assets = await loadDepthLayerAssets({
    source: sourceUrl,
    depth: depthUrl,
    maskBackground: maskBackgroundUrl,
    maskForeground: maskForegroundUrl,
  })

  const layers = createDepthLayerMeshes(meta, assets)
  anchor.group.add(layers.background)
  anchor.group.add(layers.foreground)

  const onResize = () => mindarThree.resize()
  window.addEventListener('resize', onResize)

  return {
    async start() {
      onStatus?.('initializing', 'Starting AR camera…')
      try {
        await mindarThree.start()
        configureMindARDisplay(mindarThree)
      } catch (error) {
        console.error('[WebAR] MindAR start failed:', error)
        onStatus?.('error', 'Failed to start AR. Check camera permission.')
        throw new Error('MindAR failed to start')
      }

      onStatus?.('scanning', 'Fill the frame with the print — hold steady 1–2 seconds.')
      renderer.setAnimationLoop(() => {
        renderer.render(scene, camera)
      })
    },
    stop() {
      window.removeEventListener('resize', onResize)
      renderer.setAnimationLoop(null)
      mindarThree.stop()
      anchor.group.remove(layers.background)
      anchor.group.remove(layers.foreground)
      disposeDepthLayerMeshes(layers, assets)
    },
  }
}
