const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://127.0.0.1:5174/epidemiology', { waitUntil: 'domcontentloaded' });

  // 1) 视频端点：Range 请求应 206 且可读到字节
  const probe = await page.evaluate(async () => {
    const r = await fetch('/Video/1.mp4', { headers: { Range: 'bytes=0-2047' } });
    const buf = await r.arrayBuffer();
    return { status: r.status, type: r.headers.get('content-type'),
             range: r.headers.get('content-range'), got: buf.byteLength };
  });
  console.log('VIDEO ENDPOINT:', JSON.stringify(probe));

  await page.waitForTimeout(800);
  // 2) 初始不应有选择题，视频应在播放
  const before = await page.evaluate(() => ({
    quiz: !!document.querySelector('.epi-quiz'),
    src: document.querySelector('video')?.getAttribute('src'),
    paused: document.querySelector('video')?.paused,
    readyState: document.querySelector('video')?.readyState,
  }));
  console.log('BEFORE ENDED:', JSON.stringify(before));

  // 3) 跳到接近结尾，等待真实 ended
  await page.evaluate(async () => {
    const v = document.querySelector('video');
    await new Promise((res) => { if (v.readyState >= 1) return res(); v.addEventListener('loadedmetadata', res, { once: true }); });
    v.currentTime = Math.max(0, (v.duration || 1) - 0.3);
    v.muted = true;
    await v.play().catch(() => {});
  });
  await page.waitForFunction(() => document.querySelector('video')?.ended === true, { timeout: 20000 });
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({
    ended: document.querySelector('video')?.ended,
    quiz: !!document.querySelector('.epi-quiz'),
    quizText: document.querySelector('.epi-quiz-question')?.textContent?.trim()?.slice(0, 18) || null,
    options: document.querySelectorAll('.epi-option').length,
  }));
  console.log('AFTER ENDED:', JSON.stringify(after));

  await page.screenshot({ path: 'screenshots/player-quiz-after-video.png' });
  await browser.close();

  const ok = probe.status === 206 && probe.got === 2048 && before.quiz === false
    && after.ended === true && after.quiz === true && after.options === 5;
  console.log(ok ? 'VIDEO FLOW PASS' : 'VIDEO FLOW FAIL');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
