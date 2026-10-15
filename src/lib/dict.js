// 기본 어휘 3,000개 영-한 사전(앱에 내장) — 자동완성 검색·추천 단어 뜻에 사용
let cache = null
export async function loadDict() {
  if (!cache) {
    const mod = await import('../data/dict.json')
    cache = Object.entries(mod.default || mod).map(([word, meaning]) => ({ word, meaning, lw: word.toLowerCase(), km: meaning.replace(/\s/g, '') }))
  }
  return cache
}

// 의존성 없는 검색(단위 테스트 대상)
// 영어: 정확히 일치 > 앞부분 일치 > 포함 / 한글: 뜻의 앞부분 일치 > 포함
export function searchEntries(entries, query, limit = 8) {
  const q = String(query || '').trim()
  if (!q) return []
  const isKo = /[ㄱ-ㆎ가-힣]/.test(q)
  const scored = []
  if (isKo) {
    const k = q.replace(/\s/g, '')
    for (const e of entries) {
      const parts = e.meaning.split(/,\s*/).map((p) => p.replace(/\s/g, ''))
      let s = -1
      if (parts.some((p) => p === k)) s = 0
      else if (parts.some((p) => p.startsWith(k))) s = 1
      else if (e.km.includes(k)) s = 2
      if (s >= 0) scored.push([s, e.word.length, e])
    }
  } else {
    const k = q.toLowerCase()
    if (!/^[a-z][a-z '\-]*$/.test(k)) return []
    for (const e of entries) {
      let s = -1
      if (e.lw === k) s = 0
      else if (e.lw.startsWith(k)) s = 1
      else if (k.length >= 3 && e.lw.includes(k)) s = 2
      if (s >= 0) scored.push([s, e.word.length, e])
    }
  }
  scored.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].lw.localeCompare(b[2].lw))
  return scored.slice(0, limit).map((x) => x[2])
}

export async function lookup(word) {
  const d = await loadDict()
  return d.find((e) => e.lw === String(word).toLowerCase())?.meaning || ''
}
