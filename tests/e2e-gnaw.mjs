// 갉아먹기 장면: 며칠 쉬고 들어오면 하루 한 번 → 되찾기 → 학습으로. 단어장 내용은 그대로.
// 실행: BASE=http://localhost:4173 node tests/e2e-gnaw.mjs
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const SB = 'https://gilpvbwpbioihvjbldpm.supabase.co'
const KEY = 'sb_publishable_kMgYoZQrs5LRk-zrUshxOA_wZz1keiW'
const id = 'e2e_gn' + Date.now().toString(36)
const results = []
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`) }
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1') } catch {} })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const shot = process.env.SHOT
try {
  await page.goto(BASE)
  await page.getByText('가족 만들기').click()
  await page.getByLabel('가족 이름').fill('갉갉')
  await page.getByLabel('가족 아이디').fill(id)
  await page.getByLabel('비밀번호').fill('pass1234')
  await page.getByLabel('개인정보 처리방침 동의').check()
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  await page.getByRole('button', { name: '저장했어요, 시작하기' }).click()
  await page.getByLabel('이름', { exact: true }).fill('검수')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.getByText('안녕, 검수!').waitFor()
  check('처음 가입한 날엔 장면 없음', !(await page.getByText('갉아먹고 있었어요').isVisible().catch(() => false)))
  await page.goto(BASE + '/#/add?tab=manual')
  await page.getByText('✍️ 여러 개 한 번에 적기').click()
  await page.getByLabel('한 줄에 하나씩 (영어 뜻)').fill('library 도서관\npressure 압력\nfortune 행운\nox 황소')
  await page.getByRole('button', { name: '아래 목록에 넣기' }).click()
  await page.getByRole('button', { name: /4개 단어장에 넣기/ }).click()
  await page.getByText('4개 담았어요!').waitFor()
  // 사흘 전에 마지막으로 공부한 것으로 만듦
  const { token, mid } = await page.evaluate(() => ({ token: JSON.parse(localStorage.getItem('foldy.session')).token, mid: JSON.parse(localStorage.getItem('foldy.member')) }))
  const d = new Date(Date.now() + 9 * 3600e3 - 3 * 86400e3).toISOString().slice(0, 10)
  const r = await fetch(`${SB}/rest/v1/foldy_members?id=eq.${mid}`, { method: 'PATCH', headers: { apikey: KEY, 'content-type': 'application/json', 'x-foldy-token': token, Prefer: 'return=minimal' }, body: JSON.stringify({ last_study: d }) })
  check('마지막 학습일을 사흘 전으로', r.ok, String(r.status))
  const before = await (await fetch(`${SB}/rest/v1/foldy_words?select=word,meaning&member_id=eq.${mid}&order=word`, { headers: { apikey: KEY, 'x-foldy-token': token } })).json()
  await page.goto(BASE + '/#/')
  await page.reload()
  await page.getByText('3일 만이에요, 검수!').waitFor({ timeout: 10000 })
  check('사흘 쉬고 들어오면 장면이 나옴', true)
  await page.locator('.gn-sheet.on').waitFor({ timeout: 15000 })
  check('다 먹고 나면 안내가 나옴', (await page.locator('.gn-sheet.on').textContent()).includes('3일 쉬는 사이, 단어를 갉아먹고 있었어요!'))
  const rows = await page.locator('.gn-row').count()
  check('갉아먹는 단어 3개(짧은 ox는 제외)', rows === 3, String(rows))
  const gone = await page.locator('.gn-l').evaluateAll((ls) => ls.filter((l) => l.style.opacity === '0').length)
  check('글자가 실제로 사라짐(장면 안에서만)', gone >= 6, String(gone))
  if (shot) await page.screenshot({ path: shot })
  await page.getByRole('button', { name: '복습하고 되찾기' }).click()
  await page.getByText('다 지켰어요!').waitFor({ timeout: 6000 })
  await page.waitForURL(/#\/(study|quiz\/review)/, { timeout: 6000 })
  check('되찾기 → 학습 화면으로', /#\/(study|quiz\/review)/.test(page.url()), page.url().replace(BASE, ''))
  const after = await (await fetch(`${SB}/rest/v1/foldy_words?select=word,meaning&member_id=eq.${mid}&order=word`, { headers: { apikey: KEY, 'x-foldy-token': token } })).json()
  check('단어장 내용은 그대로(훼손 없음)', JSON.stringify(before) === JSON.stringify(after) && after.length === 4)
  await page.goto(BASE + '/#/'); await page.reload(); await page.waitForTimeout(2500)
  check('같은 날 두 번째로 들어오면 안 나옴', !(await page.getByText('만이에요, 검수!').isVisible().catch(() => false)))
  // 학습 알림으로 들어온 경우(어제 공부)
  const y = new Date(Date.now() + 9 * 3600e3 - 86400e3).toISOString().slice(0, 10)
  await fetch(`${SB}/rest/v1/foldy_members?id=eq.${mid}`, { method: 'PATCH', headers: { apikey: KEY, 'content-type': 'application/json', 'x-foldy-token': token, Prefer: 'return=minimal' }, body: JSON.stringify({ last_study: y }) })
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('foldy.gnaw.')) localStorage.removeItem(k) })
  await page.goto(BASE + '/#/?gnaw=1'); await page.reload()
  await page.getByText('다시 왔네요, 검수!').waitFor({ timeout: 10000 })
  check('알림으로 들어오면 하루만 쉬어도 나옴', true)
  await page.getByRole('button', { name: '건너뛰기' }).click()
  check('건너뛰기 → 홈', await page.getByText('안녕, 검수!').isVisible())
} catch (e) { check('실행 중 오류', false, e.message.split('\n')[0]) }
check('페이지 오류 없음', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} 통과 · 가족 ${id}`)
