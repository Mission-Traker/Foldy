// 마이크 고르기 — 노트북·외장 마이크·헤드셋 등
const KEY = 'foldy.mic'

export function savedMic() {
  try { return localStorage.getItem(KEY) || 'default' } catch { return 'default' }
}
export function saveMic(id) {
  try { localStorage.setItem(KEY, id || 'default') } catch { /* */ }
}

export function canPickMic() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices && navigator.mediaDevices.getUserMedia)
}

// 마이크 목록(이름을 보려면 한 번 권한이 필요)
export async function listMics() {
  if (!canPickMic()) return []
  let stream
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch (e) {
    const err = new Error(e.name === 'NotAllowedError' ? 'MIC_DENIED' : 'MIC_FAIL')
    throw err
  }
  const devs = await navigator.mediaDevices.enumerateDevices()
  stream.getTracks().forEach((t) => t.stop())
  return devs
    .filter((d) => d.kind === 'audioinput' && d.deviceId)
    .map((d, i) => ({ id: d.deviceId, label: d.label || `마이크 ${i + 1}` }))
}

export async function openMic(deviceId) {
  const audio = deviceId && deviceId !== 'default'
    ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true }
    : { echoCancellation: true, noiseSuppression: true }
  return navigator.mediaDevices.getUserMedia({ audio })
}

// 음량 측정(0~1) — 마이크 테스트 막대용
export function meter(stream, onLevel) {
  const AC = window.AudioContext || window.webkitAudioContext
  const ctx = new AC()
  const src = ctx.createMediaStreamSource(stream)
  const an = ctx.createAnalyser()
  an.fftSize = 512
  src.connect(an)
  const buf = new Uint8Array(an.fftSize)
  let raf
  const tick = () => {
    an.getByteTimeDomainData(buf)
    let peak = 0
    for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128)
    onLevel(Math.min(1, peak * 1.8))
    raf = requestAnimationFrame(tick)
  }
  tick()
  return () => { cancelAnimationFrame(raf); ctx.close() }
}
