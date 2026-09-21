/* ------------------------------------------------------------------ *
 * 案例学习「操作用时」计时器 端到端验证
 *
 * 需求（负责人 2026-09-20）：
 *   「进入案例学习后操作用时开始计时，返回首页就停止」
 *   追加确认：① 从首页再次进入案例学习 → 归零重新计时
 *             ② 案例学习中途中刷新页面 → 接着已用时长继续
 *
 * 覆盖：
 *   [A] 首页顶栏不显示用时卡（variant=simple）
 *   [B] 进入案例学习 → 用时卡出现且从 00:00 起走（等 3.5s 应 ≥ 00:03）
 *   [C] 案例学习内部进模块 → 计时**连续累计**（不重置、不暂停）
 *   [D] 从模块回模块选择页 → 继续累计
 *   [E] 返回首页 → **停止**（显示值冻结、running=false）
 *   [F] 再次从首页进入 → **归零**重新计时
 *   [G] 案例学习内刷新（F5）→ **接着**已用时长继续
 *
 * 用法：node .verify-case-timer.cjs [http://127.0.0.1:5174]
 * ------------------------------------------------------------------ */
const { chromium } = require('E:/XWJ/GWA10343033_New/node_modules/playwright')

const BASE = process.argv[2] || 'http://127.0.0.1:5174'
const TIMER_KEY = 'gwa10343033.case-study-timer.v1'
const PROGRESS_KEY = 'gwa10343033.module-progress.v1'

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

