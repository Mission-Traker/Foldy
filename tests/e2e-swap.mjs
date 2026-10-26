// 학습 중 '다른 단어로 바꾸기': 학습 화면 단어 칩 · 퀴즈 화면, '이미 알아요'면 ○ 표시
// 실행: BASE=http://localhost:4173 node tests/e2e-swap.mjs
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const id = 'e2e_sw' + Date.now().toString(36)
const results = []
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`) }
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } })
await ctx.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1'); localStorage.setItem('foldy.noStarter', '1'); localStorage.setItem('foldy.hadLogin', '1'); localStorage.setItem('foldy.meMore', '1') } catch {} })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const W = { apple: '사과', school: '학교', tiger: '호랑이', banana: '바나나', happy: '행복한', library: '도서관', orange: '오렌지', river: '강', milk: '우유', water: '물' }
const chips = async () => (await page.locator('section.card ul li').allTextContents()).map((t) => t.replace(/[○🔄]/g, '').trim())
try {
  await page.goto(BASE)
  await page.getByText('가족 만들기').click()
  await page.getByLabel('가족 이름').fill('바꾸기')
  await page.getByLabel('가족 아이디').fill(id)
  await page.getByLabel('비밀번호').fill('pass1234')
  await page.getByLabel('보호자 확인').check(); await page.getByLabel('개인정보 처리방침 동의').check()
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  await page.getByRole('button', { name: '저장했어요, 시작하기' }).click()
  await page.getByText('누가 공부할까요?').waitFor()
  await page.getByLabel('이름', { exact: true }).fill('하나')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.getByText('안녕, 하나!').waitFor()
  await page.goto(BASE + '/#/add?tab=manual')
  await page.getByText('✍️ 여러 개 한 번에 적기').click()
  await page.getByLabel('한 줄에 하나씩 (영어 뜻)').fill(Object.entries(W).map(([a, b]) => `${a} ${b}`).join('\n'))
  await page.getByRole('button', { name: '아래 목록에 넣기' }).click()
  await page.getByRole('button', { name: /10개 단어장에 넣기/ }).click()
  await page.getByText('10개 담았어요!').waitFor()

  // 학습 화면: 칩을 눌러 '이미 알아요'
  await page.goto(BASE + '/#/study')
  await page.getByText(/오늘의 단어 5개/).waitFor()
  const before = await chips()
  const first = before[0]
  await page.getByRole('button', { name: `${first} 바꾸기` }).click()
  check('바꾸기 창: 이미 알아요 · 그냥 바꾸기', await page.getByRole('button', { name: /이미 알아요/ }).isVisible() && await page.getByRole('button', { name: /그냥 다른 단어로/ }).isVisible())
  await page.getByRole('button', { name: /이미 알아요/ }).click()
  await page.getByText(/로 바꿨어요/).first().waitFor()
  const after = await chips()
  check('바꾼 뒤에도 5개 · 원래 단어는 빠짐', after.length === 5 && !after.includes(first), after.join(','))
  check('새 단어는 오늘 단어에 없던 단어', after.filter((x) => !before.includes(x)).length === 1)
  await page.goto(BASE + '/#/book?f=o')
  check('이미 알아요 → ○ 완료로', await page.getByText(first, { exact: true }).first().waitFor({ timeout: 8000 }).then(() => true, () => false))

  // 퀴즈 화면: 지금 문제를 그냥 다른 단어로
  await page.goto(BASE + '/#/quiz/ko')
  await page.getByPlaceholder('한글 뜻').waitFor()
  const q1 = (await page.locator('.card p.font-title').first().textContent()).trim()
  await page.getByRole('button', { name: '🔄 다른 단어로 바꾸기' }).click()
  await page.getByRole('button', { name: /그냥 다른 단어로/ }).click()
  await page.waitForFunction((a) => document.querySelector('.card p.font-title')?.textContent.trim() !== a, q1, { timeout: 5000 }).catch(() => {})
  const q2 = (await page.locator('.card p.font-title').first().textContent()).trim()
  check('퀴즈: 지금 문제가 다른 단어로 바뀜', q2 !== q1 && !!W[q2], `${q1} → ${q2}`)
  const asked = new Set([q2])
  await page.getByPlaceholder('한글 뜻').fill(W[q2]); await page.keyboard.press('Enter')
  for (let n = 0; n < 6; n++) {
    await page.waitForTimeout(1300)
    if (!(await page.getByPlaceholder('한글 뜻').isVisible().catch(() => false))) break
    const w = (await page.locator('.card p.font-title').first().textContent()).trim()
    asked.add(w)
    await page.getByPlaceholder('한글 뜻').fill(W[w] || 'x'); await page.keyboard.press('Enter')
  }
  check('뺀 단어는 다시 안 나옴', !asked.has(q1) && !asked.has(first), [...asked].join(','))
  await page.goto(BASE + '/#/study')
  await page.reload()
  await page.getByText(/오늘의 단어 5개/).waitFor()
  const fin = await chips()
  check('새로고침해도 바꾼 단어 유지', !fin.includes(q1) && !fin.includes(first) && fin.includes(q2), fin.join(','))
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  check('가로 넘침 없음', ov <= 0, String(ov))
} catch (e) { check('실행 중 오류', false, e.message.split('\n').slice(0, 3).join(' / ')); await page.screenshot({ path: '/tmp/claude-0/swap-err.png' }) }
check('페이지 오류 없음', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} 통과 · 가족 ${id}`)
