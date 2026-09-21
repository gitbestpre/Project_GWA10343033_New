/* 食品卫生学调查播放器链路验证（1920x1080，headless 允许自动播放）。
 * 链路：/food-hygiene → 21.mp4(徽标) → H_08 → 11.mp4 → H_09 → H_10 → 重要环节弹窗(确定) → /case-study
 * 运行：node verify-food-hygiene.cjs
 */
const { chromium } = require('playwright')

const BASE = process.env.BASE_URL || 'http://localhost:5174'
const results = []
function check(name, cond, extra) {
  results.push({ name, pass: !!cond, extra: extra || '' })
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${extra ? ' :: ' + extra : ''}`)
}

async function pickAnswers(page, keys) {
  for (const k of keys) {
    await page.locator('.epi-option-key', { hasText: new RegExp(`^${k}$`) }).click()
  }
  await page.locator('.epi-quiz-submit').click()
}

async function endBgVideo(page, file) {
  const v = page.locator(`video.epi-video[src*="${file}"]`)
  await v.waitFor({ state: 'attached', timeout: 8000 })
  await page.locator(`video.epi-video[src*="${file}"]`).evaluate((el) => {
    el.dispatchEvent(new Event('ended', { bubbles: true }))
  })
}

;(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
  })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

  await page.goto(BASE + '/food-hygiene', { waitUntil: 'networkidle' })

  // 初始：视频21 + 徽标 + 阶段标签
  await page.waitForSelector('video.epi-video[src*="21.mp4"]', { timeout: 8000 })
  check('初始播放 21.mp4', await page.locator('video.epi-video[src*="21.mp4"]').count() === 1)
  check('徽标文案=采样前的准备工作', (await page.locator('.fh-badge-text').textContent()).includes('采样前的准备工作'),
    await page.locator('.fh-badge-text').textContent())
  check('顶栏阶段标签=食品卫生学调查', (await page.locator('.hd-stage-tag').textContent()).includes('食品卫生学调查'),
    await page.locator('.hd-stage-tag').textContent())

  // 21 结束 → H_08
  await endBgVideo(page, '21.mp4')
  await page.waitForSelector('.epi-quiz-mask', { timeout: 5000 })
  check('21 播完弹出题卡', await page.locator('.epi-quiz-mask').count() === 1)
  check('H_08 题干正确', (await page.locator('.epi-quiz-question').textContent()).includes('食品卫生学调查主要包括哪几方面内容'),
    (await page.locator('.epi-quiz-question').textContent() || '').trim().slice(0, 30))
  check('H_08 为多选题徽标', (await page.locator('.epi-quiz-type').textContent()).includes('多选题'))

  // H_08 答案 ABCD → 视频11
  await pickAnswers(page, ['A', 'B', 'C', 'D'])
  await page.waitForSelector('video.epi-video[src*="11.mp4"]', { timeout: 5000 })
  check('H_08 答对后切到 11.mp4', await page.locator('video.epi-video[src*="11.mp4"]').count() === 1)

  // 11 结束 → H_09（01/02）
  await endBgVideo(page, '11.mp4')
  await page.waitForSelector('.epi-quiz-mask', { timeout: 5000 })
  check('11 播完弹出题卡', await page.locator('.epi-quiz-mask').count() === 1)
  check('H_09 题干正确', (await page.locator('.epi-quiz-question').textContent()).includes('采样前，可查阅哪些相关记录'),
    (await page.locator('.epi-quiz-question').textContent() || '').trim().slice(0, 30))
  check('H_09 页码 01/02', (await page.locator('.epi-quiz-page').textContent()).replace(/\s/g, '').includes('01/02'),
    (await page.locator('.epi-quiz-page').textContent()).replace(/\s/g, ''))

  // H_09 答案 ABCDE → H_10
  await pickAnswers(page, ['A', 'B', 'C', 'D', 'E'])
  await page.waitForFunction(() => document.body.innerText.includes('采样时应记录'), { timeout: 5000 })
  check('H_10 题干正确', (await page.locator('.epi-quiz-question').textContent()).includes('采样时应记录哪些内容'))
  check('H_10 页码 02/02', (await page.locator('.epi-quiz-page').textContent()).replace(/\s/g, '').includes('02/02'),
    (await page.locator('.epi-quiz-page').textContent()).replace(/\s/g, ''))

  // H_10 答案 ABCDE → 重要环节弹窗
  await pickAnswers(page, ['A', 'B', 'C', 'D', 'E'])
  await page.waitForSelector('.ks-card', { timeout: 5000 })
  check('重要环节弹窗出现', await page.locator('.ks-card').count() === 1)
  check('弹窗标题正确', (await page.locator('.ks-head-title').textContent()).includes('不同致病因子类型食品卫生学调查重点环节'))
  check('新增确定按钮存在且文字=确定', (await page.locator('.ks-confirm').textContent()).replace(/\s/g, '') === '确定',
    (await page.locator('.ks-confirm').textContent()).replace(/\s/g, ''))
  const tableOk = await page.locator('.ks-table').evaluate((el) => el.complete && el.naturalWidth > 0)
  check('表格配图加载成功', tableOk)
  check('11.mp4 末帧仍为弹窗背景', await page.locator('video.epi-video[src*="11.mp4"]').count() === 1)
  await page.screenshot({ path: 'screenshots/food-keystep.png' })

  // 点确定 → 回模块选择页
  await page.locator('.ks-confirm').click()
  await page.waitForURL('**/case-study', { timeout: 5000 })
  check('确定后跳转 /case-study', page.url().includes('/case-study'), page.url())

  const consoleErrors = errors.filter((e) => !e.includes('favicon') && !e.includes('Download the React DevTools'))
  check('无 console/page 错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} PASS`)
  process.exit(failed.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
