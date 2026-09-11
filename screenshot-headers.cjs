const { chromium } = require('playwright');

const pages = [
  { path: '/', file: 'header-home' },
  { path: '/case-study', file: 'header-case' },
  { path: '/knowledge', file: 'header-knowledge' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  for (const p of pages) {
    await page.goto('http://127.0.0.1:5174' + p.path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const el = await page.$('.app-header');
    if (el) {
      await el.screenshot({ path: `screenshots/${p.file}.png` });
    } else {
      await page.screenshot({ path: `screenshots/${p.file}.png` });
    }
    console.log('done', p.file);
  }
  await browser.close();
})();
