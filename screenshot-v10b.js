const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/knowledge');
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /知识科普/ }).click();
  await page.getByRole('button', { name: '预防策略与控制体系' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screenshots/knowledge-v10-module4-p1.png' });
  await page.getByRole('button', { name: '下一页' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screenshots/knowledge-v10-module4-p2.png' });
  await browser.close();
  console.log('done');
})();
