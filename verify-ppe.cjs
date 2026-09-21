/* 食品卫生学调查：重要环节→提示弹窗→7图叠加穿戴画面 E2E */
const { chromium } = require('playwright')
const OUT = 'C:/Users/QWE/WorkBuddy/2026-09-10-11-06-42'

;(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
  let pass = 0, fail = 0
  const ok = (name, cond, extra = '') => {
    if (cond) { pass++; console.log('PASS -', name, extra ? ':: ' + extra : '') }
    else { fail++; console.log('FAIL -', name, extra ? ':: ' + extra : '') }
  }
  const ff = async (ms = 30000) => {
    await page.waitForFunction(() => {
      const v = document.querySelector('.epi-stage video')
      return v && v.duration > 0 && !v.paused
    }, { timeout: ms })
    await page.evaluate(() => {
      const v = document.querySelector('.epi-stage video')
      v.currentTime = v.duration - 0.05
      v.dispatchEvent(new Event('ended'))
    })
  }
  const answer = async (nths) => {
    for (const n of nths) {
      await page.click(`.epi-quiz-options .epi-option:nth-child(${n})`)
    }
    await page.click('.epi-quiz-submit')
    await page.waitForTimeout(200)
  }

  await page.goto('http://localhost:5174/food-hygiene', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  // 走链路：21 → H_08 → 11 → H_09 → H_10 → keyStep
  await ff()
  await page.waitForSelector('.epi-quiz-mask', { timeout: 5000 }); ok('H_08 出现', true)
  await answer([1, 2, 3]) // H_08 多选（正确答案见题库，这里全选前三）
  await page.waitForTimeout(6500) // 等判题推进（错则 5s）
  await ff()
  await page.waitForSelector('.epi-quiz-mask', { timeout: 5000 }); ok('H_09 出现', true)
  await answer([1, 2, 3, 4]); await page.waitForTimeout(6500)
  await page.waitForSelector('.epi-quiz-mask', { timeout: 8000 }); ok('H_10 出现', true)
  await answer([1, 2, 3, 4]); await page.waitForTimeout(6500)
  await page.waitForSelector('.ks-card', { timeout: 8000 }); ok('重要环节弹窗出现', true)

  // → 确定 → 提示弹窗
  await page.click('.ks-confirm')
  await page.waitForSelector('.ph-card', { timeout: 5000 }); ok('提示弹窗出现', true)
  const phTitle = await page.$eval('.ph-head-title', e => e.textContent)
  ok('提示标题=提示', phTitle === '提示', phTitle)
  const phBody = await page.$eval('.ph-body', e => e.textContent)
  ok('提示正文=采样前穿戴个人防护设备', phBody === '采样前穿戴个人防护设备', phBody)
  const phAck = await page.$eval('.ph-ack', e => e.textContent)
  ok('按钮=我已了解', phAck.includes('我已了解'), phAck)
  const phBox = await (await page.$('.ph-card')).boundingBox()
  ok('提示卡 550x340@(685,370)', Math.abs(phBox.x - 685) < 2 && Math.abs(phBox.y - 370) < 2 && Math.abs(phBox.width - 550) < 2 && Math.abs(phBox.height - 340) < 2, JSON.stringify(phBox))
  const ackBox = await (await page.$('.ph-ack')).boundingBox()
  ok('我已了解 191x60 卡内(180,240)', Math.abs(ackBox.width - 191) < 2 && Math.abs(ackBox.height - 60) < 2, JSON.stringify(ackBox))
  await page.screenshot({ path: `${OUT}/.ppe1-hint.png` })

  // → 我已了解 → 穿戴画面
  await page.click('.ph-ack')
  await page.waitForSelector('.pd-layer', { timeout: 5000 }); ok('穿戴画面出现', true)
  const sceneImgs = await page.$$eval('.pd-scene img', els => els.map(e => ({ src: e.src.split('/').pop(), nw: e.naturalWidth })))
  ok('场景 7 图全部加载', sceneImgs.length === 7 && sceneImgs.every(i => i.nw > 0), JSON.stringify(sceneImgs.map(i => i.src)))
  const items = await page.$$eval('.pd-item', els => els.map(e => ({
    label: e.querySelector('.pd-item-label').textContent,
    step: e.querySelector('.pd-item-step') ? e.querySelector('.pd-item-step').textContent : null,
    x: e.getBoundingClientRect().x, y: e.getBoundingClientRect().y, w: e.getBoundingClientRect().width,
  })))
  ok('8 个道具按钮', items.length === 8, JSON.stringify(items.map(i => i.label)))
  ok('角标 1/2/3 = 手消毒/一次性帽子/防护服',
    items.find(i => i.label === '手消毒')?.step === '1' &&
    items.find(i => i.label === '一次性帽子')?.step === '2' &&
    items.find(i => i.label === '防护服')?.step === '3')
  const icons = await page.$$eval('.pd-item-icon', els => els.map(e => e.naturalWidth))
  ok('道具图标全部加载', icons.every(w => w > 0), JSON.stringify(icons))
  const panel = await (await page.$('.pd-panel')).boundingBox()
  ok('面板 540x944@(30,103)', Math.abs(panel.x - 30) < 2 && Math.abs(panel.y - 103) < 2 && Math.abs(panel.width - 540) < 2 && Math.abs(panel.height - 944) < 2, JSON.stringify(panel))
  const submit = await (await page.$('.pd-submit')).boundingBox()
  ok('提交 240x84@(1640,956)', Math.abs(submit.x - 1640) < 2 && Math.abs(submit.y - 956) < 2 && Math.abs(submit.width - 240) < 2 && Math.abs(submit.height - 84) < 2, JSON.stringify(submit))
  const title = await page.$eval('.pd-panel-title', e => e.textContent)
  ok('面板标题=防护用品道具栏', title === '防护用品道具栏', title)
  await page.screenshot({ path: `${OUT}/.ppe2-dressing.png` })

  // → 提交 → 临时闭环 /case-study
  await page.click('.pd-submit')
  await page.waitForURL('**/case-study', { timeout: 5000 }); ok('提交后回 /case-study', true, page.url())

  ok('无 console/page 错误', errors.length === 0, errors.join(' || ').slice(0, 200))
  console.log(`\n${pass}/${pass + fail} PASS`)
  await browser.close()
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => { console.error('FATAL', e); process.exit(1) })
