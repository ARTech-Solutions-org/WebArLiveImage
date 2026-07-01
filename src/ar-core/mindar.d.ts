declare module 'mind-ar/src/image-target/three.js' {
  import type { Group, PerspectiveCamera, Scene, WebGLRenderer } from 'three'

  export interface MindARAnchor {
    group: Group
    targetIndex: number
    visible: boolean
    onTargetFound: (() => void) | null
    onTargetLost: (() => void) | null
    onTargetUpdate: (() => void) | null
  }

  export interface MindARThreeOptions {
    container: HTMLElement
    imageTargetSrc: string
    maxTrack?: number
    uiLoading?: 'yes' | 'no'
    uiScanning?: 'yes' | 'no'
    uiError?: 'yes' | 'no'
    filterMinCF?: number | null
    filterBeta?: number | null
    warmupTolerance?: number | null
    missTolerance?: number | null
  }

  export class MindARThree {
    container: HTMLElement
    scene: Scene
    renderer: WebGLRenderer
    cssRenderer: { domElement: HTMLElement }
    camera: PerspectiveCamera
    anchors: MindARAnchor[]
    video: HTMLVideoElement

    constructor(options: MindARThreeOptions)
    start(): Promise<void>
    stop(): void
    switchCamera(): void
    addAnchor(targetIndex: number): MindARAnchor
    resize(): void
  }
}
