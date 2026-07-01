/**
 * Official MindAR offline compiler (mind-ar-js OfflineCompiler).
 *
 * Usage: node compile_mind.mjs <imagePath> <output.mind>
 * On Windows, uses @napi-rs/canvas via module loader shim.
 */
import { register } from 'node:module'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

register('./canvas-loader.mjs', import.meta.url)

const imagePath = resolve(process.argv[2] ?? '')
const outputPath = resolve(process.argv[3] ?? '')

if (!imagePath || !outputPath) {
  console.error('Usage: node compile_mind.mjs <imagePath> <output.mind>')
  process.exit(1)
}

const { loadImage } = await import('canvas')
const { OfflineCompiler } = await import(
  new URL('../node_modules/mind-ar/src/image-target/offline-compiler.js', import.meta.url)
)

function countFeatures(compiledData) {
  let total = 0
  const grid = Array.from({ length: 16 }, () => 0)

  for (const target of compiledData) {
    for (const keyframe of target.matchingData ?? []) {
      const points = [...(keyframe.maximaPoints ?? []), ...(keyframe.minimaPoints ?? [])]
      total += points.length

      const w = keyframe.width || 1
      const h = keyframe.height || 1
      for (const p of points) {
        const gx = Math.min(3, Math.max(0, Math.floor((p.x / w) * 4)))
        const gy = Math.min(3, Math.max(0, Math.floor((p.y / h) * 4)))
        grid[gy * 4 + gx] += 1
      }
    }
  }

  const occupiedCells = grid.filter((n) => n > 0).length
  return { total, occupiedCells, distributionScore: occupiedCells / 16 }
}

async function run() {
  const image = await loadImage(imagePath)
  const compiler = new OfflineCompiler()
  await compiler.compileImageTargets([image], () => {})

  const stats = countFeatures(compiler.data)
  const buffer = compiler.exportData()
  await writeFile(outputPath, buffer)

  console.log(
    JSON.stringify({
      ok: true,
      output: outputPath,
      featureCount: stats.total,
      gridOccupancy: stats.occupiedCells,
      distributionScore: Number(stats.distributionScore.toFixed(3)),
    }),
  )
}

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }))
  process.exit(1)
})
