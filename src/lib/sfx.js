// 효과음 — 파일 없이 브라우저에서 직접 합성(무료·용량 0)
const KEY = 'foldy.sound'
let ctx = null

export function soundOn() {
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
}
export function setSoundOn(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* */ }
}

function ac() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(c, { freq, start = 0, dur = 0.12, type = 'sine', vol = 0.18, slideTo }) {
  const t = c.currentTime + start
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

// 타자 소리: 아주 짧은 '톡' (매번 음높이를 살짝 바꿔 자연스럽게)
let lastTap = 0
export function tap() {
  if (!soundOn()) return
  const now = performance.now()
  if (now - lastTap < 35) return
  lastTap = now
  const c = ac(); if (!c) return
  const len = Math.floor(c.sampleRate * 0.025)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6)
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = 2200 + Math.random() * 900
  f.Q.value = 1.4
  const g = c.createGain()
  g.gain.value = 0.35
  src.connect(f).connect(g).connect(c.destination)
  src.start()
}

// 정답: 도-미-솔 올라가는 맑은 차임
export function correct() {
  if (!soundOn()) return
  const c = ac(); if (!c) return
  ;[[784, 0], [988, 0.08], [1319, 0.16]].forEach(([freq, start]) =>
    tone(c, { freq, start, dur: 0.22, type: 'triangle', vol: 0.16 }))
  tone(c, { freq: 2637, start: 0.16, dur: 0.18, type: 'sine', vol: 0.04 })
}

// 오답: 부드럽게 내려가는 '뿌우'
export function wrong() {
  if (!soundOn()) return
  const c = ac(); if (!c) return
  tone(c, { freq: 330, dur: 0.18, type: 'square', vol: 0.06, slideTo: 247 })
  tone(c, { freq: 247, start: 0.16, dur: 0.26, type: 'square', vol: 0.06, slideTo: 165 })
}

// 목표 달성·퀴즈 끝: 짧은 팡파르
export function fanfare() {
  if (!soundOn()) return
  const c = ac(); if (!c) return
  ;[[523, 0], [659, 0.1], [784, 0.2], [1047, 0.32]].forEach(([freq, start]) =>
    tone(c, { freq, start, dur: start > 0.3 ? 0.45 : 0.14, type: 'triangle', vol: 0.15 }))
}
