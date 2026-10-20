// AI를 쓸 수 없을 때(키·크레딧 없음 등) 쓰는 무료 글자 인식 — 기기 안에서 실행(Tesseract)
// 정확도는 AI보다 낮으므로 결과는 반드시 미리보기에서 확인

const HANGUL = /[ㄱ-ㆎ가-힣]/

// OCR 글자 → 단어·뜻 짝 (의존성 없음, 단위 테스트 대상)
// known: 내장 사전 단어(소문자 Set) — 주면 영어만 적힌 사진에서도 사전에 있는 단어를 뽑음(뜻은 사전으로 채움)
export function pairFromText(text, known) {
  const lines = String(text || '')
    .split(/\n/)
    .map((l) => l.replace(/[|_~^*`"“”‘’<>{}[\]\\]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const out = []
  const seen = new Set()
  const push = (word, meaning) => {
    word = word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '').trim()
    meaning = meaning.replace(/^[\s\-:=.,·•\d)]+/, '').replace(/\[[^\]]*\]|\/[^/]*\//g, '').trim()
    if (!/^[A-Za-z][A-Za-z '\-]{0,40}$/.test(word) || word.length < 2) return
    const k = word.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    out.push({ word, meaning: meaning.slice(0, 120) })
  }
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].replace(/^\s*\d+[.)]?\s*/, '')
    const k = l.search(HANGUL)
    if (k > 0) {
      // 같은 줄에 영어 + 한글
      const left = l.slice(0, k)
      const m = left.match(/([A-Za-z][A-Za-z '\-]*[A-Za-z])/)
      if (m) push(m[1], l.slice(k))
    } else if (k < 0 && /^[A-Za-z][A-Za-z '\-]*$/.test(l) && i + 1 < lines.length && HANGUL.test(lines[i + 1]) && !/[A-Za-z]{2,}/.test(lines[i + 1])) {
      // 영어 줄 다음 줄이 한글 뜻
      push(l, lines[i + 1])
      i++
    }
  }
  if (known && known.size) {
    for (const l of lines) {
      if (HANGUL.test(l) || out.length >= 80) continue
      for (const t of l.split(/[^A-Za-z'\-]+/)) {
        const k = t.toLowerCase().replace(/^['\-]+|['\-]+$/g, '')
        if (k.length >= 3 && known.has(k)) push(k, '')
      }
    }
  }
  return out
}

let workerP = null
let progressCb = null
export async function ocrCanvas(canvas, onProgress, known) {
  const { createWorker } = await import('tesseract.js')
  progressCb = onProgress
  if (!workerP) {
    workerP = createWorker(['eng', 'kor'], 1, {
      logger: (m) => { if (m.status === 'recognizing text' && progressCb) progressCb(m.progress) },
    })
  }
  const worker = await workerP
  const { data } = await worker.recognize(canvas)
  return pairFromText(data.text, known)
}
