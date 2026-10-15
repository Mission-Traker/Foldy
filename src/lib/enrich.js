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
  const cache = await getCache(wordList)
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

// 사진을 1600px 이하 JPEG로 줄여 base64로
export function resizeImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * s)
      c.height = Math.round(img.height * s)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.85).split(',')[1])
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 열 수 없어요')) }
    img.src = url
  })
}
