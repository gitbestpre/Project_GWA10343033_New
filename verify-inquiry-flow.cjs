const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:5174/epidemiology';

async function reachInquiry(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const endMain = async () =>
    page.evaluate(async () => {
      const v = document.querySelector('video.epi-video');
      await new Promise((r) => {
        if (v.readyState >= 1) return r();
        v.addEventListener('loadedmetadata', r, { once: true });
      });
      v.currentTime = Math.max(0, (v.duration || 1) - 0.2);
      v.muted = true;
      await v.play().catch(() => {});
    });
  const endAudio = () =>
    page.evaluate(() =>
      document.querySelector('.dlg-layer audio')?.dispatchEvent(new Event('ended', { bubbles: true })),
    );

  await endMain(); // 视频1结束 → 出题
  await page.waitForSelector('.epi-quiz', { timeout: 20000 });
  await page.evaluate(() =>
    Array.from(document.querySelectorAll('.epi-option'))
      .find((b) => b.querySelector('.epi-option-key')?.textContent.trim() === 'C')
      .click(),
  );
  await page.click('.epi-quiz-submit');
  await page.waitForFunction(
    () => document.querySelector('video.epi-video')?.getAttribute('src') === '/Video/2.mp4',
    { timeout: 10000 },
  );
  await page.waitForTimeout(200);
  await endMain(); // 视频2结束 → 对话
  await page.waitForSelector('.dlg-layer', { timeout: 20000 });
  await page.waitForTimeout(500);
  await endAudio();
  await page.waitForTimeout(900);
  await endAudio(); // 两条对话结束 → 自动进入问询页
  await page.waitForSelector('.inq-panel', { timeout: 10000 });
  await page.waitForTimeout(400);
}

function inqState(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const qa = (s) => Array.from(document.querySelectorAll(s));
    return {
      panel: !!q('.inq-panel'),
      title: q('.inq-head-title')?.textContent?.trim() || null,
      bgSrc: q('video.inq-bg-video')?.getAttribute('src') || null,
      bgMuted: q('video.inq-bg-video')?.muted ?? null,
      bgLoop: q('video.inq-bg-video')?.loop ?? null,
      dlgGone: !q('.dlg-layer'),
      prompt: q('.inq-prompt')?.textContent?.trim() || null,
      suggest: qa('.inq-suggest-item').map(
        (b) => b.querySelector('.inq-suggest-text')?.textContent?.trim(),
      ),
      msgs: qa('.inq-msg').map((m) => ({
        side: m.classList.contains('inq-right') ? 'right' : 'left',
        text: m.querySelector('.inq-bubble')?.textContent?.trim()?.slice(0, 24) || null,
      })),
      placeholder: q('.inq-input')?.getAttribute('placeholder') || null,
      endBtn: q('.inq-end-btn')?.textContent?.trim() || null,
    };
  });
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text());
  });
  await reachInquiry(page);

  const R = [];
  const check = (n, ok) => R.push([n, !!ok]);

  const s0 = await inqState(page);
  check('I1 问询面板出现', s0.panel);
  check('I2 标题=疾病预防控制中心', s0.title === '疾病预防控制中心');
  check('I3 对话层已卸载', s0.dlgGone);
  check('I4 背景为4.mp4', s0.bgSrc === '/Video/4.mp4');
  check('I5 背景静音+循环(无声轨)', s0.bgMuted === true && s0.bgLoop === true);
  check('I6 红色任务提示', s0.prompt === '身为市场监督管理局的值班员，请询问主要信息');
  check('I7 初始4个推荐问题', s0.suggest.length === 4);
  check('I8 含发病人数问题', s0.suggest.some((t) => t.includes('一共有多少人发病')));
  check(
    'I9 历史2条(王左/张右)',
    s0.msgs.length === 2 && s0.msgs[0].side === 'left' && s0.msgs[1].side === 'right',
  );
  check('I10 输入框占位', s0.placeholder === '请在这里输入想询问的问题');
  check('I11 结束问询按钮', s0.endBtn === '结束问询');
  await page.screenshot({ path: 'screenshots/player-inquiry-initial.png' });

  // 点第1个推荐问题：左问 → 0.65s 后右答
  await page.evaluate(() => document.querySelectorAll('.inq-suggest-item')[0].click());
  await page.waitForTimeout(200);
  const during = await inqState(page);
  check('I12 问题出现在左侧(值班员)', during.msgs.some((m) => m.side === 'left' && m.text.includes('多少人发病')));
  await page.waitForTimeout(900);
  const after = await inqState(page);
  check('I13 张医生答复在右侧', after.msgs.some((m) => m.side === 'right' && m.text.includes('约20多人')));
  check('I14 推荐问题减为3个', after.suggest.length === 3);
  check('I15 已问项移除', !after.suggest.some((t) => t.includes('多少人发病')));
  await page.screenshot({ path: 'screenshots/player-inquiry-qa.png' });

  // 自由输入发送
  await page.fill('.inq-input', '你们当天还吃了什么？');
  await page.click('.inq-send');
  await page.waitForTimeout(900);
  const free = await inqState(page);
  check('I16 自由提问在左侧', free.msgs.some((m) => m.side === 'left' && m.text.includes('还吃了什么')));
  check('I17 得到答复在右侧', free.msgs.some((m) => m.side === 'right' && m.text.includes('记录下来')));

  // 结束问询 → 案例模块页
  await page.click('.inq-end-btn');
  await page.waitForURL('**/case-study', { timeout: 8000 });
  check('I18 结束问询跳回/case-study', page.url().includes('/case-study'));
  check('I19 全程无控制台错误', errs.length === 0);

  await browser.close();

  let pass = 0;
  for (const [n, ok] of R) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${R.length}`);
  console.log(pass === R.length ? 'INQUIRY FLOW PASS' : 'INQUIRY FLOW FAIL');
  process.exit(pass === R.length ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
