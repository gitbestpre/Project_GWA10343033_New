const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 3 });
  await page.goto('http://127.0.0.1:5174/epidemiology', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const nav = await page.$('.epi-nav');
  await nav.screenshot({ path: 'screenshots/player-nav-icons.png' });
  await browser.close();
  console.log('done');
})();
