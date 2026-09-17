/* E2E: /analysis 资料分析及调查结论
   15.mp4 自动播 -> 徽标「可疑食物分析」/顶栏标签「资料分析及调查结论」-> 播完弹 191:587 数据表
   -> 12 行四格 -> 填 OR 自动出 Woolf 95%CI -> X 关闭回 /case-study */
const path = require('path')
const { chromium } = require(path.join('E:', 'XWJ', 'GWA10343033_New', 'node_modules', 'playwright'))

const BASE = 'http://localhost:5174'
const SHOT = 'C:\\Users\\QWE\\WorkBuddy\\2026-09-10-11-06-42\\shot-analysis-table.png'
const SHOT_RESULT = 'C:\\Users\\QWE\\WorkBuddy\\2026-09-10-11-06-42\\shot-analysis-result.png'
const SHOT_QUIZ = (n) => `C:\\Users\\QWE\\WorkBuddy\\2026-09-10-11-06-42\\shot-analysis-quiz${n}.png`
const SHOT_HINT = 'C:\\Users\\QWE\\WorkBuddy\\2026-09-10-11-06-42\\shot-analysis-hint.png'
const SHOT_SUMMARY = 'C:\\Users\\QWE\\WorkBuddy\\2026-09-10-11-06-42\\shot-analysis-summary.png'
const SHOT_REPORT = 'C:\\Users\\QWE\\WorkBuddy\\2026-09-10-11-06-42\\shot-analysis-report.png'
let errors = 0
const LINES = []
const log = (...a) => { const s = a.join(' '); LINES.push(s); console.log(s) }
function flush() {
  try {
    require('fs').writeFileSync(
      'C:\\Users\\QWE\\WorkBuddy\\2026-09-10-11-06-42\\.e2e_analysis_out.txt',
      LINES.join('\n'), { encoding: 'utf8' })
  } catch (e) { /* ignore */ }
}
function ok(name, cond, extra) {
  if (cond) { log('PASS', name) } else { errors++; log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : '') }
}