async function until(fn, timeout = 10000, step = 200) {
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

/** 「操作用时」卡片上的显示文本（首页 variant=simple 时返回 null = 无此卡片） */
const shownTime = (page) =>
  page.evaluate(() => document.querySelector('.hd-time-card .hd-stat-value')?.textContent?.trim() ?? null)

/** 计时器存档（sessionStorage）—— 用于直接核对 running / accumulatedMs */
const timerStore = (page) =>
  page.evaluate((k) => {
    const raw = window.sessionStorage.getItem(k)
    return raw ? JSON.parse(raw) : null
  }, TIMER_KEY)

/** 显示文本 → 秒 */
const toSeconds = (text) => {
  if (!text) return null
  const m = /^(\d+):(\d{2})$/.exec(text)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/**
 * 等计时器到达期望的运行状态再断言。
 *
 * ⚠️ **这是本脚本最容易写错的地方**：`navigate()` 会**先同步改掉浏览器 URL**，
 * React 的路由 effect 随后才异步提交，计时状态要到那一刻才迁移。所以
 * 「轮询 `page.url()` 到目标路径 → 立刻读计时状态」会读到**迁移前**的旧值：
 *   · 返回首页后立刻读 → 仍是 running=true（stop 还没跑）→ 假失败；
 *   · 再次进入后立刻读 → 仍是上一轮的冻结值 → 误判成「没有归零」。
 * 正解：**轮询要断言的那个状态本身**，而不是轮询 URL。
 */
async function waitTimerRunning(page, expected, timeout = 10000) {
  return until(async () => (await timerStore(page))?.running === expected, timeout)
}

/** 等「操作用时」显示值落到某秒以内（用于确认确实归零了） */
async function waitShownSecondsAtMost(page, maxSeconds, timeout = 10000) {
  return until(async () => {
    const s = toSeconds(await shownTime(page))
    return s !== null && s <= maxSeconds
  }, timeout)
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

async function clickText(page, text) {
  return page.evaluate((t) => {
    const el = Array.from(document.querySelectorAll('button, [role="button"]')).find(
      (n) => (n.textContent || '').trim() === t,
    )
    if (!el) return false
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    return true
  }, text)
}

;(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  page.setDefaultTimeout(15000)

  try {
    /* ---------- A 首页：计时卡不显示 ---------- */
    console.log('\n[A] 首页顶栏（variant=simple）不显示「操作用时」卡')
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    // 清掉两份存储，从全新状态开始（sessionStorage 清理后模块卡都是「未学习」，不弹学习提示）
    await page.evaluate(
      ([t, p]) => {
        window.sessionStorage.removeItem(t)
        window.localStorage.removeItem(p)
      },
      [TIMER_KEY, PROGRESS_KEY],
    )
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    ok((await shownTime(page)) === null, '首页无 .hd-time-card（未显示操作用时）', String(await shownTime(page)))

    /* ---------- B 从首页点进案例学习 → 开始计时 ---------- */
    //
    // 走**真实用户路径**（首页点卡片 → SPA 导航），而不是 page.goto 整页加载 ——
    // 两者在计时器里落进不同分支：SPA 从域外进入 = restart（归零），
    // 整页加载/刷新 = resume（接着算，见 [G]）。这里要验的正是前者。
    console.log('\n[B] 从首页点「案例学习」进入 → 用时从 00:00 开始走')
    await clickCard(page, '案例学习')
    const entered = await until(async () => new URL(page.url()).pathname === '/case-study', 10000)
    ok(entered, '进入 /case-study', page.url())
    await until(async () => (await page.evaluate(() => document.querySelectorAll('.module-card').length)) === 4, 10000)
    {
      const running = await waitTimerRunning(page, true)
      ok(running, '存储：计时器 running=true（已开始计时）', JSON.stringify(await timerStore(page)))
      const t0 = await shownTime(page)
      const s0 = toSeconds(t0)
      ok(s0 !== null && s0 <= 1, '进入后用时从 00:00 附近起算', `${t0} → ${s0}s`)
    }
    await sleep(3500)
    {
      const s = toSeconds(await shownTime(page))
      ok(s !== null && s >= 3, '等待 3.5s 后用时已走 ≥ 3 秒（确实在走）', String(await shownTime(page)))
    }

    /* ---------- C 进模块：连续累计 ---------- */
    console.log('\n[C] 进入模块 → 计时连续累计（不重置）')
    const beforeEnter = toSeconds(await shownTime(page))
    await clickCard(page, '资料分析及调查结论')
    const arrived = await until(async () => new URL(page.url()).pathname === '/analysis', 10000)
    ok(arrived, '进入 /analysis', page.url())
    await sleep(2500)
    {
      const t = await shownTime(page)
      const s = toSeconds(t)
      ok(s !== null && s >= beforeEnter + 2, '进入模块后用时继续增长（未归零）', `进入前 ${beforeEnter}s → 现在 ${t}`)
      const st = await timerStore(page)
      ok(st?.running === true, '存储：仍 running=true', JSON.stringify(st))
    }

    /* ---------- D 从模块返回模块选择页：继续累计 ---------- */
    console.log('\n[D] 从模块返回案例学习页 → 继续累计')
    const beforeBack = toSeconds(await shownTime(page))
    await clickLabel(page, '返回')
    await until(async () => page.evaluate(() => Boolean(document.querySelector('.pm-mask'))), 5000)
    await clickText(page, '保存进度并退出')
    await until(async () => new URL(page.url()).pathname === '/case-study', 10000)
    await until(async () => (await page.evaluate(() => document.querySelectorAll('.module-card').length)) === 4, 10000)
    await sleep(2000)
    {
      const t = await shownTime(page)
      const s = toSeconds(t)
      ok(s !== null && s >= beforeBack + 1, '回到案例学习页后用时继续增长', `返回前 ${beforeBack}s → 现在 ${t}`)
    }

    /* ---------- E 返回首页 → 停止 ---------- */
    console.log('\n[E] 返回首页 → 用时**停止**')
    await clickLabel(page, '返回') // /case-study 的返回目标 = /
    const home = await until(async () => new URL(page.url()).pathname === '/', 10000)
    ok(home, '返回首页 /', page.url())
    {
      // 等状态真正迁移到「已停止」，不要拿 URL 变化当成计时已停
      const stopped = await waitTimerRunning(page, false)
      ok(stopped, '存储：running=false（已停止）', JSON.stringify(await timerStore(page)))
      const frozen = (await timerStore(page))?.accumulatedMs ?? -1
      ok(frozen > 0, '停止时已用时长被保留（> 0）', `${frozen}ms`)
      await sleep(3000)
      const st2 = await timerStore(page)
      ok(
        st2?.accumulatedMs === frozen && st2?.running === false,
        '静置 3s 后 accumulatedMs 未增长（确实停了）',
        `${frozen} → ${st2?.accumulatedMs}`,
      )
    }

    /* ---------- F 再次从首页进入 → 归零 ---------- */
    console.log('\n[F] 再次从首页点「案例学习」进入 → 用时**归零**重新计时')
    await clickCard(page, '案例学习')
    const backToCase = await until(async () => new URL(page.url()).pathname === '/case-study', 10000)
    ok(backToCase, '再次进入案例学习', page.url())
    {
      // 同上：等「已归零且重新在走」这个状态出现，而不是等 URL
      const restarted = await waitTimerRunning(page, true)
      ok(restarted, '再次进入后重新开始计时（running=true）')
      const zeroed = await waitShownSecondsAtMost(page, 1)
      const t = await shownTime(page)
      ok(zeroed, '用时已归零（≤ 1 秒）', `${t} → ${toSeconds(t)}s`)
      await sleep(2000)
      const t2 = await shownTime(page)
      const s2 = toSeconds(t2)
      ok(s2 !== null && s2 >= 1 && s2 <= 4, '归零后重新开始走（2s 后约 2 秒，而非接着旧的几十秒）', `${t2}（2s 后）`)
    }

    /* ---------- G 刷新 → 接着继续 ---------- */
    console.log('\n[G] 案例学习内刷新页面（F5）→ 接着已用时长继续')
    await sleep(2000)
    const beforeReload = toSeconds(await shownTime(page))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await until(async () => (await page.evaluate(() => document.querySelectorAll('.module-card').length)) === 4, 15000)
    {
      const running = await waitTimerRunning(page, true)
      ok(running, '刷新后仍在计时（running=true）', JSON.stringify(await timerStore(page)))
      const t = await shownTime(page)
      const s = toSeconds(t)
      // 刷新本身耗时也算在内，因此允许「不小于刷新前」
      ok(s !== null && s >= beforeReload, '刷新后用时接着（未归零）', `刷新前 ${beforeReload}s → 刷新后 ${t}`)
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
