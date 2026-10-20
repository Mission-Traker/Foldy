// 줄바꿈 전수 점검: 화면마다 '단어 중간에서 줄이 바뀐 곳', '…로 잘린 글', '칸 밖으로 넘친 글', '마지막 줄에 한 글자만 남은 곳'을 찾음
// 실행: BASE=http://localhost:4173 node tests/linebreak.mjs   (WIDTHS=360,390 기본)
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const WIDTHS = (process.env.WIDTHS || '360,390').split(',').map(Number)
const id = 'e2e_lb' + Date.now().toString(36)

// 브라우저 안에서 도는 검사
function scan() {
  const word = /[\p{L}\p{N}]/u
  const out = { breaks: [], cut: [], overflow: [], orphans: [] }
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0' }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  let n
  while ((n = walker.nextNode())) {
    const t = n.nodeValue
    if (!t || t.trim().length < 2) continue
    const el = n.parentElement
    if (!el || !vis(el) || el.closest('svg, script, style, textarea, input, [aria-hidden=true]')) continue
    // 글자마다 줄 위치
    let prevTop = null, prevCh = null, lines = [[]]
    for (let i = 0; i < t.length; i++) {
      const ch = t[i]
      if (/\s/.test(ch)) { prevCh = ch; lines[lines.length - 1].push(ch); continue }
      range.setStart(n, i); range.setEnd(n, i + 1)
      const rs = range.getClientRects()
      if (!rs.length) continue
      const top = Math.round(rs[0].top)
      if (prevTop !== null && Math.abs(top - prevTop) > 4) {
        if (prevCh && word.test(prevCh) && word.test(ch)) out.breaks.push(t.slice(Math.max(0, i - 8), i) + '⏎' + t.slice(i, i + 8))
        lines.push([])
      }
      lines[lines.length - 1].push(ch)
      prevTop = top; prevCh = ch
    }
  }
  // 문단 단위로 마지막 줄에 한두 글자만 남았는지
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el) || el.closest('svg, textarea, [aria-hidden=true]')) continue
    const disp = getComputedStyle(el).display
    if (disp.startsWith('inline') && disp !== 'inline-block' && disp !== 'inline-flex') continue
    if (![...el.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim())) continue
    const rows = new Map()
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let tn
    while ((tn = tw.nextNode())) {
      const pe = tn.parentElement
      if (pe !== el && !getComputedStyle(pe).display.startsWith('inline')) continue
      for (let i = 0; i < tn.nodeValue.length; i++) {
        if (/\s/.test(tn.nodeValue[i])) continue
        range.setStart(tn, i); range.setEnd(tn, i + 1)
        const r = range.getClientRects()[0]
        if (!r) continue
        const key = Math.round(r.top / 6)
        rows.set(key, (rows.get(key) || '') + tn.nodeValue[i])
      }
    }
    if (rows.size > 1) {
      const keys = [...rows.keys()].sort((x, y) => x - y)
      const last = rows.get(keys[keys.length - 1])
      if (last.replace(/[^\p{L}\p{N}]/gu, '').length <= 2 && !/^[\d.%/·]+$/.test(last)) out.orphans.push((el.innerText || '').replace(/\s+/g, ' ').trim().slice(-26))
    }
  }
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el) || el.closest('svg')) continue
    const cs = getComputedStyle(el)
    const txt = (el.innerText || '').trim()
    if (!txt) continue
    if (el.children.length > 3 && !(cs.overflowX === 'auto' || cs.overflowX === 'scroll')) continue
    if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 2 && el.children.length) out.cut.push('가로로 숨은 칸: ' + (el.innerText || '').replace(/\s+/g, ' ').slice(0, 30))
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.cut.push(txt.slice(0, 30))
    else if ((cs.overflowX === 'hidden' || cs.overflow === 'hidden') && el.scrollWidth > el.clientWidth + 2 && !el.querySelector('img,svg,canvas') && cs.display !== 'flex') out.overflow.push(txt.slice(0, 30))
  }
  if (document.documentElement.scrollWidth > window.innerWidth + 1) out.overflow.push('(화면 전체 가로 넘침)')
  for (const k of Object.keys(out)) out[k] = [...new Set(out[k])]
  return out
}

