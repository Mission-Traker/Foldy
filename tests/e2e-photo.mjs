// 사진으로 단어 넣기: AI가 한 번 붐벼도 다음 사진은 다시 AI로 읽고, 하루 한도면 남은 사진은 기기 인식으로
// 실행: BASE=http://localhost:4173 node tests/e2e-photo.mjs   (LIVE=1 이면 실제 AI로 한 장 읽기도 확인)
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const IMG = fileURLToPath(new URL('./fixtures-words.jpg', import.meta.url))
const id = 'e2e_ph' + Date.now().toString(36)
const results = []
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`) }
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } })
await ctx.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1'); localStorage.setItem('foldy.noStarter', '1'); localStorage.setItem('foldy.hadLogin', '1'); localStorage.setItem('foldy.meMore', '1') } catch {} })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => { if (!/importScripts|tesseract/i.test(e.message)) errors.push(e.message) })
let mode = 'busyThenOk', calls = 0, lastVia = '?'
page.on('response', async (r) => { if (r.url().includes('/api/extract') && mode === 'live') { try { lastVia = (await r.json()).via } catch {} } })
await page.route('**/api/extract', async (route) => {
  if (mode === 'live') return route.continue()
  calls++
  if (mode === 'busyThenOk' && calls === 1) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: '사진을 읽지 못했어요: 무료 AI가 지금 붐벼요' }) })
  if (mode === 'limit') return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: '오늘 AI 사용량을 다 썼어요', code: 'LIMIT' }) })
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ words: [{ word: 'journey', meaning: '여행' }, { word: 'brave', meaning: '용감한' }] }) })
})
// 기기 글자 인식(Tesseract)은 테스트에서 시간만 오래 걸리니 막아 둠 → 그 사진은 '실패 목록'으로
await page.route(/tesseract|traineddata/, (r) => r.abort())
async function upload(n) {
  await page.goto(BASE + '/#/words'); await page.goto(BASE + '/#/add')
  const inp = page.locator('input[type=file]')
  await inp.setInputFiles(Array(n).fill(IMG))
  await page.waitForFunction(() => !document.querySelector('[role=status].fixed'), null, { timeout: 150000 })
}
try {
  await page.goto(BASE)
  await page.getByText('가족 만들기').click()
  await page.getByLabel('가족 이름').fill('사진')
  await page.getByLabel('가족 아이디').fill(id)
  await page.getByLabel('비밀번호').fill('pass1234')
  await page.getByLabel('보호자 확인').check(); await page.getByLabel('개인정보 처리방침 동의').check()
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  await page.getByRole('button', { name: '저장했어요, 시작하기' }).click()
  await page.getByText('누가 공부할까요?').waitFor()
  await page.getByLabel('이름', { exact: true }).fill('하나')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.getByText('안녕, 하나!').waitFor()

  await upload(2)
  check('첫 사진이 붐벼도 두 번째 사진은 다시 AI로 읽음', calls === 2, `AI 호출 ${calls}번`)
  const body = await page.locator('body').innerText()
  check('AI가 읽은 단어가 목록에 들어감', (await page.locator('input[value="journey"]').count()) > 0 || body.includes('journey'))

  mode = 'limit'; calls = 0
  await upload(2)
  check('하루 한도면 남은 사진은 AI를 다시 부르지 않음', calls === 1, `AI 호출 ${calls}번`)

  if (process.env.LIVE) {
    mode = 'live'
    const t0 = Date.now()
    await upload(1)
    const secs = Math.round((Date.now() - t0) / 1000)
    const n = await page.locator('input[value="whisper"], input[value="ancient"], input[value="harvest"]').count()
    check('실제 AI로 사진 한 장 읽기', n > 0, `${secs}초, 찾은 단어 ${n}개 확인 · 읽은 AI: ${lastVia}`)
  }
  check('화면 오류 없음', errors.length === 0, errors.join(' | '))
} catch (e) { check('진행 중 오류', false, e.message.split('\n')[0]) }
const ok = results.filter((r) => r.ok).length
console.log(`\n${ok}/${results.length} 통과 · 가족 ${id}`)
await browser.close()
process.exit(ok === results.length ? 0 : 1)
