/* ------------------------------------------------------------------ *
 * 模块学习状态 + 断点续做 的实机端到端验证（Playwright + 真 Chromium）
 *
 * 覆盖：
 *   A 未学习三态显示            B 进入即「学习中」+ 断点写入
 *   C 顶栏返回 → 退出提示（保存进度并退出 / 直接退出 / 取消）
 *   D 有断点再进入 → 学习提示（继续学习 / 重新学习）
 *   E 实验室检测：等待阶段断点回退到该段操作视频开头（tools → op01）
 *   F 实验室检测：直接退出清断点 → 退回「未学习」
 *   G 实验室检测：终点（知识考核末题答完）→ 已学习
 *   H 食品卫生学：终点（14.mp4 播完自动返回）→ 已学习
 *   I 现场流行病学：末帧弹窗阶段断点回退（moduleFinish → closingVideo10）+ 终点 → 已学习
 *
 * 用法：node .verify-progress-resume.cjs [http://127.0.0.1:5174]
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

/** 读取本地存储的进度快照 */
const readStore = (page) =>
  page.evaluate((k) => {
    const raw = window.localStorage.getItem(k)
    return raw ? JSON.parse(raw) : null
  }, KEY)

/**
 * 写入/覆盖指定模块的进度（用于把模块置于某个断点，避免每次都要走完整链路）。
 *
 * ⚠️ **必须是「合并」而非「整体替换」**：本脚本后半段（G/H/I）靠逐模块设断点来分别
 * 走到终点，若整体覆盖，[I] 的 seed 会把 [G][H] 刚标好的 done 一起抹成 idle，
 * 末尾「三态共存」于是看到三个 idle —— 那是脚本自伤，不是应用 bug（曾真实踩坑）。
 */
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

const EMPTY = {
  epidemiology: { status: 'idle', step: null },
  'food-hygiene': { status: 'idle', step: null },
  'lab-testing': { status: 'idle', step: null },
  analysis: { status: 'idle', step: null },
}

/**
 * 等舞台视频源落到期望值再断言。
 *
 * ⚠️ `navigate()` 会**先同步改掉浏览器 URL**，React 的渲染是随后异步提交的 ——
 * 轮询 `page.url()` 到目标路径时，新路由的 DOM（尤其 `<video>`）可能还没挂上，
 * 此刻直接 `videoSrc()` 读到 `null` → 断言假失败（detail 里再读一次却是对的值）。
 * 必须轮询源本身。
 */
async function waitVideoSrc(page, suffix, timeout = 10000) {
  await until(async () => ((await videoSrc(page)) ?? '').endsWith(suffix), timeout)
  return (await videoSrc(page)) ?? ''
}

/** 卡片状态：{status, label}[]（按页面 DOM 顺序读取 data-status 与状态文案） */
const cardStates = (page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('.module-card')).map((el) => ({
      id: el.getAttribute('data-module'),
      status: el.getAttribute('data-status'),
      label: el.querySelector('.status-text')?.textContent?.trim() ?? '',
      title: el.querySelector('.card-title')?.textContent?.trim() ?? '',
    })),
  )

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

/**
 * 点模块卡：**必须按 .card-title 匹配**——卡片的 textContent 是「标题+状态文案」
 * （如「实验室检测未学习」），整串比较永远匹配不上（曾因此整轮 E2E 空转）。
 * 点标题 h3，事件冒泡到 .module-card 的 onClick。
 */
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

/** 按 aria-label 点击 */
async function clickLabel(page, label) {
  return page.evaluate((l) => {
    const el = document.querySelector(`[aria-label="${l}"]`)
    if (!el) return false
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    return true
  }, label)
}

const modalText = (page) =>
  page.evaluate(() => document.querySelector('.pm-mask')?.textContent ?? null)

/** 提示弹窗的标题（PromptModal 把 title 放在 .pm-card 的 aria-label 上） */
const modalTitle = (page) =>
  page.evaluate(() => document.querySelector('.pm-card')?.getAttribute('aria-label') ?? null)

const hasModal = (page) => page.evaluate(() => Boolean(document.querySelector('.pm-mask')))

/** 当前舞台上的视频源（实验室检测页可能有多个 video，取可见的那个） */
const videoSrc = (page) =>
  page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('video'))
    const visible = els.find((v) => v.offsetWidth > 0 || v.offsetHeight > 0) || els[0]
    return visible ? visible.getAttribute('src') : null
  })

