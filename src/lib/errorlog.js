// 앱 오류 자동 기록(베타 대응): 같은 오류는 한 번만, 이름·단어 같은 내용은 담지 않음
import { logError } from './db.js'

const seen = new Set()
const IGNORE = /ResizeObserver loop|Script error\.?$|Failed to fetch|NetworkError|Load failed|AbortError|The operation was aborted|NotAllowedError|play\(\) request was interrupted/i
const build = () => (document.querySelector('script[src*="/assets/index-"]')?.getAttribute('src') || '').replace(/^.*index-|\.js$/g, '') || 'dev'

export function report(err, extra = '') {
  try {
    const message = String(err?.message || err || '').trim() || '알 수 없는 오류'
    if (IGNORE.test(message)) return
    const key = message.slice(0, 120)
    if (seen.has(key) || seen.size > 20) return
    seen.add(key)
    logError({
      message: extra ? `${extra}: ${message}` : message,
      stack: err?.stack || null,
      path: location.hash.replace(/\?.*$/, '') || '#/',
      ua: navigator.userAgent,
      build: build(),
    })
  } catch { /* 기록 실패는 무시 */ }
}

export function installErrorLog() {
  if (!import.meta.env.PROD) return
  window.addEventListener('error', (e) => report(e.error || e.message))
  window.addEventListener('unhandledrejection', (e) => report(e.reason, 'promise'))
}
