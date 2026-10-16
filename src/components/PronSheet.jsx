import { useEffect, useState } from 'react'
import * as db from '../lib/db.js'
import { speak, speakTTS } from '../lib/speech.js'
import { FitWord } from './ui.jsx'

// '더 정확한 발음 들어보기' — 표준 발음(보통·천천히), 발음기호, 강세, 요령
export default function PronSheet({ word, heard, score, onClose }) {
  const [info, setInfo] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    const key = 'pron:' + word.toLowerCase()
    ;(async () => {
      try {
        const cached = await db.getCache([key])
        if (cached[key] && !heard) { if (alive) setInfo(cached[key]); return }
        const r = await db.ai('pron', { word, heard })
        if (!alive) return
        setInfo(r)
        if (!cached[key]) db.putCache([{ ...r, word: key }]).catch(() => {})
      } catch (e) { if (alive) setErr(e.code === 'NO_KEY' ? 'AI가 연결되면 발음 요령이 나와요. 소리는 아래 버튼으로 들을 수 있어요' : e.message) }
    })()
    setTimeout(() => speak(word), 200)
    return () => { alive = false }
  }, [word, heard])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30" onClick={onClose}>
      <div className="safe-b w-full max-w-md rounded-t-3xl bg-paper p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-jua text-sm text-soft">표준 발음 (미국식)</p>
            <FitWord as="h3" text={word} max={36} min={18} className="font-title font-bold leading-tight text-ink" />
            {info?.ipa && <p className="font-title text-lg text-slate">{info.ipa}</p>}
          </div>
          <button onClick={onClose} aria-label="닫기" className="text-2xl text-soft">×</button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button className="btn-main py-2.5 text-base" onClick={() => speak(word)}>🔊 보통 속도</button>
          <button className="btn-ghost py-2.5 text-base" onClick={() => speakTTS(word, { rate: 0.5 })}>🐢 천천히</button>
        </div>

        {info?.syllables?.length > 0 && (
          <div className="mb-3">
            <p className="label">강세 (크게 표시된 부분을 세게)</p>
            <div className="flex flex-wrap items-end gap-1">
              {info.syllables.map((sy, i) => (
                <span key={i} className={`rounded-xl px-2.5 py-1 font-title ${i === info.stress ? 'bg-tang text-2xl font-bold text-white' : 'bg-cream text-lg text-ink'}`}>{sy.toLowerCase()}</span>
              ))}
            </div>
            {info.ko && <p className="mt-1 text-sm text-soft">한글로 흉내 내면: <b className="text-ink">{info.ko}</b></p>}
          </div>
        )}

        {info?.tips?.length > 0 && (
          <ul className="mb-3 space-y-1.5">
            {info.tips.map((t, i) => <li key={i} className="flex gap-2 text-sm"><span>👄</span><span>{t}</span></li>)}
          </ul>
        )}

        {(heard || score != null) && (
          <div className="rounded-2xl bg-cream p-3 text-sm">
            {heard && <p>내 발음은 <b>“{heard}”</b>로 들렸어요{score != null ? ` · 정확도 ${Math.round(score * 100)}%` : ''}</p>}
            {info?.mistake && <p className="mt-1 text-slate-deep">💡 {info.mistake}</p>}
          </div>
        )}
        {!info && !err && <p className="text-center text-sm text-soft">발음 요령을 불러오는 중…</p>}
        {err && <p className="text-center text-xs text-soft">{err}</p>}
      </div>
    </div>
  )
}
