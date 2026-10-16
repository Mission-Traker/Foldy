// 오답노트 3단계 다시 익히기 + 날짜 간격 졸업 + 오늘의 학습에 끼워 넣기 + 이름 한 달에 한 번
// 실행: BASE=http://localhost:4173 node tests/e2e-wrong.mjs
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const SB = 'https://gilpvbwpbioihvjbldpm.supabase.co'
const KEY = 'sb_publishable_kMgYoZQrs5LRk-zrUshxOA_wZz1keiW'
const id = 'e2e_wr' + Date.now().toString(36)
const results = []
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`) }
const kst = (d = 0) => new Date(Date.now() + 9 * 3600e3 + d * 86400e3).toISOString().slice(0, 10)
const MEAN = { library: '도서관', pressure: '압력', fortune: '행운', apple: '사과', tiger: '호랑이' }
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1') } catch {} })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
let token, mid
const H = () => ({ apikey: KEY, 'content-type': 'application/json', 'x-foldy-token': token, Prefer: 'return=minimal' })
const getWords = async () => (await fetch(`${SB}/rest/v1/foldy_words?select=word,wrong_modes,wrong_step,wrong_next,wrong_grad&member_id=eq.${mid}&order=word`, { headers: H() })).json()
const patchWord = (word, body) => fetch(`${SB}/rest/v1/foldy_words?member_id=eq.${mid}&word=eq.${word}`, { method: 'PATCH', headers: H(), body: JSON.stringify(body) })

// 다시 익히기 한 판: okSet에 든 단어만 ③에서 맞힘
async function runPractice(okSet) {
  await page.getByText('1. 다시 보기').waitFor()
  while (await page.getByRole('button', { name: /기억했어요|쉬운 문제로/ }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /기억했어요|쉬운 문제로/ }).click()
  }
  await page.getByText('알맞은 뜻을 골라 보세요').waitFor()
  while (await page.getByText('알맞은 뜻을 골라 보세요').isVisible().catch(() => false)) {
    const w = (await page.locator('p.font-title').first().textContent()).trim()
    await page.getByRole('button', { name: MEAN[w], exact: true }).click()
    await page.getByRole('button', { name: /다음 →/ }).click()
  }
  await page.getByPlaceholder('한글 뜻').waitFor()
  while (await page.getByPlaceholder('한글 뜻').isVisible().catch(() => false)) {
    const w = (await page.locator('p.font-title').first().textContent()).trim()
    if (okSet.has(w)) { await page.getByPlaceholder('한글 뜻').fill(MEAN[w]); await page.getByRole('button', { name: '확인' }).click() }
    else await page.getByRole('button', { name: '모르겠어요' }).click()
    await page.getByRole('button', { name: '다음 →' }).click()
  }
}

try {
  await page.goto(BASE)
  await page.getByText('가족 만들기').click()
  await page.getByLabel('가족 이름').fill('오답')
  await page.getByLabel('가족 아이디').fill(id)
  await page.getByLabel('비밀번호').fill('pass1234')
  await page.getByLabel('개인정보 처리방침 동의').check()
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  await page.getByRole('button', { name: '저장했어요, 시작하기' }).click()
  await page.getByLabel('이름', { exact: true }).fill('검수')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.getByText('안녕, 검수!').waitFor()
  await page.goto(BASE + '/#/add?tab=manual')
  await page.getByText('✍️ 여러 개 한 번에 적기').click()
  await page.getByLabel('한 줄에 하나씩 (영어 뜻)').fill(Object.entries(MEAN).map(([w, m]) => `${w} ${m}`).join('\n'))
  await page.getByRole('button', { name: '아래 목록에 넣기' }).click()
  await page.getByRole('button', { name: /5개 단어장에 넣기/ }).click()
  await page.getByText('5개 담았어요!').waitFor()
  ;({ token, mid } = await page.evaluate(() => ({ token: JSON.parse(localStorage.getItem('foldy.session')).token, mid: JSON.parse(localStorage.getItem('foldy.member')) })))

  // 오답노트에 3개: 2개는 오늘, 1개는 사흘 뒤
  await patchWord('library', { wrong_modes: ['ko'] })
  await patchWord('pressure', { wrong_modes: ['ko'] })
  const r = await patchWord('fortune', { wrong_modes: ['en'], wrong_step: 1, wrong_next: kst(3) })
  check('새 칸(wrong_step·wrong_next) 저장 가능', r.ok, String(r.status))
  const bad = await patchWord('apple', { wrong_step: 9 })
  check('단계는 0~3만', !bad.ok)

  await page.goto(BASE + '/#/'); await page.reload()
  await page.getByText('안녕, 검수!').waitFor()
  check('홈에 먼저 하기 링크', await page.getByRole('link', { name: /다시 볼 단어 2개 먼저 하기/ }).waitFor({ timeout: 8000 }).then(() => true, () => false))
  check('홈 오늘의 목표에 다시 볼 단어 2개', (await page.locator('body').textContent()).includes('+ 다시 볼 단어 2개'))
  check('아래 탭 배지는 오늘 볼 단어만(2)', (await page.locator('nav a[href="#/wrong"] span.bg-coral').textContent().catch(() => '')) === '2')
  await page.goto(BASE + '/#/study')
  check('학습 화면에 다시 볼 단어 줄', await page.getByText('다시 볼 단어 2개').waitFor().then(() => true, () => false))

  await page.goto(BASE + '/#/wrong')
  await page.getByText('오늘 다시 볼 단어').waitFor()
  const wn = await page.locator('body').textContent()
  check('오답노트: 오늘 2개 + 사흘 뒤 1개 표시', wn.includes('2개 다시 익히기') && wn.includes(`${+kst(3).slice(5, 7)}/${+kst(3).slice(8)}에 다시`))
  await page.getByRole('link', { name: '2개 다시 익히기' }).click()
  await runPractice(new Set(['library']))
  await page.getByText('오늘 다시 익히기 끝!').waitFor()
  const end = await page.locator('body').textContent()
  check('끝 화면: 맞힌 단어는 3일 뒤, 틀린 단어는 처음부터', end.includes(`${+kst(3).slice(5, 7)}/${+kst(3).slice(8)}에 다시`) && end.includes('처음부터'))
  await page.waitForTimeout(1200)
  let ws = await getWords()
  const lib = ws.find((w) => w.word === 'library'), pre = ws.find((w) => w.word === 'pressure')
  check('library: 1단계 · 3일 뒤', lib.wrong_step === 1 && lib.wrong_next === kst(3), JSON.stringify(lib))
  check('pressure: 처음부터(오늘 다시)', pre.wrong_step === 0 && pre.wrong_next === null && pre.wrong_modes.length === 1)
  check('맞혀도 바로 빠지지 않음', lib.wrong_modes.length === 1)

  // 서로 다른 날 세 번째 → 졸업
  await patchWord('library', { wrong_step: 2, wrong_next: kst(0) })
  await page.goto(BASE + '/#/'); await page.reload()
  await page.getByText('안녕, 검수!').waitFor()
  await page.goto(BASE + '/#/wrong/practice')
  await runPractice(new Set(['library', 'pressure']))
  await page.getByText('1개 졸업! 🎓').waitFor({ timeout: 8000 }).then(() => check('졸업 화면', true), () => check('졸업 화면', false))
  await page.waitForTimeout(1200)
  ws = await getWords()
  const lib2 = ws.find((w) => w.word === 'library')
  check('library 졸업(오답노트에서 빠지고 졸업 1회)', lib2.wrong_modes.length === 0 && lib2.wrong_grad === 1, JSON.stringify(lib2))
  await page.getByRole('button', { name: '오답노트로' }).click()
  check('오답노트에 졸업 수 표시', await page.getByText('1개 졸업').waitFor().then(() => true, () => false))
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true })

  // 이름은 한 달에 한 번
  await page.getByRole('button', { name: '내 프로필' }).click()
  await page.getByLabel('이름(닉네임)').fill('검수2')
  check('바꾸기 전 경고', await page.getByText('저장하면 한 달 동안 다시 바꿀 수 없어요').isVisible())
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await page.getByText('프로필을 저장했어요').waitFor()
  await page.getByRole('button', { name: '내 프로필' }).click()
  check('바꾼 뒤엔 입력칸 잠김 + 다음 날짜 안내', (await page.getByLabel('이름(닉네임)').isDisabled()) && (await page.getByText(/부터 다시 바꿀 수 있어요/).isVisible()))
  const sneak = await fetch(`${SB}/rest/v1/foldy_members?id=eq.${mid}`, { method: 'PATCH', headers: H(), body: JSON.stringify({ name: '몰래' }) })
  check('서버도 한 달 안에 다시 바꾸기를 막음', !sneak.ok, String(sneak.status))
  const sneak2 = await fetch(`${SB}/rest/v1/foldy_members?id=eq.${mid}`, { method: 'PATCH', headers: H(), body: JSON.stringify({ name_changed_at: '2000-01-01T00:00:00Z' }) })
  check('바꾼 날짜는 직접 못 고침', !sneak2.ok, String(sneak2.status))
  await page.getByRole('button', { name: '저장', exact: true }).click()
  check('잠긴 상태에서도 캐릭터·레벨 저장은 됨', await page.getByText('프로필을 저장했어요').waitFor().then(() => true, () => false))
} catch (e) { check('실행 중 오류', false, e.message.split('\n')[0]) }
check('페이지 오류 없음', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} 통과 · 가족 ${id}`)
