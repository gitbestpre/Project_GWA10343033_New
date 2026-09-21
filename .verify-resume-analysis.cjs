/* ------------------------------------------------------------------ *
 * 断点续做 · 补充验证：**资料分析及调查结论模块（/analysis）**
 *
 * 为什么单独写：现有 .verify-progress-resume.cjs 的 39 项覆盖了
 * lab-testing / food-hygiene / epidemiology 的断点续做与终点，
 * 但 analysis 只被断言「未碰过时为 idle」，**它的续做路径从未被走过**。
 *
 * 本模块的结构有个天然陷阱：15.mp4 **始终挂载**（做数据表格的背景），
 * 且 onEnded 无条件 setPhase('table')。因此若断点落在 video15 之后的任何阶段，
 * 恢复时视频会从 0 重播一遍，播完再把 phase 拽回 'table'。
 *
 * 探针不动产品代码，只观测：seed 断点 → 继续学习 → 读阶段指纹 → 快进视频到末尾 → 再读。
 *
 * 用法：node .verify-resume-analysis.cjs [http://127.0.0.1:5174]
 * ------------------------------------------------------------------ */
const { chromium } = require('E:/XWJ/GWA10343033_New/node_modules/playwright')

const BASE = process.argv[2] || 'http://127.0.0.1:5174'
const KEY = 'gwa10343033.module-progress.v1'

let pass = 0
let fail = 0
const failures = []

function ok(cond, msg, detail) {
  if (cond) {
    pass++
    console.log('  ✓ ' + msg)
  } else {
    fail++
    failures.push(msg + (detail ? '  ⟶ ' + detail : ''))
    console.log('  ✗ ' + msg + (detail ? '  ⟶ ' + detail : ''))
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function until(fn, timeout = 15000, step = 200) {
  const t0 = Date.now()
  for (;;) {
    let v = false
    try {
      v = await fn()
    } catch {
      v = false
    }
    if (v) return true
    if (Date.now() - t0 > timeout) return false
    await sleep(step)
  }
}

/**
 * 当前阶段指纹：靠各弹窗的根类名识别。
 *
 * ⚠️ 题库 qid（`data-qid`）只挂在实验室检测的**非模态侧栏** `.lab-quiz-body` 上，
 * analysis 走的是一题一挂的 `QuizStep → QuizModal`，DOM 里**没有 qid**。
 * 因此这里改用弹窗自带的页码 `.epi-quiz-page-now`（01..05）来区分第几题 ——
 * 拿 lab 的 data-qid 去断言 analysis 会永远得到 `quiz(?)`（探针自身的假失败）。
 */
const phaseFingerprint = (page) =>
  page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const quizPage = q('.epi-quiz') ? (q('.epi-quiz-page-now')?.textContent?.trim() ?? '?') : null
    return {
      table: Boolean(q('.dt-panel')),
      quiz: quizPage,
      conclusion: Boolean(q('.ch-card')),
      summary: Boolean(q('.stt-panel')),
      report: Boolean(q('.rp-panel')),
      exitPrompt: Boolean(document.querySelector('.pm-card[aria-label="退出提示"]')),
      video: (() => {
        const v = q('video')
        if (!v) return null
        return {
          src: v.getAttribute('src'),
          t: Math.round(v.currentTime * 10) / 10,
          dur: Number.isFinite(v.duration) ? Math.round(v.duration * 10) / 10 : null,
          paused: v.paused,
          ended: v.ended,
        }
      })(),
    }
  })

const describe = (f) => {
  const on = []
  if (f.table) on.push('table')
  if (f.quiz) on.push('quiz(' + f.quiz + ')')
  if (f.conclusion) on.push('conclusion')
  if (f.summary) on.push('summary')
  if (f.report) on.push('report')
  if (f.exitPrompt) on.push('退出提示')
  return on.length ? on.join('+') : '(无弹窗)'
}

const readStore = (page) =>
  page.evaluate((k) => {
    const raw = window.localStorage.getItem(k)
    return raw ? JSON.parse(raw) : null
  }, KEY)

/** seed 必须是合并（见 .verify-progress-resume.cjs 注释），否则会抹掉其他模块的三态 */
async function seed(page, progress) {
  await page.evaluate(
    ([k, p]) => {
      const raw = window.localStorage.getItem(k)
      let base = {}
      try {
        const parsed = raw ? JSON.parse(raw) : null
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) base = parsed
      } catch {
        base = {}
      }
      window.localStorage.setItem(k, JSON.stringify({ ...base, ...p }))
    },
    [KEY, progress],
  )
}

const cardStates = (page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('.module-card')).map((el) => ({
      id: el.getAttribute('data-module'),
      status: el.getAttribute('data-status'),
      label: el.querySelector('.status-text')?.textContent?.trim() ?? '',
      title: el.querySelector('.card-title')?.textContent?.trim() ?? '',
    })),
  )

async function waitCards(page, timeout = 10000) {
  const okc = await until(async () => (await cardStates(page)).length === 4, timeout)
  return okc ? cardStates(page) : []
}

