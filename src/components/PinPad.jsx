import { useState } from 'react'
import { Blob } from './ui.jsx'
import { tap, wrong, correct } from '../lib/sfx.js'

// 숫자 비밀번호 입력판(4~6자리)
export default function PinPad({ title, sub, avatar = 0, onSubmit, onCancel, confirmMode = false, footer = null }) {
  const [pin, setPin] = useState('')
  const [first, setFirst] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)

  async function done(value) {
    if (confirmMode && first == null) { setFirst(value); setPin(''); return }
    if (confirmMode && first !== value) { wrong(); setErr('두 번 입력한 비밀번호가 달라요'); setFirst(null); setPin(''); setShake((x) => x + 1); return }
    setBusy(true)
    try { await onSubmit(value); correct() } catch (e) { wrong(); setErr(e.message); setPin(''); setShake((x) => x + 1) } finally { setBusy(false) }
  }
  function press(d) {
    if (busy) return
    tap(); setErr('')
    if (d === 'del') return setPin((p) => p.slice(0, -1))
    if (d === 'ok') { if (pin.length >= 4) done(pin); return }
    setPin((p) => (p + d).slice(0, 6))
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center" onClick={onCancel}>
      <div className="safe-b w-full max-w-sm rounded-t-3xl bg-paper p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex flex-col items-center text-center">
          <Blob i={avatar} size={56} />
          <h3 className="h-title mt-1 text-xl">{confirmMode && first != null ? '한 번 더 입력해 주세요' : title}</h3>
          {sub && <p className="text-xs text-soft">{sub}</p>}
        </div>
        <div key={shake} className={`my-3 flex justify-center gap-3 ${shake ? 'wiggle' : ''}`} aria-label={`${pin.length}자리 입력됨`}>
          {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
            <span key={i} className={`h-4 w-4 rounded-full border-2 border-slate-deep ${i < pin.length ? 'bg-slate-deep' : ''}`} />
          ))}
        </div>
        {err && <p className="mb-2 text-center text-sm text-coral">{err}</p>}
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map((d) => (
            <button key={d} type="button" onClick={() => press(d)} disabled={busy}
              className={`h-14 rounded-2xl font-jua text-2xl active:translate-y-[2px] ${d === 'ok' ? 'bg-slate-deep text-white' : 'bg-cream text-slate-deep'} ${d === 'ok' && pin.length < 4 ? 'opacity-40' : ''}`}>
              {d === 'del' ? '⌫' : d === 'ok' ? '확인' : d}
            </button>
          ))}
        </div>
        {footer}
        <button type="button" className="mt-3 w-full text-sm text-soft" onClick={onCancel}>취소</button>
      </div>
    </div>
  )
}
