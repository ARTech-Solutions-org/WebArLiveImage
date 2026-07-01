export interface LayerMeta {
  displacementStrength: number
  mask: string
  zOffset: number
}

export interface TrackingMeta {
  precheckFeatureCount: number
  precheckGridOccupancy: number
  precheckDistributionScore: number
  compiledFeatureCount: number | null
  compiledGridOccupancy: number | null
  compiledDistributionScore: number | null
  trackable: boolean
}

export interface AnimationMeta {
  enabled: boolean
  rig: string | null
}

export interface PipelineMeta {
  createdAt: string
  depthModel: string
  segmentationMode: string
}

export interface BundleMeta {
  target_id: string
  version: number
  source: string
  width: number
  height: number
  depth: string
  mind_file: string
  layers: {
    background: LayerMeta
    foreground: LayerMeta
  }
  tracking: TrackingMeta
  animation: AnimationMeta
  pipeline: PipelineMeta
}

export interface LoadedAsset {
  name: string
  url: string
  byteLength: number
  contentType: string | null
}

export interface TargetBundle {
  targetId: string
  baseUrl: string
  meta: BundleMeta
  loadSource: () => Promise<LoadedAsset>
  loadDepth: () => Promise<LoadedAsset>
  loadMaskForeground: () => Promise<LoadedAsset>
  loadMaskBackground: () => Promise<LoadedAsset>
  loadMind: () => Promise<LoadedAsset>
  loadAllAssets: () => Promise<LoadedAsset[]>
}
