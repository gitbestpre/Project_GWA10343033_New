/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendDir = fileURLToPath(new URL('.', import.meta.url))
// 视频素材放在仓库根的 Video/（与 frontend 平级），统一以 /Video/* 访问
const videoSourceDir = path.resolve(frontendDir, '../Video')

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
}

/**
 * 让 /Video/* 指向仓库根 Video 目录：
 * - dev：自定义中间件提供静态文件，支持 HTTP Range（视频拖动 / 分段加载）
 * - build：构建结束后把 Video 拷贝到 dist/Video
 * 不依赖 Windows 软链接（此前 public/Video 的 MSYS 相对链接对原生 Node 不可见）。
 */
function videoAssets(): Plugin {
  return {
    name: 'video-assets',
    apply: () => true,
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/Video/')) return next()
        const urlPath = decodeURIComponent(req.url.split('?')[0] || '')
        const filePath = path.join(videoSourceDir, urlPath.slice('/Video/'.length))
        if (!filePath.startsWith(videoSourceDir)) return next()
        fs.stat(filePath, (err, stat) => {
          if (err || !stat.isFile()) return next()
          const ext = path.extname(filePath).toLowerCase()
          const type = MIME[ext] || 'application/octet-stream'
          res.setHeader('Content-Type', type)
          res.setHeader('Accept-Ranges', 'bytes')
          const range = req.headers.range
          if (range) {
            const m = /bytes=(\d*)-(\d*)/.exec(range)
            if (m) {
              let start = m[1] ? parseInt(m[1], 10) : 0
              let end = m[2] ? parseInt(m[2], 10) : stat.size - 1
              if (Number.isNaN(start)) start = 0
              if (Number.isNaN(end) || end >= stat.size) end = stat.size - 1
              if (start > end) {
                res.statusCode = 416
                res.setHeader('Content-Range', `bytes */${stat.size}`)
                return res.end()
              }
              res.statusCode = 206
              res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
              res.setHeader('Content-Length', end - start + 1)
              return fs.createReadStream(filePath, { start, end }).pipe(res)
            }
          }
          res.setHeader('Content-Length', stat.size)
          fs.createReadStream(filePath).pipe(res)
        })
      })
    },
    closeBundle() {
      const outDir = path.resolve(frontendDir, 'dist')
      const dest = path.join(outDir, 'Video')
      if (fs.existsSync(videoSourceDir)) {
        fs.cpSync(videoSourceDir, dest, { recursive: true })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), videoAssets()],
  cacheDir: '/tmp/.vite',
  server: {
    host: '0.0.0.0',
    port: 5174,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    css: true,
  },
})
