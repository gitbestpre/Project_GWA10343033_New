/* 知识宣教页 AI 导师对话（Dify「01 知识宣教」Chatflow）验证
 *
 * 覆盖八件事：
 *   ① **本页上线形态 = 流式**：请求写 `response_mode=streaming`、Accept 索要 SSE、
 *      `user` 为 GUID；上游随后逐帧吐字 → 逐帧增量上屏（5f 节的前半 + 第 2 节）；
 *   ② 回答整段到手后，用**同一支 MiniMax 音色**（女主持人 presenter_female）念出来；
 *   ③ 正在念上一条回答时再提问 → 停掉过期回答（stop，不是 pause）；
 *   ④ 上游报错 → 只在字幕条提示，不朗读（诊断文案不该被念出来）；
 *   ⑤ 上游回 500 网页错误页（2026-09-20 实测形态）→ 收成可执行中文，不把 <html> 甩到页面上；
 *   ⑥ 真实 Chatflow 事件序列（含 ping / workflow_started / node_* / workflow_finished / [DONE]）
 *      且**正文只在终帧 data.outputs、一个 message 增量都不发** → 仍完整上屏并朗读；
 *   ⑦ 空结束帧（只有 message_end）→ 落到错误态，而不是静默 resolve 出空回答；
 *   ⑧ 网关把流式**降级成一次性 JSON** → 仍完整上屏并朗读（5f 节的后半）。
 *
 * ⚠️ 关于「响应模式」这段历史，判读时容易踩错：
 *   页面的响应模式由 `KnowledgePage` 的 `DIFY_RESPONSE_MODE` 决定，**当前 = streaming**
 *   （官方推荐，逐字上屏与 `node_*` 节点进度都只有流式才有）。曾经短暂改到 blocking
 *   想绕开上游故障，实测无效（两种模式都 500，只是错误体形态不同），已改回。
 *   库里 `responseMode` 这个可选项保留着，排查上游时值得换它跑一次拿更具体的错误体。
 *   注意：⑧ 走的是**一次性 JSON 响应**，那是「上游没按约定回 SSE」的降级形态，
 *   不是「页面切到了 blocking」—— 断言的措辞要照着这个区分读。
 *
 * ⑥⑦ 补的是「上游成功但页面空白」这一类故障：桩此前只发 message + message_end，
 * 等于把「上游就长这样」当成了前提。⑥ 证明终帧兜底生效，⑦ 钉住那个真实缺陷 ——
 * `message_end` 会提前 return，绕过末尾的空回答守卫，页面上表现为字幕条整条消失。
 * 另有三项运行时纪律：请求打的是 /api/dify/01（不串阶段）、请求体不含凭据、不逐字送合成。
 *
 * 两层模式：
 *   - 桩链路（默认）：**跑完整套**。在页面里替换 window.fetch —— /api/dify/01 返回**带定时器的真 SSE 流**、
 *     /api/tts 返回一段真实 MiniMax mp3（见 .verify-knowledge-tts.fixture.json）。
 *     为什么必须换成页内桩而不是 page.route：Playwright 的 route.fulfill 只能整包送达，
 *     无法模拟「一帧一帧到」，那样就测不出真实的流式行为，也测不出「不是逐字送合成」。
 *     桩用的是真音频，所以 Chromium 真能解码播放，「回答确实被念了」才不是状态自证。
 *     ⚠️ 这一层也是**唯一**能验错误形态与请求口径的地方（见下）。
 *   - 真实链路（加 --live）：**只跑「桩替代不了」的三件事** ——
 *       ① 真上游通不通（能否拿到真回答）；② 真流式（多个中间态）与真回答正文；③ 真朗读（回答进合成、音色不变）＋多轮。
 *     ⚠️ 真实链路**刻意不跑其余小节**：错误形态（400 / 500 网页 / 空结束帧 / 一次性 JSON 降级）
 *     在真上游上无法构造；请求体口径要靠页内 `window.__difyReqs`，而真实链路不装桩、那份日志不存在
 *     ⇒ 相关断言只会读到 `undefined`。实测硬跑完整套会产出 **33 条假失败**，
 *     而假失败比不跑更糟：它会把「桩专用断言跑不了」误读成「前端回归了」。
 *     所以请求口径、错误收口、节点进度这些一律以**桩链路**的结论为准。
 *     2026-09-20 曾一度全量 500，一度被误判成「Dify 侧已发布快照坏了」。**那个结论是错的**。
 *     同日单变量实测（`_probe-user-format.cjs`，只改 user、其余字段全同）定案：
 *       `user` **必须是合法 UUID**。UUID → 200 并产出真实回答；
 *       任何非 UUID（`healthcheck-probe` / `stu-xxxxxxxx` / `12345` / 连文档示例 `abc-123`）
 *       → 500，耗时仅 76~103ms（响应头之前就断，回网关 HTML）。
 *     也就是说 500 一直是**我们自己发的 user 格式不合法**造成的，Dify 侧没坏。
 *     前端 `difyUser()` 现在固定给出 UUID v4，故真实链路可以正常跑。
 *     注意 500 是**网关 HTML** 而不是应用层错误体，所以看 body 看不出所以然 ——
 *     别据此怀疑上游，先查 user。
 *
 * 用法：先起 dev server，再 `node .verify-knowledge-dify.cjs [base] [--live]`
 */
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('./node_modules/playwright')

const args = process.argv.slice(2)
const LIVE = args.includes('--live')
const BASE = args.find((a) => a.startsWith('http')) || 'http://127.0.0.1:5174'
const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, '.verify-knowledge-tts.fixture.json'), 'utf8'),
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** GUID（UUID v4）的形状。与前端 `dify.ts` 的 GUID_RE 同一口径。
 *  钉住这个格式是有意义的：user 是 Dify 侧用来归并会话的主键，
 *  一旦有人把它改回可读前缀（如 `stu-xxxx`），后续按类型拼接的地方就会出问题。 */
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

