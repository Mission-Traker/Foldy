// 관리자 페이지 점검. 2단계로 실행:
//  PHASE=a FID=e2e_adxxx node tests/e2e-admin.mjs  → 가족 만들기 + 관리자가 아니면 잠김(화면·서버)
//  (SQL로 그 가족의 '윤씨대장' 구성원을 foldy_admins에 넣기)
//  PHASE=b FID=e2e_adxxx node tests/e2e-admin.mjs  → 관리자 페이지 4개 탭 · 유료 AI 없음 · 랜딩 미리보기 · 숫자 비밀번호 잠금
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const SB = 'https://gilpvbwpbioihvjbldpm.supabase.co'
const KEY = 'sb_publishable_kMgYoZQrs5LRk-zrUshxOA_wZz1keiW'
const FID = process.env.FID, PHASE = process.env.PHASE || 'a'
const STATE = process.env.STATE || '/tmp/admin-state.json'
const results = []
const check = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? ' — ' + x : ''}`) }
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...(PHASE === 'b' ? { storageState: STATE } : {}) })
await ctx.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1') } catch {} })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const SHOT = process.env.SHOT // 예: /tmp/ad → /tmp/ad-home.png …
const shot = (n) => (SHOT ? page.screenshot({ path: `${SHOT}-${n}.png`, fullPage: true }) : null)
const seen = (t, ms = 8000) => page.getByText(t).first().waitFor({ timeout: ms }).then(() => true, () => false)
const rpc = async (fn, body = {}, extra = {}) => {
  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('foldy.session')).token)
  const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json', 'x-foldy-token': token, ...extra }, body: JSON.stringify(body) })
  return { status: r.status, data: await r.json().catch(() => null) }
}
try {
  if (PHASE === 'a') {
    await page.goto(BASE)
    await page.getByText('가족 만들기').click()
    await page.getByLabel('가족 이름').fill('관리자검수')
    await page.getByLabel('가족 아이디').fill(FID)
    await page.getByLabel('비밀번호').fill('pass1234')
    await page.getByLabel('개인정보 처리방침 동의').check()
    await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
    await page.getByRole('button', { name: '저장했어요, 시작하기' }).click()
    await page.getByLabel('이름', { exact: true }).fill('윤씨대장')
    await page.getByRole('button', { name: '추가하기' }).click()
    await page.getByText('안녕, 윤씨대장!').waitFor()
    await page.goto(BASE + '/#/me')
    await page.getByText('🛠 앱 수정요청').waitFor()
    check('관리자 아니면 내 정보에 관리자 페이지 없음', !(await page.getByRole('link', { name: /관리자 페이지/ }).isVisible()))
    await page.goto(BASE + '/#/admin')
    check('관리자 아니면 화면 잠김', await seen('관리자만 볼 수 있어요'))
    const o = await rpc('foldy_admin_overview')
    check('관리자 아니면 서버도 통계를 안 줌', o.status >= 400, String(o.status))
    const p = await rpc('foldy_admin_set_paid', { p_family: '00000000-0000-0000-0000-000000000000', p_paid: true })
    check('관리자 아니면 유료 AI도 못 바꿈', p.status >= 400, String(p.status))
    await ctx.storageState({ path: STATE })
  } else {
    await page.goto(BASE + '/#/me')
    const link = page.getByRole('link', { name: /관리자 페이지/ })
    check('관리자: 내 정보 맨 위에 관리자 페이지', await link.waitFor({ timeout: 8000 }).then(() => true, () => false))
    await link.click()
    check('한눈에: 오늘 공부한 가족', await seen('오늘 공부한 가족'))
    check('한눈에: AI 사용(무료만)', await seen('오늘 AI 사용') && await seen('유료 AI는 쓰지 않아요'))
    await shot('home')
    await page.getByRole('button', { name: '가족', exact: true }).click()
    const mine = page.locator('li').filter({ hasText: '우리 가족' })
    check('가족 탭: 테스트 포함하면 우리 가족 보임', await page.getByRole('button', { name: '테스트 포함' }).click().then(() => mine.waitFor({ timeout: 8000 })).then(() => true, () => false))
    await shot('families')
    check('유료 AI 버튼 없음(무료로만 운영)', !(await page.getByRole('button', { name: /유료 AI/ }).count()))
    await page.getByRole('button', { name: '수정요청', exact: true }).click()
    check('수정요청 탭', await page.getByRole('button', { name: /^전체 \d+/ }).waitFor({ timeout: 8000 }).then(() => true, () => false))
    await page.getByRole('button', { name: '랜딩', exact: true }).click()
    check('랜딩 탭: 카톡 미리보기', await seen('카톡으로 보냈을 때 미리보기'))
    const img = page.getByAltText('링크 미리보기 그림')
    await page.waitForFunction(() => document.querySelector('img[alt="링크 미리보기 그림"]')?.complete, null, { timeout: 8000 }).catch(() => {})
    check('카톡 미리보기 그림이 보임', (await img.evaluate((el) => el.naturalWidth)) > 0)
    await shot('landing')
    await page.getByRole('button', { name: /소개 슬라이드/ }).click()
    check('소개 슬라이드가 열림', await page.getByRole('dialog', { name: '폴디 소개' }).waitFor({ timeout: 6000 }).then(() => true, () => false))
    const dlg = page.getByRole('dialog', { name: '폴디 소개' })
    while (await dlg.getByRole('button', { name: '다음' }).isVisible().catch(() => false)) await dlg.getByRole('button', { name: '다음' }).click()
    await dlg.getByRole('button', { name: '폴디 시작하기' }).click()
    check('소개를 끝내도 관리자 화면 그대로', await seen('카톡으로 보냈을 때 미리보기'))
    await page.getByRole('button', { name: /첫 화면/ }).click()
    check('첫 화면 미리보기(로그인 화면 + 안내 띠)', await seen('랜딩 미리보기') && await seen('접어서 외우는 우리 가족 단어장'))
    await page.getByLabel('가족 아이디').fill('someone')
    await page.getByLabel('비밀번호').fill('pass1234')
    await page.getByRole('button', { name: '들어가기' }).click()
    check('미리보기에서는 로그인 안 됨', await seen('미리보기에서는 실제로 가입·로그인되지 않아요'))
    await shot('preview')
    await page.getByRole('button', { name: '닫기' }).click()
    check('닫으면 관리자 랜딩 탭으로(로그인 그대로)', await seen('카톡으로 보냈을 때 미리보기'))
    // 관리자 구성원에 숫자 비밀번호를 걸면 그 비밀번호로 연 기기에서만
    const mid = await page.evaluate(() => JSON.parse(localStorage.getItem('foldy.member')))
    const setp = await rpc('foldy_set_pin', { p_member: mid, p_pin: '2468' })
    check('관리자 구성원에 숫자 비밀번호 걸기', setp.status < 300, String(setp.status))
    check('비밀번호를 걸면 연 적 없는 기기에선 관리자 아님', (await rpc('foldy_admin_ok')).data === false)
    const mt = { 'x-foldy-member': setp.data?.token || '' }
    check('그 비밀번호로 연 기기에선 관리자', (await rpc('foldy_admin_ok', {}, mt)).data === true)
    await rpc('foldy_set_pin', { p_member: mid, p_pin: '' }, mt) // 다시 돌릴 수 있게 원래대로
  }
} catch (e) { check('예외 없이 완료', false, e.message.split('\n')[0]); if (SHOT) await page.screenshot({ path: SHOT + '-fail.png', fullPage: true }) }
check('페이지 오류 없음', errors.length === 0, errors.join(' | '))
await browser.close()
const f = results.filter((x) => !x).length
console.log(`\n${results.length - f}/${results.length} 통과`)
process.exit(f ? 1 : 0)
