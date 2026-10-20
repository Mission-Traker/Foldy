// 단어장에서 공부할 단어를 직접 골라 오늘 학습하기(고른 단어만 퀴즈에)
// 실행: BASE=http://localhost:4173 node tests/e2e-pick.mjs
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const id = 'e2e_pk' + Date.now().toString(36)
const results = []
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`) }
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } })
await ctx.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1') } catch {} })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const W = { apple: '사과', school: '학교', tiger: '호랑이', banana: '바나나', happy: '행복한', library: '도서관', orange: '오렌지', river: '강' }
const PICK = ['tiger', 'library', 'river', 'apple', 'orange']
try {
  await page.goto(BASE)
  await page.getByText('가족 만들기').click()
  await page.getByLabel('가족 이름').fill('고르기')
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
  await page.getByRole('button', { name: /8개 단어장에 넣기/ }).click()
  await page.getByText('8개 담았어요!').waitFor()

  await page.goto(BASE + '/#/study')
  await page.getByRole('link', { name: /단어장에서 직접 고르기/ }).click()
  check('학습 → 단어장 고르기 모드로 바로 열림', await page.getByText(/0개 선택/).waitFor({ timeout: 8000 }).then(() => true, () => false))
  check('아무것도 안 고르면 학습 버튼 잠김', await page.getByRole('button', { name: '📚 5개 더 골라 주세요 (목표 5개)' }).isDisabled())
  const bh = (await page.getByRole('button', { name: /더 골라 주세요/ }).boundingBox()).height
  check('안내 버튼 글자가 한 줄', bh < 52, `${Math.round(bh)}px`)
  for (const w of PICK.slice(0, 3)) await page.getByRole('checkbox', { name: `${w} 선택` }).click()
  check('목표보다 적으면 더 고르라는 안내(버튼 잠김)', await page.getByRole('button', { name: '📚 2개 더 골라 주세요 (목표 5개)' }).isDisabled())
  for (const w of PICK.slice(3)) await page.getByRole('checkbox', { name: `${w} 선택` }).click()
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  check('고르기 화면 가로 넘침 없음', ov <= 0, String(ov))
  await page.screenshot({ path: '/tmp/claude-0/pick.png' })
  await page.getByRole('button', { name: '📚 고른 5개로 오늘 학습하기' }).click()
  check('학습 화면으로 이동 · 오늘의 단어 5개', await page.getByText('오늘의 단어 5개').waitFor({ timeout: 8000 }).then(() => true, () => false))
  const chips = (await page.locator('section.card ul li').allTextContents()).map((t) => t.replace('○ ', '').trim()).sort()
  check('고른 단어만(무작위로 섞이지 않음)', JSON.stringify(chips) === JSON.stringify([...PICK].sort()), chips.join(','))
  await page.reload()
  await page.getByText(/오늘의 단어 \d개/).waitFor()
  check('새로고침해도 고른 단어 유지', await page.getByText('오늘의 단어 5개').isVisible())
  // 뜻 쓰기 퀴즈에는 고른 단어만
  await page.goto(BASE + '/#/quiz/ko')
  const asked = new Set()
  for (let n = 0; n < 5; n++) {
    await page.getByPlaceholder('한글 뜻').waitFor()
    const w = (await page.locator('.card p.font-title').first().textContent()).trim()
    asked.add(w)
    await page.getByPlaceholder('한글 뜻').fill(W[w] || 'x'); await page.keyboard.press('Enter')
    await page.waitForTimeout(1300)
  }
  check('퀴즈에 고른 단어만 나옴', [...asked].every((w) => PICK.includes(w)), [...asked].join(','))
} catch (e) { check('실행 중 오류', false, e.message.split('\n').slice(0, 3).join(' / ')); await page.screenshot({ path: '/tmp/claude-0/pick-err.png' }) }
check('페이지 오류 없음', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} 통과 · 가족 ${id}`)
