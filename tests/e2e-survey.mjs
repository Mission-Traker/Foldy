// 베타 설문 팝업 점검(가입 3일 지난 구성원이 있는 가족으로): FID=아이디 PW=비밀번호 MEMBER=이름 node tests/e2e-survey.mjs
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const results = []
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`) }
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } })
await ctx.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1') } catch {} })
const page = await ctx.newPage()
try {
  await page.goto(BASE)
  await page.getByLabel('가족 아이디').fill(process.env.FID)
  await page.getByLabel('비밀번호').fill(process.env.PW || 'pass1234')
  await page.getByRole('button', { name: '들어가기' }).click()
  await page.getByText(process.env.MEMBER || '하나').first().click()
  const shown = await page.getByRole('dialog', { name: '폴디 설문' }).waitFor({ timeout: 8000 }).then(() => true, () => false)
  check('3일째 설문이 뜸', shown && await page.getByText('폴디를 쓴 지 3일째예요').isVisible())
  await page.screenshot({ path: '/tmp/claude-0/survey.png' })
  await page.getByRole('radio', { name: '4점' }).click()
  await page.getByLabel('한 줄 의견').fill('e2e 설문 테스트')
  await page.getByRole('button', { name: '보내기' }).click()
  check('보내면 고마워요 안내', await page.getByText('고마워요!').waitFor({ timeout: 8000 }).then(() => true, () => false))
  await page.reload()
  await page.waitForTimeout(3000)
  check('다시 열어도 같은 설문은 안 뜸', !(await page.getByRole('dialog', { name: '폴디 설문' }).count()))
} catch (e) { check('실행 중 오류', false, e.message.split('\n').slice(0, 3).join(' / ')) }
await browser.close()
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} 통과`)
