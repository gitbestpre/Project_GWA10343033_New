const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:5174';
const SHOTS = [
  { route: '/', file: 'stage-home-1366.png' },
  { route: '/case-study', file: 'stage-case-1366.png' },
  { route: '/knowledge', file: 'stage-knowledge-1366.png' },
  { route: '/epidemiology', file: 'stage-player-1366.png' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  for (const s of SHOTS) {
    await page.goto(BASE + s.route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'screenshots/' + s.file });
    console.log('saved', s.file);
  }
  await browser.close();
})();
