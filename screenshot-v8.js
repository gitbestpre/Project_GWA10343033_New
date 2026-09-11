const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/homepage-v8.png', fullPage: true });

  await page.goto('http://localhost:5173/knowledge');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/knowledge-page-v8.png', fullPage: true });

  await page.goto('http://localhost:5173/case-study');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/case-study-page-v8.png', fullPage: true });

  await browser.close();
  console.log('done');
})();
