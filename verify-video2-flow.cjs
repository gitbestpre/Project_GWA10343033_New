const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:5174/epidemiology';

async function skipToQuiz(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.evaluate(async () => {
    const v = document.querySelector('video');
    await new Promise((res) => { if (v.readyState >= 1) return res(); v.addEventListener('loadedmetadata', res, { once: true }); });
    v.currentTime = Math.max(0, (v.duration || 1) - 0.3);
    v.muted = true;
    await v.play().catch(() => {});
  });
  await page.waitForFunction(() => !!document.querySelector('.epi-quiz'), { timeout: 20000 });
}

async function state(page) {
  return page.evaluate(() => ({
    src: document.querySelector('video')?.getAttribute('src'),
    paused: document.querySelector('video')?.paused,
    quiz: !!document.querySelector('.epi-quiz'),
    badge: document.querySelector('.epi-badge-pill')?.textContent?.trim() || null,
    options: document.querySelectorAll('.epi-option').length,
    disabled: Array.from(document.querySelectorAll('.epi-option')).map((b) => b.disabled),
    correctKeys: Array.from(document.querySelectorAll('.epi-option-key.is-correct')).map((e) => e.textContent.trim()),
    wrongKeys: Array.from(document.querySelectorAll('.epi-option-key.is-wrong')).map((e) => e.textContent.trim()),
    resultText: document.querySelector('.epi-quiz-result-text')?.textContent?.trim() || null,
    countdown: document.querySelector('.epi-quiz-result-count')?.textContent?.trim() || null,
    hasResult: !!document.querySelector('.epi-quiz-result'),
  }));
}

async function clickOption(page, key) {
  await page.evaluate((k) => {
    const btns = Array.from(document.querySelectorAll('.epi-option'));
    const target = btns.find((b) => b.querySelector('.epi-option-key')?.textContent.trim() === k);
    target.click();
  }, key);
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const results = [];

  // ---------- 分支 A：答错 ----------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await skipToQuiz(page);
    const q0 = await state(page);
    results.push(['A1 视频1结束后出题且5选项', q0.quiz === true && q0.options === 5 && q0.badge === '案例描述']);

    await clickOption(page, 'A'); // H_01 正确答案 C，选 A 为错
    await page.click('.epi-quiz-submit');
    await page.waitForTimeout(300);
    const wrong = await state(page);
    results.push(['A2 答错后锁定选项', wrong.disabled.length === 5 && wrong.disabled.every(Boolean)]);
    results.push(['A3 高亮正确答案C', wrong.correctKeys.join(',') === 'C']);
    results.push(['A4 标记错选A', wrong.wrongKeys.join(',') === 'A']);
    results.push(['A5 结果文案含正确答案', /回答错误.*正确答案.*C/.test(wrong.resultText || '')]);
    results.push(['A6 倒计时显示5秒', /5\s*秒后进入下一步/.test(wrong.countdown || '')]);
    await page.screenshot({ path: 'screenshots/player-wrong-answer.png' });

    // 1 秒后倒计时应递减
    await page.waitForTimeout(1100);
    const mid = await state(page);
    results.push(['A7 倒计时1秒后递减为4', /4\s*秒后进入下一步/.test(mid.countdown || '')]);

    // 到 5 秒应自动切到 2.mp4（再多等 1.5s 余量）
    await page.waitForTimeout(4600);
    const moved = await state(page);
    results.push(['A8 停留约5秒后自动播放2.mp4', moved.src === '/Video/2.mp4' && moved.quiz === false]);
    results.push(['A9 2.mp4确实在播放', moved.paused === false]);
    results.push(['A10 徽标切换为接到报告', moved.badge === '接到报告']);
    await page.screenshot({ path: 'screenshots/player-video2.png' });
    await page.close();
  }

  // ---------- 分支 B：答对 ----------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await skipToQuiz(page);
    await clickOption(page, 'C'); // 正确答案
    await page.click('.epi-quiz-submit');
    // 答对应立即跳转，无需等待 5 秒
    await page.waitForTimeout(500);
    const ok = await state(page);
    results.push(['B1 答对立即切到2.mp4', ok.src === '/Video/2.mp4' && ok.quiz === false]);
    results.push(['B2 2.mp4在播放', ok.paused === false]);
    await page.close();
  }

  // ---------- 2.mp4 端点 Range ----------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const probe = await page.evaluate(async () => {
      const r = await fetch('/Video/2.mp4', { headers: { Range: 'bytes=0-2047' } });
      return { status: r.status, type: r.headers.get('content-type'), got: (await r.arrayBuffer()).byteLength };
    });
    results.push(['C1 2.mp4端点206且video/mp4', probe.status === 206 && probe.type === 'video/mp4' && probe.got === 2048]);
    await page.close();
  }

  await browser.close();

  let pass = 0;
  for (const [name, ok] of results) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length}`);
  console.log(pass === results.length ? 'VIDEO2 FLOW PASS' : 'VIDEO2 FLOW FAIL');
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
