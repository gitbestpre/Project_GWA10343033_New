/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'

const frontendDir = fileURLToPath(new URL('.', import.meta.url))
// 媒体素材放在仓库根（与 frontend 平级），统一以 /Video/*、/Audio/* 访问
const videoSourceDir = path.resolve(frontendDir, '../Video')
const audioSourceDir = path.resolve(frontendDir, '../Audio')

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
}

/** URL 前缀 -> 仓库内媒体源目录 */
const MOUNTS: { prefix: string; dir: string }[] = [
  { prefix: '/Video/', dir: videoSourceDir },
  { prefix: '/Audio/', dir: audioSourceDir },
]

/**
 * 让 /Video/*、/Audio/* 指向仓库根对应目录：
 * - dev：自定义中间件提供静态文件，支持 HTTP Range（视频拖动 / 分段加载）
 * - build：构建结束后把媒体目录拷贝到 dist
 * 不依赖 Windows 软链接（此前 public/Video 的 MSYS 相对链接对原生 Node 不可见）。
 */
function mediaAssets(): Plugin {
  return {
    name: 'media-assets',
    apply: () => true,
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next()
        const urlPath = decodeURIComponent(req.url.split('?')[0] || '')
        const mount = MOUNTS.find((m) => urlPath.startsWith(m.prefix))
        if (!mount) return next()
        const filePath = path.join(mount.dir, urlPath.slice(mount.prefix.length))
        if (!filePath.startsWith(mount.dir)) return next()
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
      for (const { prefix, dir } of MOUNTS) {
        const dest = path.join(outDir, prefix.replace(/^\/|\/$/g, ''))
        if (fs.existsSync(dir)) {
          fs.cpSync(dir, dest, { recursive: true })
        }
      }
    },
  }
}

/**
 * MiniMax 语音合成代理（对齐 Unity 端 MiniMaxTTS.SpeakWav_url 的调用口径）。
 *
 * 存在的唯一理由：**密钥不能进浏览器**。
 * Unity 端把 Auth 硬编码在 C# 里、由客户端直连 api.minimax.chat；网页端若照搬，
 * 等于把 API Key 写进 JS 产物交给任何访客。这里改为：
 *   浏览器 ──POST /api/tts(纯 JSON，无凭据)──▶ 本中间件 ──加 Authorization──▶ MiniMax
 * 中间件跑在 Node 侧（dev 与 `vite preview` 都挂），密钥来自 .env.local，
 * 变量名不带 VITE_ 前缀 → Vite 不会把它静态替换进客户端代码。
 *
 * 生产部署时同源 `/api/tts` 需由宿主（网关 / BFF / serverless 函数）提供同等转发，
 * 转发逻辑即本函数体，可整体照搬。
 */
