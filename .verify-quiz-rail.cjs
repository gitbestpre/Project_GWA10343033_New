/* ------------------------------------------------------------------ *
 * 实验室检测「知识考核侧栏」（QuizRail）的实机端到端验证
 *
 * 为什么要单独一套：本项目有**两个**答题面 —— 全屏题卡（`QuizStep`→`QuizModal`，17 题）
 * 与**非模态右侧侧栏**（`QuizRail`，仅实验室检测的 H_12 / H_17 两题，唯一一处）。
 * 计分（单选 6 / 多选 5）与「每题只做一次 → 评审态回显」两套逻辑都落在侧栏里，
 * 而 `.verify-quiz-score.cjs` 只走全屏题卡那条路 —— 侧栏若回归，那边**一条断言都不会红**。
 * 本套件专补这个口子。
 *
 * 覆盖：
 *   A 侧栏挂载（39.mp4 播完才出现）与首题初始状态
 *   B 逐题计分：H_12 / H_17 两道单选各 +6
 *   C 末题判完自动离场（onBack → markDone → /case-study）
 *   D 每题只做一次：重走 quizWait → 评审态回显 + 5 秒推进 + 不重复计分
 *   E 从首页再次进入案例学习 = 新一次训练 → 得分归零
 *
 * 用法：node .verify-quiz-rail.cjs [http://127.0.0.1:5174]
 *      （推荐经 .run-e2e.cjs 启动，它会自带一个临时 vite）
 * ------------------------------------------------------------------ */
const { chromium } = require('E:/XWJ/GWA10343033_New/node_modules/playwright')

const BASE = process.argv[2] || 'http://127.0.0.1:5174'
const PROGRESS_KEY = 'gwa10343033.module-progress.v1'
const SCORE_KEY = 'gwa10343033.quiz-score.v1'

/** 侧栏题目（与 LabTestingPlayer 的 QUIZ_QIDS 一致；负责人所说 H_13/H_14 是 xlsx 行号） */
const RAIL_QIDS = ['H_12', 'H_17']
/** 两题答案（均为单选，各 6 分） */
const RAIL_ANSWER = { H_12: 'A', H_17: 'B' }

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

async function until(fn, timeout = 30000, step = 250) {
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

/* ---------------- 读取 ---------------- */

/** ⚠️ 顶栏得分与用时同用 .hd-stat-value，必须限定在 .hd-score-card 内 */
const readScore = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('.hd-score-card .hd-stat-value')
    if (!el) return null
    const n = Number((el.textContent || '').trim())
    return Number.isFinite(n) ? n : null
  })

const scoreStore = (page) =>
  page.evaluate((k) => {
    const raw = window.sessionStorage.getItem(k)
    if (raw == null) return null
    try {
      return JSON.parse(raw)
    } catch {
      return 'PARSE_ERROR'
    }
  }, SCORE_KEY)

const answeredCount = async (page) => {
  const s = await scoreStore(page)
  return s && typeof s === 'object' ? Object.keys(s).length : 0
}

const hasRail = (page) => page.evaluate(() => Boolean(document.querySelector('.lab-quiz-rail')))

/** 侧栏快照：题号 / 判定状态 / 是否评审态 / 倒计时 / 页码 / 题型 / 底部文案 */
const rail = (page) =>
  page.evaluate(() => {
    const body = document.querySelector('.lab-quiz-body')
    const foot = document.querySelector('.lab-quiz-foot')
    if (!body || !foot) return null
    return {
      qid: body.getAttribute('data-qid'),
      state: body.getAttribute('data-state'),
      review: foot.getAttribute('data-review'),
      countdown: Number(foot.getAttribute('data-countdown')),
      isLast: foot.getAttribute('data-last'),
      count: (document.querySelector('.lab-quiz-head-count')?.textContent || '').replace(/\s+/g, ' ').trim(),
      chip: (document.querySelector('.lab-quiz-chip')?.textContent || '').trim(),
      footText: (foot.textContent || '').replace(/\s+/g, ' ').trim(),
      hasSubmit: Boolean(document.querySelector('.lab-quiz-submit')),
      lockedOptions: Array.from(document.querySelectorAll('.lab-quiz-options .epi-option')).every((b) => b.disabled),
    }
  })

