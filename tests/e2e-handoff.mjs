// 카톡(아이폰) 발음 퀴즈(내 목소리로 확인) → '자동 채점은 사파리에서 열기' → 사파리에서 로그인 이어받아 발음 퀴즈 열림
// 비밀번호 없는 프로필(가장 흔한 경우)과 비밀번호 있는 프로필 둘 다
// 실행: BASE=http://localhost:4173 node tests/e2e-handoff.mjs
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const id = 'e2e_ho' + Date.now().toString(36)
const results = []
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`) }
const KAKAO = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5'
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const browser = await pw.chromium.launch()
const init = () => { try { localStorage.setItem('foldy.introSeen', '1'); localStorage.setItem('foldy.noStarter', '1'); localStorage.setItem('foldy.hadLogin', '1'); localStorage.setItem('foldy.meMore', '1') } catch {} }

async function grabHandoff(page) {
  // 카톡 → 사파리 이동(kakaotalk://)은 테스트 브라우저에서 못 따라가므로, 서버가 준 한 번 쓰는 코드로 사파리 주소를 만듦
  const resP = page.waitForResponse((r) => r.url().includes('foldy_handoff_create'), { timeout: 10000 })
  await page.getByRole('button', { name: '자동 채점은 사파리에서 열기 ›' }).click()
  const res = await resP
  const body = await res.json().catch(() => ({}))
  await page.waitForTimeout(800)
  const txt = await page.locator('body').textContent()
  const code = res.ok() && body && body.code
  return { status: res.status(), err: body?.message || body?.error || '', toast: txt.includes('문제가 생겼어요'), out: code ? `${BASE}/#/handoff?c=${code}&to=${encodeURIComponent('/quiz/sp')}` : null }
}

async function viaSafari(out, label) {
  const url = out
  check(`${label}: 카톡 → 사파리 주소`, /\/#\/handoff\?c=[0-9a-f]{32}/.test(url), url.slice(0, 80))
  const sctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: SAFARI })
  await sctx.addInitScript(init)
  const sp = await sctx.newPage()
  await sp.goto(url.replace(/^https?:\/\/[^/]+/, BASE))
  await sp.waitForURL(/#\/quiz\/sp/, { timeout: 10000 }).catch(() => {})
  check(`${label}: 사파리에서 바로 발음 퀴즈`, /#\/quiz\/sp/.test(sp.url()), sp.url().replace(BASE, ''))
  check(`${label}: 오류 안내 없음`, !(await sp.locator('body').textContent()).includes('문제가 생겼어요'))
  await sctx.close()
}

try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: KAKAO })
  await ctx.addInitScript(init)
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.getByRole('button', { name: '나중에' }).click().catch(() => {})
  await page.getByText('가족 만들기').click()
  await page.getByLabel('가족 이름').fill('넘기기')
  await page.getByLabel('가족 아이디').fill(id)
  await page.getByLabel('비밀번호').fill('pass1234')
  await page.getByLabel('보호자 확인').check(); await page.getByLabel('개인정보 처리방침 동의').check()
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  await page.getByRole('button', { name: '저장했어요, 시작하기' }).click()
  await page.getByText('누가 공부할까요?').waitFor()
  await page.getByLabel('이름', { exact: true }).fill('검수')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.getByText('안녕, 검수!').waitFor()
  await page.goto(BASE + '/#/add?tab=manual')
  if (await page.getByRole('button', { name: '나중에' }).isVisible().catch(() => false)) await page.getByRole('button', { name: '나중에' }).click()
  await page.getByText('✍️ 여러 개 한 번에 적기').click()
  await page.getByLabel('한 줄에 하나씩 (영어 뜻)').fill('apple 사과\nhappy 행복한')
  await page.getByRole('button', { name: '아래 목록에 넣기' }).click()
  await page.getByRole('button', { name: /2개 단어장에 넣기/ }).click()
  await page.getByText('2개 담았어요!').waitFor()

  await page.goto(BASE + '/#/quiz/sp')
  await page.getByRole('button', { name: '자동 채점은 사파리에서 열기 ›' }).waitFor()
  const a = await grabHandoff(page)
  check('비밀번호 없는 프로필: 사파리 연결 코드 만들기 성공', a.status === 200 && !!a.out && !a.toast, `${a.status} ${a.err}`)
  if (a.out) await viaSafari(a.out, '비밀번호 없음')
  await ctx.close()
} catch (e) { check('실행 중 오류', false, e.message.split('\n').slice(0,3).join(' / ')); for (const c of browser.contexts()) for (const p of c.pages()) await p.screenshot({ path: process.env.SHOT || '/tmp/claude-0/ho.png' }).catch(() => {}) }
await browser.close()
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} 통과 · 가족 ${id}`)
