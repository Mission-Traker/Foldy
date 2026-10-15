// 사전에 없는 검색어 → 영어 단어 찾기(한글 뜻으로 찾기, 영어 철자로 찾기 모두)
import { guard, send, readBody, textLLM } from './_lib.js'

// 줄 형식: word | 뜻
export function parseLookup(text) {
  const out = []
  const seen = new Set()
  for (const raw of String(text).split(/\n/)) {
    const m = raw.replace(/^\s*[-*\d.)]+\s*/, '').match(/^([A-Za-z][A-Za-z' -]{0,40}?)\s*[|:：]\s*(.+)$/)
    if (!m) continue
    const word = m[1].trim()
    const meaning = m[2].trim().slice(0, 60)
    if (!/[가-힣]/.test(meaning)) continue
    const k = word.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ word, meaning })
  }
  return out.slice(0, 6)
}

export default async function handler(req, res) {
  if (!(await guard(req, res))) return
  try {
    const { q } = await readBody(req)
    const query = String(q || '').trim().slice(0, 30)
    if (!query) return send(res, 400, { error: '검색어가 없어요' })
    const isKo = /[ㄱ-ㆎ가-힣]/.test(query)
    const { text } = await textLLM({
      check: (t) => parseLookup(t).length > 0,
      maxTokens: 300,
      system:
        (isKo
          ? '한국 학생이 한글로 영어 단어를 찾고 있다. 그 뜻에 맞는 영어 단어를 자주 쓰는 순서로 최대 5개 고른다.'
          : '학생이 영어 철자(일부일 수 있음)로 단어를 찾고 있다. 그 철자로 시작하거나 가장 비슷한 실제 영어 단어를 최대 5개 고른다.') +
        ' 한 줄에 하나씩 "영어단어 | 짧은 한글 뜻" 형식으로만 출력. 고유명사·비속어 금지.',
      text: query,
    })
    send(res, 200, { items: parseLookup(text) })
  } catch (e) {
    send(res, 500, { error: '단어를 찾지 못했어요: ' + e.message })
  }
}
