/**
 * streaming vs blocking 对照（临时，用完即删）。
 *
 * 目的：负责人要求改用 blocking。动手前先确认两件事：
 *   Q1 现在上游是否仍全 500（若已重新发布，blocking 可能直接可用）
 *   Q2 两种模式在**同一时刻**的表现差异 —— 特别是错误形态不同这一点
 *
 * 已知（2026-09-20 早先实测）：
 *   streaming → 网关 HTML 500（无 x-version）
 *   blocking  → 应用层 JSON 500（带 code / x-version）
 * 本次重测，用来判断「改 blocking」是能绕开故障，还是只是换了错误形态。
 *
 * 用法：node _probe-modes.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const ENV = fs.readFileSync(path.join(__dirname, 'frontend', '.env.local'), 'utf8')
const BASE = (/^DIFY_API_BASE=(.*)$/m.exec(ENV)?.[1] || '').trim()
const KEYS = {}
for (const m of ENV.matchAll(/^DIFY_API_KEY_(\d\d)=(.*)$/gm)) KEYS[m[1]] = m[2].trim()
const STAGE = Object.keys(KEYS).sort()[0]
const K = KEYS[STAGE]
const USER = 'mode-probe'
const P = (s) => process.stdout.write(s + '\n')

async function once(mode, i) {
  const t0 = performance.now()
  const res = await fetch(`${BASE}/chat-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${K}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ inputs: {}, query: '你好', response_mode: mode, user: USER }),
    signal: AbortSignal.timeout(120000),
  })
  const head = Math.round(performance.now() - t0)
  const ct = (res.headers.get('content-type') || '').split(';')[0]
  const xv = res.headers.get('x-version') || '(无)'
  const body = await res.text()
  const total = Math.round(performance.now() - t0)

  // 200 时统计帧数/字数；非 200 时截断正文
  let note = ''
  if (res.status === 200) {
    if (ct.includes('event-stream')) {
      const frames = body.split(/\r?\n\r?\n/).filter((b) => b.includes('data:')).length
      note = `SSE ${frames} 帧 / ${body.length} 字节`
    } else {
      let j = null
      try { j = JSON.parse(body) } catch { /* ignore */ }
      note = j
        ? `单条 JSON：event=${j.event || '?'} answer=${JSON.stringify(String(j.answer || '').slice(0, 40))} (${String(j.answer || '').length} 字)`
        : `非 JSON：${body.replace(/\s+/g, ' ').slice(0, 100)}`
    }
  } else {
    note = body.replace(/\s+/g, ' ').slice(0, 130)
  }
  P(`  ${mode.padEnd(10)} #${i}  ${String(res.status).padEnd(4)} 头@${String(head).padStart(5)}ms 尾@${String(total).padStart(5)}ms  ${ct.padEnd(17)} x-version=${xv}`)
  P(`      ${note}`)
  return { mode, status: res.status, ct, xv, ms: total }
}

;(async () => {
  P('══ streaming vs blocking 对照 ══\n')
  const rs = []
  for (let i = 1; i <= 3; i++) {
    rs.push(await once('streaming', i))
    rs.push(await once('blocking', i))
  }

  P('\n══ 汇总 ══')
  for (const mode of ['streaming', 'blocking']) {
    const sub = rs.filter((r) => r.mode === mode)
    const codes = sub.map((r) => r.status).join(', ')
    const cts = [...new Set(sub.map((r) => r.ct))].join(' | ')
    P(`  ${mode.padEnd(10)} 状态 [${codes}]  content-type {${cts}}`)
  }
  const okAny = rs.some((r) => r.status === 200)
  P(`\n  ${okAny ? '★ 有成功样本 ⇒ 上游已恢复，blocking 可用！' : '⛔ 两种模式仍全部失败 ⇒ 改 blocking 不能绕开故障。'}`)
  P('  （若全失败：blocking 只是把「网关 HTML 500」换成「应用层 JSON 500」，根因未变）')
})()
