const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Navigate to knowledge page and click on module 4 tab
  await page.goto('http://localhost:5173/knowledge');
  await page.waitForTimeout(1000);
  
  // Click on "预防策略与控制体系" tab (4th tab)
  const tabs = await page.locator('button').all();
  for (const tab of tabs) {
    const text = await tab.textContent();
    if (text && text.includes('预防策略与控制体系')) {
      await tab.click();
      break;
    }
  }
  
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/knowledge-module4-v7.png', fullPage: true });

  await browser.close();
  console.log('Module 4 screenshot captured successfully.');
})();
