// 베타 사용 분석: 어떤 화면·기능을 쓰는지, 어디서 들어와 어디서 멈추는지
// 개인정보 없음 — 기기마다 만든 무작위 번호, 화면 이름, 버튼 종류, 개수만 보냄(이름·단어·뜻은 보내지 않음)
import { trackEvents } from './db.js'

const DEV_KEY = 'foldy.dev'
let dev = null
function devId() {
  if (dev) return dev
  try { dev = localStorage.getItem(DEV_KEY) } catch { /* */ }
  if (!dev) {
    dev = 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    try { localStorage.setItem(DEV_KEY, dev) } catch { /* */ }
  }
  return dev
}
const isTest = () => { try { return !!navigator.webdriver } catch { return false } }

let queue = []
let timer = null
export function flush() {
  clearTimeout(timer); timer = null
  if (!queue.length) return
  const batch = queue.splice(0, 50)
  trackEvents(devId(), batch, isTest())
}
export function track(n, p) {
  try {
    if (typeof window === 'undefined') return
    const clean = {}
    for (const [k, v] of Object.entries(p || {})) if (v != null && ['string', 'number', 'boolean'].includes(typeof v)) clean[k] = typeof v === 'string' ? v.slice(0, 40) : v
    queue.push({ n, p: clean })
    if (queue.length >= 20) flush()
    else if (!timer) timer = setTimeout(flush, 4000)
  } catch { /* 기록 실패는 무시 */ }
}

// 화면 이름: 단어 id·숫자 같은 개인 값은 지움
export function pagePath(pathname) {
  return (String(pathname || '/').replace(/[0-9a-f]{8}-[0-9a-f-]{20,}/gi, ':id').replace(/\/\d+(?=\/|$)/g, '/:n') || '/').slice(0, 40)
}

// 어디서 들어왔는지: ?src= / utm_source / 친구 소개(?from=) / 카톡 안 브라우저 / 다른 사이트
export function sourceOf(search = location.search, ua = navigator.userAgent, ref = document.referrer) {
  const q = new URLSearchParams(search)
  const s = q.get('src') || q.get('utm_source')
  if (s) return s.replace(/[^\w가-힣.-]/g, '').slice(0, 20)
  if (q.get('from')) return 'friend'
  if (/KAKAOTALK/i.test(ua)) return 'kakao'
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/NAVER\(inapp/i.test(ua)) return 'naver'
  try { const h = ref && new URL(ref).hostname; if (h && h !== location.hostname) return h.replace(/^www\./, '').slice(0, 20) } catch { /* */ }
  return ''
}

let started = false
export function startTracking() {
  if (started) return
  started = true
  const ua = navigator.userAgent
  track('visit', {
    src: sourceOf(),
    inapp: /KAKAOTALK|Instagram|NAVER\(inapp|FBAN|FBAV|Line\//i.test(ua),
    mobile: /Mobi|Android|iPhone|iPad/i.test(ua),
    app: window.matchMedia?.('(display-mode: standalone)').matches || false,
  })
  const out = () => { if (document.visibilityState === 'hidden') flush() }
  document.addEventListener('visibilitychange', out)
  window.addEventListener('pagehide', flush)
}
