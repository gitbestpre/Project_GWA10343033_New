/* ------------------------------------------------------------------ *
 * 知识考核「目前得分」计分 + 评审态（每题只做一次）的实机端到端验证
 *
 * 需求（负责人 2026-09-20）：
 *   「单选每题做对 6 分，多选做对 5 分」（0 分起累加，满分 100）
 *   追加确认：**每题只做一次** —— 阶段被重置/重走时，已答过的题不再计分，
 *   而是回显「用户答案 + 正确答案」，停留 5 秒后自动进入下一步。
 *
 * 覆盖：
 *   A 冷启动：全新会话得分 = 0，且无计分存档
 *   B 资料分析逐题计分：单选答对 +6 / 多选答错 +0 / 多选答对 +5
 *   C 域内切换与刷新都不归零（得分与用时同一生命周期）
 *   D 每题只做一次：重走已答题 → 评审态回显 + 5 秒推进 + 不重复计分
 *   E 从首页再次进入案例学习 = 新一次训练 → 得分与答题记录一并清空
 *
 * 用例选「资料分析」的理由：其 5 道题（H_18 单选、H_19~H_22 多选）恰好覆盖
 * 6 / 5 两种分值，且 quiz 阶段可由**断点直接播种**（step='quiz1'）进入，
 * 不必先等 video15 播完，单次验证耗时可控。
 *
 * 用法：node .verify-quiz-score.cjs [http://127.0.0.1:5174]
 *      （推荐经 .run-e2e.cjs 启动，它会自带一个临时 vite）
 * ------------------------------------------------------------------ */
const { chromium } = require('E:/XWJ/GWA10343033_New/node_modules/playwright')

const BASE = process.argv[2] || 'http://127.0.0.1:5174'
const PROGRESS_KEY = 'gwa10343033.module-progress.v1'
const SCORE_KEY = 'gwa10343033.quiz-score.v1'

/** 资料分析 5 题的「显示序号 → 题库 id / 答案」对照（与 AnalysisPlayer.ANALYSIS_QUIZ 一致） */
const QUIZ = [
  { page: '01', qid: 'H_18', type: '单选题', answer: ['A'], points: 6 },
  { page: '02', qid: 'H_19', type: '多选题', answer: ['A', 'B', 'C', 'D', 'E'], points: 5 },
  { page: '03', qid: 'H_20', type: '多选题', answer: ['A', 'C', 'E'], points: 5 },
  { page: '04', qid: 'H_21', type: '多选题', answer: ['A', 'B', 'C', 'D'], points: 5 },
  { page: '05', qid: 'H_22', type: '多选题', answer: ['A', 'B', 'C', 'D', 'E', 'F'], points: 5 },
]

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

/** 轮询等待条件成立（默认 30s） */
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

/* ---------------- DOM / 存储读取 ---------------- */

/**
 * 顶栏「目前得分」的数值。
 * ⚠️ 必须限定在 .hd-score-card 内 —— 「操作用时」用的是同一个 .hd-stat-value 类名，
 * 不限定范围会读到 MM:SS 文本（Number('00:11') = NaN）。
 */
const readScore = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('.hd-score-card .hd-stat-value')
    if (!el) return null
    const n = Number((el.textContent || '').trim())
    return Number.isFinite(n) ? n : null
  })

/** 计分存档（sessionStorage）—— 每题一条记录；未作答时为 null */
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

/** 当前答题卡页码（'01'..'05'）；不在答题阶段时为 null */
const quizPage = (page) =>
  page.evaluate(() => document.querySelector('.epi-quiz-page-now')?.textContent?.trim() ?? null)

/** 题型徽标：单选题 / 多选题 / 已作答（评审态） */
const quizType = (page) =>
  page.evaluate(() => document.querySelector('.epi-quiz-type')?.textContent?.trim() ?? null)

/** 判题结果条快照 */
const resultBar = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('.epi-quiz-result')
    if (!el) return null
    return {
      text: (el.textContent || '').trim(),
      review: el.classList.contains('is-review'),
      isOk: el.classList.contains('is-ok'),
      isBad: el.classList.contains('is-bad'),
    }
  })

/** 提交按钮是否存在（评审态 / 已判题时不存在 → 不可再作答） */
const hasSubmit = (page) => page.evaluate(() => Boolean(document.querySelector('.epi-quiz-submit')))