const cardStates = (page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('.module-card')).map((el) => ({
      id: el.getAttribute('data-module'),
      status: el.getAttribute('data-status'),
      label: el.querySelector('.status-text')?.textContent?.trim() ?? '',
    })),
  )

async function waitCards(page, timeout = 15000) {
  const done = await until(async () => (await cardStates(page)).length === 4, timeout)
  return done ? cardStates(page) : []
}

/* ---------------- 交互 ---------------- */

async function clickText(page, text, scope = 'button, [role="button"], .lab-quiz-submit') {
  return page.evaluate(
    ([t, sel]) => {
      const el = Array.from(document.querySelectorAll(sel)).find(
        (n) => (n.textContent || '').trim() === t,
      )
      if (!el) return false
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
      return true
    },
    [text, scope],
  )
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

async function clickLabel(page, label) {
  return page.evaluate((l) => {
    const el = document.querySelector(`[aria-label="${l}"]`)
    if (!el) return false
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    return true
  }, label)
}

/** 勾选侧栏选项（按字母）—— ⚠️ 必须限定 .lab-quiz-options，页面其它地方也有 .epi-option */
async function clickOption(page, key) {
  return page.evaluate((k) => {
    const btn = Array.from(document.querySelectorAll('.lab-quiz-options .epi-option')).find(
      (b) => b.querySelector('.epi-option-key')?.textContent?.trim() === k,
    )
    if (!btn) return false
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    return true
  }, key)
}

async function submitRail(page) {
  return page.evaluate(() => {
    const b = document.querySelector('.lab-quiz-submit')
    if (!b) return false
    b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    return true
  })
}

/** 自动播放被策略拦截时点掉「点击播放视频」提示 */
async function clearAutoplayHint(page) {
  await page.evaluate(() => {
    const el = document.querySelector('.epi-play-hint')
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  })
}

/* ---------------- 场景装配 ---------------- */

async function seed(page, patch) {
  await page.evaluate(
    ([k, p]) => {
      let base = {}
      try {
        const parsed = JSON.parse(window.localStorage.getItem(k) || 'null')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) base = parsed
      } catch {
        base = {}
      }
      window.localStorage.setItem(k, JSON.stringify({ ...base, ...p }))
    },
    [PROGRESS_KEY, patch],
  )
}

const gotoHome = (page) => page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })

/**
 * 播种 quizWait 断点 → 进入实验室检测 → 39.mp4 播完 → 侧栏出现。
 * ⚠️ 侧栏**只在 quizWait 挂载**，且必须等 39.mp4 播出结果（本题实测约 20~40s），
 *    超时给足；进不去就不要继续断言，直接判失败并说明。
 */
async function enterLabToRail(page, timeout = 60000) {
  await page.goto(BASE + '/case-study', { waitUntil: 'domcontentloaded' })
  await waitCards(page)
  await clickCard(page, '实验室检测')
  if (!(await until(async () => Boolean(await page.evaluate(() => document.querySelector('.pm-mask'))), 8000))) {
    return false
  }
  await clickText(page, '继续学习')
  if (!(await until(async () => new URL(page.url()).pathname === '/lab-testing', 12000))) return false
  await clearAutoplayHint(page)
  return until(async () => hasRail(page), timeout)
}

/* ---------------- 主流程 ---------------- */

