// 브라우저 자동 점검(390px 모바일 화면)
// 실행: BASE=http://localhost:4173 node tests/e2e.mjs   (PLAYWRIGHT_BROWSERS_PATH 필요 시 지정)
// 실제 DB에 'e2e_' 로 시작하는 테스트 가족을 만듭니다.
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }

const BASE = process.env.BASE || 'http://localhost:4173'
const id = 'e2e_' + Date.now().toString(36)
const results = []
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`) }

const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('dialog', (d) => d.accept())

try {
  await page.goto(BASE)
  await page.getByText('가족 만들기').click()
  // 잘못된 입력
  await page.getByLabel('가족 아이디').fill('AB')
  await page.getByLabel('비밀번호').fill('12')
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  check('가입: 잘못된 아이디 거부', await page.getByText('아이디는 영어 소문자').isVisible())
  // 정상 가입
  await page.getByLabel('가족 이름').fill('테스트가족')
  await page.getByLabel('가족 아이디').fill(id)
  await page.getByLabel('비밀번호').fill('1234')
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  await page.getByText('누가 공부할까요?').waitFor()
  check('가입 후 프로필 화면', true)

  // 구성원 추가(빈 이름 → 거부)
  await page.getByRole('button', { name: '추가하기' }).click()
  check('구성원: 빈 이름 거부', await page.getByText('이름을 적어 주세요').isVisible())
  await page.getByLabel('이름').fill('하은')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.getByText('안녕, 하은!').waitFor()
  check('구성원 추가 → 홈', true)
  await page.getByText('오늘의 추천 단어').waitFor()
  await page.locator('section li').nth(4).waitFor({ timeout: 8000 }).catch(() => {})
  const recCount = await page.locator('section li').count()
  check('오늘의 추천 5개 표시', recCount === 5, `${recCount}개`)

  // 직접 추가
  await page.getByText('✍️ 직접 추가').click()
  // 자동완성 검색 → 탭해서 담기
  await page.getByLabel('영어나 한글로 찾기').fill('ora')
  await page.getByRole('button', { name: /orange/ }).first().waitFor()
  check('자동완성: ora → orange', true)
  await page.getByLabel('영어나 한글로 찾기').fill('우산')
  await page.getByRole('button', { name: /umbrella/ }).first().click()
  await page.getByRole('button', { name: /umbrella.*담음/ }).waitFor()
  check('한글 검색 → 탭해서 담기(umbrella)', true)
  await page.getByText('✍️ 여러 개 한 번에 적기').click()
  await page.getByLabel('한 줄에 하나씩 (영어 뜻)').fill('apple 사과\nhappy - 행복한, 기쁜\nlibrary: 도서관\n사과 사과')
  await page.getByRole('button', { name: '아래 목록에 넣기' }).click()
  check('직접 추가: 한글 단어 오류 표시', await page.getByText('영어 단어에는 알파벳만').isVisible())
  await page.getByRole('button', { name: /3개 단어장에 넣기/ }).click()
  await page.getByText('3개 담았어요!').waitFor()
  check('직접 추가 3개 저장', true)
  // 중복 추가
  await page.getByRole('button', { name: '더 추가' }).click()
  await page.getByText('✍️ 여러 개 한 번에 적기').click()
  await page.getByLabel('한 줄에 하나씩 (영어 뜻)').fill('Apple 사과')
  await page.getByRole('button', { name: '아래 목록에 넣기' }).click()
  await page.getByRole('button', { name: /1개 단어장에 넣기/ }).click()
  check('중복 단어 건너뜀', await page.getByText('이미 있던 단어 1개').waitFor().then(() => true, () => false))
  await page.getByRole('button', { name: '단어장 보기' }).click()

  // 단어장
  await page.getByRole('heading', { name: '단어장' }).waitFor()
  const rows = page.locator('ul li').filter({ hasText: '미학습' })
  check('단어장 4개 모두 ✕ 미학습', (await rows.count()) === 4)
  check('뜻 가림판 닫혀 있음', (await page.locator('.flap:not(.open)').count()) === 4)
  await page.getByRole('button', { name: '뜻 보기' }).first().click()
  check('가림판 탭 → 열림', (await page.locator('.flap.open').count()) === 1)
  await page.getByRole('button', { name: /^ABC/ }).click()
  const firstWord = await page.locator('ul li .font-title.text-\\[19px\\]').first().textContent()
  check('알파벳 정렬', firstWord === 'apple', firstWord)
  await page.getByRole('button', { name: /^ABC/ }).click()
  const firstDesc = await page.locator('ul li .font-title.text-\\[19px\\]').first().textContent()
  check('알파벳 역순', firstDesc === 'umbrella', firstDesc)

  // 퀴즈: 영어 → 뜻 (맥락 채점)
  await page.goto(BASE + '/#/quiz/ko')
  for (let i = 0; i < 4; i++) {
    const w = (await page.locator('.card p.font-title').first().textContent()).trim()
    const ans = { apple: '사과', happy: '즐겁고 행복하다', library: '자동차', umbrella: '우산' }[w]
    await page.getByPlaceholder('한글 뜻').fill(ans)
    await page.getByRole('button', { name: '확인' }).click()
    if (w === 'library') {
      await page.getByText('틀렸어요').waitFor()
      check('오답 처리(library=자동차)', true)
      await page.getByRole('button', { name: '📌 오답노트로' }).click()
      await page.getByText('📌 오답노트에 있어요').waitFor()
      check('오답노트로 보내기', true)
      await page.getByRole('button', { name: '다음 →' }).click()
      if (i < 3) await page.locator('.card p.font-title').first().filter({ hasNotText: /^library$/ }).waitFor()
    } else {
      await page.getByText('정답!').waitFor()
      check(`정답 처리(${w}=${ans})`, true)
      if (i < 3) await page.locator('.card p.font-title').first().filter({ hasNotText: new RegExp(`^${w}$`) }).waitFor()
    }
  }
  check('퀴즈 결과 화면(4문제 중 3개)', await page.getByText(/4문제 중 3개 정답/).waitFor().then(() => true, () => false))
  // 새로고침 없이 앱 안에서 오답노트로 이동(버그 재현 확인)
  await page.getByRole('button', { name: '그만하기' }).click()
  await page.getByRole('link', { name: /오답노트/ }).click()
  check('새로고침 없이 오답노트에 보임(버그 수정)', await page.locator('li').filter({ hasText: 'library' }).waitFor({ timeout: 5000 }).then(() => true, () => false))

  // 상태 확인: △
  await page.goto(BASE + '/#/book')
  await page.locator('ul li').filter({ hasText: '학습 중' }).nth(3).waitFor({ timeout: 8000 }).catch(() => {})
  check('푼 단어는 △ 학습 중', (await page.locator('ul li').filter({ hasText: '학습 중' }).count()) === 4)

  // 오답노트
  await page.goto(BASE + '/#/wrong')
  check('오답노트에 library', await page.locator('li').filter({ hasText: 'library' }).isVisible())

  // 새로고침 후 유지
  await page.reload()
  await page.getByRole('heading', { name: '오답노트' }).waitFor()
  check('새로고침 후 로그인·데이터 유지', await page.locator('li').filter({ hasText: 'library' }).waitFor().then(() => true, () => false))

  // 뜻 → 영어 (철자)
  await page.goto(BASE + '/#/quiz/en')
  await page.reload()
  const meaning = (await page.locator('.card p.font-jua.text-3xl').textContent()).trim()
  const map = { '사과': 'Apple', '행복한, 기쁜': 'happy', '도서관': 'library', '우산': 'umbrella' }
  await page.getByPlaceholder('English').fill(map[meaning] || 'x')
  await page.getByRole('button', { name: '확인' }).click()
  check('철자 정답(대소문자 무시)', await page.getByText('정답!').isVisible({ timeout: 3000 }).catch(() => false), meaning)

  // 레벨 진단
  await page.goto(BASE + '/#/level-test')
  await page.getByText('뜻을 아는 단어를 모두 눌러 주세요').waitFor()
  await page.getByRole('button', { name: '다음' }).click()
  check('레벨 진단 → 결과', await page.getByText('에게 맞는 레벨은').isVisible())

  // △·✕ 단어 넛지
  await page.goto(BASE + '/#/book')
  check('단어별 남은 퀴즈 표시와 끝내기 버튼', await page.getByRole('button', { name: /○까지|하나 남았어요/ }).first().waitFor().then(() => true, () => false))
  check('○ 만들기 배너', await page.getByText('지금 끝내기').isVisible())
  await page.getByRole('button', { name: /○까지|하나 남았어요/ }).first().click()
  check('끝내기 → 그 단어 집중 퀴즈', await page.getByRole('heading', { name: /○ 만들기/ }).waitFor().then(() => true, () => false))

  // 프로필 편집·비밀번호
  await page.goto(BASE + '/#/study')
  check('학습 화면 ○ 만들기 도전 카드', await page.getByText('○ 만들기 도전').waitFor().then(() => true, () => false))
  await page.getByRole('button', { name: '내 프로필' }).click()
  await page.getByRole('button', { name: '비밀번호 만들기' }).click()
  for (const d of '1234') await page.getByRole('button', { name: d, exact: true }).click()
  await page.getByRole('button', { name: '확인', exact: true }).click()
  for (const d of '1234') await page.getByRole('button', { name: d, exact: true }).click()
  await page.getByRole('button', { name: '확인', exact: true }).click()
  check('비밀번호 설정', await page.getByText('🔒 비밀번호로 보호 중').waitFor().then(() => true, () => false))
  await page.getByRole('button', { name: '🔁 프로필 바꾸기' }).click()
  await page.getByText('누가 공부할까요?').waitFor()
  check('프로필 목록에 🔒 표시', await page.getByLabel('비밀번호 잠김').isVisible())
  await page.getByText('가족 추가').click()
  await page.getByLabel('이름', { exact: true }).fill('동생')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.getByText('안녕, 동생!').waitFor()
  await page.goto(BASE + '/#/family')
  await page.getByText(/단어 \d+개/).first().waitFor()
  check('가족 학습현황에 두 사람', (await page.getByText(/단어 \d+개/).count()) === 2)
  await page.getByRole('button', { name: '내 프로필' }).click()
  await page.getByRole('button', { name: '🔁 프로필 바꾸기' }).click()
  await page.getByText('하은').click()
  for (const d of '0000') await page.getByRole('button', { name: d, exact: true }).click()
  await page.getByRole('button', { name: '확인', exact: true }).click()
  check('틀린 비밀번호 거부', await page.getByText('비밀번호가 맞지 않아요').waitFor().then(() => true, () => false))
  for (const d of '1234') await page.getByRole('button', { name: d, exact: true }).click()
  await page.getByRole('button', { name: '확인', exact: true }).click()
  check('맞는 비밀번호 → 하은 홈', await page.getByText('안녕, 하은!').waitFor().then(() => true, () => false))

  // 390px 가로 넘침 없음
  await page.goto(BASE + '/#/book')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  check('390px 가로 스크롤 없음', !overflow)
} catch (e) {
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT })
  check('예외 없이 완료', false, e.message.split('\n')[0])
}
check('페이지 스크립트 오류 없음', errors.length === 0, errors.join(' | '))
await browser.close()
const fail = results.filter((r) => !r.ok).length
console.log(`\n${results.length - fail}/${results.length} 통과 · 테스트 가족 아이디: ${id}`)
process.exit(fail ? 1 : 0)
