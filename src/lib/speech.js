// 듣기(TTS)·말하기(음성 인식) — 브라우저 기본 기능 사용(무료)

// 발음 듣기
// A) 기본 어휘 3,000개: 미리 만들어 둔 아나운서 음성 파일(/audio/단어.mp3)
// C) 그 밖의 단어·문장: 기기에서 가장 품질 좋은 영어 음성을 골라 읽기
let voice = null
const GOOD = [/enhanced|premium|향상/i, /natural|online/i, /neural/i, /google us english/i, /\b(ava|samantha|allison|evan|zoe|nathan|aria|jenny|guy)\b/i]
export function scoreVoice(v) {
  if (!/^en(-|_)?/i.test(v.lang)) return -1
  let s = /en[-_]US/i.test(v.lang) ? 10 : /en[-_]GB/i.test(v.lang) ? 6 : 3
  GOOD.forEach((re, i) => { if (re.test(v.name)) s += 20 - i * 3 })
  if (/compact|novelty|whisper|bells|bubbles|zarvox|trinoids|bad news|good news|organ|cellos|jester/i.test(v.name)) s -= 30
  if (v.localService === false) s += 2
  return s
}
function pickVoice() {
  if (voice || typeof speechSynthesis === 'undefined') return voice
  const vs = speechSynthesis.getVoices().filter((v) => scoreVoice(v) >= 0)
  vs.sort((a, b) => scoreVoice(b) - scoreVoice(a))
  voice = vs[0] || null
  return voice
}
if (typeof speechSynthesis !== 'undefined') speechSynthesis.onvoiceschanged = () => { voice = null; pickVoice() }
export const currentVoiceName = () => pickVoice()?.name || ''

export function speakTTS(text, { lang = 'en-US', rate = 0.85 } = {}) {
  if (typeof speechSynthesis === 'undefined' || !text) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  u.rate = rate
  if (lang.startsWith('en')) { const v = pickVoice(); if (v) u.voice = v }
  speechSynthesis.speak(u)
}

let audioSet = null
let audioLoading = null
function loadAudioSet() {
  if (!audioLoading) audioLoading = import('../data/audio.json').then((m) => { audioSet = new Set(m.default || m); return audioSet }).catch(() => (audioSet = new Set()))
  return audioLoading
}
export const audioSlug = (w) => String(w).toLowerCase().trim().replace(/[^a-z0-9'-]+/g, '_')
let current = null

// 단어 하나는 녹음 파일 우선, 문장·없는 단어는 기기 음성
export function speak(text, opts = {}) {
  if (!text) return
  const t = String(text).trim()
  const isWord = /^[A-Za-z][A-Za-z'-]*( [A-Za-z'-]+)?$/.test(t) && t.split(' ').length <= 2
  if (!isWord) return speakTTS(t, opts)
  const play = (set) => {
    if (!set.has(t.toLowerCase())) return speakTTS(t, opts)
    try {
      if (current) current.pause()
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
      current = new Audio(`/audio/${audioSlug(t)}.mp3`)
      current.play().catch(() => speakTTS(t, opts))
    } catch { speakTTS(t, opts) }
  }
  if (audioSet) play(audioSet)
  else loadAudioSet().then(play)
}

export function canListen() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

// 한 번 듣고 후보 문장들을 돌려줌
// deviceId를 고른 경우: 크롬 최신판은 그 마이크로 인식(start(track)), 지원 안 하면 기본 마이크로
export let micPickWorks = null // null: 아직 모름, true/false
export function listenOnce({ timeoutMs = 6000, deviceId = 'default' } = {}) {
  return new Promise((resolve, reject) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return reject(new Error('NO_SR'))
    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.maxAlternatives = 5
    let done = false
    let stream = null
    const cleanup = () => { if (stream) stream.getTracks().forEach((t) => t.stop()) }
    const finish = (fn, v) => { if (done) return; done = true; clearTimeout(t); try { rec.stop() } catch { /* */ } cleanup(); fn(v) }
    const t = setTimeout(() => finish(resolve, []), timeoutMs)
    rec.onresult = (e) => {
      const alts = []
      for (const r of e.results) for (let i = 0; i < r.length; i++) alts.push({ t: r[i].transcript, c: typeof r[i].confidence === 'number' ? r[i].confidence : null })
      finish(resolve, alts)
    }
    rec.onerror = (e) => finish(e.error === 'no-speech' ? resolve : reject, e.error === 'no-speech' ? [] : new Error(e.error))
    rec.onend = () => finish(resolve, [])
    const startDefault = () => { try { rec.start() } catch (e) { finish(reject, e) } }
    if (deviceId && deviceId !== 'default' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } })
        .then((st) => {
          stream = st
          try { rec.start(st.getAudioTracks()[0]); micPickWorks = true } catch { micPickWorks = false; startDefault() }
        })
        .catch(() => { micPickWorks = false; startDefault() })
    } else startDefault()
  })
}
