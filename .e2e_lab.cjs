const { chromium } = require('playwright')

const BASE = 'http://127.0.0.1:5174'
const SHOT = 'C:/Users/QWE/WorkBuddy/2026-09-10-11-06-42'

const EXPECTED_TOOLS = [
  '匀质机',
  '隔水式恒温培养箱',
  '食品样品',
  '缓冲蛋白胨水（BPW）',
  'SC增菌液',
  'TTB增菌液',
  '接种环',
  '三糖铁（TSI）琼脂',
  '平皿',
  '多价菌体（O）抗血清',
]

;(async () => {
  const errors = []
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE: ' + m.text())
  })
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

  const assert = (cond, msg) => {
    if (!cond) throw new Error('FAIL: ' + msg)
    console.log('PASS: ' + msg)
  }

  // ---------- 阶段一：进入即 17.mp4，原生控制条，下一步/退出 ----------
  await page.goto(BASE + '/lab-testing', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => {
    const v = document.querySelector('video.lab-video')
    return v && v.src.includes('/17.mp4')
  }, { timeout: 8000 })
  const v17 = page.locator('video.lab-video')
  assert((await v17.getAttribute('src')) === '/Video/17.mp4', '阶段一视频源 = /Video/17.mp4')
  assert(await v17.evaluate((el) => el.controls) === true, '17.mp4 带原生控制条 controls=true')
  await page.waitForFunction(() => { const v = document.querySelector('video.lab-video'); return v && !v.paused }, { timeout: 8000 })
  const dur17 = await v17.evaluate((el) => el.duration)
  assert(dur17 > 400, '17.mp4 自动播放中，时长=' + dur17.toFixed(1) + 's')

  const nextBtn = page.locator('.lab-next-btn', { hasText: '下一步' })
  const exitBtn = page.locator('.lab-actions .lab-exit-btn', { hasText: '退出视频' })
  assert(await nextBtn.count() === 1, '存在「下一步」按钮')
  assert(await exitBtn.count() === 1, '阶段一存在「退出视频」按钮')
  const badge = page.locator('.lab-badge-text', { hasText: '查看实验视频' })
  assert(await badge.count() === 1, '徽标文案 = 查看实验视频')

  // ---------- 阶段二：点下一步 → 操作视频/01.mp4 自动播放，无原生控制条 ----------
  await nextBtn.click()
  await page.waitForFunction(() => {
    const v = document.querySelector('video.lab-video')
    return v && v.src.includes('%E6%93%8D%E4%BD%9C%E8%A7%86%E9%A2%91') // 「操作视频」URL 编码
  }, { timeout: 8000 })
  const op = page.locator('video.lab-video')
  const opSrc = decodeURIComponent(await op.getAttribute('src'))
  assert(opSrc === '/Video/操作视频/01.mp4', '阶段二视频源 = /Video/操作视频/01.mp4 (实际 ' + opSrc + ')')
  assert(await op.evaluate((el) => el.controls) === false, '01.mp4 不显示原生控制条（自动教学播放）')
  await page.waitForFunction(() => { const v = document.querySelector('video.lab-video'); return v && !v.paused && v.duration > 0 }, { timeout: 8000 })
  const opInfo = await op.evaluate((el) => ({ paused: el.paused, dur: el.duration }))
  assert(opInfo.paused === false && opInfo.dur > 0, '01.mp4 自动播放中，时长=' + opInfo.dur.toFixed(1) + 's')
  // 下一步按钮已消失；徽标切换为「样品处理」；阶段一起见的退出视频按钮也消失
  assert(await page.locator('.lab-next-btn').count() === 0, '进入01后「下一步」按钮消失')
  assert(await page.locator('.lab-actions').count() === 0, '进入01后阶段一右下操作区（含退出视频）消失')
  assert(await page.locator('.lab-exit-btn--alone').count() === 0, '阶段二无独立「退出视频」按钮')
  assert((await page.locator('.lab-badge-text', { hasText: '样品处理' }).count()) === 1, '阶段二徽标切换为「样品处理」')
  assert(await page.locator('.lab-tools-rail').count() === 0, '01播放中道具栏尚未出现')

  // 配音联动：01.mp4 播放同时应播放讲解音 Audio/实验室检测/7.mp3（单 <audio> 元素）
  const narr = page.locator('audio')
  assert(await narr.count() === 1, '存在单个配音 <audio> 元素')
  await page.waitForFunction(() => {
    const a = document.querySelector('audio')
    return a && decodeURIComponent(a.src).includes('/Audio/实验室检测/7.mp3') && !a.paused
  }, { timeout: 8000 })
  const narr7 = await narr.evaluate((el) => ({ src: decodeURIComponent(el.src), paused: el.paused }))
  assert(narr7.src.includes('/Audio/实验室检测/7.mp3') && narr7.paused === false,
    '01.mp4 同步播放讲解音 7.mp3（paused=' + narr7.paused + '）')

  // ---------- 阶段三：01 播完（派发 ended）→ 右侧 10 件道具栏 ----------
  await op.evaluate((el) => el.dispatchEvent(new Event('ended', { bubbles: true })))
  await page.waitForSelector('.lab-tools-rail', { timeout: 6000 })
  assert((await page.locator('.lab-tools-head-title', { hasText: '道具栏' }).count()) === 1, '道具栏标题头存在')
  const tools = page.locator('.lab-tool')
  assert(await tools.count() === 10, '道具栏共 10 件道具（实测 ' + (await tools.count()) + '）')
  assert((await page.locator('.lab-tool-chip').count()) === 10, '10 个圆角方形图标格')

  const labels = await page.locator('.lab-tool-label').allInnerTexts()
  const norm = (s) => s.replace(/\s+/g, '')
  const labelsNorm = labels.map(norm)
  let missing = []
  for (const want of EXPECTED_TOOLS) {
    if (!labelsNorm.includes(norm(want))) missing.push(want)
  }
  assert(missing.length === 0, '10 件道具名称齐全' + (missing.length ? '，缺：' + missing.join('、') : ''))

  // 每个图标都加载成图片（naturalWidth>0）；等待最多 8s 全部解码完成
  await page.waitForFunction(() => {
    const els = document.querySelectorAll('.lab-tool-img')
    return els.length === 10 && Array.from(els).every((img) => img.complete && img.naturalWidth > 0)
  }, { timeout: 8000 })
  const imgsOk = await page.locator('.lab-tool-img').evaluateAll((els) =>
    els.every((img) => img.complete && img.naturalWidth > 0)
  )
  assert(imgsOk === true, '10 个道具图标均成功加载')

  // 一屏平铺：网格无纵向滚动条（scrollHeight 不超出 clientHeight），10 件均在可视区域
  const railBox = await page.locator('.lab-tools-rail').evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height), rightGap: Math.round(1920 - r.right) }
  })
  assert(railBox.left === 1640 && railBox.top === 160 && railBox.width === 260 && railBox.height === 760,
    '道具栏位置/尺寸对齐 Figma（实测 left=' + railBox.left + ' top=' + railBox.top + ' ' + railBox.width + 'x' + railBox.height + ' 右边距=' + railBox.rightGap + '）')
  const noScroll = await page.locator('.lab-tools-grid').evaluate((el) => ({
    sh: el.scrollHeight,
    ch: el.clientHeight,
  }))
  assert(noScroll.sh <= noScroll.ch + 1, '道具栏一屏平铺无翻页（scroll ' + noScroll.sh + ' <= client ' + noScroll.ch + '）')
  const allInView = await page.locator('.lab-tool').evaluateAll((els) => {
    const rail = document.querySelector('.lab-tools-rail').getBoundingClientRect()
    return els.every((el) => {
      const r = el.getBoundingClientRect()
      return r.top >= rail.top - 1 && r.bottom <= rail.bottom + 1
    })
  })
  assert(allInView === true, '10 件道具全部落在道具栏可视区内')

  await page.screenshot({ path: SHOT + '/shot-lab-tools.png' })

  // 视频仍停留在 01.mp4 末帧（元素仍挂载）
  const still01 = decodeURIComponent(await page.locator('video.lab-video').getAttribute('src'))
  assert(still01 === '/Video/操作视频/01.mp4', '道具栏阶段背景仍为 01.mp4（停末帧）')

  // 提示框 + 提示音 8.mp3
  const hint = page.locator('.lab-hint-text', { hasText: '把缓冲蛋白胨水' })
  assert(await hint.count() === 1, '底部提示框显示「把缓冲蛋白胨水（BPW）放至秤上」')
  // 提示框相对 1920 舞台水平居中（胶囊中心 x ≈ 960）
  const hintBox = await page.locator('.lab-hint').evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { cx: Math.round(r.left + r.width / 2), w: Math.round(r.width) }
  })
  assert(Math.abs(hintBox.cx - 960) <= 2, '底部提示框相对舞台水平居中（中心 x=' + hintBox.cx + '，宽=' + hintBox.w + '）')
  await page.waitForFunction(() => {
    const a = document.querySelector('audio')
    return a && decodeURIComponent(a.src).includes('/Audio/实验室检测/8.mp3') && !a.paused
  }, { timeout: 8000 })
  const narr8 = await narr.evaluate((el) => ({ src: decodeURIComponent(el.src), paused: el.paused }))
  assert(narr8.src.includes('/Audio/实验室检测/8.mp3') && narr8.paused === false,
    '道具栏阶段播放提示音 8.mp3（paused=' + narr8.paused + '）')

  // 仅 BPW 可点击（role=button），其余 9 件不可点
  const bpw = page.locator('.lab-tool--clickable', { hasText: '缓冲蛋白胨水' })
  assert(await page.locator('.lab-tool--clickable').count() === 1, '道具栏仅 1 件可交互（BPW）')
  assert(await bpw.count() === 1, '可交互项为缓冲蛋白胨水（BPW）')

  // ---------- 阶段四：点 BPW → 自动播放 操作视频/02.mp4，道具栏与提示框消失，8.mp3 停止 ----------
  await bpw.click()
  await page.waitForFunction(() => {
    const v = document.querySelector('video.lab-video')
    return v && decodeURIComponent(v.src).includes('/Video/操作视频/02.mp4') && !v.paused
  }, { timeout: 8000 })
  const v02 = page.locator('video.lab-video')
  const src02 = decodeURIComponent(await v02.getAttribute('src'))
  assert(src02 === '/Video/操作视频/02.mp4', '点 BPW 后视频源切为 /Video/操作视频/02.mp4（实际 ' + src02 + '）')
  // 02.mp4 播放期间道具栏常驻显示（10 件齐全），BPW 保持高亮但不再可点击
  assert(await page.locator('.lab-tools-rail').count() === 1, '02.mp4 播放中道具栏仍显示')
  assert((await page.locator('.lab-tool').count()) === 10, '02.mp4 播放中道具栏仍为 10 件')
  assert(await page.locator('.lab-tool--clickable').count() === 0, '02.mp4 播放中无可点击道具（BPW 不可重复点）')
  assert(await page.locator('.lab-tool-chip--hot').count() === 1, '02.mp4 播放中 BPW 保持高亮标识')
  assert(await page.locator('.lab-hint[data-empty="true"]').count() === 1, '02.mp4 播放中提示胶囊保留但为空（容器常显）')
  assert(await page.locator('.epi-play-hint').count() === 0, '02.mp4 自动播放无误弹「点击播放视频」遮罩')
  const afterPick = await narr.evaluate((el) => ({ src: decodeURIComponent(el.src), paused: el.paused }))
  assert(afterPick.paused === true, '进入02后提示音 8.mp3 已停止（paused=true）')
  // 等播放进度推进，确保截到真实首帧而非解码前黑帧
  await page.waitForFunction(() => {
    const v = document.querySelector('video.lab-video')
    return v && v.currentTime > 0.2 && v.readyState >= 2
  }, { timeout: 8000 })
  await page.screenshot({ path: SHOT + '/shot-lab-op02.png' })

  const opSrcNow = async () => decodeURIComponent(await page.locator('video.lab-video').getAttribute('src'))
  const endCur = async () => {
    await page.locator('video.lab-video').evaluate((el) => el.dispatchEvent(new Event('ended', { bubbles: true })))
  }
  const waitSrcN = (n) => page.waitForFunction(
    (n) => { const v = document.querySelector('video.lab-video'); return v && decodeURIComponent(v.src).includes('/' + n + '.mp4') && !v.paused },
    n, { timeout: 8000 }
  )

  // ---------- 阶段五：02 播完 → tareWait 末帧 + 秤面归零热区（视频仍 02） ----------
  await endCur()
  await page.waitForSelector('.lab-tare-hotspot', { timeout: 6000 })
  assert((await opSrcNow()) === '/Video/操作视频/02.mp4', 'tareWait 停 02.mp4 末帧')
  assert(await page.locator('.lab-tare-hotspot').count() === 1, '出现秤面归零热区')
  const hs = await page.locator('.lab-tare-hotspot').evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
  })
  assert(hs.l === 1094 && hs.t === 707 && hs.w === 100 && hs.h === 64,
    '归零热区坐标 1094,707 100×64（实测 ' + hs.l + ',' + hs.t + ' ' + hs.w + 'x' + hs.h + '，覆盖橙钮中心1144,739）')
  assert((await page.locator('.lab-tool').count()) === 10, 'tareWait 道具栏仍 10 件')
  assert(await page.locator('.lab-hint[data-empty="true"]').count() === 1, 'tareWait 提示胶囊为空（末帧自带红字引导）')
  await page.screenshot({ path: SHOT + '/shot-lab-tare.png' })

  // ---------- 阶段六：点归零热区 → 03.mp4 ----------
  await page.locator('.lab-tare-hotspot').click({ force: true }) // 脉冲 scale 动画致动作性稳定性检查不通过，force 跳过（真实点击不受影响）
  await waitSrcN('03')
  assert((await opSrcNow()) === '/Video/操作视频/03.mp4', '点归零热区 → 03.mp4')
  assert(await page.locator('.lab-tare-hotspot').count() === 0, '03 播放中归零热区消失')
  assert((await page.locator('.lab-tool').count()) === 10, '03 播放中道具栏常驻')
  assert(await page.locator('.lab-hint[data-empty="true"]').count() === 1, '03 播放中提示胶囊为空')

  // ---------- 阶段七：03 播完 → pickFoodWait 提示点击食品样品 ----------
  await endCur()
  await page.locator('.lab-tool--clickable', { hasText: '食品样品' }).waitFor({ timeout: 6000 })
  assert((await opSrcNow()) === '/Video/操作视频/03.mp4', 'pickFoodWait 停 03.mp4 末帧')
  assert(await page.locator('.lab-hint-text', { hasText: '点击食品样品' }).count() === 1, '提示「点击食品样品」')
  const food = page.locator('.lab-tool--clickable', { hasText: '食品样品' })
  assert(await page.locator('.lab-tool--clickable').count() === 1, 'pickFoodWait 仅 1 件可点')
  assert(await food.count() === 1, '可交互项=食品样品')
  assert(await page.locator('.lab-tool-chip--hot').count() === 2, 'BPW(已用)+食品样品(当前) 共 2 高亮')
  await page.screenshot({ path: SHOT + '/shot-lab-pick-food.png' })

  // ---------- 阶段八：点食品样品 → 04.mp4 ----------
  await food.click()
  await waitSrcN('04')
  assert((await opSrcNow()) === '/Video/操作视频/04.mp4', '点食品样品 → 04.mp4')
  assert(await page.locator('.lab-tools-rail').count() === 1, '04 播放中道具栏常驻')
  assert(await page.locator('.lab-hint[data-empty="true"]').count() === 1, '04 播放中提示胶囊为空')
  assert(await page.locator('.lab-tool-chip--hot').count() === 2, '04 中 BPW+食品样品保持高亮')

  // ---------- 阶段九：04 播完 → pickHomoWait 提示点击匀质机 ----------
  await endCur()
  await page.locator('.lab-tool--clickable', { hasText: '匀质机' }).waitFor({ timeout: 6000 })
  assert((await opSrcNow()) === '/Video/操作视频/04.mp4', 'pickHomoWait 停 04.mp4 末帧')
  assert(await page.locator('.lab-hint-text', { hasText: '点击匀质机' }).count() === 1, '提示「点击匀质机」')
  const homo = page.locator('.lab-tool--clickable', { hasText: '匀质机' })
  assert(await homo.count() === 1, '可交互项=匀质机')
  assert(await page.locator('.lab-tool-chip--hot').count() === 3, 'BPW+食品样品(已用)+匀质机(当前) 共 3 高亮')
  await page.screenshot({ path: SHOT + '/shot-lab-pick-homo.png' })

  // ---------- 阶段十：点匀质机 → 05.mp4；播完停末帧不跳转 ----------
  await homo.click()
  await waitSrcN('05')
  assert((await opSrcNow()) === '/Video/操作视频/05.mp4', '点匀质机 → 05.mp4')
  assert(await page.locator('.lab-tools-rail').count() === 1, '05 播放中道具栏常驻')
  assert(await page.locator('.lab-tool--clickable').count() === 0, '05 播放中无可点道具')
  assert(await page.locator('.lab-tool-chip--hot').count() === 3, '05 中三件已用道具高亮')
  await endCur()
  await page.waitForTimeout(400)
  assert((await opSrcNow()) === '/Video/操作视频/05.mp4', '05 播完停末帧（无自动跳转）')
  assert(await page.locator('.lab-tare-hotspot').count() === 0, '05 末帧无归零热区')
  assert(await page.locator('.lab-tools-rail').count() === 1, '05 末帧道具栏仍常驻')
  await page.screenshot({ path: SHOT + '/shot-lab-op05.png' })

  // 样品处理各阶段均无右下退出钮；徽标始终「样品处理」；退出统一走顶栏返回弯箭头
  assert(await page.locator('.lab-exit-btn--alone').count() === 0, '样品处理阶段无独立「退出视频」按钮')
  assert((await page.locator('.lab-badge-text', { hasText: '样品处理' }).count()) === 1, '样品处理阶段徽标=「样品处理」')
  const backBtn = page.locator('.hd-tool[aria-label="返回"]')
  assert(await backBtn.isEnabled() === true, '顶栏返回弯箭头可用')
  await backBtn.click()
  await page.waitForURL('**/case-study')
  assert(page.url().includes('/case-study'), '顶栏返回回到 /case-study')

  if (errors.length) {
    console.log('CONSOLE/PAGE ERRORS:\n' + errors.join('\n'))
    process.exit(2)
  }
  console.log('ERRORS: none')
  await browser.close()
  console.log('LAB OP-CHAIN FLOW PASS')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
