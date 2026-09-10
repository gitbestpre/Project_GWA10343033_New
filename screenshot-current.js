const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://localhost:5173/knowledge');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/knowledge-current.png', fullPage: true });

  await browser.close();
  console.log('done');
})();
