// 앱 수정요청 점검. 2단계로 실행:
//  PHASE=a FID=e2e_fbxxx node tests/e2e-feedback.mjs   → 가족 만들고 요청 접수, 관리자 아님 확인
//  (SQL로 그 가족을 foldy_admins에 넣기)
//  PHASE=b FID=e2e_fbxxx node tests/e2e-feedback.mjs   → 관리자 화면에서 상태·답장 → 내 정보에 새 소식
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw
try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const FID = process.env.FID, PHASE = process.env.PHASE || 'a'
const STATE = process.env.STATE || '/tmp/fb-state.json'
const results = []
const check = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? ' — ' + x : ''}`) }
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...(PHASE === 'b' ? { storageState: STATE } : {}) })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message)); page.on('dialog', (d) => d.accept())
const seen = (t, ms = 6000) => page.getByText(t).first().waitFor({ timeout: ms }).then(() => true, () => false)
try {
  if (PHASE === 'a') {
    await page.goto(BASE)
    await page.getByText('가족 만들기').click()
    await page.getByLabel('가족 이름').fill('요청가족')
    await page.getByLabel('가족 아이디').fill(FID)
    await page.getByLabel('비밀번호').fill('1234')
    await page.getByRole('button', { name: '우리 가족 단어장 만들기' }).click()
    await page.getByText('누가 공부할까요?').waitFor()
    await page.getByLabel('이름', { exact: true }).fill('하은')
    await page.getByRole('button', { name: '추가하기' }).click()
    await page.getByText('안녕, 하은!').waitFor()
    await page.goto(BASE + '/#/me')
    check('내 정보에 앱 수정요청 칸', await seen('🛠 앱 수정요청'))
    check('관리자 아니면 수정요청함 버튼 없음', !(await page.getByRole('link', { name: /수정요청함/ }).isVisible()))
    await page.getByRole('button', { name: '수정요청 보내기' }).click()
    const send = page.getByRole('button', { name: '수정요청 보내기' }).last()
    check('빈 글이면 보내기 막힘', await send.isDisabled())
    await page.getByRole('button', { name: '🐞 버그·오류' }).click()
    await page.getByRole('button', { name: '사진으로 추가' }).click()
    await page.getByLabel('무엇이 이상했나요? 무엇을 바라나요?').fill('<b>사진</b> 올리면 느려요')
    await send.click()
    check('접수 완료 안내', await seen('접수됐어요'))
    check('목록에 내 요청(접수됨)', await seen('접수됨', 8000) && await seen('<b>사진</b> 올리면 느려요'))
    check('글은 HTML로 해석 안 됨', (await page.locator('b', { hasText: '사진' }).count()) === 0)
    check('유형·영역 표시', await seen('버그·오류 · 사진으로 추가'))
    await page.reload()
    check('새로고침 후에도 남아 있음', await seen('<b>사진</b> 올리면 느려요', 10000))
    await page.goto(BASE + '/#/admin')
    check('관리자 아니면 수정요청함 잠김', await seen('관리자 가족만 볼 수 있어요'))
    await ctx.storageState({ path: STATE })
  } else {
    await page.goto(BASE + '/#/me')
    const link = page.getByRole('link', { name: /수정요청함/ })
    await link.waitFor({ timeout: 8000 }).catch(() => {})
    check('관리자: 수정요청함 버튼 + 신규 배지', await link.locator('span').waitFor({ timeout: 6000 }).then(() => true, () => false) && /1/.test(await link.textContent()))
    await link.click()
    check('관리자 목록에 요청·보낸 사람', await seen('<b>사진</b> 올리면 느려요') && await seen('하은 · 요청가족'))
    await page.getByRole('button', { name: '✅ 확인·고치는 중' }).click()
    check('확인 → 수정진행으로', await seen('수정진행 1'))
    await page.getByRole('button', { name: '좋은 의견이에요, 반영할게요 🙏' }).click()
    await page.getByRole('button', { name: '💬 답장 보내기' }).click()
    check('답장 표시', await seen('💬 내 답장'))
    await page.waitForTimeout(1500) // 저장 응답을 기다림
    await page.getByRole('button', { name: '수정완료 0' }).click()
    check('필터: 수정완료 0개 → 빈 안내', await seen('수정요청이 없어요'))
    await page.getByRole('button', { name: /^전체/ }).click()
    await page.goto(BASE + '/#/me')
    const ok1 = await seen('● 새 소식', 8000)
    if (!ok1) { await page.screenshot({ path: '/tmp/fb-me.png', fullPage: true }); console.log(await page.locator('body').innerText()) }
    check('내 정보: 새 소식', ok1)
    const ok2 = await seen('고치는 중')
    if (!ok2) { await page.screenshot({ path: '/tmp/fb-me.png', fullPage: true }); console.log('BODY>>', (await page.locator('body').innerText()).slice(-700)) }
    check('내 정보: 고치는 중', ok2)
    check('내 정보: 답장', await seen('윤멘토님의 답장'))
    await page.reload()
    check('한 번 보면 새 소식 사라짐', await seen('고치는 중', 10000) && !(await page.getByText('● 새 소식').isVisible()))
    await page.goto(BASE + '/#/admin')
    await page.getByLabel('삭제').first().click()
    await page.waitForTimeout(1500)
    await page.reload()
    check('관리자 삭제(새로고침 후에도 없음)', await seen('수정요청이 없어요', 10000))
  }
} catch (e) { check('예외 없이 완료', false, e.message.split('\n')[0]) }
check('페이지 오류 없음', errors.length === 0, errors.join(' | '))
await browser.close()
const f = results.filter((x) => !x).length
console.log(`\n${results.length - f}/${results.length} 통과`)
process.exit(f ? 1 : 0)
