const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://localhost:5173/knowledge');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/knowledge-v9-welcome.png', fullPage: true });

  await page.getByRole('button', { name: /知识科普/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'screenshots/knowledge-v9-learning.png', fullPage: true });

  await browser.close();
  console.log('done');
})();
