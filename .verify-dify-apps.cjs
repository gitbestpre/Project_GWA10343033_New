/**
 * Dify 四应用 API 链路体检 —— 上线/演示前跑一条就够。
 *
 * 由来：2026-09-20 知识宣教页接入后，四个应用对任何 query 都回 500，
 * 而 Dify 控制台「预览」能跑通。当时的结论是「已发布快照坏了」，**这个结论是错的**。
 * 同日单变量实测（`_probe-user-format.cjs`）推翻了它：
 *   只改请求里的 `user`、其余字段全同 → **UUID = 200，任何非 UUID = 500**（76~103ms，网关 HTML）。
 * 也就是说，500 一直是我们自己发的 `user` 格式不合法造成的，与被发布快照无关；
 * 本脚本原先用 `'healthcheck-probe'` 当 user，正是这个假故障的一部分。
 * 换成一个真 UUID 后四个应用立刻全绿 —— 所以判读时先看 user，别再去怀疑快照。
 *
 * 判读（每个应用独立给结论）：
 *   ✅ 可用   /chat-messages 回 200（无论 blocking 还是 streaming）
 *   ⛔ 未起跑 → 500 且耗时在百毫秒级。**首要怀疑 user 不是合法 UUID**；
 *      其次才是应用侧问题（应用停用 / 未发布）。判据见上面那条实测。
 *   ⚠️ 参数/凭据问题     → 400/401/404，按 body 里的 code 归类
 *
 * 成本：命中错误路径不消耗额度；一旦某个应用通了，会产生一次真实回答（约 1K tokens）。
 *       若只想查而不想说话，用 `--dry`：只打只读接口，不碰 /chat-messages。
 * 副作用：会以探测用户建会话。加 `--cleanup` 清掉这些会话。
 *
 * 用法：
 *   node .verify-dify-apps.cjs                      逐应用实测一次提问（流式）
 *   node .verify-dify-apps.cjs --blocking           同上，但用阻塞模式（错误体是应用层 JSON）
 *   node .verify-dify-apps.cjs --dry                只查 /info 与 /parameters（零成本）
 *   node .verify-dify-apps.cjs --cleanup            清掉探测会话
 *
 * 为什么要留 --blocking：同样的故障，**两种模式暴露的错误形态不同**——
 *   流式     → 网关 HTML 500（无 `code`、无 `x-version`），说明响应头之前就断了
 *   阻塞     → 应用层 JSON 500（`{"code":"internal_server_error"}`），说明请求进了应用
 * 给 Dify 侧看日志时入口不一样，所以排查时值得各跑一次。
 */
const fs = require('node:fs')
const path = require('node:path')

const ENV_FILE = path.join(__dirname, 'frontend', '.env.local')
if (!fs.existsSync(ENV_FILE)) {
  console.error(`未找到 ${ENV_FILE} —— 该文件里有 DIFY_API_BASE 与四个应用的密钥`)
  process.exit(2)
}
const ENV = fs.readFileSync(ENV_FILE, 'utf8')
const BASE = (/^DIFY_API_BASE=(.*)$/m.exec(ENV)?.[1] || '').trim()
if (!BASE) {
  console.error('frontend/.env.local 里缺 DIFY_API_BASE')
  process.exit(2)
}
const KEYS = {}
for (const m of ENV.matchAll(/^DIFY_API_KEY_(\d\d)=(.*)$/gm)) KEYS[m[1]] = m[2].trim()
const STAGES = Object.keys(KEYS).sort()
/**
 * 探测用的 user。
 *
 * ⚠️ **必须是一个合法的 UUID**，这不是随便挑的：
 * 2026-09-20 单变量实测（`_probe-user-format.cjs`，只改 user、其余字段全同）——
 *   UUID   → 200 并产出真实回答（3199ms / 142 字）
 *   任何非 UUID（`healthcheck-probe` / `stu-xxxxxxxx` / `12345` / `abc-123`）
 *          → **500**，且耗时仅 76~103ms（响应头之前就断了，形如网关 HTML）
 * 本脚本原先用 `'healthcheck-probe'` 当 user，于是**自己把四个应用全判成了 500**，
 * 还把结论误导成「已发布快照坏了」。换格式后四个应用立刻全绿。
 * 换句话说：这一行曾是本仓库里最大的一个假故障源。
 *
 * 固定用同一个 UUID（而不是每次随机）：会话归并到一个探测身份下，`--cleanup` 才好清。
 */
const PROBE_USER = '6f1b7c2e-8a4d-4f1a-9c3b-2d5e7a0b1c94'
const USER = PROBE_USER

const DRY = process.argv.includes('--dry')
/** 用哪种响应模式体检。默认 streaming；加 --blocking 换阻塞模式。
 *  两种模式在**上游故障**时的错误形态不同（见下面 probeChat 的注释），
 *  所以排查时值得各跑一次。 */
