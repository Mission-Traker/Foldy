// 발음기호(IPA): 앱에 같이 넣은 목록(open-dict-data/ipa-dict, MIT) → 없으면 AI로 한 번 받아 이 기기에 저장
let mapP = null
export function loadIpa() {
  if (!mapP) mapP = fetch('/ipa-v1.json').then((r) => (r.ok ? r.json() : {})).catch(() => { mapP = null; return {} })
  return mapP
}

const norm = (w) => String(w || '').toLowerCase().replace(/[’']/g, "'").trim()
// 영국식 철자 → 미국식(목록이 미국식이라)
function usSpell(w) {
  return [w,
    w.replace(/is(e|ed|es|ing|ation)$/, 'iz$1'),
    w.replace(/ys(e|ed|es|ing)$/, 'yz$1'),
    w.replace(/our(s|ed|ing|able)?$/, 'or$1'),
    w.replace(/tre(s)?$/, 'ter$1'),
    w.replace(/ll(ed|ing|er)$/, 'l$1')]
}

export function ipaFromMap(word, map) {
  const w = norm(word)
  if (!w || !map) return ''
  for (const v of usSpell(w)) if (map[v]) return map[v]
  // 구(두 단어 이상)는 낱말마다 이어 붙임
  const parts = w.split(/[\s-]+/).filter(Boolean)
  if (parts.length > 1) {
    const each = parts.map((p) => usSpell(p).map((v) => map[v]).find(Boolean))
    if (each.every(Boolean)) return '/' + each.map((x) => x.replace(/^\/|\/$/g, '')).join(' ') + '/'
  }
  return ''
}

const KEY = 'foldy.ipa.'
export function ipaCached(word) {
  try { return localStorage.getItem(KEY + norm(word)) } catch { return null }
}
export function ipaSave(word, v) {
  try { localStorage.setItem(KEY + norm(word), v || '') } catch { /* 저장 공간 없음 */ }
}
