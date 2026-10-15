// 듣기(TTS)·말하기(음성 인식) — 브라우저 기본 기능 사용(무료)

let voice = null
function pickVoice() {
  if (voice || typeof speechSynthesis === 'undefined') return voice
  const vs = speechSynthesis.getVoices()
  voice = vs.find((v) => /en-US/i.test(v.lang) && /Samantha|Google US|Aria|Jenny/i.test(v.name)) || vs.find((v) => /^en-US/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null
  return voice
}
if (typeof speechSynthesis !== 'undefined') speechSynthesis.onvoiceschanged = () => { voice = null; pickVoice() }

export function speak(text, { lang = 'en-US', rate = 0.85 } = {}) {
  if (typeof speechSynthesis === 'undefined' || !text) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  u.rate = rate
  if (lang.startsWith('en')) { const v = pickVoice(); if (v) u.voice = v }
  speechSynthesis.speak(u)
}

export function canListen() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

// 한 번 듣고 후보 문장들을 돌려줌
export function listenOnce({ timeoutMs = 6000 } = {}) {
  return new Promise((resolve, reject) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return reject(new Error('NO_SR'))
    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.maxAlternatives = 5
    let done = false
    const finish = (fn, v) => { if (done) return; done = true; clearTimeout(t); try { rec.stop() } catch { /* */ } fn(v) }
    const t = setTimeout(() => finish(resolve, []), timeoutMs)
    rec.onresult = (e) => {
      const alts = []
      for (const r of e.results) for (let i = 0; i < r.length; i++) alts.push(r[i].transcript)
      finish(resolve, alts)
    }
    rec.onerror = (e) => finish(e.error === 'no-speech' ? resolve : reject, e.error === 'no-speech' ? [] : new Error(e.error))
    rec.onend = () => finish(resolve, [])
    try { rec.start() } catch (e) { finish(reject, e) }
  })
}
