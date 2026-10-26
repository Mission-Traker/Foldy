// 다른 기기에서 숫자 비밀번호를 걸면, 이 기기는 새로고침 때 프로필 고르기(비밀번호 입력)로 감
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const SB = 'https://gilpvbwpbioihvjbldpm.supabase.co'
const KEY = 'sb_publishable_kMgYoZQrs5LRk-zrUshxOA_wZz1keiW'
const id = 'e2e_pl' + Date.now().toString(36)
const results = []
const check = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? ' — ' + x : ''}`) }
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1'); localStorage.setItem('foldy.noStarter', '1'); localStorage.setItem('foldy.hadLogin', '1'); localStorage.setItem('foldy.meMore', '1') } catch {} })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
try {
  await page.goto(BASE)
  await page.getByText('가족 만들기').click()
  await page.getByLabel('가족 이름').fill('잠금')
  await page.getByLabel('가족 아이디').fill(id)
  await page.getByLabel('비밀번호').fill('pass1234')
  await page.getByLabel('보호자 확인').check(); await page.getByLabel('개인정보 처리방침 동의').check()
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  await page.getByRole('button', { name: '저장했어요, 시작하기' }).click()
  await page.getByLabel('이름', { exact: true }).fill('대장')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.getByText('안녕, 대장!').waitFor()
  const { token, mid } = await page.evaluate(() => ({ token: JSON.parse(localStorage.getItem('foldy.session')).token, mid: JSON.parse(localStorage.getItem('foldy.member')) }))
  // 다른 기기에서 비밀번호를 건 것처럼(이 기기에는 잠금 해제 토큰을 저장하지 않음)
  const r = await fetch(`${SB}/rest/v1/rpc/foldy_set_pin`, { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json', 'x-foldy-token': token }, body: JSON.stringify({ p_member: mid, p_pin: '4321' }) })
  check('다른 기기에서 비밀번호 걸기', r.ok)
  await page.reload()
  check('새로고침하면 프로필 고르기로', await page.getByText('누가 공부할까요?').waitFor({ timeout: 10000 }).then(() => true, () => false))
  await page.getByText('대장').first().click()
  for (const d of '4321') await page.getByRole('button', { name: d, exact: true }).click()
  await page.getByRole('button', { name: '확인', exact: true }).click()
  check('비밀번호를 넣으면 다시 들어감', await page.getByText('안녕, 대장!').waitFor({ timeout: 10000 }).then(() => true, () => false))
  await page.reload()
  check('한 번 열면 다음부터는 바로', await page.getByText('안녕, 대장!').waitFor({ timeout: 10000 }).then(() => true, () => false))
} catch (e) { check('예외 없이 완료', false, e.message.split('\n')[0]) }
check('페이지 오류 없음', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(`\n${results.filter(Boolean).length}/${results.length} 통과 · 가족 ${id}`)