const MODE = process.argv.includes('--blocking') ? 'blocking' : 'streaming'
const P = (s) => process.stdout.write(s + '\n')
const auth = (k) => ({ Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' })

/** 百毫秒级返回 + 500 ⇒ 没走到模型（这是本脚本要区分的关键形态）。
 *  实测该形态的头号成因是 **user 不是合法 UUID**（76~103ms），而非应用侧故障。 */
const PREFLIGHT_MS = 1000

/**
 * 从 `data.outputs` 里挑出正文。
 * 与前端 `pickTextFromOutputs` 同一口径：只认约定俗成的正文键，不 `Object.values` 取第一个，
 * 免得把 `status` / `elapsed_time` 这类过程字段当成回答数进字数。
 */
function pickFromOutputs(outputs) {
  if (typeof outputs === 'string') return outputs.trim()
  if (!outputs || typeof outputs !== 'object') return ''
  for (const k of ['answer', 'text', 'output', 'result', 'content']) {
    const v = outputs[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return ''
}

async function cleanup() {
  P('══ 清理探测会话 ══')
  for (const st of STAGES) {
    const r = await fetch(`${BASE}/conversations?limit=100&user=${USER}`, { headers: auth(KEYS[st]) })
    if (!r.ok) {
      P(`  [${st}] 列会话失败 HTTP ${r.status}`)
      continue
    }
    const list = (await r.json()).data || []
    let n = 0
    for (const c of list) {
      const d = await fetch(`${BASE}/conversations/${c.id}`, {
        method: 'DELETE',
        headers: auth(KEYS[st]),
        body: JSON.stringify({ user: USER }),
      })
      if (d.ok) n++
    }
    P(`  [${st}] 删除 ${n} / ${list.length}`)
  }
}

/** 打一次 /chat-messages，把结论归成一档 */
async function probeChat(st) {
  const t0 = performance.now()
  let res
  try {
    res = await fetch(`${BASE}/chat-messages`, {
      method: 'POST',
      headers: {
        ...auth(KEYS[st]),
        Accept: MODE === 'blocking' ? 'application/json' : 'text/event-stream',
      },
      // 两种模式按需切换：streaming 逐帧吐字，blocking 一次性回整段 JSON
      body: JSON.stringify({ inputs: {}, query: '你好', response_mode: MODE, user: USER }),
      signal: AbortSignal.timeout(120000),
    })
  } catch (e) {
    return { verdict: 'unreachable', detail: e.message, ms: Math.round(performance.now() - t0) }
  }
  const ms = Math.round(performance.now() - t0)
  const ct = (res.headers.get('content-type') || '').split(';')[0]

  if (res.status !== 200) {
    /* ⚠️ 必须「先取全文再解析，最后才截断」。
       早先的写法是把 body 截断到 160 字之后再 `JSON.parse`；而 Dify 的
       internal_server_error 响应里 message 很长（90+ 字），截断后 JSON 不完整
       → 解析失败 → code 丢掉 → blocking 被误判成「网关 HTML」。
       形态（应用层 JSON / 网关 HTML）是本脚本的核心结论，不能因为一处
       纯粹用于显示的截断而失真。 */
    const full = await res.text()
    let code = ''
    try {
      code = JSON.parse(full).code || ''
    } catch { /* 可能是 HTML 错误页 */ }
    const raw = full.replace(/\s+/g, ' ').slice(0, 160)
    const preflight = res.status === 500 && ms < PREFLIGHT_MS
    return {
      verdict: preflight ? 'preflight_500' : 'http_error',
      status: res.status,
      code,
      html: !code,
      ms,
      /* 两种 500 形态要分开记：JSON 是应用层抛出的异常（带 code），
         HTML 是网关自己生成的页（连接在响应头之前就被拒，nginx 兜底）——
         前者说明请求进了应用，后者说明根本没进去。
         ⚠️ 两者**根因相同但不是「快照坏」**：实测（`_probe-user-format.cjs`）
         就是请求里的 `user` 不是合法 UUID。给 Dify 侧看日志时入口不同而已。 */
      shape: code ? '应用层 JSON' : '网关 HTML',
      detail: raw,
    }
  }

  // 200：确认真的吐出了正文（应用配错/模型不可用时也会 200 但正文恒空）
  //
  // ⚠️ 读数方式必须跟着模式走。blocking 的 200 响应体是**一条 JSON**，
  // 里面没有 `data:` 行；若照搬下面的 SSE 解析，一个**健康**的应用也会被数成
  // 0 个正文字符，然后被误判成「200 但正文为空 ⇒ 上游可疑」——正好把结论说反。
  if (MODE === 'blocking') {
    const raw = await res.text()
    let answer = ''
    try {
      const j = JSON.parse(raw)
      answer = typeof j.answer === 'string' ? j.answer : ''
      if (!answer && j.data && j.data.outputs) answer = pickFromOutputs(j.data.outputs)
    } catch { /* 非 JSON：交给下面按空处理 */ }
    const total = Math.round(performance.now() - t0)
    if (!answer) {
      return { verdict: 'empty_stream', ms: total, detail: `200 但 blocking 体里没有 answer：${raw.replace(/\s+/g, ' ').slice(0, 120)}` }
    }
    // blocking 没有「首字」概念：整段同时到达，ttft 就等于总耗时
    return { verdict: 'ok', ms: total, ttft: total, chars: answer.length }
  }

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let chars = 0
  let ttft = null
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    for (;;) {
      const cut = buf.search(/\r?\n\r?\n/)
      if (cut < 0) break
      const block = buf.slice(0, cut)
      buf = buf.slice(cut + (buf[cut] === '\r' ? 4 : 2))
      const dl = block.split(/\r?\n/).find((l) => l.startsWith('data:'))
      if (!dl) continue
      const p = dl.slice(5).trim()
      if (p === '[DONE]') continue
      let j
      try { j = JSON.parse(p) } catch { continue }
      const chunk =
        (j.event === 'message' || j.event === 'agent_message') && j.answer
          ? j.answer
          : j.event === 'text_chunk' && typeof j.data?.text === 'string'
            ? j.data.text
            : ''
      if (chunk) {
        chars += chunk.length
        if (ttft === null) ttft = Math.round(performance.now() - t0)
      }
    }
  }
  const total = Math.round(performance.now() - t0)
  if (!chars) {
    return { verdict: 'empty_stream', ms: total, detail: '200 但一个正文字符都没吐' }
  }
  return { verdict: 'ok', ms: total, ttft, chars }
}

;(async () => {
  if (process.argv.includes('--cleanup')) return cleanup()

  P(`══ Dify 应用体检  ${BASE}  ${DRY ? '（--dry：不实测提问）' : ''} ══`)

  /* 0. 网关与版本（失败响应缺 x-version 时，说明是网关页而非应用层错误） */
  {
    const r = await fetch(`${BASE}/info`, { headers: auth(KEYS[STAGES[0]]) })
    await r.text()
    P(`  版本 x-version=${r.headers.get('x-version') || '(无)'}  x-env=${r.headers.get('x-env') || '(无)'}  server=${r.headers.get('server')}`)
  }

  const rows = []
  for (const st of STAGES) {
    /* 1. 只读接口：认证与应用配置层是否正常 */
    const ir = await fetch(`${BASE}/info`, { headers: auth(KEYS[st]) })
    const it = await ir.text()
    let appName = ''
    try { appName = JSON.parse(it).name || '' } catch { /* ignore */ }

    const pr = await fetch(`${BASE}/parameters`, { headers: auth(KEYS[st]) })
    const pt = await pr.text()
    let form = null
    try { form = (JSON.parse(pt).user_input_form || []).length } catch { /* ignore */ }

    const meta =
      ir.status === 200 && pr.status === 200
        ? `应用「${appName.slice(0, 22)}」 必填变量 ${form}`
        : `异常 /info=${ir.status} /parameters=${pr.status}`

    if (DRY) {
      rows.push({ st, meta, verdict: 'dry', note: '未实测' })
      continue
    }

    const r = await probeChat(st)
    rows.push({ st, meta, verdict: r.verdict, note: r })
  }

  P('')
  for (const row of rows) {
    const icon =
      row.verdict === 'ok'
        ? '✅'
        : row.verdict === 'dry'
          ? '·'
          : row.verdict === 'preflight_500'
            ? '⛔'
            : '⚠️'
    const tail =
      row.verdict === 'ok'
        ? `可用  首字 ${row.note.ttft}ms  全文 ${row.note.ms}ms  ${row.note.chars} 字`
        : row.verdict === 'dry'
          ? row.note
          : row.verdict === 'preflight_500'
            ? `500 但仅 ${row.note.ms}ms ⇒ 未走到模型（${row.note.shape}）；先查 user 是否合法 UUID`
            : row.verdict === 'empty_stream'
              ? `200 但正文为空 ⇒ 快照可疑`
              : `HTTP ${row.note.status ?? '?'}${row.note.code ? ' ' + row.note.code : row.note.html ? ' (HTML 错误页)' : ''}  ${row.note.ms ?? ''}ms`
    P(`  ${icon} [${row.st}] ${row.meta.padEnd(40)} ${tail}`)
    if (row.note && row.note.detail && row.verdict !== 'ok') P(`        ${String(row.note.detail).slice(0, 150)}`)
  }

  const broken = rows.filter((r) => r.verdict === 'preflight_500')
  const okRows = rows.filter((r) => r.verdict === 'ok')
  P('')
  if (broken.length) {
    P(`  ⛔ ${broken.length}/${rows.length} 个应用「未走到模型」——**先查请求里的 user**：`)
    P('     Dify 只接受合法 UUID 形式的 user。2026-09-20 单变量实测：UUID → 200；')
    P('     `healthcheck-probe` / `stu-xxxxxxxx` / `12345` / 连官方文档示例里的 `abc-123`')
    P('     → 一律 500，且耗时仅 76~103ms（响应头之前就断）。')
    P('     先确认本脚本的 PROBE_USER 和前端 difyUser() 给出的都是真 UUID。')
    P('     若 user 已是 UUID 仍 500，再去控制台看该应用是否停用 / 未发布，并查服务端日志。')
  }
  if (okRows.length === rows.length && rows.length) P('  ✅ 四个应用全部可用。')
  P('')
  P('  提示：探测会话清理 → node .verify-dify-apps.cjs --cleanup')
})()
