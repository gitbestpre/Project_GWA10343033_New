const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:5174';
const ROUTES = ['/', '/knowledge', '/case-study', '/epidemiology', '/epidemiology-v2'];
const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1366x768',  width: 1366, height: 768 },
  { name: '1536x864',  width: 1536, height: 864 },
  { name: '2560x1080', width: 2560, height: 1080 },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  let failures = 0;

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    const expected = Math.min(vp.width / 1920, vp.height / 1080);

    for (const route of ROUTES) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      const m = await page.evaluate(() => {
        const c = document.querySelector('.stage-canvas');
        if (!c) return { missing: true };
        const cs = getComputedStyle(c);
        const t = new DOMMatrix(cs.transform);
        const r = c.getBoundingClientRect();
        return {
          offsetW: c.offsetWidth,
          offsetH: c.offsetHeight,
          scale: +t.a.toFixed(4),
          rectW: +r.width.toFixed(2),
          rectH: +r.height.toFixed(2),
          cx: +(r.left + r.width / 2).toFixed(2),
          cy: +(r.top + r.height / 2).toFixed(2),
          docScrollW: document.documentElement.scrollWidth,
          bodyScrollW: document.body.scrollWidth,
        };
      });

      const problems = [];
      if (m.missing) {
        problems.push('NO .stage-canvas');
      } else {
        if (m.offsetW !== 1920 || m.offsetH !== 1080)
          problems.push(`stage size=${m.offsetW}x${m.offsetH}`);
        if (Math.abs(m.scale - +expected.toFixed(4)) > 0.002)
          problems.push(`scale=${m.scale} expected=${+expected.toFixed(4)}`);
        if (Math.abs(m.rectW - +(1920 * expected).toFixed(2)) > 1.5)
          problems.push(`visualW=${m.rectW} expected=${+(1920 * expected).toFixed(2)}`);
        if (Math.abs(m.cx - vp.width / 2) > 1.5 || Math.abs(m.cy - vp.height / 2) > 1.5)
          problems.push(`center=(${m.cx},${m.cy}) expected=(${vp.width / 2},${vp.height / 2})`);
        if (m.docScrollW > vp.width + 1)
          problems.push(`horizontal overflow docScrollW=${m.docScrollW} > ${vp.width}`);
      }

      const status = problems.length ? 'FAIL' : 'PASS';
      if (problems.length) failures++;
      console.log(
        `[${status}] ${vp.name.padEnd(10)} ${route.padEnd(18)} ` +
        (problems.length ? problems.join(' | ') : `1920x1080 scale=${m.scale} centered`)
      );
    }
    await context.close();
  }

  await browser.close();
  console.log(failures === 0 ? 'ALL PASS' : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
