/**
 * Dify 对话接口诊断 —— 一次跑完，输出可交给 Dify 侧的取证报告。
 *
 * 由来：2026-09-20 知识宣教页接入后，`AI对接.xlsx` 里四个应用对任何提问都回
 * `500 internal_server_error`。当时按「服务端共享依赖故障」记了一笔，但那是**推断**。
 * 本脚本用对照实验把成因逐条证实/证伪，结论见末尾「结论」段。
 *
 * ⚠️⚠️ 本脚本第一版的结论（「与 user 无关，必在应用编排执行」）是**错的**，原因是
 * **对照组本身不合法**：R3 把「user 正常」定义成 `diag-probe`，而 Dify 只接受
 * **UUID 形式**的 user —— 于是「正常」那一组本身就是 500，
 * 「缺失/空串/null 回 400」又确实成立（存在性校验先于格式校验），
 * 两条一拼就得出「有 400 有 500 ⇒ 与 user 无关」这个错误推论。
 * 真相由单变量对照 `_probe-user-format.cjs` 定案：**UUID → 200，非 UUID → 500**。
 * 教训留在 R3 的注释里：对照实验的**对照组必须先被证明是有效的**，
 * 否则它会把「我的输入错了」误判成「上游坏了」。
 *
 * 六个假设与判别手法：
 *   R1 应用类型        「空 inputs 打三条路由」零成本判别 chat / completion / workflow
 *   R2 响应模式        H1 同 body 只换 streaming/blocking —— 都失败 ⇒ 与流式无关
 *   R3 user 字段       ⚠️ 对照组必须是**真 UUID**，否则整组无意义（见上）
 *   R4 耗时            H3 若 1 秒内就返回，根本没走到 LLM ⇒ 超时论不成立
 *   R5 模型链路        POST /conversations/:id/name {auto_generate:true} 走**同一套模型配置**，
 *                      若 200 且产出真实文本 ⇒ 供应商凭据是好的
 *   R6 历史全量        扫 probe 用户下所有 message：有没有**任何一条**成功过（偶发 vs 必现）
 *
 * 副作用：会在该应用下用探测用户建若干空会话。
 * 清理：`node _diag-dify.cjs --cleanup` 删除这些探测会话。
 *
 * 用法：node _diag-dify.cjs [--cleanup]
 */
const fs = require('node:fs')
const path = require('node:path')

const ENV_FILE = path.join(__dirname, 'frontend', '.env.local')
const ENV = fs.readFileSync(ENV_FILE, 'utf8')
const BASE = (/^DIFY_API_BASE=(.*)$/m.exec(ENV)?.[1] || '').trim()
if (!BASE) throw new Error('未在 frontend/.env.local 找到 DIFY_API_BASE')
const KEYS = {}
for (const m of ENV.matchAll(/^DIFY_API_KEY_(\d\d)=(.*)$/gm)) KEYS[m[1]] = m[2].trim()
const STAGES = Object.keys(KEYS).sort()
const K1 = KEYS[STAGES[0]]
/** ⚠️ 必须是**合法 UUID**，否则本脚本自己就会把上游打成 500（见文件头教训）。 */
const UUID_USER = '8c4a1d6f-2b93-4e57-8a10-5f3d9c7e2b48'
const PROBE_USER = process.env.DIAG_USER || UUID_USER

