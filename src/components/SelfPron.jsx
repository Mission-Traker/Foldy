import { useEffect, useRef, useState } from 'react'
import { speak } from '../lib/speech.js'
import { meter, openMic, savedMic } from '../lib/mic.js'
import { track } from '../lib/track.js'

// 내 목소리로 확인하는 발음 연습 — 음성 인식(자동 채점)이 안 되는 곳에서도 되는 방법
// ① 정답 발음 듣기 → ② 녹음(3초) → ③ 내 목소리와 정답을 번갈아 들어 보고 → ④ '비슷해요'면 통과
// 녹음도 안 되는 기기(마이크 없음·권한 거절)면 듣고 따라 말한 뒤 '따라 말했어요'
const REC_MS = 3000
const canRecord = () => typeof window !== 'undefined' && !!(window.MediaRecorder && navigator.mediaDevices?.getUserMedia)

async function getStream() {
  // 고른 마이크가 빠졌거나 바뀌었으면 기본 마이크로
  try { return await openMic(savedMic()) } catch (e) {
    if (e && e.name === 'NotAllowedError') throw e
    return openMic('default')
  }
}

export default function SelfPron({ word, onResult: done, busy }) {
  const onResult = (ok) => { track('pron', { via: 'self', ok }); done(ok) }
  const [phase, setPhase] = useState(canRecord() ? 'idle' : 'nomic') // idle · rec · got · nomic
  const [level, setLevel] = useState(0)
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const live = useRef({})
  const audio = useRef(null)

  const stopAll = () => {
    const l = live.current
    clearTimeout(l.timer)
    try { if (l.rec && l.rec.state !== 'inactive') l.rec.stop() } catch { /* */ }
    if (l.stopMeter) { l.stopMeter(); l.stopMeter = null }
    if (l.stream) { l.stream.getTracks().forEach((t) => t.stop()); l.stream = null }
  }
  useEffect(() => () => { stopAll(); if (live.current.url) URL.revokeObjectURL(live.current.url) }, []) // eslint-disable-line

  async function record() {
    setNote('')
    let stream
    try { stream = await getStream() } catch (e) {
      setPhase('nomic')
      setNote(e && e.name === 'NotAllowedError' ? '마이크 권한이 꺼져 있어요. 듣고 소리 내어 따라 말해 보세요.' : '마이크를 찾지 못했어요. 듣고 소리 내어 따라 말해 보세요.')
      return
    }
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'].find((t) => window.MediaRecorder.isTypeSupported?.(t))
    let rec
    try { rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined) } catch { stream.getTracks().forEach((t) => t.stop()); setPhase('nomic'); return }
    const chunks = []
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || type || 'audio/webm' })
      if (live.current.url) URL.revokeObjectURL(live.current.url)
      const u = URL.createObjectURL(blob)
      live.current.url = u
      setUrl(u)
      setPhase('got')
      setTimeout(() => play(u), 150)
    }
    live.current = { ...live.current, stream, rec }
    try { live.current.stopMeter = meter(stream, setLevel) } catch { /* 음량 막대 없이 */ }
    rec.start()
    setPhase('rec')
    live.current.timer = setTimeout(stop, REC_MS)
  }
  function stop() {
    const l = live.current
    clearTimeout(l.timer)
    if (l.stopMeter) { l.stopMeter(); l.stopMeter = null }
    try { if (l.rec && l.rec.state !== 'inactive') l.rec.stop() } catch { /* */ }
    if (l.stream) { l.stream.getTracks().forEach((t) => t.stop()); l.stream = null }
    setLevel(0)
  }
  function play(u = url) {
    if (!u) return
    try {
      if (!audio.current) audio.current = new Audio()
      audio.current.src = u
      audio.current.play().catch(() => {})
    } catch { /* */ }
  }

  if (phase === 'nomic') {
    return (
      <div className="space-y-2">
        <p className="text-center text-sm text-soft">{note || '🔊를 듣고 소리 내어 3번 따라 말해 보세요.'}</p>
        <button type="button" onClick={() => speak(word)} className="btn-ghost w-full">🔊 다시 듣기</button>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => onResult(false)} className="btn-ghost flex-1">잘 모르겠어요</button>
          <button type="button" disabled={busy} onClick={() => onResult(true)} className="btn-main flex-[2]">✓ 따라 말했어요</button>
        </div>
        {canRecord() && <button type="button" className="mx-auto block text-xs text-soft underline" onClick={() => { setNote(''); setPhase('idle') }}>녹음해서 비교하기</button>}
      </div>
    )
  }
  if (phase === 'got') {
    return (
      <div className="space-y-2">
        <p className="text-center text-sm text-soft">내 목소리와 정답을 번갈아 들어 보세요. 비슷하면 통과예요.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => play()} className="btn-ghost flex-1">▶ 내 목소리</button>
          <button type="button" onClick={() => speak(word)} className="btn-ghost flex-1">🔊 정답 발음</button>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={record} className="btn-ghost flex-1">🎙 다시 녹음</button>
          <button type="button" disabled={busy} onClick={() => onResult(true)} className="btn-main flex-[2]">✓ 비슷해요</button>
        </div>
        <button type="button" disabled={busy} onClick={() => onResult(false)} className="mx-auto block text-sm text-soft underline">잘 모르겠어요</button>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <button type="button" onClick={phase === 'rec' ? stop : record} className={`btn-coral w-full py-5 text-xl ${phase === 'rec' ? 'animate-pulse' : ''}`}>
        {phase === 'rec' ? '■ 녹음 끝내기' : '🎙 눌러서 따라 말하기'}
      </button>
      {phase === 'rec' && (
        <div className="mx-auto h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className="h-full rounded-full bg-coral transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
        </div>
      )}
      <p className="text-center text-xs text-soft">{phase === 'rec' ? '3초 동안 녹음해요' : '정답 발음을 듣고 3초 동안 따라 말하면, 내 목소리를 들려줘요'}</p>
      <button type="button" disabled={busy || phase === 'rec'} onClick={() => onResult(false)} className="btn-ghost w-full">잘 모르겠어요</button>
    </div>
  )
}