function minimaxTtsProxy(env: Record<string, string>): Plugin {
  const apiKey = (env.MINIMAX_API_KEY || '').trim()
  const groupId = (env.MINIMAX_GROUP_ID || '').trim()
  const endpoint = (env.MINIMAX_TTS_ENDPOINT || 'https://api.minimax.chat/v1/t2a_v2').trim()
  const route = (env.MINIMAX_TTS_ROUTE || '/api/tts').trim()

  const json = (res: import('node:http').ServerResponse, code: number, payload: unknown) => {
    res.statusCode = code
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(payload))
  }

  const handle: Connect.NextHandleFunction = (req, res) => {
    if (req.method !== 'POST') {
      return json(res, 405, { base_resp: { status_code: 405, status_msg: '仅支持 POST' } })
    }
    if (!apiKey || !groupId) {
      return json(res, 500, {
        base_resp: {
          status_code: 1004,
          status_msg: '未配置 MINIMAX_API_KEY / MINIMAX_GROUP_ID，请在 frontend/.env.local 填写后重启 dev server',
        },
      })
    }

    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      void (async () => {
        try {
          const upstream = await fetch(`${endpoint}?GroupId=${encodeURIComponent(groupId)}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: new Uint8Array(Buffer.concat(chunks)),
          })
          const text = await upstream.text()
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(text)
        } catch (e) {
          json(res, 502, {
            base_resp: {
              status_code: 502,
              status_msg: `语音服务不可达：${e instanceof Error ? e.message : String(e)}`,
            },
          })
        }
      })()
    })
  }

  return {
    name: 'minimax-tts-proxy',
    configureServer(server) {
      server.middlewares.use(route, handle)
      server.config.logger.info(
        `  \x1b[36m➜\x1b[0m  MiniMax 语音代理: \x1b[1m${route}\x1b[0m → ${endpoint}` +
          (apiKey ? '' : '  \x1b[33m(缺少 MINIMAX_API_KEY，朗诵会返回 1004)\x1b[0m'),
      )
    },
    configurePreviewServer(server) {
      server.middlewares.use(route, handle)
    },
  }
}

/**
 * Dify 对话代理 —— **一个中间件服务四个应用**，按路径后缀选密钥。
 *
 * 应用清单来自仓库根 `AI对接.xlsx`（01 知识宣教 / 02 与 03 流行病学调查_1 /
 * 04 结案报告），四个应用都在同一台 `line.doctoru.net`、都是聊天型，只有密钥不同。
 * 所以不按应用拆四个中间件，而是 `/api/dify/<阶段>` 一条路由 + 一张密钥表（见下）。
 *
 * 与 minimaxTtsProxy 同一套存在理由：**app-* 密钥不能进浏览器**。
 * 但比它多两个必须显式处理的点：
 *
 * 1. **必须边收边发**。上游 `/chat-messages` 在 response_mode=streaming 下回的是 SSE，
 *    前端靠它做逐字打字机。任何形式的「先把整包攒完再 write」都会退化成一次性返回 ——
 *    哪怕逻辑上「也返回了正确内容」，体验已经不是流式了。故这里用 Readable 直接 pipe，
 *    不做 buffer 聚合，并显式关掉中间层的缓冲（Cache-Control: no-transform / X-Accel-Buffering: no）。
 *
 * 2. **响应头要原样搬运**。上游应用不可用（未发布 / 已停用）时回的是 `application/json`
 *    错误体，而不是 SSE。客户端必须能据此分流去读 JSON 错误，否则会把错误体当成半截流丢掉，
 *    最后表现为「发了消息但什么都没发生」。所以这里复制上游的 content-type 与状态码，
 *    让客户端有据可判（见 src/lib/dify.ts 的分流逻辑）。
 *
 * 生产部署时同源 `/api/dify` 需由宿主（网关 / BFF / serverless 函数）提供同等转发，
 * 转发逻辑即本函数体，可整体照搬。
 */
function difyProxy(env: Record<string, string>): Plugin {
  const apiBase = (env.DIFY_API_BASE || 'http://line.doctoru.net/v1').trim().replace(/\/+$/, '')
  const route = (env.DIFY_ROUTE || '/api/dify').trim()
  /** 兜底超时：上游挂住不返回时别把 dev server 的连接占死 */
  const timeoutMs = Number(env.DIFY_TIMEOUT_MS || 60000)

  /**
   * 阶段（`AI对接.xlsx` 的行号）→ 该阶段的 app-* 密钥。
   *
   * 一个阶段一个 Dify 应用，因而一把密钥，由路径后缀选中：
   * `/api/dify/02` 打的是「02 流行病学调查_1」。
   *
   * 读取顺序：
   *   1. `DIFY_API_KEY_<阶段>`（如 `DIFY_API_KEY_02`）
   *   2. 仅对 01，回落到旧的 `DIFY_API_KEY` —— 兼容上一版只接了知识宣教时的配置，
   *      免得升级后必须改 .env.local 才能继续用。
   */
  const stages = ['01', '02', '03', '04'] as const
  type Stage = (typeof stages)[number]
  const keys: Record<Stage, string> = {
    '01': (env.DIFY_API_KEY_01 || env.DIFY_API_KEY || '').trim(),
    '02': (env.DIFY_API_KEY_02 || '').trim(),
    '03': (env.DIFY_API_KEY_03 || '').trim(),
    '04': (env.DIFY_API_KEY_04 || '').trim(),
  }
  const missing = stages.filter((s) => !keys[s])

  const json = (res: import('node:http').ServerResponse, code: number, payload: unknown) => {
    res.statusCode = code
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(payload))
  }

  const handle: Connect.NextHandleFunction = (req, res) => {
    if (req.method !== 'POST') {
      return json(res, 405, { code: 'method_not_allowed', message: '仅支持 POST' })
    }

    /**
     * 阶段取自路径后缀，如 `/api/dify/02` → `'02'`。
     * Connect 的 `use(route, handle)` 已把 `route` 前缀从 `req.url` 上剥掉，
     * 这里拿到的是剩余段（`'/'` / `'/02'`）。空后缀按 01 处理，兼容旧配置。
     */
    const stage = ((req.url || '').split('?')[0] || '').replace(/^\/+|\/+$/g, '') || '01'
    if (!(stages as readonly string[]).includes(stage)) {
      return json(res, 400, {
        code: 'unknown_stage',
        message: `未知阶段「${stage}」，AI对接.xlsx 中登记的是 ${stages.join(' / ')}`,
      })
    }
    const apiKey = keys[stage as Stage]
    if (!apiKey) {
      return json(res, 500, {
        code: 'not_configured',
        message: `未配置阶段 ${stage} 的 DIFY_API_KEY_${stage}，请在 frontend/.env.local 填写后重启 dev server`,
      })
    }

    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      void (async () => {
        let body: {
          query?: string
          conversation_id?: string
          user?: string
          inputs?: Record<string, unknown>
          response_mode?: string
        }
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
        } catch {
          return json(res, 400, { code: 'bad_json', message: '请求体不是合法 JSON' })
        }

        const query = (body.query || '').trim()
        if (!query) return json(res, 400, { code: 'empty_query', message: '请输入要询问的内容' })

        /**
         * 响应模式由**调用方**决定，代理只做白名单校验后透传。
         *
         * 这里此前是硬编码 `'streaming'`，等于把客户端的意图覆盖掉 —— 想切 blocking
         * 光改前端是没用的（这一层会改回去）。改成透传后，切换只需动前端一处。
         *
         * 两种模式的差别（2026-09-20 实测）：
         *   streaming → 2xx + `text/event-stream`，逐帧吐字（可做逐字上屏与节点进度）；
         *   blocking  → 2xx + `application/json`，一次性返回整段回答。
         * 上游**失败**时的错误形态也不同：streaming 回网关 HTML 500（无 x-version，
         * worker 在响应头之前崩断），blocking 回应用层 JSON 500（带 code / x-version）。
         * 后者对排查更有用 —— 这是 blocking 唯一的实质优势。
         */
        const responseMode = body.response_mode === 'blocking' ? 'blocking' : 'streaming'

        const upstreamAbort = new AbortController()
        const timer = setTimeout(() => upstreamAbort.abort(), timeoutMs)
        // 浏览器断开（用户翻了页 / 关了标签）就立刻掐断上游，别把额度继续烧在一个没人看的回答上
        res.on('close', () => {
          clearTimeout(timer)
          if (!res.writableEnded) upstreamAbort.abort()
        })

        try {
          const upstream = await fetch(`${apiBase}/chat-messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // 按模式给对应的 Accept：blocking 要的是 JSON，喊 event-stream 会让
              // 上游/中间层误以为调用方期待流，错误形态也更难读。
              Accept: responseMode === 'blocking' ? 'application/json' : 'text/event-stream',
              /**
               * 显式要求不压缩。上游（nginx）默认对响应做 gzip，
               * 而压缩流要攒够一个块才能吐出去 —— 那正是「首字延迟」在
               * **我们可控范围**内唯一可能的额外来源。
               * 实测：默认协商时 /parameters 回 `content-encoding: gzip`，
               * 显式 identity 时回不带该头。
               * 代价只有带宽（单次回答几 KB），换来的是首字不被压缩块攒住。
               */
              'Accept-Encoding': 'identity',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              // ⚠️ 这个 `?? {}` 不能删。Dify /chat-messages 把 inputs 当必填键，
              // 省略会回 400 invalid_param (params: "inputs")，2026-09-20 实测复现。
              // 浏览器侧的 dify.ts 会按需省略该键，补回的职责就在这一行。
              inputs: body.inputs ?? {},
              query,
              // 透传（已在上面白名单校验并补默认值）
              response_mode: responseMode,
              // 首轮不带 conversation_id（Dify 会下发一个），后续轮次回传即可保持上下文
              ...(body.conversation_id ? { conversation_id: body.conversation_id } : {}),
              user: body.user || 'anonymous',
            }),
            signal: upstreamAbort.signal,
          })

          res.statusCode = upstream.status
          res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8')
          res.setHeader('Cache-Control', 'no-cache, no-transform')
          res.setHeader('X-Accel-Buffering', 'no')
          res.setHeader('Connection', 'keep-alive')

          if (!upstream.body) {
            res.end()
            return
          }
          Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res)
        } catch (e) {
          clearTimeout(timer)
          if (res.headersSent) {
            res.end()
            return
          }
          json(res, 502, {
            code: 'upstream_unreachable',
            message: `Dify 不可达：${e instanceof Error ? e.message : String(e)}`,
          })
        }
      })()
    })
  }

  return {
    name: 'dify-proxy',
    configureServer(server) {
      server.middlewares.use(route, handle)
      server.config.logger.info(
        `  \x1b[36m➜\x1b[0m  Dify 对话代理: \x1b[1m${route}/<阶段>\x1b[0m → ${apiBase}/chat-messages` +
          (missing.length
            ? `  \x1b[33m(阶段 ${missing.join('/')} 未配密钥，调用会返回 not_configured)\x1b[0m`
            : '  \x1b[32m(01~04 密钥就绪)\x1b[0m'),
      )
    },
    configurePreviewServer(server) {
      server.middlewares.use(route, handle)
    },
  }
}

export default defineConfig(({ mode }) => {
  // 第三个参数传 '' = 不做前缀过滤，才能读到不带 VITE_ 的密钥变量
  const env = loadEnv(mode, frontendDir, '')

  return {
    plugins: [react(), mediaAssets(), minimaxTtsProxy(env), difyProxy(env)],
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
  }
})