/**
 * 舞台视频的播放态（用于「是否定格末帧 / 是否在重播」的反向取证）。
 * `t≈dur && paused` = 定格末帧；`t` 很小且 !paused = 正在从头重播。
 */
const videoInfo = (page) =>
  page.evaluate(() => {
    const v = document.querySelector('video')
    return v
      ? { src: v.getAttribute('src'), t: Math.round(v.currentTime * 10) / 10, dur: Number.isFinite(v.duration) ? Math.round(v.duration * 10) / 10 : null, paused: v.paused, ended: v.ended }
      : null
  })

/** 若出现「点击播放视频」（自动播放被策略拦截）则点掉 */
async function clearAutoplayHint(page) {
  await page.evaluate(() => {
    const el = document.querySelector('.epi-play-hint')
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  })
}

async function gotoCaseStudy(page) {
  await page.goto(BASE + '/case-study', { waitUntil: 'domcontentloaded' })
  await waitCards(page, 15000)
}

/**
 * 等模块选择页**真正渲染完**再读卡片状态。
 *
 * ⚠️ 与「坑 4」同源：`navigate()` 是**同步**改 URL 的，React 的渲染随后**异步提交**。
 * 所以「轮询到 pathname === '/case-study' 就立刻 cardStates()」会读到**上一页的 DOM**
 * （一个 `.module-card` 都没有）→ `st.find(...)` 得 undefined → 断言假失败。
 *
 * 在**热** server 上 React 提交够快，轮询的 250ms 间隔足以掩盖它（于是曾多次「全绿」）；
 * 一旦在**冷** server（首次编译、刚起的全新端口）上跑，提交变慢就必然暴露。
 * 属**脚本自身的时序竞态**，产品无问题 —— 但会让验证结果不可复现，必须等 DOM 而非 URL。
 */
async function waitCards(page, timeout = 10000) {
  const ok = await until(async () => (await cardStates(page)).length === 4, timeout)
  return ok ? cardStates(page) : []
}

async function enterModule(page, title) {
  await clickCard(page, title)
  await until(async () => (await hasModal(page)) || /lab-testing|food-hygiene|epidemiology|analysis/.test(new URL(page.url()).pathname), 8000)
}

/** 进入模块并「继续学习」（卡片有断点时的路径） */
async function resumeInto(page, title, modulePath) {
  await clickCard(page, title)
  const modalOn = await until(async () => hasModal(page), 6000)
  ok(modalOn, `${title}：点卡片弹「学习提示」`)
  await clickText(page, '继续学习')
  const arrived = await until(async () => new URL(page.url()).pathname === modulePath, 10000)
  ok(arrived, `${title}：继续学习 → 进入 ${modulePath}`, page.url())
}