;(async () => {
  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  page.setDefaultTimeout(15000)

  try {
    /* ---------------- A 侧栏挂载 + 首题初态 ---------------- */
    console.log('\n[A] 39.mp4 播完才挂载侧栏；首题 H_12 为未作答态')
    await gotoHome(page)
    await page.evaluate(
      ([p, s]) => {
        window.localStorage.removeItem(p)
        window.sessionStorage.removeItem(s)
      },
      [PROGRESS_KEY, SCORE_KEY],
    )
    await seed(page, { 'lab-testing': { status: 'studying', step: 'quizWait' } })
    const railOn = await enterLabToRail(page)
    ok(railOn, '断点 quizWait → 续做 → 39.mp4 播完出现 .lab-quiz-rail')
    if (!railOn) throw new Error('侧栏未挂载，后续断言无意义 —— 中止')
    {
      const r = await rail(page)
      ok(r.qid === RAIL_QIDS[0], `首题 = ${RAIL_QIDS[0]}`, JSON.stringify(r.qid))
      ok(r.count === '01 / 02', '页码 = 01 / 02', JSON.stringify(r.count))
      ok(r.chip === '单选题', '题型徽标 = 单选题', JSON.stringify(r.chip))
      ok(r.state === 'todo' && r.review === 'false', '首题未作答（state=todo / 非评审态）', JSON.stringify({ s: r.state, rv: r.review }))
      ok(r.hasSubmit === true, '未作答时有「提交」按钮')
      ok(r.lockedOptions === false, '未作答时选项可选')
      const score = await readScore(page)
      ok(score === 0, '作答前得分 = 0', String(score))
    }

    /* ---------------- B 逐题计分 ---------------- */
    console.log('\n[B] 侧栏逐题计分：两道单选各 +6')
    ok(await clickOption(page, RAIL_ANSWER.H_12), `勾选第 1 题 ${RAIL_ANSWER.H_12}`)
    ok(await submitRail(page), '提交第 1 题')
    ok(
      await until(async () => (await rail(page))?.qid === RAIL_QIDS[1], 10000),
      `答对即时切到第 2 题（${RAIL_QIDS[1]}）`,
      JSON.stringify((await rail(page))?.qid),
    )
    {
      const r = await rail(page)
      const score = await readScore(page)
      ok(score === 6, '第 1 题答对 → 得分 0 + 6 = 6', String(score))
      ok(r.count === '02 / 02', '页码推进到 02 / 02', JSON.stringify(r.count))
      ok(r.isLast === 'true', '第 2 题为末题（data-last=true）', JSON.stringify(r.isLast))
      ok(r.state === 'todo', '第 2 题未作答（本次新答的题不会被误判为评审态）', JSON.stringify(r.state))
    }
    ok(await clickOption(page, RAIL_ANSWER.H_17), `勾选第 2 题 ${RAIL_ANSWER.H_17}`)
    ok(await submitRail(page), '提交第 2 题（末题）')

    /* ---------------- C 末题判完自动离场 ---------------- */
    console.log('\n[C] 末题判完自动离场：onBack → markDone → 回模块选择页')
    ok(
      await until(async () => new URL(page.url()).pathname === '/case-study', 15000),
      '末题答对自动返回模块选择页',
      page.url(),
    )
    {
      const score = await readScore(page)
      ok(score === 12, '两题各 6 分 → 得分 = 12', String(score))
      const n = await answeredCount(page)
      ok(n === 2, `答题记录 2 条（${RAIL_QIDS.join(' / ')}）`, String(n))
      const st = await waitCards(page)
      const lab = st.find((s) => s.id === 'lab-testing')
      ok(lab?.status === 'done' && lab?.label === '已学习', '卡片显示「已学习」', JSON.stringify(lab))
    }

    /* ---------------- D 评审态（重走已答题） ---------------- */
    console.log('\n[D] 每题只做一次：断点回拨 quizWait 重走 → 评审态回显 + 5 秒推进 + 不重复计分')
    await seed(page, { 'lab-testing': { status: 'studying', step: 'quizWait' } })
    const railAgain = await enterLabToRail(page)
    ok(railAgain, '重走后侧栏再次挂载')
    if (!railAgain) throw new Error('侧栏未挂载，评审态断言无意义 —— 中止')
    {
      const r = await rail(page)
      ok(r.qid === RAIL_QIDS[0] && r.review === 'true', '第 1 题进入评审态（data-review=true）', JSON.stringify({ q: r.qid, rv: r.review }))
      ok(r.state === 'ok', '记录回放：第 1 题当时答对（state=ok）', JSON.stringify(r.state))
      ok(/已作答/.test(r.footText), '底部显示「已作答」', JSON.stringify(r.footText.slice(0, 60)))
      ok(/你的答案：A/.test(r.footText), '回显用户答案「你的答案：A」', JSON.stringify(r.footText.slice(0, 60)))
      ok(/正确答案：A/.test(r.footText), '回显「正确答案：A」', JSON.stringify(r.footText.slice(0, 60)))
      ok(/秒后进入下一题/.test(r.footText), '评审态同样有停留倒计时', JSON.stringify(r.footText.slice(-24)))
      ok(r.hasSubmit === false, '评审态无提交按钮（不可再作答）')
      ok(r.lockedOptions === true, '评审态选项全部锁定')
      ok(r.countdown > 0 && r.countdown <= 5, '倒计时从 5 秒起走', String(r.countdown))
      const score = await readScore(page)
      ok(score === 12, '评审态不重复计分（得分仍为 12）', String(score))
      const n = await answeredCount(page)
      ok(n === 2, '答题记录数不变（仍 2 条）', String(n))
    }
    ok(
      await until(async () => (await rail(page))?.qid === RAIL_QIDS[1], 12000),
      '评审态停留 5 秒后自动进入下一题',
      JSON.stringify((await rail(page))?.qid),
    )
    {
      const r = await rail(page)
      ok(r.review === 'true', '第 2 题（亦已答过）同样处于评审态', JSON.stringify(r.review))
      ok(/你的答案：B/.test(r.footText) && /正确答案：B/.test(r.footText), '回显「你的答案 B / 正确答案 B」', JSON.stringify(r.footText.slice(0, 60)))
      const score = await readScore(page)
      ok(score === 12, '连续评审仍不累加（得分仍为 12）', String(score))
    }
    // 末题评审走完 → 自动离场（不重复标记、不报错）
    ok(
      await until(async () => new URL(page.url()).pathname === '/case-study', 15000),
      '末题评审走完自动返回模块选择页',
      page.url(),
    )

    /* ---------------- E 新一次训练 → 归零 ---------------- */
    console.log('\n[E] 从首页再次进入案例学习 = 新一次训练 → 得分归零')
    await gotoHome(page)
    {
      const n = await answeredCount(page)
      ok(n === 2, '回首页只停止计时，**不清空**答题记录（仍 2 条）', String(n))
    }
    // ⚠️ 归零只有一条路径：先落在域外路由（/）、再 SPA 导航进域内。
    //    直接 page.goto('/case-study') 属首帧同步 → resume → **不归零**。
    await clickCard(page, '案例学习')
    ok(
      await until(async () => new URL(page.url()).pathname === '/case-study', 10000),
      '首页点卡片进入案例学习',
      page.url(),
    )
    // ⚠️ 「坑 4」同源：navigate() 同步改 URL、React 提交与 effect 是异步的 ——
    //    轮询到 pathname 就立刻读顶栏，会读到**清分 effect 跑之前**的那一帧（旧分 12）。
    //    必须轮询**目标状态本身**（得分变 0），而不是轮询 URL 后再单次读取。
    //    （.verify-quiz-score.cjs 靠 restartTraining 里的 waitCards 轮询 DOM 恰好躲过了这一帧，
    //      本脚本没有那一步，于是这条竞态被暴露出来 —— 属脚本时序问题，非产品缺陷。）
    await waitCards(page)
    {
      const zeroed = await until(async () => (await readScore(page)) === 0, 5000)
      const score = await readScore(page)
      ok(zeroed, '新一次训练 → 顶栏得分归零 = 0', String(score))
      const n = await answeredCount(page)
      ok(n === 0, '答题记录被清空', JSON.stringify(await scoreStore(page)))
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
