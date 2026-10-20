import { useEffect, useState } from 'react'
import * as db from '../lib/db.js'
import { daysUntil, ymd } from '../lib/study.js'
import { track } from '../lib/track.js'

// 베타 설문: 가입 3일째·7일째에 한 번씩 '폴디 어땠어요?'(별점 + 한 줄) → 수정요청함에 '베타 설문'으로 들어감
const KEY = (id) => `foldy.survey.${id}`
const MILESTONES = [7, 3]
function pending(member, today) {
  if (!member?.created_at || !member.last_study) return null
  const days = -daysUntil(String(member.created_at).slice(0, 10), today)
  let done = []
  try { done = JSON.parse(localStorage.getItem(KEY(member.id)) || '[]') } catch { /* */ }
  return MILESTONES.find((n) => days >= n && !done.includes(n)) || null
}
function markDone(id, n) {
  try {
    const done = JSON.parse(localStorage.getItem(KEY(id)) || '[]')
    // 7일째를 했으면 3일째는 다시 묻지 않음
    localStorage.setItem(KEY(id), JSON.stringify([...new Set([...done, n, ...(n === 7 ? [3] : [])])]))
  } catch { /* */ }
}

export default function SurveyPrompt({ member, showToast }) {
  const [n, setN] = useState(null)
  const [stars, setStars] = useState(0)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const p = pending(member, ymd())
    if (!p) return
    const t = setTimeout(() => setN(p), 1500)
    return () => clearTimeout(t)
  }, [member])
  if (!n) return null
  const close = () => { markDone(member.id, n); setN(null) }
  async function send() {
    if (!stars || busy) return
    setBusy(true)
    try {
      track('survey', { kind: `day${n}`, ok: stars })
      await db.addFeedback({ member_name: member.name, category: '베타 설문', area: `${n}일째 · ${'★'.repeat(stars)}`, content: text.trim().slice(0, 300) || `별점 ${stars}점` })
      showToast('고마워요! 더 좋은 폴디로 만들게요 💛')
      close()
    } catch (e) { showToast(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30" onClick={close}>
      <div role="dialog" aria-label="폴디 설문" className="safe-b w-full max-w-md rounded-t-3xl bg-paper p-5" onClick={(e) => e.stopPropagation()}>
        <p className="font-jua text-sm text-soft">폴디를 쓴 지 {n}일째예요</p>
        <h2 className="mb-3 font-jua text-xl text-slate-deep">폴디 어땠어요?</h2>
        <div className="mb-3 flex justify-center gap-2" role="radiogroup" aria-label="별점">
          {[1, 2, 3, 4, 5].map((k) => (
            <button key={k} role="radio" aria-checked={stars === k} aria-label={`${k}점`} onClick={() => setStars(k)}
              className={`text-4xl transition-transform ${k <= stars ? 'scale-110' : 'opacity-30 grayscale'}`}>⭐</button>
          ))}
        </div>
        <textarea className="field mb-3 min-h-[72px] text-base" maxLength={300} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="좋았던 점이나 아쉬운 점을 한 줄로(선택)" aria-label="한 줄 의견" />
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={close}>다음에</button>
          <button className="btn-main flex-[2]" disabled={!stars || busy} onClick={send}>{busy ? '보내는 중…' : '보내기'}</button>
        </div>
      </div>
    </div>
  )
}
