const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // 1) 直接打开 case-study（模拟刷新/直达），点返回，应回首页
  await page.goto('http://127.0.0.1:5174/case-study', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const tools = page.locator('.hd-tool');
  const backOnCase = tools.nth(2);
  console.log('case-study back disabled =', await backOnCase.isDisabled());
  await backOnCase.click();
  await page.waitForTimeout(500);
  console.log('after case-study back ->', new URL(page.url()).pathname);

  // 2) 首页进入 knowledge，点返回，应回首页
  await page.goto('http://127.0.0.1:5174/knowledge', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.locator('.hd-tool').nth(2).click();
  await page.waitForTimeout(500);
  console.log('after knowledge back ->', new URL(page.url()).pathname);

  // 3) 首页返回按钮应禁用
  await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  console.log('home back disabled =', await page.locator('.hd-tool').nth(2).isDisabled());

  // 4) 播放页 onBack -> /case-study
  await page.goto('http://127.0.0.1:5174/epidemiology', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.locator('.epi-nav-btn').nth(2).click();
  await page.waitForTimeout(500);
  console.log('after player back ->', new URL(page.url()).pathname);

  await browser.close();
  console.log('DONE');
})();
