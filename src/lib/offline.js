// 오프라인 지원: 마지막으로 받은 단어·구성원·오늘 기록을 기기에 보관하고,
// 인터넷이 끊긴 동안 푼 답은 '보낼 목록'에 모아 두었다가 연결되면 보냄
const PRE = 'foldy.off.'
export const isNetErr = (e) => (typeof navigator !== 'undefined' && navigator.onLine === false) || /인터넷 연결|Failed to fetch|NetworkError|Load failed|network/i.test(e?.message || '')

export function cacheSet(key, val) { try { localStorage.setItem(PRE + key, JSON.stringify(val)) } catch { /* 저장 공간 부족 등 */ } }
export function cacheGet(key) { try { return JSON.parse(localStorage.getItem(PRE + key) || 'null') } catch { return null } }

const OUT = 'outbox'
export function outboxAdd(kind, id, patch) {
  const box = cacheGet(OUT) || {}
  const k = kind + ':' + id
  box[k] = kind === 'daily' ? patch : { ...(box[k] || {}), ...patch } // 같은 단어는 칸별로 합침, 오늘 기록은 최신 한 줄
  cacheSet(OUT, box)
}
export const outboxSize = () => Object.keys(cacheGet(OUT) || {}).length
// send(kind, id, patch) 가 성공한 것만 지움
export async function outboxFlush(send) {
  const box = cacheGet(OUT) || {}
  for (const k of Object.keys(box)) {
    const [kind, ...rest] = k.split(':')
    try {
      await send(kind, rest.join(':'), box[k])
      const now = cacheGet(OUT) || {}
      if (JSON.stringify(now[k]) === JSON.stringify(box[k])) { delete now[k]; cacheSet(OUT, now) }
    } catch (e) { if (isNetErr(e)) return false }
  }
  return true
}
