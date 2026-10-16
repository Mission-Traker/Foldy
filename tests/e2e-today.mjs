// 오늘의 단어 수 = 하루 목표(날이 바뀌면 새로 고르고, 많이 쌓여 있으면 목표 개수로 줄임)
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const SB = 'https://gilpvbwpbioihvjbldpm.supabase.co'
const KEY = 'sb_publishable_kMgYoZQrs5LRk-zrUshxOA_wZz1keiW'
const id = 'e2e_td' + Date.now().toString(36)
const results = []
const check = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? ' — ' + x : ''}`) }
const ymd = (d) => { const t = new Date(Date.now() + 9 * 3600e3 + d * 86400e3); return t.toISOString().slice(0, 10) }
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' })
await ctx.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1') } catch {} })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
let token, mid
const H = () => ({ apikey: KEY, 'content-type': 'application/json', 'x-foldy-token': token, Prefer: 'return=minimal,resolution=merge-duplicates' })
try {
  await page.goto(BASE)
  await page.getByText('가족 만들기').click()
  await page.getByLabel('가족 이름').fill('오늘')
  await page.getByLabel('가족 아이디').fill(id)
  await page.getByLabel('비밀번호').fill('pass1234')
  await page.getByLabel('개인정보 처리방침 동의').check()
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  await page.getByRole('button', { name: '저장했어요, 시작하기' }).click()
  await page.getByLabel('이름', { exact: true }).fill('검수')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.getByText('안녕, 검수!').waitFor()
  const list = ['apple 사과', 'tiger 호랑이', 'library 도서관', 'orange 오렌지', 'school 학교', 'banana 바나나', 'happy 행복한', 'water 물', 'river 강', 'bread 빵', 'green 초록', 'house 집', 'window 창문', 'cloud 구름', 'flower 꽃', 'garden 정원', 'train 기차', 'chair 의자', 'pencil 연필', 'mother 엄마', 'father 아빠', 'sister 언니', 'friend 친구', 'doctor 의사', 'teacher 선생님']
  await page.goto(BASE + '/#/add?tab=manual')
  await page.getByText('✍️ 여러 개 한 번에 적기').click()
  await page.getByLabel('한 줄에 하나씩 (영어 뜻)').fill(list.join('\n'))
  await page.getByRole('button', { name: '아래 목록에 넣기' }).click()
  await page.getByRole('button', { name: /25개 단어장에 넣기/ }).click()
  await page.getByText('25개 담았어요!').waitFor({ timeout: 20000 })
  ;({ token, mid } = await page.evaluate(() => ({ token: JSON.parse(localStorage.getItem('foldy.session')).token, mid: JSON.parse(localStorage.getItem('foldy.member')) })))
  const ws = await (await fetch(`${SB}/rest/v1/foldy_words?select=id,word,seq&member_id=eq.${mid}&order=seq`, { headers: H() })).json()
  await fetch(`${SB}/rest/v1/foldy_members?id=eq.${mid}`, { method: 'PATCH', headers: H(), body: JSON.stringify({ daily_goal: 10 }) })
  // 어제 기록만 있고 오늘은 아직 없음
  await fetch(`${SB}/rest/v1/foldy_daily`, { method: 'POST', headers: H(), body: JSON.stringify({ member_id: mid, day: ymd(-1), done: 30, set_ids: ws.slice(0, 15).map((w) => w.id), seen_ids: ws.slice(0, 15).map((w) => w.id) }) })
  await fetch(`${SB}/rest/v1/foldy_daily?member_id=eq.${mid}&day=eq.${ymd(0)}`, { method: 'DELETE', headers: H() })
  await page.goto(BASE + '/#/'); await page.reload(); await page.getByText('안녕, 검수!').waitFor()
  check('날이 바뀌면 오늘 맞힌 수는 0부터', await page.getByText('지금 0개 맞혔어요').waitFor({ timeout: 8000 }).then(() => true, () => false))
  await page.goto(BASE + '/#/study')
  check('새 날의 오늘의 단어는 목표 10개', await page.getByText('오늘의 단어 10개').waitFor({ timeout: 8000 }).then(() => true, () => false))
  // 오늘 기록에 22개가 쌓여 있던 경우
  await fetch(`${SB}/rest/v1/foldy_daily`, { method: 'POST', headers: H(), body: JSON.stringify({ member_id: mid, day: ymd(0), done: 0, set_ids: ws.slice(0, 22).map((w) => w.id), seen_ids: [] }) })
  await page.reload()
  check('22개 쌓여 있어도 10개로 줄여 보여 줌', await page.getByText('오늘의 단어 10개').waitFor({ timeout: 8000 }).then(() => true, () => false))
  await page.goto(BASE + '/#/quiz/ko')
  await page.getByPlaceholder('한글 뜻').waitFor()
  const prog = (await page.locator('.sticky').first().textContent()).match(/(\d+)\/(\d+)/)
  check('퀴즈도 10문제', prog && prog[2] === '10', prog?.[0])
  await page.waitForTimeout(1500)
  const d = (await (await fetch(`${SB}/rest/v1/foldy_daily?select=set_ids&member_id=eq.${mid}&day=eq.${ymd(0)}`, { headers: H() })).json())[0]
  check('저장된 오늘의 단어도 10개로 정리', d.set_ids.length === 10, String(d.set_ids.length))
  // 단어장에서 보내면 맨 앞, 개수 그대로
  await page.goto(BASE + '/#/book')
  const send = page.getByRole('button', { name: /teacher 오늘 학습할 단어로 보내기/ })
  await send.click()
  await page.getByText('‘teacher’를 먼저 학습해요').waitFor()
  await page.goto(BASE + '/#/study')
  await page.getByText('오늘의 단어 10개').waitFor()
  check('보낸 단어가 맨 앞, 여전히 10개', ((await page.locator('ul li.font-title').first().textContent()) || '').includes('teacher'))
} catch (e) { check('예외 없이 완료', false, e.message.split('\n')[0]) }
check('페이지 오류 없음', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(`\n${results.filter(Boolean).length}/${results.length} 통과 · 가족 ${id}`)
