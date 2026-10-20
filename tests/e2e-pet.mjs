// 가족 펫: 데려오기 · 공부해야 생기는 돌봄권 · 돌보기 · 가족이 같은 펫 · 서버에서도 돌봄권 확인
// 실행: BASE=http://localhost:4173 node tests/e2e-pet.mjs
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const SUPA = { url: 'https://gilpvbwpbioihvjbldpm.supabase.co', key: 'sb_publishable_kMgYoZQrs5LRk-zrUshxOA_wZz1keiW' }
const id = 'e2e_pt' + Date.now().toString(36)
const results = []
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`) }
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } })
await ctx.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1') } catch {} })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const seen = (t, ms = 8000) => page.getByText(t).first().waitFor({ timeout: ms }).then(() => true, () => false)
const W = { apple: '사과', school: '학교', tiger: '호랑이', banana: '바나나', happy: '행복한', library: '도서관', orange: '오렌지', cat: '고양이', dog: '개', bird: '새', milk: '우유', water: '물' }
const KO = Object.fromEntries(Object.entries(W).map(([a, b]) => [b, a]))
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
try {
  await page.goto(BASE)
  await page.getByText('가족 만들기').click()
  await page.getByLabel('가족 이름').fill('펫')
  await page.getByLabel('가족 아이디').fill(id)
  await page.getByLabel('비밀번호').fill('pass1234')
  await page.getByLabel('보호자 확인').check(); await page.getByLabel('개인정보 처리방침 동의').check()
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  await page.getByRole('button', { name: '저장했어요, 시작하기' }).click()
  await page.getByText('누가 공부할까요?').waitFor()
  await page.getByLabel('이름', { exact: true }).fill('하나')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.getByText('안녕, 하나!').waitFor()

  check('홈: 가족 펫 데려오기 안내', await seen('우리 가족 펫을 데려와요'))
  await page.getByRole('link', { name: '우리 가족 펫' }).click()
  await page.getByRole('radio').first().waitFor()
  check('펫 고르기: 6종(강아지·고양이·새·돼지·토끼·햄스터)', (await page.getByRole('radio').count()) === 6)
  check('펫 고르기 가로 넘침 없음', (await overflow()) <= 0)
  await page.screenshot({ path: '/tmp/claude-0/pet-adopt.png', fullPage: true })
  await page.getByRole('radio', { name: /돼지/ }).click()
  await page.getByLabel('이름 (12자까지)').fill('꿀꿀이')
  await page.getByRole('button', { name: '꿀꿀이 데려오기' }).click()
  check('데려오면 펫 화면', await seen('꿀꿀이') && await seen('돼지 · 아기'))
  check('공부 전엔 돌봄권 0개(버튼 잠김)', await page.getByRole('button', { name: '산책하기 (0개)' }).isDisabled())
  check('돌봄권 모으는 법 안내', await seen('오늘의 한 판을 끝내면 1개'))

  // 단어 넣고 오늘의 한 판
  await page.goto(BASE + '/#/add?tab=manual')
  await page.getByText('✍️ 여러 개 한 번에 적기').click()
  await page.getByLabel('한 줄에 하나씩 (영어 뜻)').fill(Object.entries(W).map(([a, b]) => `${a} ${b}`).join('\n'))
  await page.getByRole('button', { name: '아래 목록에 넣기' }).click()
  await page.getByRole('button', { name: /12개 단어장에 넣기/ }).click()
  await page.getByText('12개 담았어요!').waitFor()
  await page.goto(BASE + '/#/quiz/daily')
  for (let n = 0; n < 20; n++) {
    if (await page.getByText('오늘의 한 판 끝!').isVisible()) break
    const input = page.locator('input.field')
    await input.waitFor({ timeout: 8000 })
    const ph = await input.getAttribute('placeholder')
    const ans = ph === '한글 뜻' ? W[(await page.locator('.card p.font-title').first().textContent()).trim()] : KO[(await page.locator('.card p.font-jua').nth(1).textContent()).trim()]
    await input.fill(ans || 'x'); await page.keyboard.press('Enter')
    await page.waitForTimeout(1300)
  }
  await page.getByText('오늘의 한 판 끝!').waitFor()
  await page.waitForTimeout(1500)
  await page.goto(BASE + '/#/')
  check('홈: 돌봄권 배지', await page.getByText(/돌봄권 \d/).first().waitFor({ timeout: 8000 }).then(() => true, () => false))
  await page.goto(BASE + '/#/pet')
  await page.getByText('꿀꿀이').first().waitFor()
  const walk = page.getByRole('button', { name: '산책하기 (1개)' })
  check('한 판을 끝내면 산책권 1개', await walk.waitFor({ timeout: 8000 }).then(() => true, () => false))
  check('문제 10개 맞히면 밥 1개', await page.getByRole('button', { name: /밥 주기 \([1-3]개\)/ }).isEnabled().catch(() => false))
  const funBefore = Number(await page.locator('section[aria-label="펫 상태"] .tabular-nums').nth(1).textContent())
  await walk.click()
  check('산책하면 고맙다는 말', await seen('고마워요!', 4000))
  await page.waitForTimeout(1800)
  const funAfter = Number(await page.locator('section[aria-label="펫 상태"] .tabular-nums').nth(1).textContent())
  check('산책하면 신남이 오름', funAfter > funBefore, `${funBefore} → ${funAfter}`)
  check('쓴 산책권은 0개로', await page.getByRole('button', { name: '산책하기 (0개)' }).isDisabled())
  check('오늘 돌봐 준 가족에 하나 · 산책', await page.locator('li').filter({ hasText: '하나' }).filter({ hasText: '산책하기' }).first().isVisible())
  check('펫 화면 가로 넘침 없음', (await overflow()) <= 0)
  await page.screenshot({ path: '/tmp/claude-0/pet-main.png', fullPage: true })
  await page.reload()
  check('새로고침 뒤에도 기록 유지', await page.getByRole('button', { name: '산책하기 (0개)' }).waitFor({ timeout: 8000 }).then(() => true, () => false))

  // 서버도 돌봄권을 확인(화면을 건너뛰고 직접 불러도 막힘)
  const r = await page.evaluate(async ({ url, key }) => {
    const s = JSON.parse(localStorage.getItem('foldy.session'))
    const m = JSON.parse(localStorage.getItem('foldy.member'))
    const res = await fetch(url + '/rest/v1/rpc/foldy_pet_care', { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'x-foldy-token': s.token }, body: JSON.stringify({ p_member: m, p_action: 'walk' }) })
    return { status: res.status, body: await res.text() }
  }, SUPA)
  check('돌봄권 없이 부르면 서버가 거절', r.status >= 400 && r.body.includes('NO_TICKET'), String(r.status))

  // 다른 가족 구성원도 같은 펫
  await page.goto(BASE + '/#/')
  await page.getByRole('button', { name: '내 캐릭터 보기' }).click()
  await page.getByRole('button', { name: '내 프로필 열기' }).click()
  await page.getByRole('button', { name: '🔁 프로필 바꾸기' }).click()
  await page.getByText('가족 추가').click()
  await page.getByLabel('이름', { exact: true }).fill('둘')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.getByText('안녕, 둘!').waitFor()
  await page.goto(BASE + '/#/pet')
  check('다른 구성원도 같은 펫(꿀꿀이)', await seen('꿀꿀이'))
  check('다른 구성원 화면에도 하나가 돌본 기록', await page.locator('li').filter({ hasText: '하나' }).filter({ hasText: '산책하기' }).first().isVisible())
  check('공부 안 한 구성원은 돌봄권 0개', await page.getByRole('button', { name: '밥 주기 (0개)' }).isDisabled())
  // 이름 바꾸기
  await page.getByRole('button', { name: '이름 바꾸기' }).click()
  await page.getByLabel('펫 이름').fill('꿀돼지')
  await page.getByRole('button', { name: '저장' }).click()
  check('이름 바꾸기', await seen('꿀돼지'))
} catch (e) { check('실행 중 오류', false, e.message.split('\n').slice(0, 3).join(' / ')); await page.screenshot({ path: '/tmp/claude-0/pet-err.png' }) }
check('페이지 오류 없음', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} 통과 · 가족 ${id}`)
