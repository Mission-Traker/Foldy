// 가족 문제 내기·주간 순위 / 시험 대비 / 캐릭터 키우기 / 나만의 예문 설정
// 실행: BASE=http://localhost:4173 node tests/e2e-family.mjs
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const SB = 'https://gilpvbwpbioihvjbldpm.supabase.co'
const KEY = 'sb_publishable_kMgYoZQrs5LRk-zrUshxOA_wZz1keiW'
const id = 'e2e_fm' + Date.now().toString(36)
const results = []
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`) }
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1') } catch {} })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const SHOT = process.env.SHOT
const shot = async (n) => { if (SHOT) await page.screenshot({ path: SHOT.replace('.png', `-${n}.png`), fullPage: true }) }
const body = async () => page.locator('body').textContent()
async function switchTo(name) {
  await page.goto(BASE + '/#/')
  await page.getByRole('button', { name: '내 캐릭터 보기' }).click()
  await page.getByRole('button', { name: '내 프로필 열기' }).click()
  await page.getByRole('button', { name: '🔁 프로필 바꾸기' }).click()
  await page.getByText('누가 공부할까요?').waitFor()
  await page.getByText(name, { exact: true }).click()
  await page.getByText(`안녕, ${name}!`).waitFor()
}

try {
  await page.goto(BASE)
  await page.getByText('가족 만들기').click()
  await page.getByLabel('가족 이름').fill('검수네')
  await page.getByLabel('가족 아이디').fill(id)
  await page.getByLabel('비밀번호').fill('pass1234')
  await page.getByLabel('개인정보 처리방침 동의').check()
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  await page.getByRole('button', { name: '저장했어요, 시작하기' }).click()
  await page.getByLabel('이름', { exact: true }).fill('엄마')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.getByText('안녕, 엄마!').waitFor()
  await page.getByRole('button', { name: '내 캐릭터 보기' }).click()
  check('캐릭터 카드(아기)', await page.getByText('내 캐릭터 · 아기').waitFor({ timeout: 8000 }).then(() => true, () => false))
  await page.getByRole('button', { name: '닫기' }).click()
  await page.goto(BASE + '/#/add?tab=manual')
  await page.getByText('✍️ 여러 개 한 번에 적기').click()
  await page.getByLabel('한 줄에 하나씩 (영어 뜻)').fill('apple 사과\nhappy 행복한\nlibrary 도서관\ntiger 호랑이\norange 오렌지')
  await page.getByRole('button', { name: '아래 목록에 넣기' }).click()
  await page.getByRole('button', { name: /5개 단어장에 넣기/ }).click()
  await page.getByText('5개 담았어요!').waitFor()
  // 둘째 구성원
  await page.goto(BASE + '/#/')
  await page.getByRole('button', { name: '내 캐릭터 보기' }).click()
  await page.getByRole('button', { name: '내 프로필 열기' }).click()
  await page.getByRole('button', { name: '🔁 프로필 바꾸기' }).click()
  await page.getByText('가족 추가').click()
  await page.getByLabel('이름', { exact: true }).fill('민지')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.getByText('안녕, 민지!').waitFor()
  await switchTo('엄마')

  // 1) 가족에게 문제 내기
  await page.goto(BASE + '/#/family')
  await page.getByText('🏆 이번 주 가족 순위').waitFor()
  check('주간 가족 순위 카드', true)
  await page.getByRole('button', { name: '민지' }).click()
  await page.getByLabel('apple 고르기').check()
  await page.getByLabel('happy 고르기').check()
  await page.getByLabel('한마디').fill('다 맞히면 아이스크림!')
  await shot('family')
  await page.getByRole('button', { name: '민지에게 2문제 보내기' }).click()
  await page.getByText('민지에게 문제 2개를 보냈어요').waitFor()
  await page.getByText('아직 안 풀었어요').waitFor()
  check('문제 보내기 → 보낸 목록', true)

  await switchTo('민지')
  await page.getByText('엄마가 문제 2개를 냈어요').waitFor({ timeout: 8000 })
  check('받는 사람 홈에 문제 카드', true)
  await page.getByText('엄마가 문제 2개를 냈어요').click()
  check('한마디 보임', await page.getByText('“다 맞히면 아이스크림!”').waitFor({ timeout: 8000 }).then(() => true, () => false))
  check('풀기 전엔 뜻 가림', !(await body()).includes('행복한'))
  await page.getByRole('button', { name: '문제 풀기 시작' }).click()
  for (let i = 0; i < 2; i++) {
    const w = (await page.locator('.card p.font-title').first().textContent()).trim()
    if (w === 'apple') { await page.getByLabel('답').fill('사과'); await page.getByRole('button', { name: '확인' }).click() }
    else await page.getByRole('button', { name: '모르겠어요' }).click()
    await page.getByRole('button', { name: i ? '결과 보기' : '다음 →' }).click()
  }
  await page.getByText('1/2 맞혔어요').waitFor()
  check('결과 1/2 저장', true)
  await page.getByRole('button', { name: '틀린 단어 내 단어장에 담기' }).click()
  await page.getByText('1개를 내 단어장에 담았어요').waitFor()
  check('틀린 단어 내 단어장에 담기', true)
  await page.goto(BASE + '/#/book')
  check('민지 단어장에 happy', (await page.getByText('happy', { exact: true }).count()) >= 1)

  await switchTo('엄마')
  await page.getByText('민지가 내 문제를 풀었어요').waitFor({ timeout: 8000 })
  check('낸 사람 홈에 결과 카드(1/2)', (await body()).includes('1/2 맞혔어요'))

  // 2) 시험 대비
  await page.goto(BASE + '/#/study')
  await page.getByRole('link', { name: '＋ 시험 만들기' }).click()
  await page.getByRole('button', { name: '이름·날짜·범위를 정해 주세요' }).waitFor()
  check('빈 입력이면 만들기 막힘', await page.getByRole('button', { name: '이름·날짜·범위를 정해 주세요' }).isDisabled())
  await page.getByPlaceholder('예: 3단원 단어시험').fill('3단원 단어시험 정말 긴 이름을 계속 쓰면 어떻게 되는지 확인')
  check('시험 이름 30자 제한', (await page.getByPlaceholder('예: 3단원 단어시험').inputValue()).length === 30)
  await page.getByLabel(/단어 모두 고르기/).first().check()
  await shot('exam-new')
  await page.getByRole('button', { name: /5개로 시험 계획 만들기/ }).click()
  await page.getByText('오늘 할 분량').waitFor()
  check('시험 계획 D-7 · 오늘 1개(5개÷7일)', (await body()).includes('-7') && (await body()).includes('오늘 분량 1개 공부하기'))
  await shot('exam')
  await page.getByRole('button', { name: '모의고사 보기' }).click()
  for (let i = 0; i < 5; i++) {
    const mean = (await page.locator('.card p.font-jua').nth(1).textContent()).trim()
    const ans = { 사과: 'apple', 행복한: 'happy', 도서관: 'library', 호랑이: 'tiger', 오렌지: 'orange' }[mean]
    if (i < 3) { await page.getByLabel('답').fill(ans); await page.getByRole('button', { name: '확인' }).click() }
    else await page.getByRole('button', { name: '모르겠어요' }).click()
    await page.getByRole('button', { name: i === 4 ? '결과 보기' : '다음 →' }).click()
  }
  await page.getByText('3/5 맞혔어요').waitFor()
  check('철자 모의고사 3/5 + 틀린 단어 표시', (await body()).includes('틀린 단어'))
  await page.goto(BASE + '/#/')
  check('홈에 시험 D-day 카드', await page.getByText(/3단원 단어시험 정말 긴 이름/).first().waitFor({ timeout: 8000 }).then(() => true, () => false))

  // 3) 캐릭터 키우기: 단어 5개 퀴즈를 모두 통과 → 15번 먹음 → 꼬마 + 리본
  const { token, mid } = await page.evaluate(() => ({ token: JSON.parse(localStorage.getItem('foldy.session')).token, mid: JSON.parse(localStorage.getItem('foldy.member')) }))
  const r = await fetch(`${SB}/rest/v1/foldy_words?member_id=eq.${mid}`, { method: 'PATCH', headers: { apikey: KEY, 'content-type': 'application/json', 'x-foldy-token': token, Prefer: 'return=minimal' }, body: JSON.stringify({ ko_ok: true, en_ok: true, sp_ok: true }) })
  check('퀴즈 통과 상태 만들기', r.ok, String(r.status))
  await page.reload()
  await page.getByRole('button', { name: '내 캐릭터 보기' }).click()
  await page.getByText('내 캐릭터 · 꼬마').waitFor({ timeout: 8000 })
  check('15번 맞히면 꼬마로 자람', true)
  await page.getByText(/꼬마로 자랐어요/).waitFor({ timeout: 6000 }).then(() => check('자람 알림 + 리본', true), () => check('자람 알림 + 리본', false))
  check('꾸미기에 리본(풀림)·잠긴 단계', (await page.getByRole('button', { name: '리본' }).count()) === 1 && (await page.getByRole('button', { name: /🔒/ }).count()) === 4)
  await shot('home')
  const pet = await (await fetch(`${SB}/rest/v1/foldy_members?select=pet&id=eq.${mid}`, { headers: { apikey: KEY, 'x-foldy-token': token } })).json()
  check('리본 착용이 저장됨(가족 화면에도 보이게)', JSON.stringify(pet[0].pet?.wear) === '["ribbon"]', JSON.stringify(pet[0].pet))

  // 4) 나만의 예문 설정
  await page.goto(BASE + '/#/me')
  await page.getByLabel('나만의 예문 켜기').check()
  await page.getByRole('button', { name: '저장' }).first().click()
  check('별명 없으면 저장 안 됨', await page.getByText('별명을 적어 주세요').waitFor({ timeout: 4000 }).then(() => true, () => false))
  await page.getByLabel('별명').fill('콩이네엄마는최고라서')
  await page.getByLabel('좋아하는 것 1').fill('커피')
  await page.getByRole('button', { name: '저장' }).first().click()
  await page.getByText(/내 이야기 예문이 나와요/).waitFor()
  const st = await (await fetch(`${SB}/rest/v1/foldy_members?select=story&id=eq.${mid}`, { headers: { apikey: KEY, 'x-foldy-token': token } })).json()
  check('예문 설정 저장(별명 10자)', st[0].story?.on === true && st[0].story?.nick === '콩이네엄마는최고라서' && st[0].story?.likes?.[0] === '커피', JSON.stringify(st[0].story))
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  check('가로 넘침 없음', overflow <= 0)
} catch (e) { check('실행 중 오류', false, e.message.split('\n').slice(0,3).join(' / ')); await page.screenshot({ path: (SHOT || '/tmp/claude-0/x.png').replace('.png', '-err.png') }).catch(() => {}) }
check('페이지 오류 없음', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} 통과 · 가족 ${id}`)
