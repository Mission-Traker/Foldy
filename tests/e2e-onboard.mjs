// 처음 온 사람의 길: 가족 만들기 탭이 먼저 · 가족 초대 링크(?join=)는 로그인 탭 + 아이디 채움
// → 구성원 만들면 '추천 단어 5개로 바로 시작' → 첫 문제까지 / 내 정보는 자주 쓰는 것 위, 설정은 접힘
// 실행: BASE=http://localhost:4173 node tests/e2e-onboard.mjs
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const id = 'e2e_ob' + Date.now().toString(36)
const results = []
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`) }
const browser = await pw.chromium.launch()
const errors = []
const fresh = async () => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 760 } })
  await ctx.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1') } catch {} })
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message)); return p
}
try {
  // 1) 처음 온 기기: 가족 만들기 탭
  let page = await fresh()
  await page.goto(BASE)
  check('처음 온 기기는 가족 만들기 탭부터', await page.getByLabel('가족 이름').isVisible({ timeout: 5000 }).catch(() => false) || await page.getByLabel('가족 이름').waitFor({ timeout: 5000 }).then(() => true, () => false))
  await page.getByRole('button', { name: '그 아이디로 로그인' }).click()
  check('‘그 아이디로 로그인’을 누르면 로그인 탭', await page.getByRole('button', { name: '들어가기' }).isVisible())
  await page.close()

  // 2) 가족 초대 링크
  page = await fresh()
  await page.goto(BASE + '/?join=yoonfamily')
  await page.getByRole('button', { name: '들어가기' }).waitFor({ timeout: 8000 })
  check('가족 초대 링크는 로그인 탭 + 아이디 채움', (await page.getByLabel('가족 아이디').inputValue()) === 'yoonfamily')
  await page.close()

  // 3) 가입 → 구성원 → 시작 안내 → 바로 시작
  page = await fresh()
  await page.goto(BASE)
  await page.getByLabel('가족 이름').fill('첫걸음')
  await page.getByLabel('가족 아이디').fill(id)
  await page.getByLabel('비밀번호').fill('pass1234')
  await page.getByLabel('보호자 확인').check(); await page.getByLabel('개인정보 처리방침 동의').check()
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  await page.getByRole('button', { name: '저장했어요, 시작하기' }).click()
  await page.getByLabel('이름', { exact: true }).fill('하나')
  await page.getByRole('button', { name: '추가하기' }).click()
  const sheet = page.getByRole('dialog', { name: '바로 시작하기' })
  check('구성원을 만들면 시작 안내 창', await sheet.waitFor({ timeout: 10000 }).then(() => true, () => false))
  await sheet.getByRole('button', { name: /추천 단어 5개로 바로 시작/ }).click()
  await page.waitForURL(/quiz\/daily/, { timeout: 15000 })
  check('한 번 누르면 첫 문제', await page.locator('input.field, .card button').first().waitFor({ timeout: 10000 }).then(() => true, () => false))
  await page.goto(BASE + '/#/book')
  check('추천 단어 5개가 단어장에', /내 단어 5개|5개/.test(await page.locator('body').innerText()), '')
  await page.goto(BASE + '/#/')
  check('단어가 생기면 시작 안내 창 안 뜸', !(await sheet.isVisible()))

  // 4) 내 정보 정리
  await page.goto(BASE + '/#/x'); await page.goto(BASE + '/#/me')
  await page.getByText('오늘의 목표').first().waitFor()
  const order = await page.evaluate(() => ['오늘의 목표', '알림', '레벨', '우리 가족', '가족 초대하기'].map((t) => [...document.querySelectorAll('h2')].findIndex((h) => h.textContent.trim().startsWith(t))))
  check('자주 쓰는 것 순서(목표·알림·레벨·가족·초대)', order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), order.join(','))
  check('설정은 접혀 있음(효과음 안 보임)', !(await page.getByRole('heading', { name: '효과음' }).isVisible()))
  await page.getByRole('button', { name: /설정 더 보기/ }).click()
  check('설정 더 보기를 누르면 효과음·계정', await page.getByRole('heading', { name: '효과음' }).isVisible() && await page.getByRole('button', { name: '비밀번호 바꾸기' }).isVisible())
  await page.getByRole('button', { name: '레벨 바꾸기' }).click()
  check('레벨은 바꾸기를 눌러야 목록', await page.getByText('Lv.05').isVisible())

  // 5) 카톡 안: 가입 화면엔 안내 창 없음
  const kctx = await browser.newContext({ viewport: { width: 375, height: 760 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.5' })
  await kctx.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1') } catch {} })
  const kp = await kctx.newPage()
  await kp.goto(BASE); await kp.getByLabel('가족 이름').waitFor()
  check('카톡 안 가입 화면엔 사파리 안내 창 없음', !(await kp.getByText('카카오톡 안에서 열렸어요').isVisible()))
  check('카톡 안에서도 가족 만들기 탭부터', await kp.getByLabel('가족 이름').isVisible())
  check('화면 오류 없음', errors.length === 0, errors.join(' | '))
} catch (e) { check('진행 중 오류', false, e.message.split('\n')[0]) }
const ok = results.filter((r) => r.ok).length
console.log(`\n${ok}/${results.length} 통과 · 가족 ${id}`)
await browser.close()
process.exit(ok === results.length ? 0 : 1)
