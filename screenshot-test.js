const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // HomePage
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/homepage-v9.png', fullPage: true });

  // KnowledgePage
  await page.goto('http://localhost:5173/knowledge');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/knowledge-page-v9.png', fullPage: true });

  // CaseStudyPage
  await page.goto('http://localhost:5173/case-study');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/case-study-page-v9.png', fullPage: true });

  await browser.close();
  console.log('Screenshots captured successfully.');
})();