async function clickCard(page, title) {
  return page.evaluate((t) => {
    const h3 = Array.from(document.querySelectorAll('.module-card .card-title')).find(
      (n) => (n.textContent || '').trim() === t,
    )
    if (!h3) return false
    h3.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    return true
  }, title)
}

async function clickText(page, text) {
  return page.evaluate((t) => {
    const nodes = Array.from(document.querySelectorAll('button, [role="button"]'))
    const el = nodes.find((n) => (n.textContent || '').trim() === t)
    if (!el) return false
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    return true
  }, text)
}

async function gotoCaseStudy(page) {
  await page.goto(BASE + '/case-study', { waitUntil: 'domcontentloaded' })
  await waitCards(page, 15000)
}

/** 等 15.mp4 元数据就绪（duration 有限）—— 定格逻辑本身就是靠 loadedmetadata 兜底的 */
async function untilDuration(page, timeout = 8000) {
  const okDur = await until(async () => Number.isFinite((await phaseFingerprint(page)).video?.dur), timeout)
  return okDur ? (await phaseFingerprint(page)).video : null
}

/** 快进 15.mp4 到末尾前 0.4s，让 onEnded 尽快触发（不依赖真实时长） */
async function fastForward(page) {
  return page.evaluate(() => {
    const v = document.querySelector('video')
    if (!v || !Number.isFinite(v.duration)) return false
    v.currentTime = Math.max(0, v.duration - 0.4)
    v.play().catch(() => {})
    return true
  })
}

