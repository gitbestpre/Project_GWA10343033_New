/* 知识宣教页（/knowledge）排版与按钮热区验证
 *
 * 基准来源：Figma frame 231:1172「基础知识」
 *   - 节点树（absoluteBoundingBox）→ 精确几何
 *   - 渲染图 figma-kb-231.png 像素扫描 → 交叉校验
 * 本脚本对每条基准做「实机几何断言 + 命中测试断言」，并跑一轮交互回归。
 *
 * 用法：先起 dev server，再 `node .verify-knowledge-layout.cjs [base]`
 */
const { chromium } = require('./node_modules/playwright')

const BASE = process.argv[2] || 'http://127.0.0.1:5174'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* Figma 基准表（1920x1080 帧内局部坐标） */
const BASELINE = [
  // 选择器,                        索引, 名称,          x,    y,    w,    h,   tolXW, tolY, tolH
  ['.tutor-zone', 0, 'AI导师面板', 6, 73, 554, 926, 2, 2, 2],
  // Figma 中玻璃列(总览 x1) 与照片面板(患者历史 x6) 是两层独立图层，天然错位 5px。
  // 实机以照片层 x6 对齐（按钮 x14 与 Figma 完全一致），故此项容差放宽到 6px。
  ['.tutor-action-col', 0, '玻璃按钮列', 1, 73, 167, 926, 6, 2, 2],
  ['.sidebar-action-btn', 0, '知识科普按钮', 14, 107, 150, 56, 2, 2, 2],
  ['.sidebar-action-btn', 1, '完成学习按钮', 14, 189, 150, 56, 2, 2, 2],
  // 以下两行是「朗读」功能的**新增**元素，Figma 231:1172 里没有对应图层。
  // 这里不是拿它们跟设计稿比，而是把当前落位钉死成回归基线：
  // 间距沿用 56 高 + 26 间隔，分隔线必须仍停在 y=590（新增行不得把它顶下去）。
  // 音色选择行原在此处（y271），已按负责人要求撤除 → 朗读按钮由 y353 上移到 y271。
  ['.tts-read-btn', 0, '朗读本页按钮', 14, 271, 150, 56, 2, 2, 2],
  ['.sidebar-divider', 0, '左列分隔线', 14, 590, 140, 1, 2, 2, 2],
  ['.hide-tutor-btn', 0, '隐藏AI导师', 522, 443, 35, 111, 2, 2, 2],
  ['.control-btn', 0, '导师静音键', 507, 85, 40, 40, 3, 3, 3],
  ['.control-btn', 1, '导师朗读键', 507, 151, 40, 40, 3, 3, 3],
  ['.knowledge-content', 0, '内容白卡', 584, 85, 1324, 903, 2, 2, 2],
  ['.tab-btn', 0, '标签1', 604, 96, 174, 56, 2, 2, 2],
  ['.tab-btn', 1, '标签2', 793, 96, 174, 56, 2, 2, 2],
  ['.tab-btn', 2, '标签3', 982, 95, 174, 56, 2, 2, 2],
  ['.tab-btn', 3, '标签4', 1171, 95, 174, 56, 2, 2, 2],
  ['.tab-btn', 4, '标签5', 1360, 95, 206, 56, 3, 2, 2],
  // 标签6 的文字宽度由字体度量决定，Figma 原文本含前导空格 → 宽度差 5px 属素材层差异，
  // 位置与高度仍按 2px 严卡。第 11 位为该行专属宽度容差。
  ['.tab-btn', 5, '标签6', 1581, 95, 195, 56, 2, 2, 2, 6],
  ['.nav-arrow.left-arrow', 0, '左箭头', 610, 507, 60, 60, 2, 2, 2],
  ['.nav-arrow.right-arrow', 0, '右箭头', 1823, 507, 60, 60, 2, 2, 2],
  ['.narrator-dot', 0, '讲解小圆点', 673, 218, 7, 7, 2, 2, 2],
  ['.narrator-avatar', 0, '讲解头像', 692, 201, 40, 40, 2, 2, 2],
  ['.content-card', 0, '正文白卡', 744, 192, 1060, 0, 2, 2, 0], // 高度随内容，只校验 x/y/w
  ['.ai-dialog-bar', 0, '底部对话栏', 0, 1000, 1920, 80, 2, 2, 2],
  ['.voice-btn', 0, '语音按钮', 750, 1019, 42, 42, 3, 3, 3],
  ['.dialog-input', 0, '对话输入框', 808, 1009, 850, 62, 3, 3, 3],
]

