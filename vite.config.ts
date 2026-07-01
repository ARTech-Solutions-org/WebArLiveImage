import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const repoRoot = path.dirname(fileURLToPath(import.meta.url))
const targetsRoot = path.resolve(repoRoot, 'assets/targets')

function copyTargetsRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyTargetsRecursive(from, to)
    } else {
      fs.copyFileSync(from, to)
    }
  }
}

function targetBundlesPlugin(): Plugin {
  return {
    name: 'target-bundles',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (url === '/kiosk' || url === '/kiosk/') {
          const query = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
          req.url = `/kiosk.html${query}`
        }
        next()
      })

      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (!url.startsWith('/targets/')) {
          next()
          return
        }

        const relative = decodeURIComponent(url.slice('/targets/'.length))
        const filePath = path.resolve(targetsRoot, relative)

        if (!filePath.startsWith(targetsRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          next()
          return
        }

        const ext = path.extname(filePath).toLowerCase()
        const types: Record<string, string> = {
          '.json': 'application/json',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.mind': 'application/octet-stream',
        }

        res.setHeader('Content-Type', types[ext] ?? 'application/octet-stream')
        res.setHeader('Cache-Control', 'public, max-age=3600')
        fs.createReadStream(filePath).pipe(res)
      })
    },
    closeBundle() {
      copyTargetsRecursive(targetsRoot, path.resolve(repoRoot, 'dist/targets'))
    },
  }
}

export default defineConfig({
  server: {
    host: true,
    https: false,
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: path.resolve(repoRoot, 'index.html'),
        kiosk: path.resolve(repoRoot, 'kiosk.html'),
      },
    },
  },
  optimizeDeps: {
    exclude: ['mind-ar'],
    include: ['three', '@tensorflow/tfjs'],
  },
  plugins: [targetBundlesPlugin()],
})