;(async () => {
  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  page.setDefaultTimeout(15000)

  try {
    /* ---------- A 未学习三态 ---------- */
    console.log('\n[A] 未学习：全新会话四张卡片均为「未学习」')
    await gotoCaseStudy(page)
    await page.evaluate((k) => window.localStorage.removeItem(k), KEY)
    await gotoCaseStudy(page)
    {
      const st = await waitCards(page)
      ok(st.length === 4, '渲染 4 张模块卡', JSON.stringify(st.map((s) => s.id)))
      ok(st.every((s) => s.status === 'idle' && s.label === '未学习'), '四张卡均为 idle/未学习', JSON.stringify(st.map((s) => s.status)))
    }

    /* ---------- B 进入即「学习中」+ 断点写入 ---------- */
    console.log('\n[B] 点进实验室检测 → 学习中 + 断点为第一步 watch17')
    await enterModule(page, '实验室检测')
    ok(new URL(page.url()).pathname === '/lab-testing', '无断点直接进入（不弹「学习提示」）', page.url())
    ok((await waitVideoSrc(page, '/Video/17.mp4')).endsWith('/Video/17.mp4'), 'watch17：挂载 17.mp4', await videoSrc(page))
    {
      const s = await readStore(page)
      ok(s?.['lab-testing']?.status === 'studying', '存储：lab-testing = studying', JSON.stringify(s?.['lab-testing']))
      ok(s?.['lab-testing']?.step === 'watch17', '存储：断点 = watch17', JSON.stringify(s?.['lab-testing']?.step))
    }

    /* ---------- C 退出提示 ---------- */
    console.log('\n[C] 顶栏返回 → 退出提示弹窗')
    await clickLabel(page, '返回')
    await until(async () => hasModal(page), 5000)
    {
      const t = (await modalText(page)) ?? ''
      ok(t.includes('是否退出案例学习'), '弹「退出提示」', t.slice(0, 40))
      ok(t.includes('保存进度并退出'), '含「保存进度并退出」')
      ok(t.includes('直接退出'), '含「直接退出」')
    }
    // 先验「取消退出」（右上 X）留在原页
    await clickLabel(page, '取消退出')
    await until(async () => !(await hasModal(page)), 4000)
    ok(new URL(page.url()).pathname === '/lab-testing', '取消退出后仍留在模块内', page.url())

    await clickLabel(page, '返回')
    await until(async () => hasModal(page), 5000)
    await clickText(page, '保存进度并退出')
    await until(async () => new URL(page.url()).pathname === '/case-study', 8000)
    ok(true, '「保存进度并退出」→ 回模块选择页', page.url())
    {
      const st = await waitCards(page)
      const lab = st.find((s) => s.id === 'lab-testing')
      ok(lab?.status === 'studying' && lab?.label === '学习中', '卡片显示「学习中」', JSON.stringify(lab))
    }

    /* ---------- D 学习提示（继续 / 重新学习） ---------- */
    console.log('\n[D] 有断点再进入 → 学习提示')
    await clickCard(page, '实验室检测')
    await until(async () => hasModal(page), 5000)
    {
      const t = (await modalText(page)) ?? ''
      ok(t.includes('学习提示'), '弹「学习提示」', t.slice(0, 40))
      ok(t.includes('继续学习'), '含「继续学习」')
      ok(t.includes('重新学习'), '含「重新学习」')
    }
    await clickText(page, '继续学习')
    await until(async () => new URL(page.url()).pathname === '/lab-testing', 8000)
    ok((await waitVideoSrc(page, '/Video/17.mp4')).endsWith('/Video/17.mp4'), '「继续学习」回到断点 watch17', await videoSrc(page))

    // 「重新学习」：断点被第一步覆盖
    await clickLabel(page, '返回')
    await until(async () => hasModal(page), 5000)
    await clickText(page, '保存进度并退出')
    await until(async () => new URL(page.url()).pathname === '/case-study', 8000)
    await clickCard(page, '实验室检测')
    await until(async () => hasModal(page), 5000)
    await clickText(page, '重新学习')
    await until(async () => new URL(page.url()).pathname === '/lab-testing', 8000)
    ok((await waitVideoSrc(page, '/Video/17.mp4')).endsWith('/Video/17.mp4'), '「重新学习」回到第一步', await videoSrc(page))

    /* ---------- E 等待阶段断点 → 回退到该段操作视频开头 ---------- */
    console.log('\n[E] 断点停在等待阶段 tools → 续做应回退到 op01（该段操作视频开头）')
    await gotoCaseStudy(page)
    await seed(page, { 'lab-testing': { status: 'studying', step: 'tools' } })
    await gotoCaseStudy(page)
    await clickCard(page, '实验室检测')
    await until(async () => hasModal(page), 5000)
    await clickText(page, '继续学习')
    await until(async () => new URL(page.url()).pathname === '/lab-testing', 8000)
    {
      const src = await waitVideoSrc(page, '/Video/操作视频/01.mp4')
      ok(src.endsWith('/Video/操作视频/01.mp4'), '回退到 01.mp4（而非直接落在 tools 末帧）', src)
      const s = await readStore(page)
      ok(s?.['lab-testing']?.step === 'play01', '存储断点被更新为 play01', JSON.stringify(s?.['lab-testing']?.step))
    }
    await clearAutoplayHint(page)
    // 01.mp4 播完 → tools 阶段（底部提示「把缓冲蛋白胨水（BPW）放至秤上」）
    const reachedTools = await until(async () =>
      ((await page.evaluate(() => document.querySelector('.lab-hint')?.textContent ?? '')) || '').includes('BPW'),
      40000,
    )
    ok(reachedTools, '01.mp4 播完自然落到 tools（提示 BPW 上秤）', await page.evaluate(() => document.querySelector('.lab-hint')?.textContent ?? ''))

    /* ---------- F 直接退出：本次不记录 ---------- */
    console.log('\n[F] 直接退出 → 断点清空、退回「未学习」')
    await clickLabel(page, '返回')
    await until(async () => hasModal(page), 5000)
    await clickText(page, '直接退出')
    await until(async () => new URL(page.url()).pathname === '/case-study', 8000)
    {
      const st = await waitCards(page)
      const lab = st.find((s) => s.id === 'lab-testing')
      ok(lab?.status === 'idle' && lab?.label === '未学习', '卡片退回「未学习」', JSON.stringify(lab))
      const s = await readStore(page)
      ok(s?.['lab-testing']?.step == null, '存储断点已清空', JSON.stringify(s?.['lab-testing']))
    }

    /* ---------- G 实验室检测：终点 = 知识考核末题答完 ---------- */
    console.log('\n[G] 实验室检测终点：断点 quizWait → 续做 → 答完 H_12/H_17 → 已学习')
    await gotoCaseStudy(page)
    await seed(page, { 'lab-testing': { status: 'studying', step: 'quizWait' } })
    await gotoCaseStudy(page)
    await clickCard(page, '实验室检测')
    await until(async () => hasModal(page), 5000)
    await clickText(page, '继续学习')
    await until(async () => new URL(page.url()).pathname === '/lab-testing', 8000)
    ok((await waitVideoSrc(page, '/Video/操作视频/39.mp4')).endsWith('/Video/操作视频/39.mp4'), '回退到 39.mp4（考核整段重播）', await videoSrc(page))
    await clearAutoplayHint(page)
    const railOn = await until(
      async () => page.evaluate(() => Boolean(document.querySelector('.lab-quiz-rail'))),
      40000,
    )
    ok(railOn, '39.mp4 播完才挂载右侧知识考核侧栏')
    // 第 1 题 H_12 答案 A
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.lab-quiz-options .epi-option')).find(
        (b) => b.querySelector('.epi-option-key')?.textContent?.trim() === 'A',
      )
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    })
    await page.evaluate(() => document.querySelector('.lab-quiz-submit')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })))
    const secondQ = await until(
      async () => (await page.evaluate(() => document.querySelector('.lab-quiz-body')?.getAttribute('data-qid'))) === 'H_17',
      10000,
    )
    ok(secondQ, '答对第 1 题后自动切到第 2 题（H_17）')
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.lab-quiz-options .epi-option')).find(
        (b) => b.querySelector('.epi-option-key')?.textContent?.trim() === 'B',
      )
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    })
    await page.evaluate(() => document.querySelector('.lab-quiz-submit')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })))
    const backHome = await until(async () => new URL(page.url()).pathname === '/case-study', 15000)
    ok(backHome, '末题答完自动返回模块选择页', page.url())
    {
      const st = await waitCards(page)
      const lab = st.find((s) => s.id === 'lab-testing')
      ok(lab?.status === 'done' && lab?.label === '已学习', '卡片显示「已学习」', JSON.stringify(lab))
      const s = await readStore(page)
      ok(s?.['lab-testing']?.status === 'done' && s?.['lab-testing']?.step == null, '存储：done 且断点清空', JSON.stringify(s?.['lab-testing']))
    }

    /* ---------- H 食品卫生学：终点 = 14.mp4 播完自动返回 ---------- */
    console.log('\n[H] 食品卫生学终点：断点 staffVideo14 → 续做 → 14.mp4 播完自动返回并标「已学习」')
    await gotoCaseStudy(page)
    await seed(page, { 'food-hygiene': { status: 'studying', step: 'staffVideo14' } })
    await gotoCaseStudy(page)
    await clickCard(page, '食品卫生学调查')
    await until(async () => hasModal(page), 5000)
    await clickText(page, '继续学习')
    await until(async () => new URL(page.url()).pathname === '/food-hygiene', 8000)
    ok((await waitVideoSrc(page, '/Video/14.mp4')).endsWith('/Video/14.mp4'), '续做落在 14.mp4（末段）', await videoSrc(page))
    await clearAutoplayHint(page)
    const fhBack = await until(async () => new URL(page.url()).pathname === '/case-study', 60000)
    ok(fhBack, '14.mp4 播完自动返回模块选择页（终点不弹退出确认）', page.url())
    {
      const st = await waitCards(page)
      const fh = st.find((s) => s.id === 'food-hygiene')
      ok(fh?.status === 'done' && fh?.label === '已学习', '卡片显示「已学习」', JSON.stringify(fh))
    }

    /* ---------- I 现场流行病学：末帧弹窗断点回退 + 终点 ---------- */
    console.log('\n[I] 现场流行病学：断点 1:moduleFinish → 回退到 closingVideo10 → 走完终点')
    await gotoCaseStudy(page)
    await seed(page, { epidemiology: { status: 'studying', step: '1:moduleFinish' } })
    await gotoCaseStudy(page)
    await clickCard(page, '现场流行病学调查')
    await until(async () => hasModal(page), 5000)
    await clickText(page, '继续学习')
    await until(async () => new URL(page.url()).pathname === '/epidemiology', 8000)
    ok((await waitVideoSrc(page, '/Video/10.mp4')).endsWith('/Video/10.mp4'), '回退到 10.mp4（末帧弹窗的那段视频）', await videoSrc(page))
    {
      const s = await readStore(page)
      ok(s?.epidemiology?.step === '1:closingVideo10', '存储断点更新为 1:closingVideo10', JSON.stringify(s?.epidemiology?.step))
    }
    await clearAutoplayHint(page)
    const finishOn = await until(
      async () => ((await page.evaluate(() => document.body.textContent ?? '')) || '').includes('我已了解'),
      60000,
    )
    ok(finishOn, '10.mp4 播完出现「模块完成」提示')
    await clickText(page, '我已了解')
    const epiBack = await until(async () => new URL(page.url()).pathname === '/case-study', 15000)
    ok(epiBack, '「我已了解」→ 返回模块选择页', page.url())
    {
      const st = await waitCards(page)
      const epi = st.find((s) => s.id === 'epidemiology')
      ok(epi?.status === 'done' && epi?.label === '已学习', '卡片显示「已学习」', JSON.stringify(epi))
    }

    /* ---------- 终局：三态共存 ---------- */
    console.log('\n[J] 三态共存（实验室检测/食品卫生学/现场流行病学=已学习，资料分析=未学习）')
    {
      const st = await waitCards(page)
      const map = Object.fromEntries(st.map((s) => [s.id, s.status]))
      ok(map['lab-testing'] === 'done' && map['food-hygiene'] === 'done' && map.epidemiology === 'done', '三个已走完的模块均为 done', JSON.stringify(map))
      ok(map.analysis === 'idle', '未碰过的资料分析仍为 idle', JSON.stringify(map))
      const labels = st.map((s) => s.label).join(',')
      ok(labels === '已学习,已学习,已学习,未学习', '文案顺序 = 已学习×3 + 未学习×1', labels)
    }
    /* ---------- K 资料分析：续做不能被常驻背景视频劫持 ---------- */
    //
    // 历史缺陷（2026-09-20 修复）：analysis 的 15.mp4 **始终挂载**（播完停末帧当背景），
    // 且 onEnded 曾无条件 setPhase('table')。断点落在 video15 之后的阶段时，恢复进入
    // 会让它从 0 重播，8.29s 后把阶段拽回 'table' —— 学员正在答的题被顶掉、断点倒退。
    //
    // 本用例是「假覆盖」的补丁：主套件此前只把 analysis 断言成 idle（见 [J]），
    // 它的续做路径从未被走过，所以这个 bug 一直藏在 39/39 全绿之下。
    console.log('\n[K] 资料分析：断点 quiz3 续做 → 15.mp4 定格末帧、阶段不被 onEnded 劫持')
    await gotoCaseStudy(page)
    await seed(page, { analysis: { status: 'studying', step: 'quiz3' } })
    await gotoCaseStudy(page)
    await clickCard(page, '资料分析及调查结论')
    await until(async () => hasModal(page), 5000)
    await clickText(page, '继续学习')
    await until(async () => new URL(page.url()).pathname === '/analysis', 8000)
    {
      const onQuiz3 = await until(
        async () => (await page.evaluate(() => document.querySelector('.epi-quiz-page-now')?.textContent?.trim())) === '03',
        8000,
      )
      ok(onQuiz3, '续做落在第 3 题（03 / 05）')

      // 反向取证①：背景视频必须定格末帧（paused 且 currentTime ≈ duration），不从头重播
      const frozen = await until(
        async () =>
          page.evaluate(() => {
            const v = document.querySelector('video')
            return Boolean(v && v.paused && Number.isFinite(v.duration) && v.currentTime >= v.duration - 0.3)
          }),
        8000,
      )
      ok(frozen, '15.mp4 定格末帧（未从头重播）', JSON.stringify(await videoInfo(page)))

      // 反向取证②：静置一段 —— 若它仍在播，onEnded 早该把阶段拽去 table 了
      await sleep(1500)
      const stillQuiz = await page.evaluate(() =>
        Boolean(document.querySelector('.epi-quiz')) && !document.querySelector('.dt-panel'),
      )
      ok(stillQuiz, '阶段未被劫持（仍是答题卡，未跳回数据表格）', JSON.stringify(await videoInfo(page)))

      const s = await readStore(page)
      ok(s?.analysis?.step === 'quiz3', '存储断点未被改写成 table', JSON.stringify(s?.analysis))
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
