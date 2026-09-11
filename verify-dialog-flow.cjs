const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:5174/epidemiology';

async function endMainVideo(page) {
  await page.evaluate(async () => {
    const v = document.querySelector('video.epi-video');
    await new Promise((res) => { if (v.readyState >= 1) return res(); v.addEventListener('loadedmetadata', res, { once: true }); });
    v.currentTime = Math.max(0, (v.duration || 1) - 0.25);
    v.muted = true;
    await v.play().catch(() => {});
  });
}

function dialogState(page) {
  return page.evaluate(() => {
    const q = (sel) => document.querySelector(sel);
    return {
      layer: !!q('.dlg-layer'),
      bgSrc: q('video.dlg-bg')?.getAttribute('src') || null,
      bgMuted: q('video.dlg-bg')?.muted ?? null,
      bgLoop: q('video.dlg-bg')?.loop ?? null,
      audioSrc: q('.dlg-layer audio')?.getAttribute('src') || null,
      rowClass: q('.dlg-row')?.className || null,
      role: q('.dlg-role')?.textContent?.trim() || null,
      bubble: q('.dlg-bubble')?.textContent?.trim() || null,
      dots: Array.from(document.querySelectorAll('.dlg-dot')).map((d) =>
        d.classList.contains('is-active') ? 'active' : d.classList.contains('is-done') ? 'done' : 'idle'),
      end: q('.dlg-end')?.textContent?.trim() || null,
      nextBtn: q('.dlg-next-btn')?.textContent?.trim() || null,
    };
  });
}

function fireAudioEnded(page) {
  return page.evaluate(() => {
    document.querySelector('.dlg-layer audio')?.dispatchEvent(new Event('ended', { bubbles: true }));
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE.ERROR:', m.text()); });

  const results = [];
  const check = (name, ok) => results.push([name, !!ok]);

  // —— 走到对话：视频1结束 → 答对(C) → 视频2 → 视频2结束 ——
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  // 主视频 1.mp4 应带声音（不静音）且正在播放
  const main0 = await page.evaluate(() => {
    const v = document.querySelector('video.epi-video');
    return { src: v?.getAttribute('src'), muted: v?.muted, paused: v?.paused };
  });
  results.push(['M0 主视频1.mp4不静音', main0.src === '/Video/1.mp4' && main0.muted === false]);
  results.push(['M1 主视频1.mp4在播放', main0.paused === false]);
  await endMainVideo(page);
  await page.waitForFunction(() => !!document.querySelector('.epi-quiz'), { timeout: 20000 });
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.epi-option'));
    btns.find((b) => b.querySelector('.epi-option-key')?.textContent.trim() === 'C').click();
  });
  await page.click('.epi-quiz-submit');
  await page.waitForFunction(() => {
    const v = document.querySelector('video.epi-video');
    return v && v.getAttribute('src') === '/Video/2.mp4';
  }, { timeout: 10000 });
  await page.waitForTimeout(300);
  await endMainVideo(page); // 视频2结束 → 进入对话
  await page.waitForSelector('.dlg-layer', { timeout: 20000 });
  await page.waitForTimeout(600);

  const s1 = await dialogState(page);
  check('D1 对话层出现', s1.layer);
  check('D2 第1条背景为3.mp4', s1.bgSrc === '/Video/3.mp4');
  check('D3 背景视频不静音(本身无音轨)', s1.bgMuted === false);
  check('D4 背景循环', s1.bgLoop === true);
  check('D5 第1条语音0.mp3', (s1.audioSrc || '').endsWith('/0.mp3'));
  check('D6 第1条角色王医师', s1.role === '王医师');
  check('D7 第1条在左侧', /dlg-left/.test(s1.rowClass));
  check('D8 第1条字幕正确', s1.bubble === '您好，这里是海河市红林区市场监督管理局，有什么需要帮助，请讲。');
  check('D9 共2个进度点且第1个active', s1.dots.length === 2 && s1.dots[0] === 'active' && s1.dots[1] === 'idle');
  await page.screenshot({ path: 'screenshots/player-dialog-1.png' });

  // 第1条语音结束 → 自动进第2条
  await fireAudioEnded(page);
  await page.waitForTimeout(900);
  const s2 = await dialogState(page);
  check('D10 切到第2条语音01.mp3', (s2.audioSrc || '').endsWith('/01.mp3'));
  check('D10b 第2条背景切为4.mp4', s2.bgSrc === '/Video/4.mp4');
  check('D10c 第2条背景仍不静音', s2.bgMuted === false);
  check('D11 第2条角色张医生', s2.role === '张医生');
  check('D12 第2条在右侧', /dlg-right/.test(s2.rowClass));
  check('D13 第2条字幕正确', /^您好，我是海河市中心医院急诊科张医生/.test(s2.bubble || ''));
  check('D14 进度第1个done第2个active', s2.dots[0] === 'done' && s2.dots[1] === 'active');
  check('D15 按钮文案为完成对话', s2.nextBtn.includes('完成对话'));
  await page.screenshot({ path: 'screenshots/player-dialog-2.png' });

  // 第2条语音结束 → 通话结束
  await fireAudioEnded(page);
  await page.waitForTimeout(600);
  const s3 = await dialogState(page);
  check('D16 显示通话结束', s3.end === '通话结束');
  check('D17 气泡与按钮已消失', !s3.role && !s3.nextBtn);
  check('D18 两个进度点均done', s3.dots.length === 2 && s3.dots.every((d) => d === 'done'));
  check('D19 结束后背景停在4.mp4', s3.bgSrc === '/Video/4.mp4');
  await page.screenshot({ path: 'screenshots/player-dialog-end.png' });

  await browser.close();

  let pass = 0;
  for (const [name, ok] of results) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length}`);
  console.log(pass === results.length ? 'DIALOG FLOW PASS' : 'DIALOG FLOW FAIL');
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
