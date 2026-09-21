/**
 * 单变量对照：只改 `user`，其它字段全部一致，看 500 是否跟着 user 走。
 *
 * 由来：2026-09-20 通过同源代理发了一次带 GUID user 的请求，**成功**拿到完整回答
 * （200 / workflow_finished succeeded / 1903 tokens），而同一时刻直连体检脚本
 * （user = 'healthcheck-probe'）仍是 500。两边只有 user 不同，故立此对照。
 *
 * 用法：node _probe-user-format.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const ENV = fs.readFileSync(path.join(__dirname, 'frontend', '.env.local'), 'utf8')
const BASE = (/^DIFY_API_BASE=(.*)$/m.exec(ENV)?.[1] || '').trim()
const KEY = (/^DIFY_API_KEY_01=(.*)$/m.exec(ENV)?.[1] || '').trim()
if (!BASE || !KEY) {
  console.error('缺 DIFY_API_BASE 或 DIFY_API_KEY_01')
  process.exit(2)
}

const CASES = [
  ['GUID（UUID v4）', '3f2504e0-4f89-41d3-9a0c-0305e82c3301'],
  ['体检脚本用的', 'healthcheck-probe'],
  ['前端旧格式', 'stu-9f3ab12c'],
  ['裸数字', '12345'],
  ['Dify 文档示例', 'abc-123'],
]

;(async () => {
  console.log(`══ user 格式单变量对照  ${BASE} ══\n`)
  console.log('其它字段全部固定：query=你好 / inputs={} / response_mode=streaming\n')
  for (const [label, user] of CASES) {
    const t0 = performance.now()
    let status = 0
    let verdict = ''
    let note = ''
    try {
      const res = await fetch(`${BASE}/chat-messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KEY}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ inputs: {}, query: '你好', response_mode: 'streaming', user }),
        signal: AbortSignal.timeout(120000),
      })
      status = res.status
      const raw = await res.text()
      const ms = Math.round(performance.now() - t0)
      if (status === 200) {
        const chars = [...raw.matchAll(/^data: (.*)$/gm)]
          .map((m) => {
            try { return JSON.parse(m[1]) } catch { return null }
          })
          .filter((j) => j && (j.event === 'message' || j.event === 'text_chunk'))
          .reduce((n, j) => n + (j.answer || j.data?.text || '').length, 0)
        verdict = '✅ 200'
        note = `${ms}ms  正文字符 ${chars}`
      } else {
        const isJson = raw.trim().startsWith('{')
        let code = ''
        try { code = JSON.parse(raw).code || '' } catch { /* HTML */ }
        verdict = `⛔ ${status}`
        note = `${ms}ms  形态=${isJson ? '应用层 JSON' : '网关 HTML'}${code ? ' code=' + code : ''}`
      }
    } catch (e) {
      verdict = '⚠️ 异常'
      note = e.message
    }
    console.log(`  ${verdict}  user=${JSON.stringify(user).padEnd(42)} ${label.padEnd(18)} ${note}`)
  }
  console.log('')
})()
