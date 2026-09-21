/* 知识宣教页（/knowledge）语音朗读验证 —— 进入即自动播放版
 *
 * 覆盖两层：
 *   ① 桩链路（默认）：拦截 /api/tts 返回一段**真实 MiniMax mp3**（见 .verify-knowledge-tts.fixture.json）
 *      —— 桩用的是真音频而不是假字节，这样 Blob 的 MIME 与内容一致，Chromium 真能解码播放，
 *      「自动起播 / 分段推进 / 暂停继续 / 静音」这些依赖真实媒体事件的行为才测得出来；同时耗时短、无调用开销。
 *   ② 真实链路（加 --live）：放行到真实 MiniMax（经 vite 代理），验证端到端真能出声、且请求口径正确。
 *      因为要计费，默认不跑。
 *
 * 另外三项断言专门针对运行时风险：
 *   - 浏览器发出的 /api/tts 请求**不带 Authorization 头**，客户端模块源码里不含密钥字样；
 *   - 「进入即自动播放」确实不需要点任何播放控件（全程计数为 0）；
 *   - 自动播放被浏览器策略拦下时，落进 blocked 态并显示「播放文字」，而不是像出错的「重新播放」。
 *
 * 用法：先起 dev server，再 `node .verify-knowledge-tts.cjs [base] [--live]`
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

let pass = 0
const fails = []
const ok = (cond, label, detail) => {
  if (cond) pass++
  else fails.push(`${label}${detail ? '  ⟶ ' + detail : ''}`)
}

const OK_BODY = JSON.stringify({
  data: { audio: FIXTURE.hex },
  base_resp: { status_code: 0, status_msg: 'success' },
})
const ERR_BODY = JSON.stringify({ base_resp: { status_code: 1004, status_msg: '模拟：凭据无效' } })

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  page.setDefaultTimeout(20000)

  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push('console: ' + m.text())
  })

  /** 请求记录：payload 与鉴权头 */
  const reqs = []
  const resCodes = []
  page.on('request', (r) => {
    if (r.url().includes('/api/tts')) {
      reqs.push({ payload: r.postDataJSON?.() ?? null, auth: r.headers()['authorization'] })
    }
  })
  page.on('response', (r) => {
    if (r.url().includes('/api/tts')) resCodes.push(r.status())
  })

  // 把 Audio 构造暴露出来，才能看到「真的在播」而不是「状态说是 playing」
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

  /** 计数：本轮共点了几次播放/停止控件，用来证明自动播放没依赖点击 */
  let playControlClicks = 0

  if (!LIVE) {
    await page.route('**/api/tts', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: OK_BODY }),
    )
  }

  const ttsState = () =>
    page.evaluate(() => {
      const kp = document.querySelector('.knowledge-page')
      return {
        status: kp?.dataset.ttsStatus ?? '',
        index: Number(kp?.dataset.ttsIndex ?? -1),
        total: Number(kp?.dataset.ttsTotal ?? -1),
        voice: kp?.dataset.ttsVoice ?? '',
        error: kp?.dataset.ttsError ?? '',
      }
    })

  /**
   * 正文**不做任何朗读定位标记**（负责人不要高亮），所以「念到哪一段」只能从请求侧取证：
   * 每个块各自发一次请求，请求文本即该块内容。用首行标题做锚点判断块从哪开始。
   */
  const lastText = () => reqs.length ? (reqs[reqs.length - 1].payload?.text ?? '') : ''

  const mediaState = () =>
    page.evaluate(() => {
      const a = window.__audios?.[window.__audios.length - 1]
      if (!a) return null
      return {
        scheme: a.src.split(':')[0],
        src: a.src,
        paused: a.paused,
        muted: a.muted,
        currentTime: a.currentTime,
      }
    })

  const waitFor = async (fn, label, timeout = 20000) => {
    const t0 = Date.now()
    for (;;) {
      const v = await fn()
      if (v) return v
      if (Date.now() - t0 > timeout) throw new Error(`等待超时：${label}`)
      await sleep(120)
    }
  }

  const byAria = (label) => page.locator(`button[aria-label="${label}"]`)
  const sidebar = (text) => page.locator('.sidebar-action-btn', { hasText: text })
  /** 点播放类控件并计数（仅用于「手动」路径；自动路径一次也不点） */
  const clickPlayControl = async (label) => {
    playControlClicks++
    await byAria(label).click()
  }

  console.log(`══════════ 准备（${LIVE ? '真实链路' : '桩链路'}） ══════════`)
  await page.goto(BASE + '/knowledge', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.knowledge-page')

  let s = await ttsState()
  ok(s.status === 'idle', '[初始] TTS 状态为 idle', s.status)
  ok(!(await byAria('播放文字').count()), '[初始] 欢迎态不渲染播放按钮')
  // 音色选择行已撤除：不论欢迎态还是学习态都不该出现（下面的学习态段落另有断言）
  ok(!(await page.locator('.tts-voice-select').count()), '[初始] 无音色下拉（已撤除）')

  /* ───────────── 1. 进入即自动播放（不点任何播放控件） ───────────── */
  console.log('\n══════════ 1. 进入即自动播放 ══════════')
  playControlClicks = 0
  const r0 = reqs.length
  await sidebar('知识科普').click()
  await page.waitForSelector('.tts-read-btn')
  await waitFor(async () => (await ttsState()).status === 'playing', '自动进入 playing', LIVE ? 90000 : 20000)

  s = await ttsState()
  ok(playControlClicks === 0, '[自动] 全程未点任何播放/停止控件', `点了 ${playControlClicks} 次`)
  ok(reqs.length > r0, '[自动] 未经点击即发起了语音请求', `${r0} → ${reqs.length}`)
  ok(s.total > 1, '[自动] 本页被切成多块', `total=${s.total}`)
  ok(s.index === 0, '[自动] 从第 1 块开始', `index=${s.index}`)
  ok(s.error === '', '[自动] 无错误信息', s.error)
  // 音色不再是可选项（选择行已撤除），但「用的是哪支音色」这个口径必须仍可读出：
  // 状态属性 data-tts-voice 仍在，且固定为默认女主持人。
  const voiceRowGone = await page.evaluate(() => ({
    row: document.querySelectorAll('.tts-voice-row').length,
    select: document.querySelectorAll('.tts-voice-select').length,
  }))
  ok(
    voiceRowGone.row === 0 && voiceRowGone.select === 0,
    '[自动] 学习态也无音色选择行（已撤除）',
    `row=${voiceRowGone.row} select=${voiceRowGone.select}`,
  )
  ok(s.voice === 'narrator-female', '[自动] 音色固定为默认女主持人', s.voice)

  // 注意：控制器取到当前块后会立刻预取下一块（tts.ts 里 fetch 当前 → 再 void fetch 下一块），
  // 所以「本页首块」必须是本轮**第一个**新请求 reqs[r0]，而不是 reqs[末尾]（那多半是预取的第 2 块）。
  const first = reqs[r0]
  ok(!!first?.payload, '[请求] 捕获到 /api/tts 调用')
  ok(
    reqs.length === r0 + 1 || reqs[r0]?.payload?.text !== reqs[r0 + 1]?.payload?.text,
    '[请求] 首块与预取块是两份不同文本',
  )
  console.log('  请求体：' + JSON.stringify(first?.payload))
  ok(first?.payload?.model === 'speech-02-turbo', '[请求] 模型 speech-02-turbo', first?.payload?.model)
  ok(
    first?.payload?.voice_setting?.voice_id === 'presenter_female',
    '[请求] 音色 presenter_female',
    first?.payload?.voice_setting?.voice_id,
  )
  ok(first?.payload?.stream === false, '[请求] 非流式（与脚本 SpeakWav_url 一致）', String(first?.payload?.stream))
  ok(first?.payload?.output_format === 'hex', '[请求] output_format=hex', first?.payload?.output_format)
  ok(first?.payload?.language_boost === 'Chinese', '[请求] language_boost=Chinese', first?.payload?.language_boost)
  ok(first?.payload?.audio_setting?.format === 'mp3', '[请求] 音频格式 mp3', first?.payload?.audio_setting?.format)
  ok(
    first?.payload?.audio_setting?.sample_rate === 32000,
    '[请求] 采样率 32000',
    String(first?.payload?.audio_setting?.sample_rate),
  )
  ok(typeof first?.payload?.text === 'string' && first.payload.text.length > 0, '[请求] 携带待合成文本')

  ok(first?.auth === undefined, '[密钥] 浏览器请求不带 Authorization 头', String(first?.auth))
  ok(
    !(await page.evaluate(async () => {
      const t = await (await fetch('/src/lib/tts.ts')).text()
      return /Bearer|eyr4|MINIMAX_API_KEY/.test(t)
    })),
    '[密钥] 客户端 tts 模块源码不含密钥字样',
  )

  /* ───────────── 2. 真的在播 + 高亮同步 ───────────── */
  console.log('\n══════════ 2. 真实播放与高亮同步 ══════════')
  const m0 = await waitFor(mediaState, '创建 media 元素')
  ok(m0.scheme === 'blob', '[播放] 音频源为 blob URL（内存播放，不落盘）', m0.scheme)
  ok(m0.paused === false, '[播放] media 处于播放态')
  // 记下第 1 块的 blob URL：缓存命中时重播会拿到**同一个字符串**（见第 6 节的正向取证）
  const srcFirstBlock = m0.src

  const played = await waitFor(
    async () => {
      const m = await mediaState()
      return m && m.currentTime > 0 ? m : null
    },
    'currentTime 前进',
    LIVE ? 40000 : 15000,
  )
  ok(played.currentTime > 0, '[播放] 音频真实推进（currentTime > 0）', `currentTime=${played.currentTime.toFixed(2)}`)

  s = await ttsState()
  // 「从本页第一行开始」的取证：首块请求文本以本页首行标题为前缀
  const heading0 = (await page.locator('.section-heading').first().textContent())?.trim() ?? ''
  ok(heading0.length > 0, '[播放] 本页首行标题存在', heading0)
  ok(first.payload.text.includes(heading0), '[播放] 首块从本页第一行开始', `首行「${heading0}」`)
  // 负责人明确不要高亮：正文里不得再有任何朗读定位标记
  const marks = await page.evaluate(() => ({
    speaking: document.querySelectorAll('.is-speaking').length,
    dataLine: document.querySelectorAll('.content-card [data-line]').length,
  }))
  ok(marks.speaking === 0, '[无高亮] 正文无 is-speaking 标记', `${marks.speaking} 个`)
  ok(marks.dataLine === 0, '[无高亮] 正文无 data-line 定位属性', `${marks.dataLine} 个`)

  // 留证据图：左列新增控件 + 播放中的整页外观
  const shotDir = 'C:/Users/QWE/WorkBuddy/2026-09-10-11-06-42'
  await page.screenshot({ path: path.join(shotDir, 'tts-left-column.png'), clip: { x: 0, y: 60, width: 620, height: 460 } })
  await page.screenshot({ path: path.join(shotDir, 'tts-reading.png') })

  /* ───────────── 3. 分段自动推进 ───────────── */
  console.log('\n══════════ 3. 分段自动推进 ══════════')
  const reqsBefore = reqs.length
  const advanced = await waitFor(
    async () => {
      const cur = await ttsState()
      return cur.index > 0 ? cur : null
    },
    '自动进入第 2 块',
    LIVE ? 60000 : 25000,
  )
  ok(advanced.index === 1, '[推进] 播完一块自动切下一块', `index=${advanced.index}`)
  ok(reqs.length > reqsBefore, '[推进] 为新块发起了新请求', `${reqsBefore} → ${reqs.length}`)
  ok(lastText() !== first.payload.text, '[推进] 第 2 块请求的是后续文本（不是重发首块）')

  /* ───────────── 4. 暂停 / 继续 ───────────── */
  console.log('\n══════════ 4. 暂停 / 继续 ══════════')
  await clickPlayControl('暂停')
  await waitFor(async () => (await ttsState()).status === 'paused', '状态进入 paused')
  const mp = await mediaState()
  ok(mp.paused === true, '[暂停] media 真正暂停', `paused=${mp.paused}`)
  const idxPaused = (await ttsState()).index
  await sleep(600)
  ok((await ttsState()).index === idxPaused, '[暂停] 暂停期间块序号不前进', `${idxPaused}`)

  await clickPlayControl('继续')
  await waitFor(async () => (await ttsState()).status === 'playing', '状态回到 playing')
  ok((await mediaState()).paused === false, '[继续] media 恢复播放')

  /* ───────────── 5. 静音 ───────────── */
  console.log('\n══════════ 5. 静音 ══════════')
  await clickPlayControl('静音')
  ok((await mediaState()).muted === true, '[静音] media 被静音')
  ok((await byAria('取消静音').count()) === 1, '[静音] 按钮语义切换为「取消静音」')
  await clickPlayControl('取消静音')
  ok((await mediaState()).muted === false, '[静音] 取消静音后恢复出声')

  /* ───────────── 6. 手动停止 → 原地重播（音色固定，首块命中缓存） ───────────── */
  console.log('\n══════════ 6. 手动停止 / 原地重播 ══════════')
  await clickPlayControl('停止播放')
  await waitFor(async () => (await ttsState()).status === 'idle', '停止后回到 idle')
  ok((await page.locator('.is-speaking').count()) === 0, '[停止] 正文无遗留标记')
  ok((await mediaState()).paused === true, '[停止] media 已暂停')

  // 换音色入口已撤除：停止后再播仍是同一支默认音色（不再有「换音色重播」这条路径）
  s = await ttsState()
  ok(s.voice === 'narrator-female', '[音色] 停止后音色仍为默认女主持人', s.voice)

  const before2 = reqs.length
  await clickPlayControl('播放文字')
  await waitFor(async () => (await ttsState()).status === 'playing', '原地重播')
  const restarted = await ttsState()
  ok(restarted.voice === 'narrator-female', '[音色] 重播仍用默认女主持人', restarted.voice)
  const replayMedia = await mediaState()
  ok(replayMedia?.paused === false, '[重播] 音频在播')
  ok(restarted.index === 0, '[重播] 从本页第 1 块重新开始', `index=${restarted.index}`)

  // 缓存键 = 音色 + 文本。换音色入口撤掉后，重播同页用的还是同音色同文本 → 必须命中缓存。
  // 正向取证：命中缓存则复用同一个 objectURL，blob 字符串必然逐字相同
  //（若走了网络会 createObjectURL 出新串，这里立刻不等）。
  // ⚠️ 只断言「没有重复请求首块文本」是不够的：新请求数为 0 时 some() 恒为 false，
  //    会变成空测恒过。故这里以 srcFirstBlock 的字符串相等作主证据，请求侧作旁证。
  const replayReqs = reqs.slice(before2)
  ok(
    replayMedia?.src === srcFirstBlock,
    '[缓存] 重播第 1 块命中缓存（复用同一 blob URL，未重新合成）',
    `${String(replayMedia?.src).slice(-24)} vs ${String(srcFirstBlock).slice(-24)}`,
  )
  ok(
    !replayReqs.some((r) => r.payload?.text === first.payload.text),
    '[缓存] 首块文本未再出现在任何新请求里（不重复计费）',
    `重播后新请求 ${replayReqs.length} 条`,
  )
  console.log(`  重播：复用第 1 块 blob URL，重播后新请求 ${replayReqs.length} 条`)

  /* ───────────── 7. 切模块 → 自动重播 ───────────── */
  console.log('\n══════════ 7. 切模块自动重播 ══════════')
  const clickedBefore = playControlClicks
  const r7 = reqs.length
  await page.locator('.tab-btn', { hasText: '临床表现与诊断鉴别' }).click()
  await waitFor(async () => {
    const cur = await ttsState()
    return cur.status === 'playing' && cur.index === 0 ? cur : null
  }, '切模块后自动从第 1 块起播')
  s = await ttsState()
  ok(playControlClicks === clickedBefore, '[自动] 切模块未点播放控件', `点了 ${playControlClicks - clickedBefore} 次`)
  ok(s.index === 0, '[自动] 块序号归零', `index=${s.index}`)
  ok(
    (await page.locator('.section-heading').first().textContent())?.includes('一、常见临床表现'),
    '[自动] 正文已切到新模块第 1 页',
  )
  ok((reqs[r7]?.payload?.text ?? '').includes('一、常见临床表现'), '[自动] 新模块首块从该页第一行开始', `首请求 ${(reqs[r7]?.payload?.text ?? '').slice(0, 14)}…`)

  /* ───────────── 8. 翻页 → 打断旧的、自动起播新的 ───────────── */
  console.log('\n══════════ 8. 翻页自动重播 ══════════')
  const srcBefore = (await mediaState())?.src
  const clickedBefore2 = playControlClicks
  const r8 = reqs.length
  await page.locator('.nav-arrow.right-arrow').click()
  await waitFor(
    async () => {
      const cur = await ttsState()
      if (cur.status !== 'playing' || cur.index !== 0) return null
      const src = (await mediaState())?.src
      return src && src !== srcBefore ? cur : null
    },
    '翻页后以新音频自动起播',
    LIVE ? 60000 : 25000,
  )

  const afterFlip = await ttsState()
  ok(playControlClicks === clickedBefore2, '[自动] 翻页未点播放控件', `点了 ${playControlClicks - clickedBefore2} 次`)
  ok(afterFlip.index === 0, '[翻页] 块序号归零', `index=${afterFlip.index}`)
  const flipHeading = (await page.locator('.section-heading').first().textContent())?.trim() ?? ''
  ok(
    (reqs[r8]?.payload?.text ?? '').includes(flipHeading),
    '[翻页] 新页首块从该页第一行开始（无高亮可依赖）',
    `首请求「${(reqs[r8]?.payload?.text ?? '').slice(0, 14)}…」/ 首行「${flipHeading}」`,
  )
  ok((await page.locator('.section-heading').first().textContent())?.includes('二、'), '[翻页] 正文已切到第 2 页')
  ok((await mediaState())?.paused === false, '[翻页] 新音频在播（旧的已被打断）')

  /* ────── 8b. 收起人物卡片不打断朗读（「保留按钮列」的直接后果） ────── */
  console.log('\n══════════ 8b. 收起人物卡片不打断朗读 ══════════')
  const mediaBefore = await mediaState()
  const stBefore = await ttsState()
  await page.evaluate(() => document.querySelector('.hide-tutor-btn').click())
  await sleep(420)
  const stAfter = await ttsState()
  const mediaAfter = await mediaState()
  // 旧行为是「收起面板 = 掐断音频」（理由：控制键随面板卸载，音频会成为停不掉的孤儿）。
  // 现在按钮列保留、左列主控仍在，孤儿前提不成立，故朗读必须照常继续。
  ok(stAfter.status === 'playing', '[收起] 朗读未被打断（仍 playing）', stAfter.status)
  ok(stAfter.index === stBefore.index, '[收起] 块序号未倒退', `${stBefore.index} → ${stAfter.index}`)
  ok(mediaAfter?.src === mediaBefore?.src, '[收起] 仍播同一段音频（未重新起播）')
  ok(mediaAfter?.paused === false, '[收起] media 未暂停')
  ok((await byAria('停止播放').count()) === 1, '[收起] 左列「停止播放」仍在 → 音频始终停得掉')

  await sleep(700)
  // ⚠️ 「仍在推进」不能看 currentTime 单调增：块很短（桩音频约 1s），播完就切下一块，
  // 新段从头放，currentTime 会归零。实测这里取到 0.40 → 0.03，看似倒退，其实正是「播放循环还活着」。
  // 正确的取证是块序号在往前推 —— 它同时排除了「被 stop() 掐断」（那样会回 idle）。
  const advanced3 = await waitFor(
    async () => {
      const cur = await ttsState()
      return cur.status === 'playing' && cur.index > stAfter.index ? cur : null
    },
    '收起后仍自动推进到下一块',
    LIVE ? 60000 : 15000,
  )
  ok(
    advanced3.index > stAfter.index,
    '[收起] 播放循环仍在推进（块序号前进）',
    `index ${stAfter.index} → ${advanced3.index}`,
  )

  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.sidebar-action-btn')).find((x) =>
      (x.textContent || '').includes('打开AI导师'),
    )
    b.click()
  })
  await sleep(420)
  ok((await ttsState()).status === 'playing', '[还原] 照片回来后朗读继续')
  ok((await page.locator('.tutor-photo-panel').count()) === 1, '[还原] 照片层已恢复')

  /* ───────────── 9. 失败态：服务端错误 vs 自动播放被拦 ───────────── */
  console.log('\n══════════ 9. 失败态可读 ══════════')
  if (!LIVE) {
    // 9a 服务端返回错误码 → 走普通 error，按钮语义为「重新播放」
    await page.unroute('**/api/tts')
    await page.route('**/api/tts', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: ERR_BODY }),
    )
    await clickPlayControl('停止播放')
    await waitFor(async () => (await ttsState()).status === 'idle', '停止后回到 idle')
    await clickPlayControl('播放文字')
    const errState = await waitFor(async () => {
      const cur = await ttsState()
      return cur.status === 'error' ? cur : null
    }, '进入 error 态')
    ok(errState.error.includes('模拟'), '[失败] 错误文案来自服务端', errState.error)
    console.log(`  错误提示：${errState.error}`)
    ok((await page.locator('.tts-read-btn.is-error').count()) === 1, '[失败] 按钮转为失败态样式')
    ok((await byAria('重新播放').count()) === 1, '[失败] 按钮语义为「重新播放」')

    // 9b 自动播放被浏览器策略拦下 → 走 blocked 态，措辞应是「播放文字」而不是出错的「重新播放」
    await page.route('**/api/tts', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: OK_BODY }),
    )
    await page.evaluate(() => {
      HTMLMediaElement.prototype.play = () => Promise.reject(new Error('NotAllowedError'))
      window.__blockedPatched = true
    })
    await clickPlayControl('重新播放')
    const blockedState = await waitFor(async () => {
      const cur = await ttsState()
      return cur.status === 'error' ? cur : null
    }, '进入 blocked 态')
    ok(await page.evaluate(() => window.__blockedPatched === true), '[拦截] 播放策略桩已生效')
    ok((await byAria('播放文字').count()) === 1, '[拦截] 按钮语义回落为「播放文字」（不像是出错）')
    const blockedTitle = await byAria('播放文字').getAttribute('title')
    ok(!!blockedTitle && blockedTitle.includes('浏览器阻止'), '[拦截] 悬停提示说明被浏览器拦下', blockedTitle)
    console.log(`  拦截提示：${blockedState.error}`)
  }

  /* ───────────── 10. 运行时报错 ───────────── */
  console.log('\n══════════ 10. 控制台 / 页面错误 ══════════')
  if (LIVE) {
    ok(resCodes.length > 0 && resCodes.every((c) => c === 200), '[真链路] 所有 /api/tts 均 200', resCodes.join(','))
  }
  ok(errs.length === 0, '[运行时] 无页面错误', errs.slice(0, 3).join(' | '))
  if (errs.length) errs.slice(0, 8).forEach((e) => console.log('  ! ' + e.slice(0, 200)))

  await browser.close()

  console.log('\n' + '─'.repeat(72))
  console.log(`通过 ${pass} 项，失败 ${fails.length} 项  （${LIVE ? '真实链路' : '桩链路'}）`)
  if (fails.length) {
    console.log('\n失败明细：')
    fails.forEach((f, i) => console.log(`  ${i + 1}. ${f}`))
  }
  process.exit(fails.length ? 1 : 0)
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