let pass = 0
const fails = []
const ok = (cond, label, detail) => {
  if (cond) pass++
  else fails.push(`${label}${detail ? '  ⟶ ' + detail : ''}`)
}

/* ── 桩回答：带 Markdown 强调、多行、含 ≥/℃ 符号与中文编号，把三道工序都逼出来 ── */
const CHUNKS = [
  '**食源性疾病**',
  '是指食品中致病因素进入人体引起的感染性或中毒性疾病，包括经食物传播的急性胃肠道感染、食物中毒、肠道传染病、寄生虫病以及长期低剂量污染物导致的慢性危害。',
  '\n处置的关键控制点是中心温度≥70℃并保持至少2分钟，冷藏应≤4℃，熟食在室温下放置不超过2小时；生熟分开、烧熟煮透、安全温度、安全原料与保持清洁是预防的五个要点。',
  '\n调查时应围绕致病因子、污染食品与污染环节三个问题展开，先用病例对照或队列研究锁定可疑食品，再用分子分型比对病人与食品分离株以确证同源。',
]
const REPLY_RAW = CHUNKS.join('')
const CONV_ID = 'conv-e2e-1'
/**
 * `real_shape` 用的正文。刻意**与 REPLY_RAW 不同**：若测出字幕等于 REPLY_RAW，
 * 说明桩发的是旧序列，这条用例就没在验「正文只在终帧」这件事 —— 用一个独占字符串
 * 才能证明内容确实来自 `workflow_finished.data.outputs` 而不是别处的残留。
 */
const REAL_SHAPE_TEXT = '熟食在室温下放置不应超过 2 小时，中心温度需≥70℃并保持至少 2 分钟。'
/**
 * json_once 节用的正文。同样**刻意与 REPLY_RAW 不同**，且理由更硬：
 * `tts.ts` 里有一个模块级 `audioCache`（键 = 音色 + 文本），同一段文本第二次朗读
 * **不会再发合成请求**。若沿用 REPLY_RAW，本节就只能证明「有音频在响」，
 * 证不出「降级返回的这段文本真的进了合成链路」—— 断言会退化成假通过。
 * 用一个独占字符串，才能要求合成请求里出现它。
 */
