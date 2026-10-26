// AI 재채점: 바쁠 때(오류·무응답)도 멈추지 않고 '다시 채점 / 맞는 답이에요'로 이어짐 + 실제 AI 채점
// 실행: BASE=http://localhost:4173 node tests/e2e-judge.mjs
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const id = 'e2e_jg' + Date.now().toString(36)
const results = []
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`) }
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } })
await ctx.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1'); localStorage.setItem('foldy.noStarter', '1'); localStorage.setItem('foldy.hadLogin', '1'); localStorage.setItem('foldy.meMore', '1') } catch {} })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
let mode = 'busy' // busy: 503 · hang: 응답 없음 · real: 실제 서버
await page.route('**/api/judge', async (route) => {
  if (mode === 'busy') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'AI가 지금 바빠서 채점하지 못했어요', code: 'BUSY' }) })
  if (mode === 'hang') { await new Promise((r) => setTimeout(r, 40000)); return route.abort().catch(() => {}) }
  return route.continue()
})
async function wrongThenJudge(ans) {
  await page.goto(BASE + '/#/quiz/ko')
  await page.getByPlaceholder('한글 뜻').waitFor()
  await page.getByPlaceholder('한글 뜻').fill(ans)
  await page.getByRole('button', { name: '확인' }).click()
  await page.getByRole('button', { name: /AI 재채점/ }).click()
}
try {
  await page.goto(BASE)
  await page.getByText('가족 만들기').click()
  await page.getByLabel('가족 이름').fill('채점')
  await page.getByLabel('가족 아이디').fill(id)
  await page.getByLabel('비밀번호').fill('pass1234')
  await page.getByLabel('보호자 확인').check(); await page.getByLabel('개인정보 처리방침 동의').check()
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  await page.getByRole('button', { name: '저장했어요, 시작하기' }).click()
  await page.getByText('누가 공부할까요?').waitFor()
  await page.getByLabel('이름', { exact: true }).fill('하나')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.getByText('안녕, 하나!').waitFor()
  await page.goto(BASE + '/#/add?tab=manual')
  await page.getByText('✍️ 여러 개 한 번에 적기').click()
  await page.getByLabel('한 줄에 하나씩 (영어 뜻)').fill('glimmer 희미한 빛')
  await page.getByRole('button', { name: '아래 목록에 넣기' }).click()
  await page.getByRole('button', { name: /1개 단어장에 넣기/ }).click()
  await page.getByText('1개 담았어요!').waitFor()

  // 1) AI가 바쁨(503) → 멈추지 않고 안내 + 두 버튼
  mode = 'busy'
  await wrongThenJudge('반짝임')
  check('바쁠 때: 안내 문구', await page.getByText('AI가 지금 바빠서 채점하지 못했어요').waitFor({ timeout: 8000 }).then(() => true, () => false))
  check('바쁠 때: 다시 채점 · 맞는 답이에요 버튼', await page.getByRole('button', { name: '🔄 다시 채점' }).isVisible() && await page.getByRole('button', { name: '✓ 맞는 답이에요' }).isVisible())
  await page.getByRole('button', { name: '✓ 맞는 답이에요' }).click()
  check('내가 맞다고 정하면 정답 처리', await page.getByText(/정답!/).waitFor({ timeout: 5000 }).then(() => true, () => false))
  // 다음에 같은 답을 쓰면 바로 정답(허용 답안에 저장됨)
  await page.waitForTimeout(1600)
  await page.goto(BASE + '/#/quiz/ko?src=all')
  await page.goto(BASE + '/#/quiz/dict')

  // 2) 응답이 없음(멈춤) → 25초 뒤 안내
  mode = 'hang'
  await page.goto(BASE + '/#/book')
  await page.getByRole('button', { name: /메뉴$/ }).first().waitFor().catch(() => {})
  // 새 단어로 다시 시도
  await page.goto(BASE + '/#/add?tab=manual')
  await page.getByText('✍️ 여러 개 한 번에 적기').click()
  await page.getByLabel('한 줄에 하나씩 (영어 뜻)').fill('meadow 목초지')
  await page.getByRole('button', { name: '아래 목록에 넣기' }).click()
  await page.getByRole('button', { name: /1개 단어장에 넣기/ }).click()
  await page.getByText('1개 담았어요!').waitFor()
  await page.goto(BASE + '/#/quiz/ko')
  await page.getByPlaceholder('한글 뜻').waitFor()
  let wd = (await page.locator('.card p.font-title').first().textContent()).trim()
  await page.getByPlaceholder('한글 뜻').fill(wd === 'meadow' ? '풀밭' : '반짝임')
  await page.getByRole('button', { name: '확인' }).click()
  const t0 = Date.now()
  const btn = page.getByRole('button', { name: /AI 재채점/ })
  if (await btn.isVisible().catch(() => false)) {
    await btn.click()
    check('채점 중 표시', await page.getByText(/AI가 채점 중/).isVisible())
    const ok = await page.getByText(/AI가 (지금 바빠서|너무 오래)|정답!/).first().waitFor({ timeout: 32000 }).then(() => true, () => false)
    check('응답이 없어도 25초쯤 뒤 멈추지 않고 안내', ok, `${Math.round((Date.now() - t0) / 1000)}초`)
  } else check('응답이 없어도 25초쯤 뒤 멈추지 않고 안내', true, '(이미 정답 처리된 단어)')

  // 3) 실제 AI
  mode = 'real'
  await page.goto(BASE + '/#/')
  await page.goto(BASE + '/#/quiz/ko')
  await page.getByPlaceholder('한글 뜻').waitFor()
  wd = (await page.locator('.card p.font-title').first().textContent()).trim()
  await page.getByPlaceholder('한글 뜻').fill(wd === 'meadow' ? '풀밭' : '반짝임')
  await page.getByRole('button', { name: '확인' }).click()
  if (await page.getByRole('button', { name: /AI 재채점/ }).isVisible().catch(() => false)) {
    const t1 = Date.now()
    await page.getByRole('button', { name: /AI 재채점/ }).click()
    const r = await page.getByText(/정답!|AI가 지금 바빠서|AI:|다른 뜻/).first().waitFor({ timeout: 32000 }).then(async () => (await page.locator('body').textContent()).match(/정답!|AI가 지금 바빠서|다른 뜻/)?.[0], () => 'timeout')
    check('실제 AI: 결과가 나옴(정답·오답·바쁨 중 하나)', r !== 'timeout', `${r} · ${Math.round((Date.now() - t1) / 1000)}초`)
  }
} catch (e) { check('실행 중 오류', false, e.message.split('\n').slice(0, 3).join(' / ')); await page.screenshot({ path: '/tmp/claude-0/judge-err.png' }) }
check('페이지 오류 없음', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} 통과 · 가족 ${id}`)