const hasModal = (page) => page.evaluate(() => Boolean(document.querySelector('.pm-mask')))
const modalText = (page) => page.evaluate(() => document.querySelector('.pm-mask')?.textContent ?? null)

const cardStates = (page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('.module-card')).map((el) => ({
      id: el.getAttribute('data-module'),
      status: el.getAttribute('data-status'),
      label: el.querySelector('.status-text')?.textContent?.trim() ?? '',
    })),
  )

/* ---------------- 交互 ---------------- */

/** 按可见文案点击（StageLayout 有 scale，坐标点击易被判遮挡 → 直接派发事件给 React 委托） */
async function clickText(page, text, scope = 'button, [role="button"], .lab-quiz-submit') {
  return page.evaluate(
    ([t, sel]) => {
      const nodes = Array.from(document.querySelectorAll(sel))
      const el = nodes.find((n) => (n.textContent || '').trim() === t)
      if (!el) return false
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
      return true
    },
    [text, scope],
  )
}

/** 点模块卡：必须按 .card-title 匹配（卡片 textContent 是「标题+状态文案」，整串比不等） */
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

/** 勾选某选项（按选项字母） */
async function clickOption(page, key) {
  return page.evaluate((k) => {
    const btn = Array.from(document.querySelectorAll('.epi-quiz-options .epi-option')).find(
      (b) => b.querySelector('.epi-option-key')?.textContent?.trim() === k,
    )
    if (!btn) return false
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    return true
  }, key)
}

/** 点提交 */
async function submitQuiz(page) {
  return page.evaluate(() => {
    const b = document.querySelector('.epi-quiz-submit')
    if (!b) return false
    b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    return true
  })
}

/**
 * 等模块选择页**真正渲染完**再读卡片状态。
 * ⚠️ 与「坑 4」同源：navigate() 同步改 URL、React 提交是异步的 ——
 * 轮询 URL 到 '/case-study' 就立刻读 DOM 会读到上一页（一个 .module-card 都没有）。
 * 必须轮询 DOM 本身；冷 server 上首次编译慢时这条尤其关键。
 */
async function waitCards(page, timeout = 15000) {
  const done = await until(async () => (await cardStates(page)).length === 4, timeout)
  return done ? cardStates(page) : []
}

/** 等答题卡落到指定页码（'01'..'05'） */
const waitQuizPage = (page, n, timeout = 20000) =>
  until(async () => (await quizPage(page)) === String(n).padStart(2, '0'), timeout)

/* ---------------- 场景装配 ---------------- */

/** 合并写入模块学习进度（不整体覆盖，避免把其它模块状态抹掉） */
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
 * 从首页**再次进入案例学习** = 新一次训练。
 * ⚠️ 这是唯一会触发 `syncCaseTimerWithRoute → 'restart'` 的路径：
 *    必须「本页先落在域外路由（/）、再 SPA 导航进域内」。直接 `page.goto('/case-study')`
 *    属**首帧同步** → 'resume'，**不归零** —— 这正是「刷新接着保留」的实现方式。
 */
async function restartTraining(page) {
  await gotoHome(page)
  await clickCard(page, '案例学习')
  await until(async () => new URL(page.url()).pathname === '/case-study', 10000)
  return waitCards(page)
}

/** 从模块选择页进入资料分析（有断点 → 走「学习提示 / 继续学习」） */
async function enterAnalysis(page) {
  await clickCard(page, '资料分析及调查结论')
  const modalOn = await until(async () => hasModal(page), 8000)
  if (!modalOn) return false
  await clickText(page, '继续学习')
  return until(async () => new URL(page.url()).pathname === '/analysis', 12000)
}

/** 退出确认弹窗 → 保存进度并退出 → 回模块选择页 */
async function saveAndExit(page) {
  await clickLabel(page, '返回')
  const modalOn = await until(async () => hasModal(page), 6000)
  if (!modalOn) return false
  await clickText(page, '保存进度并退出')
  return until(async () => new URL(page.url()).pathname === '/case-study', 10000)
}

