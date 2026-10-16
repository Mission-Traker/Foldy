// 처음 소개 슬라이드 점검. 실행: BASE=http://localhost:4173 node tests/e2e-intro.mjs
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const SHOTS = process.env.SHOTS
const results = []
const check = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? ' — ' + x : ''}`) }
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const dlg = page.getByRole('dialog', { name: '폴디 소개' })
try {
  await page.goto(BASE)
  check('처음 접속하면 소개가 뜸', await dlg.waitFor({ timeout: 8000 }).then(() => true, () => false))
  check('첫 장: 안녕, 나는 폴디!', await page.getByText('안녕, 나는 폴디!').isVisible())
  check('첫 장엔 이전 버튼 없음', !(await page.getByRole('button', { name: '이전' }).isVisible()))
  const total = Number((await page.getByText(/^1 \/ \d+$/).textContent()).split('/')[1])
  check('슬라이드 수 표시', total >= 6, `${total}장`)
  // 아이콘이 하나씩: 셋째 아이콘은 처음엔 아직 투명
  const op0 = await page.locator('.intro-ic').nth(2).evaluate((el) => getComputedStyle(el).opacity)
  await page.waitForTimeout(1600)
  const op1 = await page.locator('.intro-ic').nth(2).evaluate((el) => getComputedStyle(el).opacity)
  check('아이콘이 차례로 나타남', Number(op0) < 0.5 && Number(op1) === 1, `${op0} → ${op1}`)
  check('아이콘 3개', (await page.locator('.intro-ic').count()) === 3)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/intro-1.png` })
  check('마지막 전엔 시작 버튼 없음', !(await page.getByRole('button', { name: '폴디 시작하기' }).isVisible()))
  const titles = []
  for (let k = 2; k <= total; k++) {
    await page.getByRole('button', { name: '다음' }).click()
    await page.getByText(new RegExp(`^${k} / ${total}$`)).waitFor()
    titles.push(await page.locator('h2').first().textContent())
    if (SHOTS && (k === 2 || k === 4 || k === total)) { await page.waitForTimeout(1700); await page.screenshot({ path: `${SHOTS}/intro-${k}.png` }) }
  }
  check('다음으로 끝까지 넘어감', titles.length === total - 1, titles.join(' / '))
  await page.getByRole('button', { name: '이전' }).click()
  check('이전 버튼', await page.getByText(new RegExp(`^${total - 1} / ${total}$`)).isVisible())
  // 휴대폰 밀기
  await page.evaluate(() => {
    const el = document.querySelector('[role=dialog]')
    const t = (x) => [new Touch({ identifier: 1, target: el, clientX: x, clientY: 400 })]
    el.dispatchEvent(new TouchEvent('touchstart', { touches: t(300), changedTouches: t(300), bubbles: true }))
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: t(120), bubbles: true }))
  })
  check('왼쪽으로 밀면 다음 장', await page.getByText(new RegExp(`^${total} / ${total}$`)).isVisible())
  await page.getByRole('button', { name: '폴디 시작하기' }).click()
  check('폴디 시작하기 → 앱(로그인 화면)', await dlg.isHidden() && await page.getByText('가족 만들기').isVisible())
  await page.reload()
  await page.waitForTimeout(1500)
  check('다시 들어오면 소개 안 뜸', await dlg.isHidden())
  check('가로 넘침 없음', await page.evaluate(() => document.documentElement.scrollWidth <= 390))
} catch (e) { check('예외 없이 완료', false, e.message.split('\n')[0]) }
check('페이지 오류 없음', errors.length === 0, errors.join(' | '))
await browser.close()
const f = results.filter((x) => !x).length
console.log(`\n${results.length - f}/${results.length} 통과`)
process.exit(f ? 1 : 0)
