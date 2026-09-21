#!/usr/bin/env node
/* ------------------------------------------------------------------ *
 * run-e2e.cjs —— 自包含的端到端验证启动器
 *
 * 背景（本项目真实约束）：
 *   沙箱里的后台任务**在每轮对话结束时会被回收**，vite dev server 无法跨轮常驻。
 *   之前先把 vite 起在后台、下一轮再跑 E2E 的做法必然失败（ECONNREFUSED）。
 *
 * 做法：在**同一次进程生命周期内**完成
 *   ① 挑一个空闲端口起 vite（不占用负责人可能在用的 5174）
 *   ② 轮询直到 HTTP 就绪（并校验返回 200）
 *   ③ 跑目标验证脚本，把 base URL 作为 argv[2] 传进去
 *   ④ 无论成败都收掉 vite 子进程
 *   ⑤ 用验证脚本的退出码作为本进程退出码
 *
 * 用法：
 *   node .run-e2e.cjs .verify-progress-resume.cjs
 *   node .run-e2e.cjs .verify-lab-chain.cjs --port 5300
 *   node .run-e2e.cjs .verify-quiz-rail.cjs --keep   # 失败时保留 vite 便于手动排查
 *
 * 约定：目标脚本从 process.argv[2] 取 base URL（本项目所有 .verify-*.cjs 均如此）。
 * ------------------------------------------------------------------ */
const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const fs = require('node:fs')
const net = require('node:net')

const ROOT = 'E:/XWJ/GWA10343033_New'
const FRONTEND = path.join(ROOT, 'frontend')
const NODE = process.execPath
const VITE = path.join(FRONTEND, 'node_modules/vite/bin/vite.js')

/** 取参 */
const argv = process.argv.slice(2)
const script = argv.find((a) => !a.startsWith('--') && /\.(cjs|mjs|js)$/.test(a))
const portFlag = argv.indexOf('--port')
const keepOnFail = argv.includes('--keep')
if (!script) {
  console.error('用法：node .run-e2e.cjs <验证脚本.cjs> [--port N] [--keep]')
  process.exit(2)
}
const scriptPath = path.isAbsolute(script) ? script : path.join(ROOT, script)
if (!fs.existsSync(scriptPath)) {
  console.error('找不到验证脚本：' + scriptPath)
  process.exit(2)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 找一个真正空闲的端口（用 net 试听，避免与已在跑的服务撞车） */
function freePort(preferred) {
  const tryBind = (p) =>
    new Promise((res) => {
      const srv = net.createServer()
      srv.once('error', () => res(false))
      srv.once('listening', () => srv.close(() => res(true)))
      srv.listen(p, '127.0.0.1')
    })
  return (async () => {
    if (preferred && (await tryBind(preferred))) return preferred
    for (let p = 5200; p < 5400; p++) if (await tryBind(p)) return p
    throw new Error('找不到空闲端口')
  })()
}

const probe = (url) =>
  new Promise((res) => {
    const req = http.get(url, (r) => {
      r.resume()
      res(r.statusCode === 200)
    })
    req.on('error', () => res(false))
    req.setTimeout(2000, () => {
      req.destroy()
      res(false)
    })
  })

;(async () => {
  const port = await freePort(portFlag > -1 ? Number(argv[portFlag + 1]) : null)
  const base = `http://127.0.0.1:${port}`
  console.log(`[run-e2e] 起 vite @ ${base}`)

  const vite = spawn(NODE, [VITE, '--port', String(port), '--host', '127.0.0.1', '--strictPort'], {
    cwd: FRONTEND,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let viteLog = ''
  vite.stdout.on('data', (d) => (viteLog += d))
  vite.stderr.on('data', (d) => (viteLog += d))

  const kill = () => {
    try {
      vite.kill()
    } catch {}
  }
  process.on('exit', kill)
  process.on('SIGINT', () => {
    kill()
    process.exit(130)
  })

  // ② 等就绪：最多 30s
  let ready = false
  for (let i = 0; i < 60; i++) {
    if (await probe(base + '/')) {
      ready = true
      break
    }
    if (vite.exitCode !== null) break
    await sleep(500)
  }
  if (!ready) {
    kill()
    console.error('[run-e2e] vite 未就绪。日志：')
    console.error(viteLog.slice(-2000))
    process.exit(3)
  }
  console.log('[run-e2e] vite 就绪，开始跑 ' + path.basename(scriptPath))

  // ③ 跑验证脚本（继承 stdio，输出直达终端/重定向文件）
  const code = await new Promise((res) => {
    const child = spawn(NODE, [scriptPath, base], { cwd: ROOT, stdio: 'inherit' })
    child.on('exit', (c) => res(c == null ? 1 : c))
    child.on('error', () => res(1))
  })

  // ④ 收尾
  if (!(keepOnFail && code !== 0)) kill()
  console.log(`[run-e2e] ${path.basename(scriptPath)} 退出码 ${code}` + (keepOnFail && code !== 0 ? '（--keep：vite 保留在 ' + base + '）' : '，已收掉 vite'))
  // ⑤
  if (keepOnFail && code !== 0) {
    // 不退出，让负责人手动排查；此处用不退出会让后台任务挂住，故仍退出但打印提示
    console.log('[run-e2e] 提示：--keep 在本沙箱下无法保持连接，请改用负责人自建常驻服务。')
  }
  process.exit(code)
})()