;(async () => {
  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  page.setDefaultTimeout(15000)

  try {
    /* ---------------- A 冷启动 ---------------- */
    console.log('\n[A] 冷启动：全新会话「目前得分」= 0，且无计分存档')
    await gotoHome(page)
    await page.evaluate(
      ([p, s]) => {
        window.localStorage.removeItem(p)
        window.sessionStorage.removeItem(s)
      },
      [PROGRESS_KEY, SCORE_KEY],
    )
    await page.goto(BASE + '/case-study', { waitUntil: 'domcontentloaded' })
    await waitCards(page)
    {
      const score = await readScore(page)
      ok(score === 0, '模块选择页顶栏「目前得分」= 0', String(score))
      const store = await scoreStore(page)
      ok(store == null, 'sessionStorage 无计分存档（一条记录都没有）', JSON.stringify(store))
    }

    /* ---------------- B 逐题计分：6 / 0 / 5 ---------------- */
    console.log('\n[B] 资料分析逐题计分：单选答对 +6、多选答错 +0、多选答对 +5')
    await seed(page, { analysis: { status: 'studying', step: 'quiz1' } })
    ok(await enterAnalysis(page), '播种断点 quiz1 → 「继续学习」进入 /analysis')
    ok(await waitQuizPage(page, 1), '落在第 1 题（01 / 05）', String(await quizPage(page)))
    {
      ok((await quizType(page)) === QUIZ[0].type, `第 1 题题型 = ${QUIZ[0].type}`, String(await quizType(page)))
      ok((await readScore(page)) === 0, '作答前得分 = 0', String(await readScore(page)))
    }

    // 第 1 题（H_18，单选）答对 A → 即时推进，+6
    ok(await clickOption(page, 'A'), '勾选第 1 题 A')
    ok(await submitQuiz(page), '提交第 1 题')
    ok(await waitQuizPage(page, 2), '答对即时切到第 2 题（02）', String(await quizPage(page)))
    {
      const score = await readScore(page)
      ok(score === 6, '单选答对 → 得分 0 + 6 = 6', String(score))
      ok((await quizType(page)) === QUIZ[1].type, `第 2 题题型 = ${QUIZ[1].type}`, String(await quizType(page)))
    }

    // 第 2 题（H_19，多选，答案 A~E）只勾 A → 答错，不加分，停留 5 秒
    ok(await clickOption(page, 'A'), '第 2 题只勾选 A（漏选 → 错误）')
    ok(await submitQuiz(page), '提交第 2 题')
    {
      const bar = await resultBar(page)
      ok(!!bar && bar.isBad === true, '判词条为「答错」态', bar ? bar.text.slice(0, 40) : 'null')
      ok(!!bar && /秒后进入下一步/.test(bar.text), '答错停留倒计时出现', bar ? bar.text.slice(-20) : 'null')
      const score = await readScore(page)
      ok(score === 6, '多选答错 → 得分不变（仍为 6）', String(score))
      const store = await scoreStore(page)
      ok(store?.H_19?.correct === false, '记录 H_19 = 答错（用于派生得分）', JSON.stringify(store?.H_19))
    }
    ok(await waitQuizPage(page, 3, 15000), '答错停留 5 秒后自动切到第 3 题（03）', String(await quizPage(page)))
    {
      const score = await readScore(page)
      ok(score === 6, '推进后得分仍为 6', String(score))
      ok((await quizType(page)) === QUIZ[2].type, `第 3 题题型 = ${QUIZ[2].type}`, String(await quizType(page)))
    }

    // 第 3 题（H_20，多选，答案 A/C/E）全选对 → 即时推进，+5
    for (const k of ['A', 'C', 'E']) ok(await clickOption(page, k), `勾选第 3 题 ${k}`)
    ok(await submitQuiz(page), '提交第 3 题')
    ok(await waitQuizPage(page, 4), '答对即时切到第 4 题（04）', String(await quizPage(page)))
    {
      const score = await readScore(page)
      ok(score === 11, '多选答对 → 得分 6 + 5 = 11', String(score))
      const n = await answeredCount(page)
      ok(n === 3, '已作答 3 题（H_18 / H_19 / H_20）', String(n))
    }

    /* ---------------- C 域内切换 / 刷新不归零 ---------------- */
    console.log('\n[C] 域内返回与刷新都不归零（得分与操作用时同一生命周期）')
    ok(await saveAndExit(page), '「保存进度并退出」→ 回模块选择页')
    {
      const score = await readScore(page)
      ok(score === 11, '域内返回（/analysis → /case-study）得分保留 = 11', String(score))
    }
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitCards(page)
    {
      const score = await readScore(page)
      ok(score === 11, 'F5 刷新后得分接着保留 = 11（首帧同步走 resume，不归零）', String(score))
      const n = await answeredCount(page)
      ok(n === 3, '刷新后答题记录仍为 3 条（未丢失）', String(n))
    }

    /* ---------------- D 每题只做一次：评审态 ---------------- */
    console.log('\n[D] 每题只做一次：重走已答题 → 评审态回显 + 5 秒推进 + 不重复计分')
    await seed(page, { analysis: { status: 'studying', step: 'quiz1' } })
    ok(await enterAnalysis(page), '断点回拨到 quiz1 → 再次进入 /analysis')
    ok(await waitQuizPage(page, 1), '再次落在第 1 题（01）', String(await quizPage(page)))
    {
      const bar = await resultBar(page)
      ok(!!bar && bar.review === true, '第 1 题进入评审态（.is-review）', bar ? bar.text.slice(0, 60) : 'null')
      ok((await quizType(page)) === '已作答', '题型徽标显示「已作答」', String(await quizType(page)))
      ok(!!bar && /你的答案：A/.test(bar.text), '回显用户答案「你的答案：A」', bar ? bar.text : 'null')
      ok(!!bar && /正确答案：A/.test(bar.text), '回显「正确答案：A」', bar ? bar.text : 'null')
      ok(!!bar && /秒后进入下一步/.test(bar.text), '评审态同样有停留倒计时', bar ? bar.text.slice(-20) : 'null')
      ok((await hasSubmit(page)) === false, '评审态无提交按钮（不可再作答）')
      const score = await readScore(page)
      ok(score === 11, '评审态不重复计分（得分仍为 11）', String(score))
      const n = await answeredCount(page)
      ok(n === 3, '答题记录数不变（仍为 3 条）', String(n))
    }
    ok(await waitQuizPage(page, 2, 12000), '评审态停留 5 秒后自动切到下一步（02）', String(await quizPage(page)))
    {
      const bar = await resultBar(page)
      ok(!!bar && bar.review === true, '第 2 题（H_19 亦已答过）同样进入评审态', bar ? bar.text.slice(0, 60) : 'null')
      ok(!!bar && /你的答案：A/.test(bar.text) && /正确答案：A、B、C、D、E/.test(bar.text), '第 2 题回显「你的答案 A / 正确答案 A、B、C、D、E」', bar ? bar.text : 'null')
      const score = await readScore(page)
      ok(score === 11, '连续评审仍不累加（得分仍为 11）', String(score))
      const n = await answeredCount(page)
      ok(n === 3, '答题记录数仍为 3 条', String(n))
    }

    /* ---------------- E 新一次训练 → 归零 ---------------- */
    console.log('\n[E] 从首页再次进入案例学习 = 新一次训练 → 得分与记录一并清空')
    await gotoHome(page)
    {
      const store = await scoreStore(page)
      const n = store && typeof store === 'object' ? Object.keys(store).length : 0
      ok(n === 3, '回到首页只是停止计时，**不清空**答题记录（仍 3 条）', String(n))
    }
    await restartTraining(page)
    {
      const score = await readScore(page)
      ok(score === 0, '再次进入案例学习 → 得分归零 = 0', String(score))
      const store = await scoreStore(page)
      const n = store && typeof store === 'object' ? Object.keys(store).length : 0
      ok(n === 0, '答题记录被清空（存档为 {}）', JSON.stringify(store))
    }
    // 记录清空后，同一题不应再走评审态，而是可正常重新作答
    await seed(page, { analysis: { status: 'studying', step: 'quiz3' } })
    ok(await enterAnalysis(page), '断点 quiz3 → 再次进入 /analysis（H_20 此前答过，但记录已清）')
    ok(await waitQuizPage(page, 3), '落在第 3 题（03）', String(await quizPage(page)))
    {
      const bar = await resultBar(page)
      ok(bar === null, '第 3 题不再是评审态（.epi-quiz-result 不存在）', bar ? bar.text.slice(0, 60) : 'null')
      ok((await hasSubmit(page)) === true, '第 3 题重新可作答（提交按钮存在）')
      ok((await quizType(page)) === QUIZ[2].type, `第 3 题题型回到「${QUIZ[2].type}」`, String(await quizType(page)))
      const score = await readScore(page)
      ok(score === 0, '新一次训练下得分从 0 起', String(score))
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