;(async () => {
  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  page.setDefaultTimeout(15000)

  try {
    console.log('\n[0] 前置：清空存储，确认 /analysis 的断点续做入口存在')
    await gotoCaseStudy(page)
    await page.evaluate((k) => window.localStorage.removeItem(k), KEY)
    await gotoCaseStudy(page)

    /* ---- 1. 全新进入：无断点不弹提示，落 video15 ---- */
    console.log('\n[1] 无断点首进 /analysis → video15')
    await clickCard(page, '资料分析及调查结论')
    {
      const entered = await until(async () => new URL(page.url()).pathname === '/analysis', 8000)
      ok(entered, '进入 /analysis（无断点不弹「学习提示」）', page.url())
      ok(!(await page.evaluate(() => Boolean(document.querySelector('.pm-card[aria-label="学习提示"]')))), '未弹「学习提示」')
    }
    await until(async () => (await phaseFingerprint(page)).video?.src === '/Video/15.mp4', 8000)
    {
      const f = await phaseFingerprint(page)
      ok(f.video?.src === '/Video/15.mp4', '挂载 15.mp4', JSON.stringify(f.video))
      const s = await readStore(page)
      ok(s?.analysis?.status === 'studying' && s?.analysis?.step === 'video15', '存储：analysis=studying / 断点=video15', JSON.stringify(s?.analysis))
    }
    // —— 反向取证：修复不能把**首播**一起改坏 ——
    // 去掉 autoPlay 属性 + onEnded 加阶段守卫后，首段仍须有声自动播放并自行推进到 table。
    {
      const autoPlayed = await until(async () => (await phaseFingerprint(page)).table, 20000)
      ok(autoPlayed, '首段 15.mp4 仍正常自动播放并在播完后推进到「数据表格」', describe(await phaseFingerprint(page)))
    }

    /* ---- 2. 逐断点恢复：是否落在断点对应的阶段 ---- */
    const cases = [
      { step: 'table', expect: (f) => f.table, name: '数据表格' },
      { step: 'quiz1', expect: (f) => f.quiz === '01', name: '第 1 题（01/05）' },
      { step: 'quiz3', expect: (f) => f.quiz === '03', name: '第 3 题（03/05）' },
      { step: 'conclusion', expect: (f) => f.conclusion, name: '结论提示卡' },
      { step: 'summary', expect: (f) => f.summary, name: '信息整理表' },
      { step: 'report', expect: (f) => f.report, name: '调查报告提纲' },
    ]

    for (const c of cases) {
      console.log(`\n[2] 断点 = ${c.step} → 继续学习，应落在「${c.name}」`)
      await gotoCaseStudy(page)
      await seed(page, { analysis: { status: 'studying', step: c.step } })
      await gotoCaseStudy(page)
      await clickCard(page, '资料分析及调查结论')
      const modalOn = await until(async () =>
        page.evaluate(() => Boolean(document.querySelector('.pm-card[aria-label="学习提示"]'))),
      )
      ok(modalOn, `断点 ${c.step}：点卡片弹「学习提示」`)
      await clickText(page, '继续学习')
      await until(async () => new URL(page.url()).pathname === '/analysis', 8000)

      const landed = await until(async () => c.expect(await phaseFingerprint(page)), 8000)
      const f1 = await phaseFingerprint(page)
      ok(landed, `恢复后立即落在「${c.name}」`, describe(f1))

      // —— 反向取证：背景视频必须**定格在末帧**，一个字节都不重播 ——
      // 修复前这里是「autoPlay 从 0 重播 → 8.29s 后 onEnded 劫持阶段」。
      {
        const froze = await until(async () => {
          const v = (await phaseFingerprint(page)).video
          return Boolean(v && v.paused && v.dur != null && v.t >= v.dur - 0.3)
        }, 6000)
        const v = (await phaseFingerprint(page)).video
        ok(froze, '背景视频定格在末帧（paused=true 且 t≈duration，未重播）', JSON.stringify(v))
      }

      // 再等一会儿：若 15.mp4 仍在播，onEnded 早该把 phase 拽去 'table' 了
      await sleep(1200)
      const f2 = await phaseFingerprint(page)
      const hijacked = c.step !== 'table' && f2.table && !c.expect(f2)
      ok(!hijacked, `阶段未被 onEnded 劫持（保持「${c.name}」）`, '实际=' + describe(f2))

      const s = await readStore(page)
      ok(s?.analysis?.step === c.step, `存储断点仍为 ${c.step}`, JSON.stringify(s?.analysis))
    }

    /* ---- 3. 强行触发 onEnded：阶段守卫必须兜住 ---- */
    console.log('\n[3] 断点 = quiz3，强制让 15.mp4 触发 ended —— 阶段必须不被劫持')
    await gotoCaseStudy(page)
    await seed(page, { analysis: { status: 'studying', step: 'quiz3' } })
    await gotoCaseStudy(page)
    await clickCard(page, '资料分析及调查结论')
    await until(async () => page.evaluate(() => Boolean(document.querySelector('.pm-card[aria-label="学习提示"]'))))
    await clickText(page, '继续学习')
    await until(async () => new URL(page.url()).pathname === '/analysis', 8000)
    await until(async () => (await phaseFingerprint(page)).quiz === '03', 8000)
    {
      // 3a 真·播到末尾：等元数据就绪再快进（否则 duration 为 NaN，探针自己会假失败）
      const meta = await untilDuration(page)
      ok(Boolean(meta && meta.dur > 0), '15.mp4 元数据就绪（duration 有限）', JSON.stringify(meta))
      const seek = await fastForward(page)
      ok(seek, '15.mp4 已快进到末尾并触发 onEnded')
      await sleep(1500)
      const f = await phaseFingerprint(page)
      ok(f.quiz === '03', '真实 ended 后仍停在 03/05（未被拽回 table）', describe(f))
    }
    {
      // 3b 直接派发合成 ended：无论 ended 从哪来，守卫都必须拦住
      const dispatched = await page.evaluate(() => {
        const v = document.querySelector('video')
        if (!v) return false
        v.dispatchEvent(new Event('ended', { bubbles: false }))
        return true
      })
      ok(dispatched, '已向 15.mp4 派发合成 ended 事件')
      await sleep(600)
      const f = await phaseFingerprint(page)
      ok(f.quiz === '03' && !f.table, '合成 ended 也被守卫拦下（仍停在 03/05）', describe(f))
      const s = await readStore(page)
      ok(s?.analysis?.step === 'quiz3', '存储断点未被改写', JSON.stringify(s?.analysis))
    }

    /* ---- 4. 终点：断点 report → 确认 → 已学习 ---- */
    console.log('\n[4] 断点 = report → 继续学习 → 确认 → 模块标记「已学习」')
    await gotoCaseStudy(page)
    await seed(page, { analysis: { status: 'studying', step: 'report' } })
    await gotoCaseStudy(page)
    await clickCard(page, '资料分析及调查结论')
    await until(async () => page.evaluate(() => Boolean(document.querySelector('.pm-card[aria-label="学习提示"]'))))
    await clickText(page, '继续学习')
    await until(async () => new URL(page.url()).pathname === '/analysis', 8000)
    const repOn = await until(async () => (await phaseFingerprint(page)).report, 8000)
    ok(repOn, '落在《调查报告提纲》')
    await clickText(page, '确认')
    const back = await until(async () => new URL(page.url()).pathname === '/case-study', 10000)
    ok(back, '提纲「确认」→ 返回模块选择页', page.url())
    {
      const st = await waitCards(page)
      const an = st.find((s) => s.id === 'analysis')
      ok(an?.status === 'done' && an?.label === '已学习', '卡片显示「已学习」', JSON.stringify(an))
      const s = await readStore(page)
      ok(s?.analysis?.status === 'done' && s?.analysis?.step == null, '存储：done 且断点清空', JSON.stringify(s?.analysis))
    }
  } catch (err) {
    fail++
    failures.push('脚本异常：' + (err && err.message ? err.message : String(err)))
    console.log('\n!! 脚本异常：', err)
  } finally {
    await browser.close()
  }

  console.log('\n================ 汇总 ================')
  console.log(`通过 ${pass} 项，失败 ${fail} 项`)
  if (failures.length) {
    console.log('失败明细：')
    failures.forEach((f) => console.log('  · ' + f))
  }
  process.exit(fail ? 1 : 0)
})()
