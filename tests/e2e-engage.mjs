// 재방문 기능 점검: 오늘의 한 판 · 아는 단어 거르기 · 이번 주 성장 · 가족 목표(👏 깨우기) · 친구 소개 링크
// 실행: BASE=http://localhost:4173 node tests/e2e-engage.mjs
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const id = 'e2e_eg' + Date.now().toString(36)
const results = []
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`) }
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, acceptDownloads: true })
await ctx.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1'); localStorage.setItem('foldy.noStarter', '1'); localStorage.setItem('foldy.hadLogin', '1'); localStorage.setItem('foldy.meMore', '1') } catch {} })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const seen = (t, ms = 8000) => page.getByText(t).first().waitFor({ timeout: ms }).then(() => true, () => false)
const W = { apple: '사과', school: '학교', tiger: '호랑이', banana: '바나나', happy: '행복한', library: '도서관', orange: '오렌지' }
const KO = Object.fromEntries(Object.entries(W).map(([a, b]) => [b, a]))
try {
  // 친구 소개 링크로 들어오면 안내 + 가족 만들기 탭
  await page.goto(BASE + '/?from=' + encodeURIComponent('테스트네'))
  check('친구 소개 링크: 안내 문구', await seen('가족이 폴디를 소개했어요'))
  check('친구 소개 링크: 가족 만들기 탭', await page.getByLabel('가족 이름').isVisible())
  await page.getByLabel('가족 이름').fill('참여')
  await page.getByLabel('가족 아이디').fill(id)
  await page.getByLabel('비밀번호').fill('pass1234')
  await page.getByLabel('개인정보 처리방침 동의').check()
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  check('보호자 확인 없이는 가입 안 됨', await seen('만 14세 이상 보호자가 만들어요', 3000))
  await page.getByLabel('보호자 확인').check()
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  await page.getByRole('button', { name: '저장했어요, 시작하기' }).click()
  await page.getByText('누가 공부할까요?').waitFor()
  await page.getByLabel('이름', { exact: true }).fill('하나')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.getByText('안녕, 하나!').waitFor()
  await page.goto(BASE + '/#/add?tab=manual')
  await page.getByText('✍️ 여러 개 한 번에 적기').click()
  await page.getByLabel('한 줄에 하나씩 (영어 뜻)').fill(Object.entries(W).map(([a, b]) => `${a} ${b}`).join('\n'))
  await page.getByRole('button', { name: '아래 목록에 넣기' }).click()
  await page.getByRole('button', { name: /7개 단어장에 넣기/ }).click()
  await page.getByText('7개 담았어요!').waitFor()

  // 오늘의 한 판
  await page.goto(BASE + '/#/')
  await page.getByRole('link', { name: '▶ 오늘의 한 판' }).click()
  let n = 0
  for (; n < 20; n++) {
    if (await page.getByText('오늘의 한 판 끝!').isVisible()) break
    const input = page.locator('input.field')
    await input.waitFor({ timeout: 8000 })
    const ph = await input.getAttribute('placeholder')
    let ans
    if (ph === '한글 뜻') ans = W[(await page.locator('.card p.font-title').first().textContent()).trim()]
    else ans = KO[(await page.locator('.card p.font-jua').nth(1).textContent()).trim()]
    await input.fill(ans || 'x'); await page.keyboard.press('Enter')
    await page.waitForTimeout(1300)
  }
  check('오늘의 한 판: 끝까지 풀면 완료 화면', await seen('오늘의 한 판 끝!'), `${n}문제`)
  check('끝낸 화면에서 알림 켜기 권유', await seen('내일 잊지 않게 알려 드릴까요?'))
  await page.getByRole('button', { name: '괜찮아요' }).click()
  check('괜찮아요 누르면 권유 닫힘', !(await page.getByText('내일 잊지 않게 알려 드릴까요?').isVisible()))
  await page.goto(BASE + '/#/')
  check('홈: 오늘의 한 판 완료 표시', await seen('오늘의 한 판 완료'))

  // 아는 단어 거르기(남은 미학습 단어가 없을 수 있으니 단어를 더 넣고)
  await page.goto(BASE + '/#/add?tab=manual')
  await page.getByText('✍️ 여러 개 한 번에 적기').click()
  await page.getByLabel('한 줄에 하나씩 (영어 뜻)').fill('cat 고양이\ndog 개\nbird 새')
  await page.getByRole('button', { name: '아래 목록에 넣기' }).click()
  await page.getByRole('button', { name: /3개 단어장에 넣기/ }).click()
  await page.getByText('3개 담았어요!').waitFor()
  await page.goto(BASE + '/#/sort')
  await page.getByRole('button', { name: '✅ 알아요' }).waitFor({ timeout: 8000 })
  const total = (await page.locator('header, .sticky').first().textContent()).match(/\d+\/(\d+)/)?.[1]
  await page.getByRole('button', { name: '뜻 보기' }).click()
  await page.getByRole('button', { name: '✅ 알아요' }).click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: '📖 배울게요' }).click()
  await page.getByRole('button', { name: '여기까지 할게요' }).click()
  check('거르기: 알아요 1 · 배울게요 1 집계', await seen('정리 끝!') && /알아요\s*1/.test(await page.locator('body').textContent()), `대상 ${total}개`)
  await page.goto(BASE + '/#/book?f=o')
  await page.waitForTimeout(1500)
  check('알아요 단어는 ○ 완료로', (await page.getByRole('button', { name: /메뉴$/ }).count()) >= 1)

  // 이번 주 성장 + 가족 목표(구성원 2명)
  await page.goto(BASE + '/#/me')
  await page.getByRole('button', { name: '＋ 가족 추가' }).click()
  await page.getByLabel('이름', { exact: true }).fill('둘')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.waitForTimeout(1500)
  await page.goto(BASE + '/#/week')
  check('이번 주 성장: 공부한 날 1/7일', await seen('공부한 날 1/7일'))
  check('이번 주 성장: 한 판 1번', await seen('오늘의 한 판 1번'))
  check('가족 공동 목표 보임', await seen('가족 공동 목표'))
  await page.getByRole('button', { name: '둘 깨우기' }).click()
  check('👏 깨우기 → 깨웠어요(하루 한 번)', await page.getByRole('button', { name: '둘 깨우기' }).getByText('깨웠어요').waitFor({ timeout: 8000 }).then(() => true, () => false))
  const dl = page.waitForEvent('download', { timeout: 10000 }).then((d) => d.suggestedFilename(), () => '')
  await page.getByRole('button', { name: '📤 성장 카드 공유하기' }).click()
  const fname = await dl
  check('성장 카드: 이미지로 저장', /^foldy-week-.*\.png$/.test(fname), fname)
  await page.screenshot({ path: '/tmp/claude-0/week.png', fullPage: true })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  check('360px 가로 넘침 없음', overflow <= 0, String(overflow))
  await page.reload()
  check('새로고침 뒤에도 깨웠어요 유지', await page.getByRole('button', { name: '둘 깨우기' }).getByText('깨웠어요').waitFor({ timeout: 8000 }).then(() => true, () => false))
  // 오류가 나면 자동 기록(서버에서 확인: foldy_errors에 'e2e 테스트 오류')
  await page.evaluate(() => { setTimeout(() => { throw new Error('e2e 테스트 오류 ' + location.hash) }, 0) })
  await page.waitForTimeout(1500)
  await page.goto(BASE + '/#/me')
  check('내 정보: 친구 가족 소개하기', await seen('친구 가족에게 소개하기'))
} catch (e) { check('실행 중 오류', false, e.message.split('\n').slice(0, 3).join(' / ')); await page.screenshot({ path: '/tmp/claude-0/eg.png' }) }
const realErrors = errors.filter((m) => !m.includes('e2e 테스트 오류'))
check('페이지 오류 없음', realErrors.length === 0, realErrors.join(' | '))
await browser.close()
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} 통과 · 가족 ${id}`)
