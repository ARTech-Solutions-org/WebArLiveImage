import {
  DoubleSide,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  sRGBEncoding,
  Texture,
  TextureLoader,
} from 'three'
import type { BundleMeta, LayerMeta } from '../loader/types'
import fragmentShader from '../shaders/depth-displace.frag.glsl?raw'
import vertexShader from '../shaders/depth-displace.vert.glsl?raw'

const SEGMENT_COUNT = 64

export interface DepthLayerAssets {
  source: Texture
  depth: Texture
  maskBackground: Texture
  maskForeground: Texture
}

export interface DepthLayerMeshes {
  background: Mesh
  backgroundMaterial: ShaderMaterial
  foreground: Mesh
  foregroundMaterial: ShaderMaterial
  geometry: PlaneGeometry
}

function configureColorTexture(texture: Texture): void {
  texture.encoding = sRGBEncoding
  texture.flipY = true
}

function configureDataTexture(texture: Texture): void {
  texture.flipY = true
}

export function loadTexture(url: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    new TextureLoader().load(url, resolve, undefined, reject)
  })
}

export async function loadDepthLayerAssets(urls: {
  source: string
  depth: string
  maskBackground: string
  maskForeground: string
}): Promise<DepthLayerAssets> {
  const [source, depth, maskBackground, maskForeground] = await Promise.all([
    loadTexture(urls.source),
    loadTexture(urls.depth),
    loadTexture(urls.maskBackground),
    loadTexture(urls.maskForeground),
  ])

  configureColorTexture(source)
  configureDataTexture(depth)
  configureDataTexture(maskBackground)
  configureDataTexture(maskForeground)

  return { source, depth, maskBackground, maskForeground }
}

function createLayerMaterial(
  assets: DepthLayerAssets,
  maskTexture: Texture,
  layer: LayerMeta,
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      map: { value: assets.source },
      depthMap: { value: assets.depth },
      maskMap: { value: maskTexture },
      displacementStrength: { value: layer.displacementStrength },
      zOffset: { value: layer.zOffset },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: true,
    depthTest: true,
    side: DoubleSide,
  })
}

export function createDepthLayerMeshes(
  meta: BundleMeta,
  assets: DepthLayerAssets,
): DepthLayerMeshes {
  const aspect = meta.height / meta.width
  const segmentsY = Math.min(SEGMENT_COUNT, Math.max(16, Math.round(SEGMENT_COUNT * aspect)))
  const geometry = new PlaneGeometry(1, aspect, SEGMENT_COUNT, segmentsY)

  const backgroundMaterial = createLayerMaterial(
    assets,
    assets.maskBackground,
    meta.layers.background,
  )
  const foregroundMaterial = createLayerMaterial(
    assets,
    assets.maskForeground,
    meta.layers.foreground,
  )

  const background = new Mesh(geometry, backgroundMaterial)
  background.renderOrder = 0

  const foreground = new Mesh(geometry, foregroundMaterial)
  foreground.renderOrder = 1

  return {
    background,
    backgroundMaterial,
    foreground,
    foregroundMaterial,
    geometry,
  }
}

export function disposeDepthLayerMeshes(meshes: DepthLayerMeshes, assets: DepthLayerAssets): void {
  meshes.geometry.dispose()
  meshes.backgroundMaterial.dispose()
  meshes.foregroundMaterial.dispose()
  assets.source.dispose()
  assets.depth.dispose()
  assets.maskBackground.dispose()
  assets.maskForeground.dispose()
}
