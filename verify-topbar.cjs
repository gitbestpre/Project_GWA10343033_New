const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:5174';
// 页面 -> 顶栏变体（是否含阶段标签）
const PAGES = [
  { route: '/', variant: 'home' },
  { route: '/knowledge', variant: 'knowledge' },
  { route: '/case-study', variant: 'case' },
  { route: '/epidemiology', variant: 'player' },
];

// Figma 帧内期望坐标（相对 1920 舞台左缘/顶缘）
const FIGMA = {
  logoL: 15, logoR: 247, logoH: 58,
  dividerBrandL: 262,
  titleL: 275,
  scoreL: 1108, scoreR: 1334,
  timeL: 1364, timeR: 1637,
  toolsL: 1673, toolsR: 1897,
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const rows = {};
  for (const p of PAGES) {
    await page.goto(BASE + p.route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const stage = document.querySelector('.stage-canvas').getBoundingClientRect();
      const rel = (el) => {
        const r = el.getBoundingClientRect();
        return { l: +(r.left - stage.left).toFixed(1), r: +(r.right - stage.left).toFixed(1),
                 t: +(r.top - stage.top).toFixed(1), h: +r.height.toFixed(1) };
      };
      const logo = document.querySelector('.hd-logo');
      const divider = document.querySelector('.hd-divider-brand');
      const titles = document.querySelector('.hd-titles');
      const score = document.querySelector('.hd-score-card');
      const time = document.querySelector('.hd-time-card');
      const tools = document.querySelector('.hd-tools');
      const stageTag = document.querySelector('.hd-stage');
      return {
        logo: logo ? rel(logo) : null,
        divider: divider ? rel(divider) : null,
        titles: titles ? rel(titles) : null,
        score: score ? rel(score) : null,
        time: time ? rel(time) : null,
        tools: tools ? rel(tools) : null,
        stageTag: stageTag ? rel(stageTag) : null,
      };
    });
    rows[p.variant] = m;
    await page.screenshot({ path: `screenshots/topbar-${p.variant}.png` });
  }
  await browser.close();

  // 输出坐标表
  const keys = ['logo', 'divider', 'titles', 'score', 'time', 'tools', 'stageTag'];
  for (const k of keys) {
    const line = [];
    for (const p of PAGES) {
      const v = rows[p.variant][k];
      line.push(`${p.variant}:${v ? `${v.l}→${v.r}` : '—'}`);
    }
    console.log(k.padEnd(9), line.join('   '));
  }

  // 断言共有元素在所有页面坐标一致
  const shared = ['logo', 'divider', 'titles', 'tools'];
  let fail = 0;
  for (const k of shared) {
    const ref = rows.home[k];
    for (const p of PAGES) {
      const v = rows[p.variant][k];
      if (!v || Math.abs(v.l - ref.l) > 1 || Math.abs(v.r - ref.r) > 1) {
        console.log(`MISMATCH ${k} home=${JSON.stringify(ref)} ${p.variant}=${JSON.stringify(v)}`);
        fail++;
      }
    }
  }
  // 播放页/案例页得分卡坐标应等于 Figma
  for (const p of ['case', 'player']) {
    const s = rows[p].score, t = rows[p].time;
    const check = (name, val, exp) => { if (val == null || Math.abs(val - exp) > 2) { console.log(`FIGMA ${p}.${name}=${val} expected~${exp}`); fail++; } };
    check('scoreL', s && s.l, FIGMA.scoreL);
    check('scoreR', s && s.r, FIGMA.scoreR);
    check('timeL', t && t.l, FIGMA.timeL);
    check('timeR', t && t.r, FIGMA.timeR);
    const tl = rows[p].tools;
    check('toolsL', tl && tl.l, FIGMA.toolsL);
    check('toolsR', tl && tl.r, FIGMA.toolsR);
    check('logoL', rows[p].logo && rows[p].logo.l, FIGMA.logoL);
  }
  // 播放页应有阶段标签且居中于 771-1055
  const st = rows.player.stageTag;
  if (!st || Math.abs(st.l - 771) > 2 || Math.abs(st.r - 1055) > 2) {
    console.log(`FIGMA player.stageTag=${JSON.stringify(st)} expected 771→1055`); fail++;
  } else {
    console.log('\nplayer stageTag', st.l, '→', st.r, '(Figma 771→1055) OK');
  }

  console.log(fail === 0 ? '\nALL TOPBAR CHECKS PASS' : `\n${fail} TOPBAR CHECK(S) FAILED`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