const report = []
const browser = await pw.chromium.launch()
async function audit(page, name) {
  await page.waitForTimeout(1900) // 애니메이션 끝나기 기다림
  const r = await page.evaluate(scan)
  const issues = r.breaks.length + r.cut.length + r.overflow.length + r.orphans.length
  report.push({ name, w: page.viewportSize().width, ...r })
  console.log(`${issues ? '⚠️' : '✅'} [${page.viewportSize().width}] ${name}${issues ? '' : ' — 문제 없음'}`)
  for (const b of r.breaks) console.log('     단어 잘림: ' + b)
  for (const c of r.cut) console.log('     …로 잘림: ' + c)
  for (const o of r.overflow) console.log('     넘침: ' + o)
  for (const o of r.orphans) console.log('     외톨이 줄: …' + o)
}

const WORDS = [
  'apple 사과', 'responsibility 책임, 책임감', 'congratulations 축하해요, 축하합니다', 'extraordinary 보통이 아닌, 비범한, 놀라운',
  'environment 환경', 'library 도서관', 'umbrella 우산', 'photosynthesis 광합성(식물이 빛으로 양분을 만드는 일)',
  'neighborhood 이웃, 동네', 'happy 행복한, 기쁜',
]

for (const W of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 800 }, hasTouch: true })
  const page = await ctx.newPage()
  page.on('dialog', (d) => d.accept())
  await page.goto(BASE)
  await page.getByRole('dialog', { name: '폴디 소개' }).waitFor()
  const total = Number((await page.getByText(/^1 \/ \d+$/).textContent()).split('/')[1])
  for (let k = 1; k <= total; k++) {
    await audit(page, `소개 슬라이드 ${k}`)
    if (k < total) await page.getByRole('button', { name: '다음' }).click()
  }
  await page.getByRole('button', { name: '폴디 시작하기' }).click()
  await audit(page, '로그인')
  await page.getByRole('button', { name: '비밀번호를 잊었어요' }).click()
  await audit(page, '비밀번호 찾기')
  await page.getByRole('button', { name: '로그인으로 돌아가기' }).click()
  await page.getByRole('button', { name: '개인정보 처리방침' }).last().click()
  await audit(page, '개인정보 처리방침')
  await page.getByRole('button', { name: '확인' }).click()
  await page.getByText('가족 만들기').click()
  await audit(page, '가족 만들기')
  await page.getByLabel('가족 이름').fill('줄바꿈점검가족')
  await page.getByLabel('가족 아이디').fill(id + W)
  await page.getByLabel('비밀번호').fill('pass1234')
  await page.getByLabel('보호자 확인').check(); await page.getByLabel('개인정보 처리방침 동의').check()
  await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
  await page.getByText('비밀번호 복구 코드').waitFor()
  await page.getByRole('button', { name: '저장했어요, 시작하기' }).click()
  await page.getByText('누가 공부할까요?').waitFor()
  await audit(page, '프로필 고르기(처음)')
  await page.getByLabel('이름', { exact: true }).fill('하은이')
  await page.getByRole('button', { name: '추가하기' }).click()
  await page.getByText('안녕, 하은이!').waitFor()
  await audit(page, '홈(단어 없음)')
  await page.goto(BASE + '/#/add?tab=manual')
  await audit(page, '단어 추가 · 직접')
  await page.getByText('✍️ 여러 개 한 번에 적기').click()
  await page.getByLabel('한 줄에 하나씩 (영어 뜻)').fill(WORDS.join('\n'))
  await page.getByRole('button', { name: '아래 목록에 넣기' }).click()
  await audit(page, '단어 추가 · 여러 개 미리보기')
  await page.getByRole('button', { name: /단어장에 넣기/ }).click()
  await page.getByText(/담았어요!/).waitFor()
  await page.goto(BASE + '/#/add')
  await audit(page, '단어 추가 · 사진')
  for (const [path, name] of [['/', '홈'], ['/book', '단어장'], ['/study', '학습'], ['/wrong', '오답노트(빈)'], ['/me', '내 정보'], ['/family', '가족 학습현황'], ['/expand', '확장 학습'], ['/level-test', '레벨 진단'], ['/exam/new', '시험 만들기']]) {
    await page.goto(BASE + '/#' + path)
    await audit(page, name)
  }
  await page.goto(BASE + '/#/book')
  await page.getByText('탭해서 보기').first().click().catch(() => {})
  await audit(page, '단어장(뜻 펼침)')
  for (const [mode, name] of [['ko', '퀴즈 영→뜻'], ['en', '퀴즈 뜻→영'], ['sp', '퀴즈 발음']]) {
    await page.goto(BASE + '/#/quiz/' + mode)
    await page.waitForTimeout(800)
    await audit(page, name)
  }
  await page.goto(BASE + '/#/quiz/ko')
  await page.getByPlaceholder('한글 뜻').fill('자동차')
  await page.getByRole('button', { name: '확인' }).click()
  await audit(page, '퀴즈 오답 화면')
  await page.getByText('📌 오답노트에 담았어요').waitFor()
  await page.goto(BASE + '/#/')
  await page.getByRole('link', { name: /먼저 하기|다시 볼 단어/ }).first().waitFor().catch(() => {})
  await audit(page, '홈(다시 볼 단어 있음)')
  await page.goto(BASE + '/#/wrong')
  await audit(page, '오답노트(오늘 볼 단어)')
  await page.goto(BASE + '/#/wrong/practice')
  await page.getByText('1. 다시 보기').waitFor()
  await audit(page, '다시 익히기 ① 다시 보기')
  await page.getByRole('button', { name: /쉬운 문제로/ }).click()
  await audit(page, '다시 익히기 ② 쉬운 문제')
  await page.locator('.grid button').first().click()
  await audit(page, '다시 익히기 ② 결과')
  if (await page.getByRole('button', { name: /다음 →/ }).isVisible()) await page.getByRole('button', { name: /다음 →/ }).click()
  await page.getByPlaceholder('한글 뜻').waitFor()
  await audit(page, '다시 익히기 ③ 원래 방식')
  await page.getByRole('button', { name: '모르겠어요' }).click()
  await audit(page, '다시 익히기 ③ 결과')
  await page.getByRole('button', { name: '다음 →' }).click()
  await page.getByText('오늘 다시 익히기 끝!').waitFor()
  await audit(page, '다시 익히기 끝')
  await page.goto(BASE + '/#/pet')
  await page.getByRole('radio').first().waitFor()
  await audit(page, '가족 펫 고르기')
  await page.getByRole('radio', { name: /햄스터/ }).click()
  await page.getByRole('button', { name: /데려오기/ }).click()
  await page.getByText('시간이 지나면 줄어요', { exact: false }).waitFor()
  await audit(page, '가족 펫')
  await page.goto(BASE + '/#/study')
  await page.getByRole('button', { name: '내 프로필' }).click()
  await page.getByLabel('이름(닉네임)').fill('하은이2')
  await audit(page, '내 프로필(이름 바꾸기 경고)')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await page.getByText('프로필을 저장했어요').waitFor()
  await page.getByRole('button', { name: '내 프로필' }).click()
  await audit(page, '내 프로필(이름 잠김)')
  await page.getByRole('button', { name: '닫기' }).first().click()
  await page.goto(BASE + '/#/me')
  for (const [btn, name, close] of [['비밀번호 바꾸기', '비밀번호 바꾸기 창', '닫기'], [/복구 코드 (만들기|새로 받기)/, '복구 코드 창', '닫기'], ['가족 계정 탈퇴', '탈퇴 창', '그만두기']]) {
    await page.getByRole('button', { name: btn }).click()
    await audit(page, name)
    await page.getByRole('button', { name: close }).last().click()
  }
  await page.getByRole('button', { name: '수정요청 보내기' }).first().click()
  await audit(page, '수정요청 창')
  await ctx.close()

  // 카톡 안 브라우저(아이폰)로 열었을 때: 바깥 브라우저 안내 + 발음은 내 목소리로 확인
  const ctx2 = await browser.newContext({ viewport: { width: W, height: 800 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5' })
  await ctx2.addInitScript(() => { try { localStorage.setItem('foldy.introSeen', '1') } catch {} })
  const p2 = await ctx2.newPage()
  await p2.goto(BASE)
  await p2.getByLabel('가족 아이디').fill(id + W)
  await p2.getByLabel('비밀번호').fill('pass1234')
  await p2.getByRole('button', { name: '들어가기' }).click()
  await p2.getByText('누가 공부할까요?').waitFor()
  await audit(p2, '카톡 안 브라우저 · 프로필 고르기')
  await p2.getByText('하은이2').first().click()
  await p2.goto(BASE + '/#/quiz/sp')
  await p2.getByRole('button', { name: '🎙 눌러서 따라 말하기' }).waitFor()
  await audit(p2, '카톡 · 발음(내 목소리로 확인)')
  await p2.getByRole('button', { name: '🎙 눌러서 따라 말하기' }).click()
  await p2.getByRole('button', { name: /비슷해요|따라 말했어요/ }).waitFor({ timeout: 10000 })
  await audit(p2, '카톡 · 발음 녹음 뒤 비교')
  await ctx2.close()
}
await browser.close()
const bad = report.filter((r) => r.breaks.length + r.cut.length + r.overflow.length + r.orphans.length)
console.log(`\n화면 ${report.length}개 중 문제 ${bad.length}개`)
process.exit(bad.length ? 1 : 0)