;(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  page.on('console', (m) => { if (m.type() === 'error') { errors++; log('CONSOLE-ERROR', m.text()) } })
  page.on('pageerror', (e) => { errors++; log('PAGE-ERROR', e.message) })

  await page.goto(BASE + '/analysis', { waitUntil: 'networkidle' })

  // ---- 视频阶段 ----
  const video = page.locator('.an-video')
  await video.waitFor({ state: 'attached', timeout: 8000 })
  const src = await video.getAttribute('src')
  ok('video src = /Video/15.mp4', /\/Video\/15\.mp4/.test(src || ''), src)

  await page.waitForFunction(() => {
    const v = document.querySelector('.an-video')
    return v && !v.paused && Number.isFinite(v.duration) && v.duration > 0
  }, { timeout: 8000 })
  const playing = await page.evaluate(() => { const v = document.querySelector('.an-video'); return { paused: v.paused, dur: v.duration } })
  ok('15.mp4 自动播放中', playing.paused === false, playing)

  // 徽标胶囊文案
  await page.waitForSelector('.an-badge-text', { timeout: 5000 })
  const pillText = (await page.locator('.an-badge-text').textContent()) || ''
  ok('左上徽标文案=可疑食物分析', pillText.trim() === '可疑食物分析', pillText)
  // 顶栏阶段标签
  const stageTag = (await page.locator('.hd-stage-tag').textContent()) || ''
  ok('顶栏阶段标签=资料分析及调查结论', stageTag.trim() === '资料分析及调查结论', stageTag)

  // ---- 顶部栏样式对齐 Figma 230:288 ----
  const cnStyle = await page.locator('.hd-title-cn').evaluate((el) => {
    const cs = getComputedStyle(el)
    return { fs: cs.fontSize, color: cs.color, lh: cs.lineHeight }
  })
  ok('顶栏中文标题 26px #494E58', cnStyle.fs === '26px' && cnStyle.color.toLowerCase() === 'rgb(73, 78, 88)', cnStyle)
  const enStyle = await page.locator('.hd-title-en').evaluate((el) => {
    const cs = getComputedStyle(el)
    return { color: cs.color, ls: cs.letterSpacing }
  })
  ok('顶栏英文标题 #1D2129 字距~1px', enStyle.color.toLowerCase() === 'rgb(29, 33, 41)' && parseFloat(enStyle.ls) >= 0.9, enStyle)
  // 数字使用 Digital Numbers（得分 100）
  const numFont = await page.locator('.hd-score-card .hd-num').evaluate((el) => getComputedStyle(el).fontFamily)
  ok('顶栏数字字体=Digital Numbers', /digital numbers/i.test(numFont), numFont)
  // 得分/用时卡 2px #618DCF 内描边
  const cardShadow = await page.locator('.hd-score-card').evaluate((el) => getComputedStyle(el).boxShadow)
  ok('得分卡有 2px #618DCF 内描边', /insset|inset/i.test(cardShadow) && cardShadow.includes('97, 141, 207'), cardShadow)
  // 阶段标签蓝底宽 280（Figma260 + 下拉箭头对称加宽）、字号 26，含下拉箭头
  const tagBox = await page.locator('.hd-stage-tag').evaluate((el) => {
    const cs = getComputedStyle(el)
    return { w: el.getBoundingClientRect().width, fs: cs.fontSize, caret: !!el.querySelector('.hd-stage-caret') }
  })
  ok('阶段标签 280px/26px 含箭头', Math.round(tagBox.w) === 280 && tagBox.fs === '26px' && tagBox.caret, tagBox)
  ok('标签初始 aria-expanded=false', (await page.getAttribute('.hd-stage-tag', 'aria-expanded')) === 'false')

  // ---- 阶段标签下拉切换模块 ----
  ok('初始无下拉菜单', await page.locator('.hd-stage-menu').count() === 0)
  await page.click('.hd-stage-tag')
  await page.locator('.hd-stage-menu').waitFor({ state: 'visible', timeout: 3000 })
  ok('点击后展开下拉菜单', await page.locator('.hd-stage-menu').count() === 1)
  ok('展开 aria-expanded=true', (await page.getAttribute('.hd-stage-tag', 'aria-expanded')) === 'true')
  const menuItems = await page.locator('.hd-stage-item-text').allTextContents()
  ok('下拉含4个模块',
    JSON.stringify(menuItems) === JSON.stringify(['流行病学调查', '食品卫生学调查', '实验室检测', '资料分析及调查结论']),
    menuItems)
  ok('当前模块(资料分析)高亮带勾', await page.locator('.hd-stage-item.is-active').count() === 1 &&
    (await page.locator('.hd-stage-item.is-active .hd-stage-item-text').textContent()) === '资料分析及调查结论')
  // 点外部关闭
  await page.mouse.click(100, 400)
  ok('点击外部关闭下拉', await page.locator('.hd-stage-menu').count() === 0)
  // 再展开，切换到「实验室检测」
  await page.click('.hd-stage-tag')
  await page.locator('.hd-stage-menu').waitFor({ state: 'visible', timeout: 3000 })
  await page.locator('.hd-stage-item', { hasText: '实验室检测' }).click()
  await page.waitForURL('**/lab-testing', { timeout: 6000 })
  ok('下拉切换路由到 /lab-testing', page.url().endsWith('/lab-testing'), page.url())
  ok('切换后菜单收起', await page.locator('.hd-stage-menu').count() === 0)
  await page.waitForSelector('.hd-stage-tag', { timeout: 6000 })
  const labTag = ((await page.locator('.hd-stage-tag .hd-stage-label').textContent()) || '').trim()
  ok('实验室页标签=实验室检测', labTag === '实验室检测', labTag)
  // 返回资料分析页继续后续链路（数据表等在 /analysis）
  await page.goto(BASE + '/analysis', { waitUntil: 'load', timeout: 60000 })
  await page.waitForSelector('.an-video', { timeout: 8000 })

  // 播放中表格未出现
  ok('播放中未显示数据表', await page.locator('.dt-panel').count() === 0)

  // ---- 快进到结尾触发 onEnded ----
  await page.evaluate(() => {
    const v = document.querySelector('.an-video')
    v.currentTime = v.duration - 0.05
  })
  await page.waitForSelector('.dt-panel', { timeout: 8000 })
  ok('播完弹出数据表格', await page.locator('.dt-panel').count() === 1)

  // ---- 表格结构 ----
  const rows = page.locator('.dt-panel tbody .dt-tr')
  const rowCount = await rows.count()
  ok('数据行=12', rowCount === 12, rowCount)

  const firstRow = rows.nth(0)
  const tds0 = await firstRow.locator('.dt-td').allInnerTexts()
  // [菜品, a, b, c, d, OR(td 内含 input), ciLow, ciHigh]
  ok('第1行菜品=素炒粉干', tds0[0] === '素炒粉干', tds0[0])
  ok('第1行四格 a/b/c/d=27/2/8/21', [tds0[1], tds0[2], tds0[3], tds0[4]].join('/') === '27/2/8/21', tds0.slice(1, 5))

  const dish11 = (await rows.nth(10).locator('.dt-td').nth(0).innerText()) || ''
  ok('第11行菜品=人参花胶炖土鸡', dish11 === '人参花胶炖土鸡', dish11)

  // OR 输入框 12 个，初始 CI 为空
  const orInputs = page.locator('.dt-or-input')
  ok('OR 输入框=12', await orInputs.count() === 12)
  const ciInit = await firstRow.locator('.dt-td-ci').allInnerTexts()
  ok('未填 OR 时 CI 两列空白', ciInit[0].trim() === '' && ciInit[1].trim() === '', ciInit)

  // ---- Woolf 法独立复算（基准=用户提供的公式，而非设计稿数字）----
      const woolf = (a, b, c, d, orv) => {
        const se = Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d)
        const ln = Math.log(orv)
        return [Math.exp(ln - 1.96 * se), Math.exp(ln + 1.96 * se)]
      }

  // ---- 填第1行 OR=35.4375，断言 Woolf CI（下限 6.798 与稿面逐位一致）----
  await orInputs.nth(0).fill('35.4375')
  await page.waitForFunction(() => {
    const t = document.querySelectorAll('.dt-panel tbody .dt-tr')[0].querySelectorAll('.dt-td-ci')
    return t[0].textContent.trim() !== '' && t[1].textContent.trim() !== ''
  }, { timeout: 3000 })
  const ci1 = await firstRow.locator('.dt-td-ci').allInnerTexts()
  const [eLo1, eHi1] = woolf(27, 2, 8, 21, 35.4375)
  ok('行1 CI下限≈Woolf ' + eLo1.toFixed(3), Math.abs(parseFloat(ci1[0]) - eLo1) < 0.01, ci1)
  ok('行1 CI上限≈Woolf ' + eHi1.toFixed(2), Math.abs(parseFloat(ci1[1]) - eHi1) < 0.01, ci1)
  log('   行1 Woolf 输出 =', ci1.map((s) => s.trim()).join(' , '), ' 期望 ≈', eLo1.toFixed(3), '/', eHi1.toFixed(2))

  // ---- 填第2行 OR=3.868132，断言 Woolf CI ----
  await orInputs.nth(1).fill('3.868132')
  await page.waitForFunction(() => {
    const t = document.querySelectorAll('.dt-panel tbody .dt-tr')[1].querySelectorAll('.dt-td-ci')
    return t[0].textContent.trim() !== '' && t[1].textContent.trim() !== ''
  }, { timeout: 3000 })
  const ci2 = await rows.nth(1).locator('.dt-td-ci').allInnerTexts()
  const [eLo2, eHi2] = woolf(22, 7, 13, 16, 3.868132)
  ok('行2 CI下限≈Woolf ' + eLo2.toFixed(3), Math.abs(parseFloat(ci2[0]) - eLo2) < 0.01, ci2)
  ok('行2 CI上限≈Woolf ' + eHi2.toFixed(2), Math.abs(parseFloat(ci2[1]) - eHi2) < 0.01, ci2)
  log('   行2 Woolf 输出 =', ci2.map((s) => s.trim()).join(' , '), ' 期望 ≈', eLo2.toFixed(3), '/', eHi2.toFixed(2))

  // ---- 非法输入不产生 CI（只允许数字/小数点）----
  await orInputs.nth(2).type('abc')
  const val3 = await orInputs.nth(2).inputValue()
  ok('非数字字符被过滤', val3 === '', val3)
  const ci3 = await rows.nth(2).locator('.dt-td-ci').allInnerTexts()
  ok('非法/空值不生成 CI', ci3[0].trim() === '' && ci3[1].trim() === '', ci3)

  await page.screenshot({ path: SHOT })

  // ============ 提交判题：行1/行2 正确，行3 故意填错，其余留空 ============
  await orInputs.nth(2).fill('9.99')

  const submitBtn = page.locator('.dt-submit')
  ok('提交按钮文案=提交', (await submitBtn.textContent()) === '提交', await submitBtn.textContent())
  await submitBtn.click()

  // 提交后所有输入锁定
  const allReadonly = await page.locator('.dt-or-input').evaluateAll(
    (els) => els.every((e) => e.hasAttribute('readonly'))
  )
  ok('提交后 12 个 OR 输入全部锁定', allReadonly)

  // 标准答案 OR = a·d/(b·c)
  const abcd = [
    [27,2,8,21],[22,7,13,16],[16,13,14,15],[20,9,19,10],[23,6,20,9],
    [23,6,16,13],[22,7,23,6],[24,5,23,6],[24,5,20,9],[25,4,27,2],
    [27,2,27,2],[22,7,24,5],
  ]
  const orStd = (i) => { const [a,b,c,d] = abcd[i]; return (a*d)/(b*c) }
  const fmtOr = (n) => n.toFixed(6).replace(/\.?0+$/, '')

  // 行1/2 答对：保留作答值 + is-correct
  const v1 = await orInputs.nth(0).inputValue()
  const cls1 = await orInputs.nth(0).getAttribute('class')
  ok('行1 答对保留 35.4375', v1 === '35.4375', v1)
  ok('行1 标绿 is-correct', /is-correct/.test(cls1), cls1)
  const v2 = await orInputs.nth(1).inputValue()
  ok('行2 答对保留 3.868132', v2 === '3.868132', v2)

  // 行3 答错：替换为标准答案 1.318681 + is-wrong
  const v3 = await orInputs.nth(2).inputValue()
  const cls3 = await orInputs.nth(2).getAttribute('class')
  ok('行3 答错显示标准答案 ' + fmtOr(orStd(2)), v3 === fmtOr(orStd(2)), v3)
  ok('行3 标红 is-wrong', /is-wrong/.test(cls3), cls3)

  // 留空行（行4~12）：全部回填标准答案 + is-wrong
  const stdFilled = await page.locator('.dt-or-input').evaluateAll(
    (els, std) => {
      for (let i = 3; i < 12; i++) {
        const expect = std[i]
        if (els[i].value !== expect) return { i, got: els[i].value, expect }
        if (!/is-wrong/.test(els[i].className)) return { i, got: els[i].className, expect: 'is-wrong' }
      }
      return true
    },
    abcd.map(([a,b,c,d]) => fmtOr((a*d)/(b*c)))
  )
  ok('留空行4~12 提交后全部显示标准答案并标红', stdFilled === true, stdFilled)

  // 提交后 CI 全部以标准答案生成（行1 仍 6.798/184.73；行4 由标准 OR 重算）
  const ciAfter1 = await rows.nth(0).locator('.dt-td-ci').allInnerTexts()
  ok('提交后行1 CI 仍正确', Math.abs(parseFloat(ciAfter1[0]) - 6.798) < 0.01, ciAfter1)
  const [sLo4, sHi4] = woolf(...abcd[3], orStd(3))
  const ciAfter4 = await rows.nth(3).locator('.dt-td-ci').allInnerTexts()
  ok('提交后行4 CI 按标准OR重算 ' + sLo4.toFixed(3), Math.abs(parseFloat(ciAfter4[0]) - sLo4) < 0.01 && Math.abs(parseFloat(ciAfter4[1]) - sHi4) < 0.01, ciAfter4)
  const ciGreen = await rows.nth(3).locator('.dt-ci-box').first().evaluate((e) => /is-correct/.test(e.className))
  ok('提交后 CI 盒标绿', ciGreen)

  // 提交后显示 5 秒倒计时提示
  const holdHint = page.locator('.dt-hold-hint')
  await holdHint.waitFor({ state: 'visible', timeout: 3000 })
  const holdText = (await holdHint.textContent()) || ''
  ok('提交后显示进入考核倒计时', /秒后进入知识考核/.test(holdText), holdText)

  await page.screenshot({ path: SHOT_RESULT })

  // ============ 5 秒停留后进入 5 道知识考核（复用 QuizStep/QuizModal）============
  await page.waitForSelector('.epi-quiz-mask', { timeout: 8000 })
  ok('停留后进入知识考核弹窗', await page.locator('.epi-quiz-mask').count() === 1)

  // 5 题答案（qid H_18~H_22 对应 xlsx H_15~H_19）：[正确选项...]
  const QUIZ = [
    { keys: ['A'], label: '可疑食物(单选A)', page: '01' },
    { keys: ['A', 'B', 'C', 'D', 'E'], label: '调查结论(多选全选)', page: '02' },
    { keys: ['A', 'C', 'E'], label: '结论依据(A/C/E)', page: '03' },
    { keys: ['A', 'B', 'C', 'D'], label: '推论原则(全选)', page: '04' },
    { keys: ['A', 'B', 'C', 'D', 'E', 'F'], label: '因果推论(全选)', page: '05' },
  ]
  for (let qi = 0; qi < QUIZ.length; qi++) {
    const spec = QUIZ[qi]
    const modal = page.locator('.epi-quiz').last()
    await modal.waitFor({ state: 'visible', timeout: 5000 })
    const pageNow = (await modal.locator('.epi-quiz-page-now').textContent()) || ''
    ok(`题${qi + 1} 页码=${spec.page}/05`, pageNow.trim() === spec.page, pageNow)

    // 点选正确选项
    for (const k of spec.keys) {
      await modal.locator(`.epi-option:has(.epi-option-key:text-is("${k}"))`).first().click()
    }
    const chosen = await modal.locator('.epi-option.is-selected').count()
    ok(`题${qi + 1} ${spec.label} 已选 ${spec.keys.length} 项`, chosen === spec.keys.length, chosen)

    // 提交前截图：题1=短选项基线；题4/题5=长选项换行/滚动验证
    if (qi === 0 || qi === 3 || qi === 4) {
      await page.waitForTimeout(150)
      await page.screenshot({ path: SHOT_QUIZ(qi + 1) })
    }

    // 长选项题（题4/题5）：文本换行完整显示 + 字号自动缩小，全部选项一屏放完（无滚动条）
    if (qi === 3 || qi === 4) {
      const layout = await modal.locator('.epi-quiz-options').evaluate((ul) => {
        const texts = Array.from(ul.querySelectorAll('.epi-option-text'))
        const overflowX = texts.filter((t) => t.scrollWidth - t.clientWidth > 2).length
        const clipped = texts.filter((t) => getComputedStyle(t).textOverflow === 'ellipsis').length
        const layer = ul.closest('.an-quiz-layer')
        const fs = layer ? getComputedStyle(layer).getPropertyValue('--an-opt-fs').trim() : '?'
        const fsPx = texts[0] ? parseFloat(getComputedStyle(texts[0]).fontSize) : 0
        // 全部选项实际总高 + 实际 gap 必须落在固定区内（top126→结果条512，预算 376）
        const gapPx = parseFloat(getComputedStyle(ul).rowGap || getComputedStyle(ul).gap) || 0
        const gap = (ul.children.length - 1) * gapPx
        let contentH = gap
        ul.querySelectorAll('.epi-option').forEach((b) => { contentH += b.offsetHeight })
        return {
          overflowX,
          clipped,
          fs,
          fsPx,
          contentH,
          noVerticalScroll: ul.scrollHeight - ul.clientHeight <= 2,
          fits: contentH <= 376,
        }
      })
      ok(`题${qi + 1} 长选项无横向溢出/无省略号`, layout.overflowX === 0 && layout.clipped === 0, layout)
      ok(
        `题${qi + 1} 字号自动缩小(${layout.fsPx}px)且全部一屏放完无滚动条`,
        layout.fsPx < 24 && layout.fits && layout.noVerticalScroll,
        layout,
      )
      log(`   题${qi + 1} 自适应字号=${layout.fs} 实测fontSize=${layout.fsPx}px 选项总高=${layout.contentH}/376`)
    }

    // 提交（答对即时推进到下一题/结束）
    await modal.locator('.epi-quiz-submit').click()
    log(`   题${qi + 1} 已提交正确答案 ${spec.keys.join('')}`)
  }

  // ============ 末题答完：「如何给这起事件下结论?」提示卡（Figma 355:1547）============
  const hintCard = page.locator('.ch-card')
  await hintCard.waitFor({ state: 'visible', timeout: 6000 })
  ok('末题后弹出结论提示卡', await hintCard.count() === 1)
  const hintTitle = (await page.locator('.ch-title').textContent()) || ''
  ok('提示卡标题=如何给这起事件下结论?', hintTitle.trim() === '如何给这起事件下结论?', hintTitle)
  const hintHead = (await page.locator('.ch-head-title').textContent()) || ''
  ok('提示卡头条=提示', hintHead.trim() === '提示', hintHead)
  const paraCount = await page.locator('.ch-para').count()
  ok('提示卡正文=2 段', paraCount === 2, paraCount)
  const para1 = (await page.locator('.ch-para').nth(0).textContent()) || ''
  ok('第1段含 沙门氏菌/素炒粉干', para1.includes('沙门氏菌') && para1.includes('素炒粉干'), para1.slice(0, 40))
  const para2 = (await page.locator('.ch-para').nth(1).textContent()) || ''
  ok('第2段含 信息整理表/调查报告提纲', para2.includes('信息整理表') && para2.includes('调查报告提纲'), para2.slice(0, 40))
  const ackText = (await page.locator('.ch-ack-btn span').textContent()) || ''
  ok('主按钮文案=我已了解', ackText.trim() === '我已了解', ackText)
  await page.screenshot({ path: SHOT_HINT })

  // 点「我已了解」→ 信息整理表
  await page.locator('.ch-ack-btn').click()
  const summaryPanel = page.locator('.st-panel')
  await summaryPanel.waitFor({ state: 'visible', timeout: 6000 })
  ok('点我已了解后弹出信息整理表', await summaryPanel.count() === 1)
  ok('提示卡已卸载', await page.locator('.ch-card').count() === 0)
  const sumTitle = (await page.locator('.st-head-title').textContent()) || ''
  ok('整理表标题=食品安全事故流行病学调查信息整理表', sumTitle.trim() === '食品安全事故流行病学调查信息整理表', sumTitle)
  const sumImg = page.locator('.st-img')
  await sumImg.waitFor({ state: 'visible', timeout: 6000 })
  const imgComplete = await sumImg.evaluate((el) => el.complete && el.naturalWidth > 0)
  ok('整理表长图加载成功', imgComplete === true)
  // 长图可纵向滚动（源图 1049×3531，主体仅 800 高）
  const scrollInfo = await page.locator('.st-body').evaluate((el) => ({
    canScroll: el.scrollHeight - el.clientHeight > 100,
    scrollH: el.scrollHeight,
    clientH: el.clientHeight,
  }))
  ok('整理表内容区可纵向滚动', scrollInfo.canScroll === true, scrollInfo)
  const sumConfirm = page.locator('.st-confirm-btn')
  ok('整理表存在确认按钮', (await sumConfirm.textContent()) === '确认', await sumConfirm.textContent())
  await page.screenshot({ path: SHOT_SUMMARY })

  // 整理表「确认」→ 报告提纲弹窗
  await sumConfirm.click()
  const reportPanel = page.locator('.rp-panel')
  await reportPanel.waitFor({ state: 'visible', timeout: 6000 })
  ok('点确认后弹出调查报告提纲', await reportPanel.count() === 1)
  ok('整理表已卸载', await page.locator('.st-panel').count() === 0)
  const rpTitle = (await page.locator('.rp-head-title').textContent()) || ''
  ok('提纲标题=食品安全事故流行病学调查报告提纲', rpTitle.trim() === '食品安全事故流行病学调查报告提纲', rpTitle)
  const headings = ['一、背景', '二、基本情况', '三、调查过程', '四、调查结果', '五、调查结论', '六、建议']
  const headingCount = await page.locator('.rp-heading').count()
  ok('提纲六章节齐全', headingCount === 6, headingCount)
  for (const hd of headings) {
    ok(`提纲含章节 ${hd}`, await page.locator('.rp-heading', { hasText: hd }).count() === 1)
  }
  const rpBody = page.locator('.rp-body')
  const rpScroll = await rpBody.evaluate((el) => el.scrollHeight - el.clientHeight)
  ok('提纲正文可纵向滚动', rpScroll > 50, { overflow: rpScroll })
  const rpConfirm = page.locator('.rp-confirm-btn')
  ok('提纲存在确认按钮', (await rpConfirm.textContent()) === '确认', await rpConfirm.textContent())
  await page.screenshot({ path: SHOT_REPORT })

  // 报告提纲打开即自动播放解说音频 0.mp3
  const rpAudio = page.locator('.rp-mask audio')
  await rpAudio.waitFor({ state: 'attached', timeout: 3000 })
  const rpAudioSrc = (await rpAudio.getAttribute('src')) || ''
  ok('报告提纲解说音频=0.mp3', rpAudioSrc.includes('资料分析及调查结论/0.mp3'), rpAudioSrc)
  await page.waitForTimeout(500)
  const rpAudioState = await rpAudio.evaluate((el) => ({ paused: el.paused, currentTime: el.currentTime, readyState: el.readyState }))
  ok('报告提纲解说音频正在播放', rpAudioState.paused === false && rpAudioState.currentTime > 0, rpAudioState)

  // 提纲「确认」→ 返回模块选择页
  await rpConfirm.click()
  await page.waitForURL('**/case-study', { timeout: 6000 })
  ok('提纲确认返回 /case-study', page.url().endsWith('/case-study'), page.url())
  await page.locator('.rp-mask').waitFor({ state: 'detached', timeout: 5000 })
  ok('离开后解说音频随弹窗卸载停止', await page.locator('.rp-mask audio').count() === 0)

  // ---- 顶栏返回弯箭头也回 /case-study（重进一次验证）----
  await page.goto(BASE + '/analysis', { waitUntil: 'networkidle' })
  const backDisabled = await page.locator('.hd-tool').nth(2).isDisabled()
  ok('播放页返回钮可用（非禁用）', backDisabled === false, backDisabled)

  await browser.close()
  log(errors === 0 ? 'ANALYSIS E2E ALL PASS' : `ANALYSIS E2E ${errors} FAILURE(S)`)
  flush()
  process.exit(errors === 0 ? 0 : 1)
})().catch((e) => { console.error(e); flush(); process.exit(2) })
