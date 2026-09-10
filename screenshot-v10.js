const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('http://localhost:5173/knowledge');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/knowledge-v10-welcome.png' });

  await page.getByRole('button', { name: /知识科普/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'screenshots/knowledge-v10-learning.png' });

  await browser.close();
  console.log('done');
})();
