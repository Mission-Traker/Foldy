// 느린 망: 가입 직후 구성원 목록(빈 목록)이 늦게 도착해도 방금 추가한 첫 구성원이 사라지지 않는지
// 실행: BASE=http://localhost:4173 node tests/e2e-race.mjs
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } })
await ctx.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1'); localStorage.setItem('foldy.noStarter', '1'); localStorage.setItem('foldy.hadLogin', '1'); localStorage.setItem('foldy.meMore', '1') } catch {} })
const page = await ctx.newPage()
let delayOn = false
await page.route(/foldy_members\?select/, async (route) => {
  if (delayOn && route.request().method() === 'GET') {
    const r = await route.fetch()
    await new Promise((z) => setTimeout(z, 5000))
    return route.fulfill({ response: r })
  }
  return route.continue()
})
const id = 'e2e_rc' + Date.now().toString(36)
let ok = false
try {
  await page.goto(BASE)
  await page.getByText('가족 만들기').click()
  await page.getByLabel('가족 이름').fill('경합')
  await page.getByLabel('가족 아이디').fill(id)
  await page.getByLabel('비밀번호').fill('pass1234')
  await page.getByLabel('보호자 확인').check()
  await page.getByLabel('개인정보 처리방침 동의').check()
  delayOn = true
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  await page.getByRole('button', { name: '저장했어요, 시작하기' }).click()
  await page.getByText('누가 공부할까요?').waitFor()
  await page.getByLabel('이름', { exact: true }).fill('하나')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.waitForTimeout(7000)
  ok = await page.getByText('안녕, 하나!').isVisible()
} catch (e) { console.log('오류', e.message.split('\n')[0]) }
console.log(`${ok ? 'PASS' : 'FAIL'}  느린 구성원 목록이 늦게 와도 첫 구성원 유지`)
console.log(`\n${ok ? 1 : 0}/1 통과 · 가족 ${id}`)
await browser.close()
process.exit(ok ? 0 : 1)
