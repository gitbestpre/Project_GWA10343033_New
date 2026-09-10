const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const tools = await page.$('.hd-tools');
  await tools.screenshot({ path: 'screenshots/header-icons-zoom.png' });
  await browser.close();
  console.log('done');
})();
