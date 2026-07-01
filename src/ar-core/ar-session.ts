import { MindARThree } from 'mind-ar/src/image-target/three.js'
import {
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  sRGBEncoding,
  Texture,
  TextureLoader,
} from 'three'
import type { BundleMeta } from '../loader/types'

export type ARTrackingStatus = 'initializing' | 'scanning' | 'locked' | 'lost' | 'error'

export interface ARSessionOptions {
  container: HTMLElement
  mindUrl: string
  sourceUrl: string
  meta: BundleMeta
  onStatus?: (status: ARTrackingStatus, message?: string) => void
  uiScanning?: 'yes' | 'no'
}

export interface ARSession {
  start: () => Promise<void>
  stop: () => void
}

function loadTexture(url: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    const loader = new TextureLoader()
    loader.load(url, resolve, undefined, reject)
  })
}

export async function createARSession({
  container,
  mindUrl,
  sourceUrl,
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
  })

  const { renderer, scene, camera } = mindarThree
  const anchor = mindarThree.addAnchor(0)

  anchor.onTargetFound = () => {
    onStatus?.('locked', 'Target locked — image anchored.')
  }
  anchor.onTargetLost = () => {
    onStatus?.('lost', 'Target lost — scan the printed image again.')
  }

  const texture = await loadTexture(sourceUrl)
  texture.encoding = sRGBEncoding

  const aspect = meta.height / meta.width
  const geometry = new PlaneGeometry(1, aspect)
  const material = new MeshBasicMaterial({ map: texture })
  const plane = new Mesh(geometry, material)
  anchor.group.add(plane)

  return {
    async start() {
      onStatus?.('initializing', 'Starting AR camera…')
      try {
        await mindarThree.start()
      } catch {
        onStatus?.('error', 'Failed to start AR. Check camera permission.')
        throw new Error('MindAR failed to start')
      }

      onStatus?.('scanning', 'Point your camera at the printed image.')
      renderer.setAnimationLoop(() => {
        renderer.render(scene, camera)
      })
    },
    stop() {
      renderer.setAnimationLoop(null)
      mindarThree.stop()
      texture.dispose()
      geometry.dispose()
      material.dispose()
    },
  }
}
