// 단어에 AI 정보(허용 답안·유의어·반의어·예문)를 붙이는 작업
import { getCache, putCache, ai, updateWord } from './db.js'

export async function enrichPending(words, level) {
  const pending = words.filter((w) => !w.enriched).slice(0, 30)
  if (!pending.length) return { updated: [], error: null }
  const cache = await getCache(pending.map((w) => w.word))
  const misses = pending.filter((w) => !cache[w.word.toLowerCase()])
  let error = null
  for (let i = 0; i < misses.length; i += 15) {
    const chunk = misses.slice(i, i + 15)
    try {
      const { items } = await ai('enrich', { words: chunk.map((w) => ({ word: w.word, meaning: w.meaning })), level })
      await putCache(items)
      for (const it of items) cache[it.word.toLowerCase()] = it
    } catch (e) {
      error = e
      break
    }
  }
  const updated = []
  for (const w of pending) {
    const d = cache[w.word.toLowerCase()]
    if (!d) continue
    const patch = {
      accepted: d.accepted || [],
      syn: d.syn || null,
      ant: d.ant || null,
      example: d.example || null,
      enriched: true,
    }
    updated.push(await updateWord(w.id, patch))
  }
  return { updated, error }
}

// 뜻만 필요할 때(추천 단어 표시용)
export async function meaningsFor(wordList, level) {
  const { loadDict } = await import('./dict.js')
  const dict = await loadDict()
  const known = Object.fromEntries(dict.map((e) => [e.lw, e.meaning]))
  if (wordList.every((w) => known[w.toLowerCase()])) return wordList.map((w) => ({ word: w, meaning: known[w.toLowerCase()] }))
  const cache = await getCache(wordList)
  for (const w of wordList) if (known[w.toLowerCase()] && !cache[w.toLowerCase()]) cache[w.toLowerCase()] = { meaning: known[w.toLowerCase()] }
  const misses = wordList.filter((w) => !cache[w.toLowerCase()])
  if (misses.length) {
    try {
      const { items } = await ai('enrich', { words: misses.map((w) => ({ word: w, meaning: '' })), level })
      await putCache(items)
      for (const it of items) cache[it.word.toLowerCase()] = it
    } catch { /* AI가 없으면 뜻 없이 표시 */ }
  }
  return wordList.map((w) => ({ word: w, meaning: cache[w.toLowerCase()]?.meaning || '' }))
}
