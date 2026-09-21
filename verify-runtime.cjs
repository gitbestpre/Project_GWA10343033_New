// 运行时巡检：打开各路由，采集 console/pageerror/失败请求，校验关键媒体，截图。
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')

const BASE = 'http://localhost:5174'
const SHOT_DIR = path.join(__dirname, 'screenshots', 'runtime')
fs.mkdirSync(SHOT_DIR, { recursive: true })
const RESULT = path.join(__dirname, 'verify-runtime-result.txt')

const routes = [
  { p: '/', name: 'home', wait: 1200 },
  { p: '/knowledge', name: 'knowledge', wait: 1500 },
  { p: '/case-study', name: 'case-study', wait: 1200 },
  { p: '/epidemiology', name: 'epidemiology', wait: 4000 }
]

;(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required']
  })
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const page = await context.newPage()

  const summary = []

  for (const r of routes) {
    const consoleErrors = []
    const consoleWarnings = []
    const pageErrors = []
    const failedReq = []
    const http4xx = []
    const mediaStatus = {}

    const onConsole = m => {
      const t = m.type()
      const txt = m.text()
      if (t === 'error') consoleErrors.push(txt)
      else if (t === 'warning') consoleWarnings.push(txt)
    }
    const onPageErr = e => pageErrors.push(e.message)
    const onReqFailed = req => failedReq.push(req.url() + ' :: ' + (req.failure() && req.failure().errorText))
    const onResp = resp => {
      const u = resp.url()
      const st = resp.status()
      if (/\/Video\/|\/Audio\//.test(u)) mediaStatus[u.replace(BASE, '')] = st
      if (u.includes('Ellipse%2033') || u.includes('Ellipse 33')) mediaStatus['/images/Ellipse33.png'] = st
      if (st >= 400) http4xx.push(st + ' ' + u.replace(BASE, ''))
    }

    page.on('console', onConsole)
    page.on('pageerror', onPageErr)
    page.on('requestfailed', onReqFailed)
    page.on('response', onResp)

    let navError = null
    try {
      await page.goto(BASE + r.p, { waitUntil: 'load', timeout: 30000 })
    } catch (e) {
      navError = e.message
    }
    await page.waitForTimeout(r.wait)

    // 播放页：检查视频真实状态
    let videoInfo = null
    if (r.name === 'epidemiology') {
      videoInfo = await page.evaluate(() => {
        const v = document.querySelector('video')
        if (!v) return { hasVideo: false }
        return {
          hasVideo: true,
          src: v.currentSrc || v.src,
          paused: v.paused,
          readyState: v.readyState,
          networkState: v.networkState,
          duration: Number.isFinite(v.duration) ? Math.round(v.duration) : null
        }
      })
    }

    await page.screenshot({ path: path.join(SHOT_DIR, r.name + '.png') })

    page.off('console', onConsole)
    page.off('pageerror', onPageErr)
    page.off('requestfailed', onReqFailed)
    page.off('response', onResp)

    summary.push({
      route: r.p,
      navError,
      title: await page.title().catch(() => ''),
      consoleErrors: [...new Set(consoleErrors)],
      consoleWarnings: [...new Set(consoleWarnings)].slice(0, 8),
      pageErrors: [...new Set(pageErrors)],
      failedReq: [...new Set(failedReq)],
      http4xx: [...new Set(http4xx)],
      mediaStatus,
      videoInfo
    })
  }

  await browser.close()

  const lines = []
  let problems = 0
  for (const s of summary) {
    lines.push('===== ROUTE ' + s.route + ' =====')
    lines.push('title: ' + s.title)
    if (s.navError) { lines.push('NAV ERROR: ' + s.navError); problems++ }
    lines.push('console.error count: ' + s.consoleErrors.length)
    s.consoleErrors.forEach(e => lines.push('  [console.error] ' + e))
    lines.push('pageerror count: ' + s.pageErrors.length)
    s.pageErrors.forEach(e => lines.push('  [pageerror] ' + e))
    lines.push('requestfailed count: ' + s.failedReq.length)
    s.failedReq.forEach(e => lines.push('  [reqfailed] ' + e))
    lines.push('http>=400 count: ' + s.http4xx.length)
    s.http4xx.forEach(e => lines.push('  [http] ' + e))
    if (Object.keys(s.mediaStatus).length) lines.push('media: ' + JSON.stringify(s.mediaStatus))
    if (s.videoInfo) lines.push('video: ' + JSON.stringify(s.videoInfo))
    if (s.consoleErrors.length || s.pageErrors.length || s.failedReq.length || s.http4xx.length || s.navError) problems++
    lines.push('')
  }
  lines.unshift('TOTAL ROUTES WITH PROBLEM: ' + problems + ' / ' + summary.length)
  fs.writeFileSync(RESULT, lines.join('\n'), 'utf8')
  console.log(lines.join('\n'))
})().catch(e => {
  fs.writeFileSync(RESULT, 'SCRIPT FATAL: ' + e.stack, 'utf8')
  console.error(e)
  process.exit(1)
})
