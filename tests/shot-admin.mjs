// 관리자 화면 눈 확인용 스크린샷(설문 요약·친구 소개 지표): STATE=관리자 로그인 상태 파일
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let pw; try { pw = require('playwright') } catch { pw = require('/opt/npm-tools/node_modules/playwright') }
const BASE = process.env.BASE || 'http://localhost:4173'
const browser = await pw.chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: process.env.STATE || '/tmp/admin-state.json' })
const page = await ctx.newPage()
await page.goto(BASE + '/#/')
await page.waitForTimeout(2500)
if (process.env.SURVEY) {
  // 베타 설문 두 건을 앱과 같은 방식(가족 토큰)으로 넣음
  const r = await page.evaluate(async ({ url, key }) => {
    const s = JSON.parse(localStorage.getItem('foldy.session'))
    const rows = [{ member_name: '점검', category: '베타 설문', area: '3일째 · ★★★★', content: '점검용' }, { member_name: '점검', category: '베타 설문', area: '7일째 · ★★★★★', content: '점검용' }]
    const res = await fetch(url + '/rest/v1/foldy_feedback', { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'x-foldy-token': s.token }, body: JSON.stringify(rows) })
    return res.status
  }, { url: process.env.SUPA_URL, key: process.env.SUPA_KEY })
  console.log('설문 넣기', r)
}
await page.goto(BASE + '/#/admin')
await page.getByText('소개로 온 가족').waitFor({ timeout: 15000 })
await page.screenshot({ path: '/tmp/claude-0/ad2-home.png', fullPage: true })
await page.goto(BASE + '/#/admin?tab=feedback')
const ok = await page.getByText(/베타 설문 \d+명/).waitFor({ timeout: 10000 }).then(() => true, () => false)
console.log(ok ? 'PASS  설문 요약 표시' : 'FAIL  설문 요약 안 보임')
await page.screenshot({ path: '/tmp/claude-0/ad2-fb.png' })
await browser.close()
