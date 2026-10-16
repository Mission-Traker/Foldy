// 기본 어휘 2,898개(Lv.01~Lv.09)의 학습 데이터를 앱에 넣어 둠 — 유의어·반의어·예문·허용 답안·발음 요령
// AI를 부르지 않고 바로 씀(비용 0). 이 목록에 없는 단어만 무료 AI에게 묻고 결과는 공용 캐시에 저장
let p = null
export function loadVocab() {
  if (!p) p = import('../data/vocab.json').then((m) => {
    const raw = m.default || m
    const map = new Map()
    for (const [k, v] of Object.entries(raw)) map.set(k.toLowerCase(), v)
    return map
  }).catch(() => { p = null; return new Map() })
  return p
}

const pair = (x) => (Array.isArray(x) && x[0] ? { word: String(x[0]), meaning: String(x[1] || '') } : null)
const splitMeaning = (m) => String(m || '').split(/[,;/]\s*/).map((s) => s.trim()).filter(Boolean)

// 단어 하나의 학습 정보(enrich와 같은 모양) — 없으면 null
export function vocabEnrich(map, word, meaning = '') {
  const v = map.get(String(word || '').trim().toLowerCase())
  if (!v) return null
  const accepted = [...new Set([...splitMeaning(meaning), ...(v.acc || [])])].slice(0, 10)
  return {
    word,
    accepted,
    syn: pair(v.syn),
    ant: pair(v.ant),
    example: Array.isArray(v.ex) && v.ex[0] ? { en: v.ex[0], ko: v.ex[1] || '', scene: v.ex[2] || '' } : null,
  }
}

// 발음 요령(PronSheet와 같은 모양) — 없으면 null
export function vocabPron(map, word, heard = '', ipa = '') {
  const v = map.get(String(word || '').trim().toLowerCase())
  if (!v || !v.syl) return null
  const syllables = v.syl.split('|').filter(Boolean)
  let stress = syllables.findIndex((s) => s === s.toUpperCase() && /[A-Z]/.test(s))
  if (stress < 0) stress = 0
  const h = String(heard || '').trim()
  const mistake = h && h.toLowerCase().replace(/[^a-z]/g, '') !== String(word).toLowerCase().replace(/[^a-z]/g, '')
    ? `‘${h}’로 들렸어요. ${syllables.length > 1 ? `‘${syllables[stress].toLowerCase()}’ 부분을 더 크고 길게 말해 보세요.` : '천천히 또박또박 다시 말해 보세요.'}`
    : ''
  return { ipa, syllables, stress, ko: v.ko || '', tips: v.tip ? [v.tip] : [], mistake }
}