/* 热区体检目标：必须存在、有正尺寸、且中心点可命中自身 */
const HITTABLE = [
  ['.sidebar-action-btn', '左列-知识科普'],
  ['.sidebar-action-btn', '左列-完成学习'],
  ['.tts-read-btn', '左列-朗读本页'],
  ['.control-btn', '导师-静音'],
  ['.control-btn', '导师-朗读'],
  ['.hide-tutor-btn', '导师-隐藏AI导师'],
]

let pass = 0
const fails = []
const ok = (cond, label, detail) => {
  if (cond) pass++
  else fails.push(`${label}${detail ? '  ⟶ ' + detail : ''}`)
}

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  page.setDefaultTimeout(20000)
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push('console: ' + m.text())
  })

  await page.goto(BASE + '/knowledge', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.knowledge-page')

  /* 统一测量器：把视口坐标换算回 1920x1080 帧内坐标 */
  const measure = (sel, idx) =>
    page.evaluate(
      ({ sel, idx }) => {
        const kp = document.querySelector('.knowledge-page')
        const kb = kp.getBoundingClientRect()
        const s = kb.width / 1920
        const el = document.querySelectorAll(sel)[idx]
        if (!el) return null
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        const box = {
          x: (r.x - kb.x) / s,
          y: (r.y - kb.y) / s,
          w: r.width / s,
          h: r.height / s,
        }
        let hitSelf = null
        let hitDesc = null
        if (r.width > 0 && r.height > 0) {
          // 中心 + 四角内缩 3px 都要命中自身（热区不被遮挡的充分条件）
          const pts = [
            [r.x + r.width / 2, r.y + r.height / 2],
            [r.x + 3, r.y + 3],
            [r.x + r.width - 3, r.y + 3],
            [r.x + 3, r.y + r.height - 3],
            [r.x + r.width - 3, r.y + r.height - 3],
          ]
          hitSelf = pts.every(([px, py]) => {
            const t = document.elementFromPoint(px, py)
            return t && (el === t || el.contains(t) || t.contains(el))
          })
          const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
          hitDesc = t
            ? `${t.tagName.toLowerCase()}${typeof t.className === 'string' && t.className ? '.' + t.className.trim().split(/\s+/).join('.') : ''}`
            : 'none'
        } else {
          hitSelf = false
          hitDesc = 'none'
        }
        return {
          box,
          hitSelf,
          hitDesc,
          display: cs.display,
          visibility: cs.visibility,
          opacity: cs.opacity,
          pointerEvents: cs.pointerEvents,
          disabled: el.disabled === true,
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24),
        }
      },
      { sel, idx },
    )

  const dump = (label, v) =>
    v
      ? `x${v.box.x.toFixed(1)} y${v.box.y.toFixed(1)} ${v.box.w.toFixed(1)}x${v.box.h.toFixed(1)}`
      : '(元素不存在)'

  console.log('══════════ 1. 初始态（欢迎卡） ══════════')
  // 欢迎态：左列按钮 + 导师按钮必须在位且可命中；标签/正文/箭头不该出现
  for (const [sel, name] of HITTABLE.slice(0, 2)) {
    const v = await measure(sel, 0)
    ok(!!v, `[初始] ${name} 存在`, dump(name, v))
    if (v) {
      ok(v.box.w > 0 && v.box.h > 0, `[初始] ${name} 有正尺寸`, `${v.box.w}x${v.box.h}`)
      ok(v.hitSelf, `[初始] ${name} 中心与四角均可命中`, '实际命中 → ' + v.hitDesc)
    }
  }
  const welcomeVisible = await page.evaluate(() => !!document.querySelector('.welcome-card'))
  ok(welcomeVisible, '[初始] 欢迎卡渲染')
  const tabCount0 = await page.evaluate(() => document.querySelectorAll('.tab-btn').length)
  ok(tabCount0 === 0, '[初始] 未进入学习态时无标签栏', `实际 ${tabCount0} 个`)

  console.log('\n══════════ 2. 进入学习态 ══════════')
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.sidebar-action-btn')).find((x) =>
      (x.textContent || '').includes('知识科普'),
    )
    b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  })
  await sleep(600)
  const tabCount1 = await page.evaluate(() => document.querySelectorAll('.tab-btn').length)
  ok(tabCount1 === 6, '[学习] 6 个模块标签全部渲染', `实际 ${tabCount1}`)
  const cardVisible = await page.evaluate(() => !!document.querySelector('.content-card-inner'))
  ok(cardVisible, '[学习] 正文卡片渲染')

  console.log('\n══════════ 3. 几何比对（基准 = Figma 231:1172） ══════════')
  console.log('  元素                 实机                                  Figma 基准              判定')
  for (const [sel, idx, name, bx, by, bw, bh, tw, ty, th, twid] of BASELINE) {
    const v = await measure(sel, idx)
    if (!v) {
      ok(false, `[几何] ${name} 元素缺失`, sel + `[${idx}]`)
      console.log(`  ${name.padEnd(18)} (元素缺失)`)
      continue
    }
    const wTol = twid === undefined ? tw : twid
    const dx = Math.abs(v.box.x - bx)
    const dy = Math.abs(v.box.y - by)
    const dw = bh ? Math.abs(v.box.w - bw) : 0
    const dh = bh ? Math.abs(v.box.h - bh) : 0
    const bad = dx > tw || dy > ty || dw > wTol || dh > th
    ok(!bad, `[几何] ${name} 与 Figma 一致`, `Δx=${dx.toFixed(1)} Δy=${dy.toFixed(1)} Δw=${dw.toFixed(1)} Δh=${dh.toFixed(1)}`)
    console.log(
      `  ${name.padEnd(18)} ${dump(name, v).padEnd(36)} x${String(bx).padEnd(5)} y${String(by).padEnd(5)} ${bw}x${bh}`.padEnd(96) +
        (bad ? '✗' : '✓'),
    )
  }

  console.log('\n══════════ 4. 按钮热区体检（中心 + 四角） ══════════')
  for (const [sel, name] of HITTABLE) {
    const cnt = await page.evaluate((s) => document.querySelectorAll(s).length, sel)
    ok(cnt > 0, `[热区] ${name} 存在于 DOM`, `匹配 ${cnt} 个`)
    for (let i = 0; i < Math.max(cnt, 1); i++) {
      const v = await measure(sel, i)
      if (!v) continue
      const tag = cnt > 1 ? `${name}[${i}]` : name
      ok(v.box.w > 0 && v.box.h > 0, `[热区] ${tag} 非零尺寸`, `${v.box.w.toFixed(1)}x${v.box.h.toFixed(1)}`)
      ok(v.display !== 'none', `[热区] ${tag} display 可见`, v.display)
      ok(v.visibility === 'visible', `[热区] ${tag} visibility 可见`, v.visibility)
      ok(v.pointerEvents === 'auto', `[热区] ${tag} pointer-events=auto`, v.pointerEvents)
      ok(v.hitSelf, `[热区] ${tag} 中心/四角均命中自身`, `命中 → ${v.hitDesc}`)
      console.log(
        `  ${v.hitSelf && v.box.w > 0 && v.pointerEvents === 'auto' ? '✓' : '✗'} ${tag.padEnd(22)} ${dump(tag, v).padEnd(30)} pe=${v.pointerEvents} op=${v.opacity}`,
      )
    }
  }

  // 反向断言：音色选择行已被负责人明确撤除，不得再出现在左列。
  // （与其删掉相关断言了事，不如立一条「它必须不在」，防止日后被顺手加回来。）
  const voiceRow = await page.evaluate(() => ({
    row: document.querySelectorAll('.tts-voice-row').length,
    select: document.querySelectorAll('.tts-voice-select').length,
  }))
  ok(voiceRow.row === 0, '[撤除] 左列无音色选择行 .tts-voice-row', `${voiceRow.row} 个`)
  ok(voiceRow.select === 0, '[撤除] 无音色下拉 .tts-voice-select', `${voiceRow.select} 个`)
  // 音色固定为默认「女主持人」：状态属性仍要能读出它（换音色入口没了，口径不能跟着丢）
  const fixedVoice = await page.evaluate(
    () => document.querySelector('.knowledge-page')?.dataset.ttsVoice,
  )
  ok(fixedVoice === 'narrator-female', '[撤除] 音色固定为默认女主持人', String(fixedVoice))

  // 全量普查：任何 button/input/select 都不允许零尺寸或不可命中（disabled 除外）
  const zero = await page.evaluate(() => {
    const bad = []
    for (const el of document.querySelectorAll('button, input, select')) {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      if (cs.display === 'none') continue
      if (r.width < 1 || r.height < 1) {
        bad.push(`${el.tagName}.${el.className || el.type} ${r.width}x${r.height}`)
      }
    }
    return bad
  })
  ok(zero.length === 0, '[热区] 无零尺寸可交互元素', zero.join(' | '))

  console.log('\n══════════ 5. 交互回归 ══════════')
  // 5a 切标签 → 高亮迁移且页码归零
  await page.evaluate(() => document.querySelectorAll('.tab-btn')[2].click())
  await sleep(250)
  const tabState = await page.evaluate(() => {
    const ts = Array.from(document.querySelectorAll('.tab-btn'))
    return {
      activeIdx: ts.findIndex((t) => t.classList.contains('active')),
      text: ts[2].textContent,
      heading: document.querySelector('.section-heading')?.textContent,
      leftDisabled: document.querySelector('.nav-arrow.left-arrow')?.disabled,
    }
  })
  ok(tabState.activeIdx === 2, '[交互] 点击标签3后仅标签3高亮', `activeIdx=${tabState.activeIdx}`)
  ok(tabState.leftDisabled === true, '[交互] 切换模块后页码归零（左箭头禁用）', `leftDisabled=${tabState.leftDisabled}`)
  console.log(`  标签3「${tabState.text}」→ 正文首行「${tabState.heading}」`)

  // 5b 翻页 → 左箭头由禁用转为可用
  await page.evaluate(() => document.querySelector('.nav-arrow.right-arrow').click())
  await sleep(250)
  const paged = await page.evaluate(() => ({
    leftDisabled: document.querySelector('.nav-arrow.left-arrow')?.disabled,
    heading: document.querySelector('.section-heading')?.textContent,
  }))
  ok(paged.leftDisabled === false, '[交互] 右箭头翻页后左箭头转为可用')
  console.log(`  翻页后正文首行「${paged.heading}」`)

  // 5c 输入框可输入
  await page.fill('.dialog-input', '食源性疾病的定义是什么')
  const typed = await page.inputValue('.dialog-input')
  ok(typed === '食源性疾病的定义是什么', '[交互] 对话输入框可正常输入', typed)
  await page.fill('.dialog-input', '')

  /* 5d 收起人物卡片 → 只撤照片层、按钮列保留、白卡左移放大；且可再展开。
     ⚠️ 此段原断言是「隐藏导师不影响内容区布局」。负责人改需求为
     「隐藏人物卡片 + 知识科普部分放大左移」后，该断言必须反向 —— 内容区**就该**左移，
     故改为硬约束 x=197 / w=1711，并补「左移量 = 放大量」「按钮列不动」「可还原」三条反向取证。 */
  console.log('\n  ── 5d 收起 / 展开人物卡片 ──')
  const expanded = {
    card: await measure('.knowledge-content', 0),
    col: await measure('.tutor-action-col', 0),
    btn0: await measure('.sidebar-action-btn', 0),
    btn1: await measure('.sidebar-action-btn', 1),
  }
  ok(!!(await measure('.hide-tutor-btn', 0)), '[展开] 照片右缘存在竖排「隐藏AI导师」')

  await page.evaluate(() => document.querySelector('.hide-tutor-btn').click())
  await sleep(520) // 0.28s 过渡必须走完，否则量到的是中间帧
  const photoGone = await page.evaluate(() => !document.querySelector('.tutor-photo-panel'))
  const collapsed = {
    card: await measure('.knowledge-content', 0),
    zone: await measure('.tutor-zone', 0),
    col: await measure('.tutor-action-col', 0),
    btn0: await measure('.sidebar-action-btn', 0),
    btn1: await measure('.sidebar-action-btn', 1),
    read: await measure('.tts-read-btn', 0),
  }

  ok(photoGone, '[收起] 人物照片层已卸载')
  ok(
    !!collapsed.zone && Math.abs(collapsed.zone.box.w - 167) < 2,
    '[收起] 侧栏收窄到只剩按钮列（167）',
    dump('', collapsed.zone),
  )
  ok(
    !!collapsed.col && Math.abs(collapsed.col.box.x - expanded.col.box.x) < 1,
    '[收起] 按钮列未被挪动，仍停在原位',
    `${dump('', expanded.col)} → ${dump('', collapsed.col)}`,
  )
  // 「保留按钮列」的价值就在这三条：功能入口与朗读主控收起后必须仍点得到
  for (const [k, name] of [
    ['btn0', '知识科普'],
    ['btn1', '完成学习'],
    ['read', '停止播放'],
  ]) {
    const v = collapsed[k]
    ok(!!v && v.hitSelf, `[收起] ${name} 仍可见可点`, v ? `命中 → ${v.hitDesc}` : '(元素不存在)')
  }
  ok(
    collapsed.btn0 &&
      Math.abs(collapsed.btn0.box.x - expanded.btn0.box.x) < 1 &&
      Math.abs(collapsed.btn0.box.y - expanded.btn0.box.y) < 1,
    '[收起] 左列按钮几何不变（不因收起而位移）',
    `${dump('', expanded.btn0)} → ${dump('', collapsed.btn0)}`,
  )

  // 白卡左移补位：left 584 → 197（= 列右缘 173 + 原间距 24），right 固定故宽度同步 1324 → 1711
  ok(!!collapsed.card && Math.abs(collapsed.card.box.x - 197) < 2, '[收起] 白卡左移到 x197', dump('', collapsed.card))
  ok(
    !!collapsed.card && Math.abs(collapsed.card.box.w - 1711) < 2,
    '[收起] 白卡放大到 1711 宽',
    `w=${collapsed.card?.box.w.toFixed(1)}`,
  )
  const movedX = expanded.card.box.x - collapsed.card.box.x
  const grewW = collapsed.card.box.w - expanded.card.box.w
  ok(
    Math.abs(movedX - grewW) < 1,
    '[收起] 左移量与放大量相等（右侧固定，位移必然转为增量）',
    `左移 ${movedX.toFixed(1)} / 放大 ${grewW.toFixed(1)}`,
  )
  console.log(
    `  收起：白卡 ${dump('', collapsed.card)}（原 ${dump('', expanded.card)}）；位移 ${movedX.toFixed(1)}px = 放大 ${grewW.toFixed(1)}px`,
  )

  // 还原入口必须出现在按钮列里，否则「隐藏」就是单向的（照片层上的竖排按钮已随之卸载）
  const showBtn = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.sidebar-action-btn')).find((x) =>
      (x.textContent || '').includes('打开AI导师'),
    )
    if (!b) return null
    const r = b.getBoundingClientRect()
    const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return { hit: !!t && (b === t || b.contains(t)), w: r.width, h: r.height }
  })
  ok(
    !!showBtn && showBtn.hit,
    '[收起] 左列出现可点的「打开AI导师」',
    showBtn ? `${showBtn.w.toFixed(0)}x${showBtn.h.toFixed(0)}` : '(未找到)',
  )

  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.sidebar-action-btn')).find((x) =>
      (x.textContent || '').includes('打开AI导师'),
    )
    b.click()
  })
  await sleep(520)
  const restored = {
    card: await measure('.knowledge-content', 0),
    photo: await page.evaluate(() => !!document.querySelector('.tutor-photo-panel')),
    showGone: await page.evaluate(
      () =>
        !Array.from(document.querySelectorAll('.sidebar-action-btn')).some((x) =>
          (x.textContent || '').includes('打开AI导师'),
        ),
    ),
  }
  ok(restored.photo, '[还原] 人物照片层回来了')
  ok(restored.showGone, '[还原] 「打开AI导师」随照片回归而收起')
  ok(
    !!restored.card &&
      Math.abs(restored.card.box.x - expanded.card.box.x) < 1 &&
      Math.abs(restored.card.box.w - expanded.card.box.w) < 1,
    '[还原] 白卡回到展开态几何',
    dump('', restored.card),
  )
  console.log(`  还原：白卡 ${dump('', restored.card)}`)

  console.log('\n══════════ 6. 控制台/页面错误 ══════════')
  ok(errs.length === 0, '[运行时] 无页面错误', errs.slice(0, 3).join(' | '))
  if (errs.length) errs.slice(0, 8).forEach((e) => console.log('  ! ' + e.slice(0, 200)))

  await browser.close()

  console.log('\n' + '─'.repeat(72))
  console.log(`通过 ${pass} 项，失败 ${fails.length} 项`)
  if (fails.length) {
    console.log('\n失败明细：')
    fails.forEach((f, i) => console.log(`  ${i + 1}. ${f}`))
  }
  process.exit(fails.length ? 1 : 0)
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