const JSON_ONCE_TEXT = '沙门氏菌在危险温度带内约每二十分钟增殖一代，冷藏需保持在四摄氏度以下。'
const OK_TTS_BODY = JSON.stringify({
  data: { audio: FIXTURE.hex },
  base_resp: { status_code: 0, status_msg: 'success' },
})

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  page.setDefaultTimeout(20000)

  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push('console: ' + m.text())
  })

  // 把 Audio 构造暴露出来：才能区分「状态说是 playing」与「音频元素真在走」
  await page.addInitScript(() => {
    const Orig = window.Audio
    window.__audios = []
    function Patched(...a) {
      const el = new Orig(...a)
      window.__audios.push(el)
      return el
    }
    Patched.prototype = Orig.prototype
    window.Audio = Patched
  })

  if (!LIVE) {
    await page.addInitScript(
      ({ chunks, convId, okBody, realShapeText, jsonOnceText }) => {
        const orig = window.fetch.bind(window)
        const enc = new TextEncoder()
        window.__difyReqs = []
        window.__ttsReqs = []
        /** 下一次请求的行为：'chat'（默认）| 'error' | 'hang'，用后即清 */
        window.__difyNextMode = null
        /** 首帧之前的静默时长（ms）。`slow` 模式用它把「等待首字」这一刻拉长到可断言 */
        window.__difySlowMs = 700

        const parse = (body) => {
          try {
            return body ? JSON.parse(body) : null
          } catch {
            return null
          }
        }

        window.fetch = (input, init = {}) => {
          const url = typeof input === 'string' ? input : (input && input.url) || ''
          const headers = init.headers || {}

          if (url.includes('/api/dify')) {
            const body = parse(init.body)
            window.__difyReqs.push({ url, body, headers })
            const mode = window.__difyNextMode || 'chat'
            window.__difyNextMode = null

            if (mode === 'error') {
              return Promise.resolve(
                new Response(
                  JSON.stringify({
                    code: 'invalid_param',
                    message: 'Workflow not published',
                    status: 400,
                  }),
                  { status: 400, headers: { 'content-type': 'application/json' } },
                ),
              )
            }

            // 实测形态：Dify 工作进程崩掉时，HTTP 层回自己的 500 网页而不是 Dify 的结构化错误体
            if (mode === 'error_html') {
              return Promise.resolve(
                new Response(
                  '<html>\n  <head>\n    <title>Internal Server Error</title>\n  </head>\n  <body>\n    <h1><p>Internal Server Error</p></h1>\n  </body>\n</html>',
                  { status: 500, headers: { 'content-type': 'text/html' } },
                ),
              )
            }

            /**
             * 网关把**流式**降级成一次性 JSON —— 页面上线的可是 streaming（见 5f 节），
             * 所以这不是「另一种响应模式」，而是「上游没按约定回 SSE」的故障形态。
             * 上游回一条 JSON（`{event:'message', answer, conversation_id, metadata}`），
             * 没有 `data:` 行、也没有节点事件。
             * `json_once_slow` 再往后拖 700ms —— 用来观察「整段到达之前」界面上有没有话可说，
             * 这一支同时覆盖「没有 node_started 时进度文案的兜底路径」。
             */
            if (mode === 'json_once' || mode === 'json_once_slow') {
              const payload = JSON.stringify({
                event: 'message',
                answer: jsonOnceText,
                conversation_id: convId,
                metadata: { usage: { total_tokens: 1024 } },
              })
              const respond = () =>
                new Response(payload, {
                  status: 200,
                  headers: { 'content-type': 'application/json' },
                })
              if (mode === 'json_once_slow') {
                return new Promise((r) => setTimeout(() => r(respond()), window.__difySlowMs || 700))
              }
              return Promise.resolve(respond())
            }

            /**
             * 三种帧序列，覆盖真实 Chatflow 的形态差异：
             *   - 默认 `chat`：逐帧 message 增量（最理想的一种）；
             *   - `real_shape`：**完整的真实事件序列**（ping / workflow_started /
             *     node_started / node_finished / workflow_finished / message_end / [DONE]），
             *     且**一个 message 增量都不发** —— 正文只在终帧 data.outputs 里。
             *     这是「上游成功但页面空白」的真实成因形态；
             *   - `empty_end`：只有 message_end —— 用来证明空结束帧会落到错误态，
             *     而不是静默出一个空回答（那会让字幕条直接消失）。
             */
            let frames
            if (mode === 'real_shape') {
              frames = [
                { event: 'ping' },
                { event: 'workflow_started', conversation_id: convId, data: { id: 'wf-1' } },
                { event: 'node_started', data: { node_id: 'n1', title: 'LLM' } },
                { event: 'node_finished', data: { node_id: 'n1', status: 'succeeded' } },
                {
                  event: 'workflow_finished',
                  conversation_id: convId,
                  data: {
                    status: 'succeeded',
                    elapsed_time: '2.4',
                    outputs: { answer: realShapeText, elapsed_time: '2.4' },
                  },
                },
                { event: 'message_end', conversation_id: convId },
                '[DONE]',
              ]
            } else if (mode === 'empty_end') {
              frames = [{ event: 'message_end', conversation_id: convId }]
            } else if (mode === 'slow') {
              /* 上游跑得慢的形态：节点事件先到、正文迟迟不来。
                 负责人反馈的「发送后要等几秒才开始回复」正是这一段
                 （实测该应用：开始 7ms → 知识检索 381ms → LLM 2275ms）。
                 用它来断言「等待期界面上有话可说」，而不是一片空白 + 一根光标。 */
              frames = [
                { event: 'workflow_started', conversation_id: convId, data: { id: 'wf-s' } },
                { event: 'node_started', data: { node_id: 'n1', title: '知识检索' } },
                { event: 'node_started', data: { node_id: 'n2', title: 'LLM' } },
                { event: 'message', answer: chunks[0], conversation_id: convId },
                { event: 'message', answer: chunks.slice(1).join(''), conversation_id: convId },
                { event: 'message_end', conversation_id: convId },
              ]
            } else {
              frames = []
              chunks.forEach((c, i) =>
                frames.push({
                  event: 'message',
                  answer: c,
                  ...(i === 0 ? { conversation_id: convId } : {}),
                }),
              )
              frames.push({ event: 'message_end', conversation_id: convId })
            }

            const stream = new ReadableStream({
              async start(ctrl) {
                // hang：一帧不发、永不结束 —— 用来在「已发出提问」这一刻稳定观察音频
                if (mode === 'hang') return
                let first = true
                for (const f of frames) {
                  // slow：首帧之前先静默一段，把「等待首字」这一刻拉长到可断言
                  if (first && mode === 'slow') {
                    first = false
                    await new Promise((r) => setTimeout(r, window.__difySlowMs || 700))
                  }
                  // 裸哨兵 `data: [DONE]` 不能过 JSON.stringify，否则会变成 `data: "[DONE]"`
                  const line = typeof f === 'string' ? f : JSON.stringify(f)
                  ctrl.enqueue(enc.encode('data: ' + line + '\n\n'))
                  await new Promise((r) => setTimeout(r, 150))
                }
                ctrl.close()
              },
            })
            return Promise.resolve(
              new Response(stream, {
                status: 200,
                headers: { 'content-type': 'text/event-stream' },
              }),
            )
          }

          if (url.includes('/api/tts')) {
            window.__ttsReqs.push({ url, body: parse(init.body), headers })
            return Promise.resolve(
              new Response(okBody, {
                status: 200,
                headers: { 'content-type': 'application/json' },
              }),
            )
          }

          return orig(input, init)
        }
      },
      {
        chunks: CHUNKS,
        convId: CONV_ID,
        okBody: OK_TTS_BODY,
        realShapeText: REAL_SHAPE_TEXT,
        jsonOnceText: JSON_ONCE_TEXT,
      },
    )
  }

  /* ───────────────────────── 取值助手 ───────────────────────── */

  const subState = () =>
    page.evaluate(() => {
      const el = document.querySelector('.lecture-subtitle')
      if (!el) return null
      return {
        state: el.dataset.state,
        text: el.querySelector('.lecture-subtitle-text')?.textContent ?? '',
      }
    })

  const ttsLog = () => page.evaluate(() => window.__ttsLog || [])
  const difyReqs = () => page.evaluate(() => window.__difyReqs || [])
  const ttsReqs = () => page.evaluate(() => window.__ttsReqs || [])
  const nextMode = (m) => page.evaluate((x) => (window.__difyNextMode = x), m)

  const mediaState = () =>
    page.evaluate(() => {
      const a = window.__audios?.[window.__audios.length - 1]
      if (!a) return null
      return {
        scheme: a.src.split(':')[0],
        src: a.src,
        paused: a.paused,
        currentTime: a.currentTime,
        muted: a.muted,
      }
    })

  /** 订阅 data-tts-* 的**全部跃迁**。用观察者而不是轮询：回答音频只有一两秒，
   *  轮询会漏掉 playing 这一跳，让「回答确实被念了」变成靠运气。 */
  const watchTts = () =>
    page.evaluate(() => {
      const el = document.querySelector('.knowledge-page')
      if (!el || window.__ttsLog) return
      const log = []
      const rec = () =>
        log.push({
          status: el.dataset.ttsStatus ?? '',
          source: el.dataset.ttsSource ?? '',
          index: Number(el.dataset.ttsIndex ?? -1),
        })
      rec()
      new MutationObserver(rec).observe(el, {
        attributes: true,
        attributeFilter: ['data-tts-status', 'data-tts-source', 'data-tts-index'],
      })
      window.__ttsLog = log
    })

  const waitFor = async (fn, label, timeout = 20000) => {
    const t0 = Date.now()
    for (;;) {
      const v = await fn()
      if (v) return v
      if (Date.now() - t0 > timeout) {
        // 超时**不抛异常**：抛出会让整轮脚本提前中断，后面的断言一条都跑不到，
        // 排查时只能看到「第一个坏掉的等待」，看不到全貌。记一条失败后继续。
        ok(false, `[等待超时] ${label}`)
        return null
      }
      await sleep(100)
    }
  }

  const ask = async (text) => {
    await page.fill('.dialog-input', text)
    await page.click('.send-btn')
  }

  const finish = async () => {
    console.log(`\n────────── 结果：${pass} 通过 / ${fails.length} 失败 ──────────`)
    if (fails.length) {
      console.log('\n失败明细：')
      fails.forEach((f, i) => console.log(`  ${i + 1}. ${f}`))
    }
    await browser.close()
    process.exit(fails.length ? 1 : 0)
  }

  console.log(`══════════ 准备（${LIVE ? '真实链路' : '桩链路'}） ══════════`)
  await page.goto(BASE + '/knowledge', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.knowledge-page')
  await watchTts()

  ok(!(await page.locator('.lecture-subtitle').count()), '[初始] 未提问时不渲染字幕条')
  ok(
    (await page.locator('.knowledge-page').getAttribute('data-tts-source')) === null,
    '[初始] 无朗读来源标记',
  )

  /* ───────── 1. 进入学习态：正文自动朗读未因本次改动回归 ───────── */
  console.log('\n══════════ 1. 进入学习态（正文自动朗读） ══════════')
  await page.click('.sidebar-action-btn:has-text("知识科普")')
  await waitFor(
    async () => (await ttsLog()).some((e) => e.source === 'page' && e.status === 'playing'),
    '正文自动朗读进入 playing',
  )
  ok(true, '[正文] 进入学习态后自动起播，来源标记为 page')

  /* ═══════════ 真实链路：只跑「桩替代不了」的那几项 ═══════════
   *
   * 为什么真实链路不往下跑整套：
   * 下面 2 / 3 / 4 / 5 / 5b / 5c / 5d / 5e / 5f 各节大量依赖**页内桩**，而真实链路不装桩：
   *   · 错误形态（400 / 500 网页 / 空结束帧 / 一次性 JSON 降级）**无法在真上游上构造**；
   *   · 请求体口径靠读 `window.__difyReqs`，合成口径靠读 `window.__ttsReqs` ——
   *     **这两个数组都是桩建的**，真实链路下根本不存在 ⇒ 相关断言只会读到 `undefined` / `0`。
   * 硬跑完整套的结果是**几十条假失败**（实测 33 条），而假失败比不跑更糟：
   * 它会把「桩专用断言本来就跑不了」误读成「前端回归了」。
   *
   * ⇒ 真实链路只验「**只有真上游能回答**」的那几件事，且只用 **DOM 可观测**的信号
   *   （`data-tts-*` 跃迁 + Audio 元素状态），不碰任何桩才有的日志。
   */
  if (LIVE) {
    console.log('\n══════════ L. 真实链路（真 Dify + 真 MiniMax） ══════════')
    ok(true, '[真实链路] 正文自动朗读起播（1 节已验）')

    await ask('什么是食源性疾病？')

    // 真流式：应当看到多个中间态，而不是整段一次出现
    const liveSamples = []
    let liveLast = null
    const tl = Date.now()
    while (Date.now() - tl < 60000) {
      const s = await subState()
      const text = s?.text ?? ''
      if (text !== liveLast) {
        liveSamples.push(text)
        liveLast = text
      }
      if (s?.state === 'done' || s?.state === 'error') break
      await sleep(60)
    }
    const liveStages = liveSamples.filter((t) => t.length > 0)
    const liveSub = await subState()
    ok(liveStages.length >= 3, '[真实链路] 真上游逐帧吐字：字幕出现多个中间态', `中间态 ${liveStages.length} 个`)
    ok(liveSub?.state === 'done', '[真实链路] 真回答以 done 收尾（没落到错误态）', liveSub?.state)
    ok(
      (liveSub?.text?.length ?? 0) > 20,
      '[真实链路] 真回答有实质正文',
      `长度 ${liveSub?.text?.length}｜${liveSub?.text?.slice(0, 40)}`,
    )

    // 真朗读：只看 DOM 信号 —— 来源标记翻到 reply 且进 playing
    await waitFor(
      async () => (await ttsLog()).some((e) => e.source === 'reply' && e.status === 'playing'),
      '真实回答进入朗读',
      60000,
    )
    ok(
      (await ttsLog()).some((e) => e.source === 'reply' && e.status === 'playing'),
      '[真实链路] 真回答进入朗读（data-tts-source=reply 且 playing）',
    )
    // 音频元素真的在走 ⇒ 播放的确实是 /api/tts 回来的音频，而不是状态自证
    const liveMedia = await mediaState()
    ok(
      liveMedia?.scheme === 'blob' && liveMedia?.paused === false && liveMedia?.currentTime > 0,
      '[真实链路] 回答音频由 Blob 播放且确实在推进',
      JSON.stringify(liveMedia),
    )

    // 多轮：第二问也要拿到实质回答（依赖真实 conversation_id 流转）
    await ask('那关键控制点是什么？')
    await waitFor(async () => (await subState())?.state === 'done', '真实链路第二轮回答结束', 60000)
    const liveSecond = await subState()
    ok(
      (liveSecond?.text?.length ?? 0) > 20,
      '[真实链路] 第二轮（多轮上下文）同样拿到实质回答',
      `长度 ${liveSecond?.text?.length}`,
    )

    ok(errs.length === 0, '[真实链路] 运行期无未捕获异常', errs.slice(0, 3).join(' || '))
    await finish()
    return
  }

  await waitFor(async () => (await page.locator('.knowledge-page').getAttribute('data-tts-status')) === 'idle', '正文朗读跑完')

  /* ───────── 2. 上游以流式形态应答 → 增量上屏 ───────── */
  console.log('\n══════════ 2. 上游以流式形态应答 → 增量上屏 ══════════')
  /* 注意：本节验的是**上游回 SSE** 时的行为（库层契约 / 网关降级兜底），
     不是本页当前的上线形态 —— 本页用 blocking，线上是整段一次出现（见 5f 节）。 */
  await ask('什么是食源性疾病？')

  // 逐帧采样字幕文本：一帧一帧到，字幕就该一段一段长
  const samples = []
  let last = null
  const t0 = Date.now()
  while (Date.now() - t0 < 15000) {
    const s = await subState()
    const text = s?.text ?? ''
    if (text !== last) {
      samples.push(text)
      last = text
    }
    if (s?.state === 'done') break
    await sleep(40)
  }

  const stages = samples.filter((t) => t.length > 0 && t !== REPLY_RAW)
  ok(stages.length >= 3, '[流式] 上屏过程中出现多个中间态（不是整段一次性出现）', `中间态 ${stages.length} 个`)
  ok(
    stages.every((t) => REPLY_RAW.startsWith(t) || t.startsWith('**')),
    '[流式] 每个中间态都是回答的前缀（不是乱序或重复拼接）',
  )
  const sub = await subState()
  ok(sub?.text === REPLY_RAW, '[流式] 字幕终值等于回答全文', sub?.text?.slice(0, 40))
  ok(sub?.state === 'done', '[流式] 流结束后字幕进入 done 态', sub?.state)
  ok((await page.inputValue('.dialog-input')) === '', '[流式] 提问后输入框已清空')
  ok(await page.locator('.send-btn').isDisabled(), '[流式] 输入为空时发送钮禁用')

  // 请求口径：同源代理、无凭据、首轮不带 conversation_id
  const reqs1 = await difyReqs()
  const first = reqs1[0]
  // 阶段进路径后缀：知识宣教页必须打 01，别串到 02/03/04 去
  ok(first?.url.endsWith('/api/dify/01'), '[请求] 发往同源代理 /api/dify/01（知识宣教）', first?.url)
  ok(first?.body?.query === '什么是食源性疾病？', '[请求] query 为题面原文', JSON.stringify(first?.body))
  ok(!('conversation_id' in (first?.body || {})), '[请求] 首轮不带 conversation_id')
  ok(typeof first?.body?.user === 'string' && first.body.user.length > 0, '[请求] 带匿名 user 标识')
  ok(
    !JSON.stringify(first?.headers || {}).toLowerCase().includes('authorization'),
    '[请求] 浏览器侧不带 Authorization 头（密钥留在服务端）',
  )
  ok(
    !JSON.stringify(first?.body || {}).includes('app-'),
    '[请求] 请求体不含 app- 前缀密钥',
  )

  /* ───────── 3. 多轮：第二轮回传 conversation_id ───────── */
  console.log('\n══════════ 3. 多轮上下文 ══════════')
  await ask('那关键控制点是什么？')
  await waitFor(async () => (await difyReqs()).length >= 2, '第二轮请求发出')
  const second = (await difyReqs())[1]
  ok(second?.body?.conversation_id === CONV_ID, '[多轮] 第二轮带上首轮下发的 conversation_id', second?.body?.conversation_id)
  await waitFor(async () => (await subState())?.state === 'done', '第二轮回答结束')

  /* ───────── 4. 回答被朗读（核心）───────── */
  console.log('\n══════════ 4. 回答用同一支 MiniMax 音色朗读 ══════════')
  const ttsReqsAll = await ttsReqs()
  // 进入学习态那次「正文朗读」也会发 /api/tts，故按**回答原文片段**筛出回答这一路，
  // 而不是靠「第几条」——块数会随分段策略变化，按下标切迟早会错位。
  const replyTts = ttsReqsAll.filter((r) => /食源性疾病是指|调查时应围绕|处置的关键控制点/.test(r.body?.text || ''))
  ok(replyTts.length >= 1, '[朗读] 回答被送去 MiniMax 合成', `命中 ${replyTts.length} 条`)

  // 分块：回答超过 220 字上限，应切成多块分别合成（而不是把整段塞进一次请求）
  ok(replyTts.length >= 2, '[朗读] 长回答按块切分后逐块合成', `块数 ${replyTts.length}`)
  ok(
    replyTts.every((r) => !replyTts.some((o) => o !== r && r.body.text.startsWith(o.body.text))),
    '[朗读] 各块文本互不为前缀 —— 排除「逐字送合成」',
  )

  // 清洗：上屏保留 Markdown，送合成的必须是剥掉标记与符号后的朗读文本
  const spoken = replyTts.map((r) => r.body.text).join('')
  ok(!/[*#`~]/.test(spoken), '[朗读] 送合成文本里没有 Markdown 标记残留', spoken.slice(0, 60))
  ok(spoken.includes('大于等于70摄氏度'), '[朗读] 符号已按念法转换（≥70℃ → 大于等于70摄氏度）')
  ok(spoken.includes('小于等于4摄氏度'), '[朗读] ≤ 也已转换（≤4℃ → 小于等于4摄氏度）')

  // 音色：与正文朗读同一支（女主持人 presenter_female）
  ok(
    replyTts.every((r) => r.body?.voice_setting?.voice_id === 'presenter_female'),
    '[朗读] 沿用固定音色 presenter_female',
    replyTts.map((r) => r.body?.voice_setting?.voice_id).join(','),
  )
  ok(
    (await page.locator('.knowledge-page').getAttribute('data-tts-voice')) === 'narrator-female',
    '[朗读] 页面音色口径仍为 narrator-female（未被回答改掉）',
  )

  // 真的开口了：来源标记为 reply 且进过 playing，音频元素确实在走
  const logWithReply = (await ttsLog()).filter((e) => e.source === 'reply')
  ok(
    logWithReply.some((e) => e.status === 'playing'),
    '[朗读] 回答音频进入 playing（来源标记 source=reply）',
    JSON.stringify(logWithReply.slice(0, 6)),
  )
  const media = await mediaState()
  ok(media?.scheme === 'blob', '[朗读] 音频由 Blob URL 播放（来自 /api/tts 响应体）', media?.scheme)
  ok(media?.paused === false && media?.currentTime > 0, '[朗读] 音频元素确实在推进', JSON.stringify(media))

  /* ───────── 5. 上游报错 → 只提示不朗读 ───────── */
  console.log('\n══════════ 5. 上游报错不朗读 ══════════')
  const ttsCountBeforeErr = (await ttsReqs()).length
  // 日志同样要按「报错这一刻」切一刀：直接看尾巴会读到前几节留下的 reply 记录，
  // 那与本次报错无关，属于典型的假失败（也提醒：切片基准必须是本次事件的起点）
  const logLenBeforeErr = (await ttsLog()).length
  await nextMode('error')
  await ask('刻意触发错误')
  await waitFor(async () => (await subState())?.state === 'error', '错误态字幕')
  const errSub = await subState()
  ok(errSub.text.includes('发布'), '[报错] 字幕给出可执行的中文提示（提示去控制台发布）', errSub.text.slice(0, 60))
  const afterErr = (await ttsReqs()).slice(ttsCountBeforeErr)
  ok(
    !afterErr.some((r) => /发布|Workflow|invalid_param/.test(r.body?.text || '')),
    '[报错] 诊断文案没有被送去合成（不朗读错误提示）',
    afterErr.map((r) => r.body?.text).join(' | ').slice(0, 80),
  )
  ok(
    !(await ttsLog()).slice(logLenBeforeErr).some((e) => e.source === 'reply'),
    '[报错] 报错后没有出现 source=reply 的朗读',
  )

  /* ───────── 5b. 上游 500 网页错误页 → 给可执行提示，不甩 HTML ───────── */
  console.log('\n══════════ 5b. 上游 500（Dify 内部错误页） ══════════')
  // 这条对应 2026-09-20 实测的真实故障：四个应用一起回 500 text/html。
  // 若不做收口，页面上会直接显示一段 <html>…，使用者零信息量。
  const ttsCountBefore500 = (await ttsReqs()).length
  const logLenBefore500 = (await ttsLog()).length
  await nextMode('error_html')
  await ask('触发上游 500')
  await waitFor(async () => (await subState())?.text.includes('网页错误页'), '500 的可执行提示出现')
  const sub500 = await subState()
  ok(sub500.state === 'error', '[500] 字幕进入错误态', sub500.state)
  ok(sub500.text.includes('HTTP 500'), '[500] 提示里带上状态码', sub500.text.slice(0, 90))
  ok(!sub500.text.includes('<html>'), '[500] 字幕里不含 HTML 标签', sub500.text.slice(0, 90))
  const after500 = (await ttsReqs()).slice(ttsCountBefore500)
  ok(
    !after500.some((r) => /Internal Server Error/.test(r.body?.text || '')),
    '[500] 错误页内容没有被送去合成',
    after500.map((r) => r.body?.text).join(' | ').slice(0, 60),
  )
  ok(
    !(await ttsLog()).slice(logLenBefore500).some((e) => e.source === 'reply'),
    '[500] 报错后没有出现 source=reply 的朗读',
  )

  /* ───────── 5c. 真实 Chatflow 事件形态：正文只在终帧 outputs ───────── */
  console.log('\n══════════ 5c. 真实 Chatflow 事件序列（正文只在终帧 outputs） ══════════')
  // 对应「上游成功、页面却是空气泡」这一类真实故障：LLM 节点不向客户端流式吐字，
  // 全文只出现在 workflow_finished.data.outputs 里。
  // 桩**一个 message 增量都不发**，所以本条用例能通过，只能是因为终帧兜底生效。
  const ttsCountBeforeReal = (await ttsReqs()).length
  const logLenBeforeReal = (await ttsLog()).length
  await nextMode('real_shape')
  await ask('熟食能放多久？')

  // 采样「是否出现过字幕条」：空回答的老毛病就是字幕条全程不出现
  let sawVisible = false
  const t0r = Date.now()
  while (Date.now() - t0r < 15000) {
    const s = await subState()
    if (s) sawVisible = true
    if (s?.state === 'done' || s?.state === 'error') break
    await sleep(40)
  }
  const subReal = await subState()
  ok(sawVisible, '[真实形态] 提问后字幕条确实出现（不是全程空白）')
  ok(subReal?.state === 'done', '[真实形态] 以 done 收尾（不是错误态）', subReal?.state)
  ok(
    subReal?.text === REAL_SHAPE_TEXT,
    '[真实形态] 正文只在终帧 outputs 时仍完整上屏',
    JSON.stringify(subReal?.text?.slice(0, 60)),
  )
  ok(
    !/elapsed_time|2\.4/.test(subReal?.text || ''),
    '[真实形态] outputs 里的过程字段没有被当成正文上屏',
    subReal?.text?.slice(0, 60),
  )
  await waitFor(
    async () => (await ttsLog()).slice(logLenBeforeReal).some((e) => e.source === 'reply'),
    '真实形态的回答被朗读',
  )
  const afterReal = (await ttsReqs()).slice(ttsCountBeforeReal)
  ok(afterReal.length > 0, '[真实形态] 终帧兜底取到的正文同样送去合成了（不是只有上屏）')
  ok(
    !/elapsed_time/.test(afterReal.map((r) => r.body?.text || '').join('')),
    '[真实形态] 合成文本里不含过程字段',
  )

  /* ───────── 5d. 只收到 message_end（一个字都没有）→ 错误态而非空回答 ───────── */
  console.log('\n══════════ 5d. 空结束帧（上游只发 message_end） ══════════')
  // 原缺陷：message_end 会提前 return，绕过末尾的空回答守卫 → resolve 出空串。
  // 调用方既不走成功分支也不走错误分支，表现就是**字幕条整个消失**。
  const ttsCountBeforeEmpty = (await ttsReqs()).length
  const logLenBeforeEmpty = (await ttsLog()).length
  await nextMode('empty_end')
  await ask('触发空结束帧')
  await waitFor(async () => (await subState())?.state === 'error', '空结束帧落到错误态')
  const subEmpty = await subState()
  ok(subEmpty !== null, '[空结束帧] 字幕条仍在（原缺陷会让它整条消失）')
  ok(subEmpty?.state === 'error', '[空结束帧] 进入错误态', subEmpty?.state)
  ok(
    subEmpty?.text.includes('未返回任何内容'),
    '[空结束帧] 提示「未返回任何内容」，不静默成功',
    subEmpty?.text?.slice(0, 60),
  )
  ok(
    !(await ttsLog()).slice(logLenBeforeEmpty).some((e) => e.source === 'reply'),
    '[空结束帧] 没有出现 source=reply 的朗读',
  )
  ok((await ttsReqs()).length === ttsCountBeforeEmpty, '[空结束帧] 一次合成都没发（没有空文本送合成）')

  /* ───────── 5e. 首字之前：等待期必须有话可说 ───────── */
  console.log('\n══════════ 5e. 首字之前的空窗（等待期进度文案） ══════════')
  /* 负责人反馈的「发送之后要等几秒 AI 才开始回复」，根因是这段静默期界面上只有
     一片空白 + 一根闪光标。此段把这一刻**停住**观察：上游先发节点事件、
     正文拖到 700ms 之后，中间这段就是用户感知到的「等」。 */
  await nextMode('slow')
  await ask('等待期文案')

  // 等待期：hint 元素存在且说了人话
  await waitFor(
    async () =>
      page.evaluate(() => {
        const el = document.querySelector('.lecture-subtitle')
        return el?.dataset.phase === 'waiting'
      }),
    '字幕条进入 waiting 阶段',
  )
  const waitHint = await page.evaluate(() => ({
    phase: document.querySelector('.lecture-subtitle')?.dataset.phase,
    state: document.querySelector('.lecture-subtitle')?.dataset.state,
    hint: document.querySelector('.lecture-subtitle-hint')?.textContent ?? null,
    body: document.querySelector('.lecture-subtitle-text')?.textContent ?? null,
  }))
  ok(waitHint.phase === 'waiting', '[等待期] data-phase=waiting', waitHint.phase)
  ok(waitHint.state === 'streaming', '[等待期] 仍归入原有的 streaming 态（四态没被改坏）', waitHint.state)
  ok(Boolean(waitHint.hint), '[等待期] 显示进度文案，而不是 1325px 空白条', JSON.stringify(waitHint.hint))
  ok(
    !waitHint.body,
    '[等待期] 正文元素尚不存在（占位文案没有被当成回答上屏）',
    JSON.stringify(waitHint.body),
  )

  // 节点事件到达后：文案跟着走（真实进度）
  await waitFor(
    async () =>
      page.evaluate(() => document.querySelector('.lecture-subtitle-hint')?.textContent?.includes('检索') ?? false),
    '节点事件把文案推进到「检索知识库」',
    5000,
  )
  const afterNode = await page.evaluate(
    () => document.querySelector('.lecture-subtitle-hint')?.textContent ?? '',
  )
  ok(afterNode.includes('正在检索知识库'), '[等待期] node_started(知识检索) 反映到文案上', afterNode)

  // 正文到达后：占位退场，不并存
  await waitFor(async () => (await subState())?.state === 'done', '慢链路跑完')
  const subSlow = await subState()
  ok(subSlow?.text === REPLY_RAW, '[等待期] 慢链路的终值仍是回答全文', subSlow?.text?.slice(0, 40))
  ok(
    (await page.locator('.lecture-subtitle-hint').count()) === 0,
    '[等待期] 正文到达后进度文案已退场（不与正文并存）',
  )

  /* ───────── 5f. 回应答模式：上线用流式，且能扛住网关降级 ───────── */
  console.log('\n══════════ 5f. 响应模式口径（上线=流式） ══════════')
  /* 本页的响应模式由 KnowledgePage 的 `DIFY_RESPONSE_MODE` 决定，当前 = streaming。
     这一节分两段，各钉一件事：
       (1) **请求口径**：请求体真的写了 response_mode=streaming、Accept 索要 SSE。
           少了这段，第 2 / 5c / 5e 节全绿也证明不了页面上线时用的是流式 ——
           它们只证明「上游回 SSE 时页面能处理」，而页面完全可能一边要求 blocking
           一边靠桩喂 SSE 蒙混过关。
       (2) **降级兜底**：网关不按约定回 SSE、改回一次性 JSON 时，页面仍要完整上屏并朗读。
           `streamChat` 按 content-type 分流，这条路径不能只靠单测。 */

  const reqBeforeModeCheck = (await difyReqs()).length
  await ask('确认响应模式')
  await waitFor(async () => (await difyReqs()).length > reqBeforeModeCheck, '模式核查请求发出')
  const modeReq = (await difyReqs())[reqBeforeModeCheck]
  ok(
    modeReq?.body?.response_mode === 'streaming',
    '[模式] 请求体写的是 response_mode=streaming（上线即流式）',
    String(modeReq?.body?.response_mode),
  )
  const modeAccept = String(modeReq?.headers?.Accept || modeReq?.headers?.accept || '')
  ok(
    modeAccept.includes('text/event-stream'),
    '[模式] 请求头向 SSE 取样（Accept 含 text/event-stream）',
    modeAccept,
  )
  ok(
    typeof modeReq?.body?.user === 'string' && GUID_RE.test(modeReq.body.user),
    '[模式] user 是 GUID 格式（不是可读前缀 id）',
    String(modeReq?.body?.user),
  )
  await waitFor(async () => (await subState())?.state === 'done', '模式核查那轮回答结束')

  /* 降级兜底：上游改成一次性 JSON（没有 data: 行、也没有节点事件） */
  const ttsCountBeforeJson = (await ttsReqs()).length
  const logLenBeforeJson = (await ttsLog()).length
  // 让上游把 JSON 拖住 700ms：这是降级形态下仅有的「等待期」，
  // 且此时**不会有 node_started**，正好覆盖进度文案的兜底路径（5e 验的是有节点事件那一支）
  await nextMode('json_once_slow')
  await ask('一次性返回')

  await waitFor(
    async () =>
      page.evaluate(() => document.querySelector('.lecture-subtitle')?.dataset.phase === 'waiting'),
    'JSON 降级等待期进入 waiting',
  )
  const blockWait = await page.evaluate(() => ({
    hint: document.querySelector('.lecture-subtitle-hint')?.textContent ?? null,
    body: document.querySelector('.lecture-subtitle-text')?.textContent ?? null,
  }))
  ok(
    blockWait.hint?.includes('正在思考'),
    '[JSON降级] 无节点事件时进度文案回落到通用兜底（而不是 1325px 空白条）',
    JSON.stringify(blockWait.hint),
  )
  ok(!blockWait.body, '[JSON降级] 等待期正文元素尚未出现', JSON.stringify(blockWait.body))

  await waitFor(async () => (await subState())?.state === 'done', 'JSON 降级回答结束')
  const blockSub = await subState()
  ok(
    blockSub?.text === JSON_ONCE_TEXT,
    '[JSON降级] 一次性 JSON 被完整上屏',
    blockSub?.text?.slice(0, 40),
  )
  ok(
    (await page.locator('.lecture-subtitle-hint').count()) === 0,
    '[JSON降级] 正文到达后进度文案已退场（不与正文并存）',
  )

  // 整段到达的回答同样要走朗读。
  // ⚠️ 断言要落在**真的发出合成请求**上，不能只看 data-tts-source：
  //    该标记在 playReply 开头就翻转，早于 useTts 内部那次 fetch 被记录，
  //    盯着它取样会得到一个与实现时序耦合的假失败（初版就是这么错的）。
  //    桩正文用 JSON_ONCE_TEXT（≠ REPLY_RAW）就是为了避开 tts.ts 的 audioCache，
  //    否则「命中缓存、一个请求都不发」也会让这条断言落空。
  await waitFor(
    async () =>
      (await ttsLog()).slice(logLenBeforeJson).some((e) => e.source === 'reply' && e.status === 'playing'),
    'JSON 降级的回答音频进入 playing',
  )
  await waitFor(
    async () =>
      (await ttsReqs()).slice(ttsCountBeforeJson).some((r) => /沙门氏菌在危险温度带/.test(r.body?.text || '')),
    'JSON 降级的回答送去合成',
  )
  const afterJson = (await ttsReqs()).slice(ttsCountBeforeJson)
  ok(
    afterJson.some((r) => /沙门氏菌在危险温度带/.test(r.body?.text || '')),
    '[JSON降级] 降级返回的内容真的进了合成请求（不只是上屏、也不是命中缓存）',
    afterJson.map((r) => r.body?.text).join(' | ').slice(0, 80),
  )
  ok(
    afterJson.every((r) => r.body?.voice_setting?.voice_id === 'presenter_female'),
    '[JSON降级] 仍沿用固定音色 presenter_female',
    afterJson.map((r) => r.body?.voice_setting?.voice_id).join(','),
  )

  /* ───────── 6. 念上一条回答时再提问 → 停掉过期回答 ───────── */
  console.log('\n══════════ 6. 过期回答停掉（stop 而非 pause） ══════════')
  await ask('再问一次')
  // 等回答音频真的开口，再在「还响着」的时刻抛出下一个问题
  await waitFor(
    async () => {
      const m = await mediaState()
      const log = await ttsLog()
      return m?.paused === false && log.some((e) => e.source === 'reply' && e.status === 'playing')
    },
    '回答音频正在播',
  )
  const beforeAsk = await mediaState()
  ok(beforeAsk?.paused === false, '[过期] 提问前回答音频确实在播（否则本条断言会变成空测）', JSON.stringify(beforeAsk))

  await nextMode('hang') // 第二个回答永不返回，好在「已发出提问」这一刻稳定观察
  await ask('上一条还在念时再问')
  await waitFor(
    async () => (await page.locator('.knowledge-page').getAttribute('data-tts-status')) === 'idle',
    '过期回答被停掉',
  )
  const afterAsk = await mediaState()
  ok(afterAsk.paused === true, '[过期] 音频已暂停播放')
  ok(afterAsk.src === '', '[过期] 音频元素的 src 已被清掉（stop 会 removeAttribute）', afterAsk.src)
  ok(
    (await page.locator('.knowledge-page').getAttribute('data-tts-source')) === null,
    '[过期] 来源标记已归零',
  )
  const tail = await ttsLog()
  const lastReplyPlaying = tail.map((e) => e.source === 'reply' && e.status === 'playing').lastIndexOf(true)
  ok(
    lastReplyPlaying >= 0 && tail.slice(lastReplyPlaying).some((e) => e.status === 'idle'),
    '[过期] 提问后由 playing 直接落到 idle（stop），没有停在 paused',
    JSON.stringify(tail.slice(-4)),
  )

  /* ───────── 7. 运行期无报错 ───────── */
  console.log('\n══════════ 7. 运行期控制台 ══════════')
  ok(errs.length === 0, '[控制台] 无未捕获异常', errs.slice(0, 3).join(' || '))

  await finish()
}

main().catch((e) => {
  console.error('验证脚本异常：', e)
  process.exit(1)
})
