// '한 번 더' 검수: 모르는 단어만 다시 나오는지, 느린 인터넷에서도 맞힌 단어가 다시 나오지 않는지
// 실행: BASE=http://localhost:4173 node tests/e2e-retry.mjs
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }

const BASE = process.env.BASE || 'http://localhost:4173'
const id = 'e2e_rt' + Date.now().toString(36)
const results = []
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`) }

const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1') } catch {} })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('dialog', (d) => d.accept())
// 느린 인터넷 흉내: 단어 저장(PATCH)을 1.5초 늦춤
await page.route('**/rest/v1/foldy_words**', async (route) => {
  if (route.request().method() === 'PATCH') await new Promise((r) => setTimeout(r, 1500))
  await route.continue()
})

const ANS = { apple: '사과', happy: '행복한', library: '도서관', orange: '오렌지', school: '학교' }
const word = async () => (await page.locator('.card p.font-title').first().textContent()).trim()
const progress = async () => (await page.locator('header, .sticky').first().textContent()).match(/(\d+)\/(\d+)/)

try {
  await page.goto(BASE)
  await page.getByText('가족 만들기').click()
  await page.getByLabel('가족 이름').fill('재도전')
  await page.getByLabel('가족 아이디').fill(id)
  await page.getByLabel('비밀번호').fill('1234')
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  await page.getByText('누가 공부할까요?').waitFor()
  await page.getByLabel('이름', { exact: true }).fill('검수')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.getByText('안녕, 검수!').waitFor()
  await page.goto(BASE + '/#/add?tab=manual')
  await page.getByText('✍️ 여러 개 한 번에 적기').click()
  await page.getByLabel('한 줄에 하나씩 (영어 뜻)').fill(Object.entries(ANS).map(([w, m]) => `${w} ${m}`).join('\n'))
  await page.getByRole('button', { name: '아래 목록에 넣기' }).click()
  await page.getByRole('button', { name: /5개 단어장에 넣기/ }).click()
  await page.getByText('5개 담았어요!').waitFor()

  // 1회차: 5문제 중 library·school 두 개를 일부러 틀림
  await page.goto(BASE + '/#/quiz/ko')
  await page.getByPlaceholder('한글 뜻').waitFor()
  const wrongSet = new Set(['library', 'school'])
  for (let i = 0; i < 5; i++) {
    const w = await word()
    await page.getByPlaceholder('한글 뜻').fill(wrongSet.has(w) ? '자동차' : ANS[w])
    await page.getByRole('button', { name: '확인' }).click()
    if (wrongSet.has(w)) { await page.getByText('틀렸어요').waitFor(); await page.getByRole('button', { name: '다음 →' }).click() }
    else await page.getByText('정답!').waitFor()
    if (i < 4) await page.locator('.card p.font-title').first().filter({ hasNotText: new RegExp(`^${w}$`) }).waitFor()
  }
  await page.getByText(/5문제 중 3개 정답/).waitFor()
  check('1회차 결과: 5문제 중 3개', true)
  const btn = page.getByRole('button', { name: /한 번 더/ })
  check('버튼에 남은 단어 수 표시(2개)', /2/.test(await btn.textContent()), (await btn.textContent()).trim())

  // 저장이 끝나기 전에 바로 누름(느린 인터넷)
  await btn.click()
  await page.getByPlaceholder('한글 뜻').waitFor()
  const seen = []
  for (let i = 0; i < 2; i++) {
    const w = await word(); seen.push(w)
    await page.getByPlaceholder('한글 뜻').fill(ANS[w])
    await page.getByRole('button', { name: '확인' }).click()
    await page.getByText('정답!').waitFor()
    if (i < 1) await page.locator('.card p.font-title').first().filter({ hasNotText: new RegExp(`^${w}$`) }).waitFor()
  }
  check('2회차: 틀린 단어만 나옴(library, school)', seen.sort().join() === 'library,school', seen.join(','))
  check('2회차 문제 수 2개', await page.getByText(/2문제 중 2개 정답/).waitFor({ timeout: 6000 }).then(() => true, () => false))
  const allPass = await page.getByText('이 퀴즈는 모두 통과!').waitFor({ timeout: 4000 }).then(() => true, () => false)
  check('다 맞히면 "한 번 더" 대신 모두 통과 안내', allPass && !(await page.getByRole('button', { name: /한 번 더/ }).isVisible()))

  // 저장 확인: 새로고침해도 다시 안 나와야 함
  await page.waitForTimeout(2500)
  await page.goto(BASE + '/#/quiz/ko')
  await page.reload()
  check('새로고침 후 뜻 퀴즈는 모두 통과 상태', await page.getByText(/모두 통과했어요/).waitFor({ timeout: 10000 }).then(() => true, () => false))
} catch (e) {
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT })
  check('예외 없이 완료', false, e.message.split('\n')[0])
}
check('페이지 스크립트 오류 없음', errors.length === 0, errors.join(' | '))
await browser.close()
const fail = results.filter((r) => !r.ok).length
console.log(`\n${results.length - fail}/${results.length} 통과 · ${id}`)
process.exit(fail ? 1 : 0)
