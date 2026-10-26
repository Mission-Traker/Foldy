// 연속 학습일: 날이 바뀐 뒤 첫 정답을 맞히면 +1, 하루를 건너뛰면 다시 1부터
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const SB = 'https://gilpvbwpbioihvjbldpm.supabase.co'
const KEY = 'sb_publishable_kMgYoZQrs5LRk-zrUshxOA_wZz1keiW'
const id = 'e2e_st' + Date.now().toString(36)
const results = []
const check = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? ' — ' + x : ''}`) }
const ymd = (d) => { const t = new Date(Date.now() + d * 86400e3); const z = (n) => String(n).padStart(2, '0'); return `${t.getFullYear()}-${z(t.getMonth() + 1)}-${z(t.getDate())}` }
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' })
await ctx.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1'); localStorage.setItem('foldy.noStarter', '1'); localStorage.setItem('foldy.hadLogin', '1'); localStorage.setItem('foldy.meMore', '1'); for (const k of Object.keys(localStorage)) if (k.startsWith('foldy.gnaw')) localStorage.removeItem(k) } catch {} })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
let token, mid
const H = () => ({ apikey: KEY, 'content-type': 'application/json', 'x-foldy-token': token, Prefer: 'return=minimal' })
const setMember = (b) => fetch(`${SB}/rest/v1/foldy_members?id=eq.${mid}`, { method: 'PATCH', headers: H(), body: JSON.stringify(b) })
const getMember = async () => (await (await fetch(`${SB}/rest/v1/foldy_members?select=streak,best_streak,last_study&id=eq.${mid}`, { headers: H() })).json())[0]
const badge = async () => (await page.locator('[aria-label*="연속 학습 중"]').getAttribute('aria-label').catch(() => '')) || ''
async function answerOne() {
  await page.goto(BASE + '/#/quiz/ko')
  await page.getByPlaceholder('한글 뜻').waitFor()
  const w = (await page.locator('.card p.font-title').first().textContent()).trim()
  await page.getByPlaceholder('한글 뜻').fill({ apple: '사과', tiger: '호랑이', library: '도서관' }[w] || '사과')
  await page.getByRole('button', { name: '확인' }).click()
  await page.getByText('정답!').waitFor({ timeout: 5000 })
  await page.waitForTimeout(1500)
}
try {
  await page.goto(BASE)
  await page.getByText('가족 만들기').click()
  await page.getByLabel('가족 이름').fill('연속')
  await page.getByLabel('가족 아이디').fill(id)
  await page.getByLabel('비밀번호').fill('pass1234')
  await page.getByLabel('보호자 확인').check(); await page.getByLabel('개인정보 처리방침 동의').check()
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  await page.getByRole('button', { name: '저장했어요, 시작하기' }).click()
  await page.getByLabel('이름', { exact: true }).fill('검수')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.getByText('안녕, 검수!').waitFor()
  check('처음엔 0일 · 오늘 시작해요', /0일 연속 학습 중, 오늘 시작해요/.test(await badge()), await badge())
  await page.goto(BASE + '/#/add?tab=manual')
  await page.getByText('✍️ 여러 개 한 번에 적기').click()
  await page.getByLabel('한 줄에 하나씩 (영어 뜻)').fill('apple 사과\ntiger 호랑이\nlibrary 도서관')
  await page.getByRole('button', { name: '아래 목록에 넣기' }).click()
  await page.getByRole('button', { name: /3개 단어장에 넣기/ }).click()
  await page.getByText('3개 담았어요!').waitFor()
  ;({ token, mid } = await page.evaluate(() => ({ token: JSON.parse(localStorage.getItem('foldy.session')).token, mid: JSON.parse(localStorage.getItem('foldy.member')) })))
  await answerOne()
  let m = await getMember()
  check('첫날 첫 정답 → 1일', m.streak === 1 && m.last_study === ymd(0), JSON.stringify(m))
  // 어제까지 3일 연속이었던 것으로
  await setMember({ streak: 3, best_streak: 3, last_study: ymd(-1) })
  await page.goto(BASE + '/#/'); await page.reload(); await page.getByText('안녕, 검수!').waitFor()
  await page.waitForTimeout(1500)
  check('다음 날 들어오면 3일 · 오늘 하면 4일째', /3일 연속 학습 중, 오늘 하면 4일째/.test(await badge()), await badge())
  await answerOne()
  m = await getMember()
  check('그날 첫 정답 → 4일, 최고 기록도 4', m.streak === 4 && m.best_streak === 4 && m.last_study === ymd(0), JSON.stringify(m))
  await page.goto(BASE + '/#/')
  await page.getByText('안녕, 검수!').waitFor(); await page.waitForTimeout(800)
  check('홈에 4일 · 오늘 학습 완료', /4일 연속 학습 중, 오늘 학습 완료/.test(await badge()), await badge())
  await answerOne()
  check('같은 날 더 맞혀도 4일 그대로', (await getMember()).streak === 4)
  // 이틀 이상 쉬었으면 다시 1부터
  await setMember({ streak: 7, best_streak: 7, last_study: ymd(-3) })
  await page.goto(BASE + '/#/'); await page.reload(); await page.getByText('안녕, 검수!').waitFor()
  await page.getByRole('button', { name: '건너뛰기' }).click({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(800)
  check('사흘 쉬면 0일 · 오늘 시작해요', /0일 연속 학습 중, 오늘 시작해요/.test(await badge()), await badge())
  await answerOne()
  m = await getMember()
  check('다시 1일부터, 최고 기록 7은 그대로', m.streak === 1 && m.best_streak === 7, JSON.stringify(m))
  if (process.env.SHOT) { await page.goto(BASE + '/#/'); await page.getByText('안녕, 검수!').waitFor(); await page.waitForTimeout(800); await page.screenshot({ path: process.env.SHOT }) }
} catch (e) { check('예외 없이 완료', false, e.message.split('\n')[0]) }
check('페이지 오류 없음', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(`\n${results.filter(Boolean).length}/${results.length} 통과 · 가족 ${id}`)