const H = (k) => ({ Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' })
const brief = (s, n = 240) => String(s).replace(/\s+/g, ' ').slice(0, n)
const P = (s) => process.stdout.write(s + '\n')

/** 统一发请求，带耗时与 content-type —— 耗时是本诊断的一等证据 */
async function call(label, url, init, { json = false, key = K1 } = {}) {
  const t0 = performance.now()
  const res = await fetch(url, {
    ...init,
    headers: { ...H(key), ...(init?.headers || {}) },
    signal: AbortSignal.timeout(120000),
  })
  const ms = Math.round(performance.now() - t0)
  const raw = await res.text()
  P(`  ${label.padEnd(44)} ${String(res.status).padEnd(4)} ${String(ms).padStart(7)}ms  ${(res.headers.get('content-type') || '').split(';')[0]}`)
  if (raw) P(`      ${brief(raw)}`)
  let parsed
  if (json) {
    try { parsed = JSON.parse(raw) } catch { /* 非 JSON 就留 undefined */ }
  }
  return { status: res.status, ms, raw, json: parsed, ct: (res.headers.get('content-type') || '').split(';')[0] }
}

const chat = (key, extra = {}, label = 'POST /chat-messages') =>
  call(label, `${BASE}/chat-messages`, {
    method: 'POST',
    body: JSON.stringify({ inputs: {}, query: '你好', response_mode: 'blocking', user: PROBE_USER, ...extra }),
  }, { key })

const conversations = async (user, key = K1, limit = 100) =>
  (await call(`GET /conversations (user=${user})`, `${BASE}/conversations?limit=${limit}&user=${user}`, { method: 'GET' }, { json: true, key })).json?.data || []

/** 清理探测期间产生的会话，避免污染 Dify 侧的会话统计 */
async function cleanup() {
  P('\n══ 清理 ══')
  let n = 0
  const failed = []
  for (const stage of STAGES) {
    for (const c of await conversations(PROBE_USER, KEYS[stage])) {
      // ⚠️ Dify 的 DELETE /conversations/:id **要求带 `{user}` 请求体**；
      // 不带体时它不会报错，但也**不会删**（曾因此静默删了 0 个）。
      const r = await fetch(`${BASE}/conversations/${c.id}`, {
        method: 'DELETE', headers: H(KEYS[stage]), body: JSON.stringify({ user: PROBE_USER }),
      })
      await r.text()
      if (r.ok) n++
      else failed.push(`${stage}/${c.id} → HTTP ${r.status}`)
    }
  }
  P(`  → 已删除 ${n} 个探测会话（应用 ${STAGES.join('/')}，user=${PROBE_USER}）`)
  if (failed.length) P(`  ! 失败 ${failed.length} 个：${failed.slice(0, 5).join('  ')}`)
}

;(async () => {
  if (process.argv.includes('--cleanup')) return cleanup()

  P(`\nDify 对话接口诊断`)
  P(`  BASE   = ${BASE}`)
  P(`  阶段   = ${STAGES.join(', ')}`)
  P(`  探测用户 = ${PROBE_USER}（会在各应用下建若干空会话，可用 --cleanup 删除）`)

  /* ── R0 版本与网关 ── */
  P('\n══ R0. 版本 / 网关（说清是在哪个版本上出的问题）══')
  {
    const a = await call('GET /info', `${BASE}/info`, { method: 'GET' }, { json: true })
    P(`       x-version=${a.json ? '见响应头' : '?'}`)
    const res = await fetch(`${BASE}/info`, { headers: H(K1) })
    await res.text()
    P(`       ${res.headers.get('x-version') ? 'x-version=' + res.headers.get('x-version') : '(无 x-version 头)'}  server=${res.headers.get('server')}  x-env=${res.headers.get('x-env')}`)
  }

  /* ── R1 应用类型判别 ── */
  P('\n══ R1. 应用类型：三条路由各打一次（零成本判别）══')
  await chat(K1, { response_mode: 'blocking' }, 'POST /chat-messages        （聊天族）')
  await call('POST /completion-messages  （文本生成族）', `${BASE}/completion-messages`, {
    method: 'POST', body: JSON.stringify({ inputs: {}, query: '你好', response_mode: 'blocking', user: PROBE_USER }),
  })
  await call('POST /workflows/run         （工作流族）', `${BASE}/workflows/run`, {
    method: 'POST', body: JSON.stringify({ inputs: {}, response_mode: 'blocking', user: PROBE_USER }),
  })
  P('  判据：只有一条不报「应用类型不符」⇒ 那就是该应用的族。四条都报错说明三者皆非。')

  /* ── R2 响应模式 ── */
  P('\n══ R2. H1 响应模式（同 body 只换模式）══')
  await chat(K1, { response_mode: 'streaming' }, 'streaming')
  await chat(K1, { response_mode: 'blocking' }, 'blocking')
  P('  判据：两者都失败 ⇒ 与「流式 broken pipe」无关。')

  /* ── R3 user 字段 ── */
  P('\n══ R3. H2 user 字段六态（其余完全相同）══')
  /* ⚠️ 本组第一版在这里翻过车：「正常」那一态用的是 `diag-probe`，
     而它并不是合法 UUID —— 于是对照组的期望值（200）本身就是错的，
     整组做下来得到「有 400 有 500 ⇒ 与 user 无关」这个正好相反的结论。
     现在对照组显式用 UUID，并额外留一态专门放**非 UUID 的普通字符串**，
     把「格式」与「存在性」两件事分开看。 */
  await chat(K1, { user: UUID_USER }, 'user = UUID（真正的正常）')
  await chat(K1, { user: 'diag-probe' }, 'user = 非 UUID 普通串')
  await chat(K1, { user: undefined }, 'user 缺失')
  await chat(K1, { user: '' }, 'user 空串')
  await chat(K1, { user: null }, 'user null')
  await chat(K1, { user: 'u'.repeat(200) }, 'user 超长(200)')
  P('  判据：UUID → 200；非 UUID → 500（百毫秒级，未走到模型）；')
  P('        缺失/空串/null → 400（存在性校验在格式校验之前，所以这两种错要分开读）。')

  /* ── R4 耗时 ── */
  P('\n══ R4. H3 耗时（超时论需要「耗时接近某个整数秒」）══')
  const times = []
  for (let i = 0; i < 5; i++) times.push((await chat(K1, {}, `第 ${i + 1} 次`)).ms)
  P(`  五次耗时 = [${times.join(', ')}]ms`)
  P('  判据：几十~百余毫秒 ⇒ 没走到模型，超时论不成立（对照：一次模型调用实测约 1.8s，见 R5）。')

  /* ── R5 模型链路健康度 ── */
  P('\n══ R5. 模型链路是否健康（与 chat 不同的代码路径，同一套模型配置）══')
  {
    const list = await conversations(PROBE_USER)
    const conv = list[0]
    if (!conv) return P('  ✗ 没造出会话，R5/R6 跳过')
    await call('GET /conversations（复查名字）', `${BASE}/conversations?limit=1&user=${PROBE_USER}`, { method: 'GET' }, { json: true })
    const r = await call('POST /conversations/:id/name auto_generate=true', `${BASE}/conversations/${conv.id}/name`, {
      method: 'POST', body: JSON.stringify({ auto_generate: true, user: PROBE_USER }),
    }, { json: true })
    if (r.status === 200 && r.json?.name) {
      P(`  ★ 模型给出的名字 = ${JSON.stringify(r.json.name)}（耗时 ${r.ms}ms）`)
      P('  ★ 结论：模型供应商凭据**健康** —— 500 不可能出在供应商，只能在应用编排。')
    } else {
      P('  ! 自动命名未成功：可能模型链路本身有问题，或该版本无此接口。')
    }
  }

  /* ── R6 历史全量 ── */
  P('\n══ R6. 历史全量扫描：是「必现」还是「偶发」══')
  {
    const tally = { total: 0, empty: 0, nonEmpty: 0, withError: 0 }
    const samples = []
    for (const stage of STAGES) {
      for (const c of await conversations(PROBE_USER, KEYS[stage])) {
        const m = await call(`GET /messages (${c.id.slice(0, 8)}…)`, `${BASE}/messages?conversation_id=${c.id}&limit=100&user=${PROBE_USER}`, { method: 'GET' }, { json: true, key: KEYS[stage] })
        for (const it of m.json?.data || []) {
          tally.total++
          if ((it.answer || '').trim()) { tally.nonEmpty++; samples.push(it) } else tally.empty++
          if (it.error) tally.withError++
        }
      }
    }
    P(`  message 总数 ${tally.total}｜answer 非空 ${tally.nonEmpty}｜answer 为空 ${tally.empty}｜error 非空 ${tally.withError}`)
    for (const s of samples.slice(0, 5)) P(`  成功样本 query=${JSON.stringify(s.query)} answer=${JSON.stringify(brief(s.answer, 120))}`)
    if (!tally.nonEmpty) P('  ★ 零成功样本：该应用在**当前配置下从未**产出过回答。')
  }

  P(`
══ 结论（2026-09-20 在 x-version=0.14.2 / PRODUCTION 上实测）══

  ★ 定案：**500 的成因是请求里的 user 不是合法 UUID**，上游没坏。
    判据（单变量对照，\`_probe-user-format.cjs\`，只改 user、其余字段全同）：
      user = UUID v4                    → 200，产出真实回答（约 3s / 142 字）
      user = 任何非 UUID 字符串          → 500，耗时仅 76~103ms（网关 HTML，未走到模型）
    前端 \`difyUser()\` 现已固定给出 UUID v4，故正常链路不再出现该 500。

  ⚠️ 本脚本第一版给出的结论是
     「③ 不是 user 字段问题 …… 500 必在应用编排执行」
     **这条是错的**，根因在 R3 的对照组：把「正常」定义为 \`diag-probe\`，
     而那并不是合法 UUID。对照组本身无效 ⇒ 由它推不出任何关于 user 的结论。
     对照组无效时，实验测到的是「我的输入错了」，不是「上游坏了」。

  以下几条仍然成立（当时的证据是对的，只是解释错了）：
  ─────────────────────────────────  ──────────────────────────────────────────────
  ① 不是前端集成问题                  同 base/同 key 的 /info、/parameters 均 200
  ② 不是 response_mode / 流式问题     streaming 与 blocking **同时** 500（R2）
  ④ 不是超时                          百毫秒级即返回，远快于一次模型调用（R4/R5）
  ⑤ 不是模型供应商凭据 / 额度          同密钥的自动命名走同一套模型配置，200 且产出真实文本（R5）
  ⑥ 不是鉴权 / 应用未发布             /info 与 /parameters 正常，且已通过应用类型校验（R1）
  ⑦ 不是数据库写入故障                 会话与消息记录都成功落库（R6 能读出记录）

  为什么容易被误读成「上游故障」
  · 500 是**网关 HTML**（不是应用层 JSON），body 里看不出任何具体原因；
  · 失败发生在**响应头之前**，所以看不到 traceback、也看不到 workflow_run_id；
  · 耗时极短（未走到模型），看着像「图一执行就炸」；
  · 四个应用**一致**失败，看着像「共享依赖有问题」。
    实际共享的是「同一个不合法的 user 值」。

  ⇒ 无需 Dify 侧处理。下次再撞到这个形态，先核对 user 是不是真 UUID。
`)
})().catch((e) => {
  P(`\n诊断脚本自身出错：${e.name}: ${e.message}`)
  process.exitCode = 1
})
