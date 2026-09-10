const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 1) 数据层：从生成的 questions.ts 中抽取 QUESTIONS 数组
const ts = fs.readFileSync(path.join('frontend/src/data/questions.ts'), 'utf8');
const start = ts.indexOf('= [', ts.indexOf('export const QUESTIONS')) + 2;
const json = ts.slice(start, ts.lastIndexOf(']', ts.indexOf('getQuestionById')) + 1);
const QUESTIONS = JSON.parse(json);
const byId = (id) => QUESTIONS.find(q => q.id === id);
console.log('题库: 总数=', QUESTIONS.length, ' 多选=', QUESTIONS.filter(q=>q.type==='multiple').length, ' 单选=', QUESTIONS.filter(q=>q.type==='single').length);
console.log('H_01:', byId('H_01').type, JSON.stringify(byId('H_01').answerKeys), '选项', byId('H_01').options.length);
console.log('H_06:', byId('H_06').type, JSON.stringify(byId('H_06').answerKeys), '选项', byId('H_06').options.length);
console.log('H_20:', byId('H_20').type, JSON.stringify(byId('H_20').answerKeys), '选项', byId('H_20').options.length);

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://127.0.0.1:5174/epidemiology', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const v = document.querySelector('video');
    await new Promise(r => { if (v.readyState >= 1) return r(); v.addEventListener('loadedmetadata', r, { once: true }); });
    v.currentTime = Math.max(0, (v.duration||1) - 0.3); v.muted = true; await v.play().catch(()=>{});
  });
  await page.waitForSelector('.epi-quiz', { timeout: 20000 });

  const ui = await page.evaluate(() => ({
    type: document.querySelector('.epi-quiz-type')?.textContent,
    question: document.querySelector('.epi-quiz-question')?.textContent?.trim()?.replace(/^[●•]\s*/,''),
    options: [...document.querySelectorAll('.epi-option-text')].map(e => e.textContent),
  }));
  console.log('\n弹题型徽标 =', ui.type);
  console.log('题干 =', ui.question);
  console.log('选项 =', JSON.stringify(ui.options));

  await page.locator('.epi-option').nth(2).click(); // C
  await page.locator('.epi-option').nth(0).click(); // 再点 A（单选应切到 A）
  const onlyA = await page.evaluate(() =>
    [...document.querySelectorAll('.epi-option')].map((b,i)=> b.classList.contains('is-selected')?String.fromCharCode(65+i):null).filter(Boolean));
  console.log('单选连点后选中 =', JSON.stringify(onlyA));
  await page.screenshot({ path: 'screenshots/quiz-from-xlsx.png' });

  await page.locator('.epi-quiz-submit').click();
  await page.waitForTimeout(300);
  const wrong = await page.locator('.epi-feedback').textContent();
  console.log('选 A 提交反馈 =', wrong);
  await page.locator('.epi-feedback').click();
  await page.waitForTimeout(200);
  await page.locator('.epi-option').nth(2).click(); // C
  await page.locator('.epi-quiz-submit').click();
  await page.waitForTimeout(300);
  const right = await page.locator('.epi-feedback').textContent();
  console.log('选 C 提交反馈 =', right);
  await browser.close();

  const h01 = byId('H_01');
  const ok = QUESTIONS.length === 18
    && h01.answerKeys.join()==='C' && h01.options.length===5
    && ui.type==='单选题' && ui.options.length===5
    && ui.question === h01.question
    && JSON.stringify(ui.options) === JSON.stringify(h01.options.map(o=>o.text))
    && onlyA.join()==='A' && wrong.includes('错误') && right.includes('正确');
  console.log(ok ? '\nQUIZ-XLSX PASS' : '\nQUIZ-XLSX FAIL');
  process.exit(ok?0:1);
})().catch(e => { console.error(e); process.exit(1); });
