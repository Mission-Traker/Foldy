// 어떤 브라우저에서 열렸는지 — 카톡 안 브라우저 안내·발음 퀴즈를 사파리/크롬으로 넘길 때 씀
const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent || '')
export const isIOS = () => /iPhone|iPad|iPod/.test(ua()) || (/Macintosh/.test(ua()) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
export const isAndroid = () => /Android/.test(ua())
export const isKakao = () => /KAKAOTALK/i.test(ua())
export const isInApp = () => isKakao() || /NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|everytimeApp|DaumApps|SamsungBrowser\/[\d.]+ .*CrossApp/i.test(ua())
export const isStandalone = () => typeof window !== 'undefined' && (window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches)
// 아이폰의 '진짜' 사파리(홈 화면 앱·크롬·카톡 아님)
export const isIOSSafari = () => isIOS() && !isStandalone() && !isInApp() && /Safari\//.test(ua()) && !/CriOS|FxiOS|EdgiOS|Whale|NAVER/.test(ua())

// 지금 주소를 바깥 기본 브라우저로 열기
export function openOutside(url = location.href) {
  if (isKakao()) { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url); return }
  if (isIOS()) { location.href = 'x-safari-' + url; return }
  if (isAndroid()) {
    const u = new URL(url)
    location.href = `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;end`
    return
  }
  window.open(url, '_blank')
}
// 발음 퀴즈를 이 화면에서 바로 해도 되는지: 아이폰은 사파리에서만, 그 밖엔 음성 인식이 되는 브라우저면 OK
export function pronHereOK(canListen) {
  if (isIOS()) return isIOSSafari() && canListen
  if (isInApp()) return false
  return canListen
}
