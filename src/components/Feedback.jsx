import { useState } from 'react'
import * as db from '../lib/db.js'

// 앱 수정요청 — 멘토링대학교 '앱 수정요청하기'·'수정요청함'과 같은 구조(유형·영역 토글 + 상세 글 / 5단계 상태 + 답장)
export const TYPES = ['🐞 버그·오류', '🧩 화면이 이상해요', '😣 불편해요', '💡 이런 기능 원해요', '🙋 기타']
export const AREAS = ['홈', '단어장', '사진으로 추가', '검색으로 추가', '학습·퀴즈', '발음', '오답노트', '확장 학습', '가족·프로필', '기타']
export const STATUS_STYLE = {
  신규: 'bg-coral/15 text-coral border-coral/40',
  확인완료: 'bg-slate/10 text-slate-deep border-slate/30',
  의견보류: 'bg-cream text-soft border-line',
  수정진행: 'bg-mustard/20 text-[#9A7414] border-mustard/50',
  수정완료: 'bg-sage/20 text-[#5E7F4B] border-sage/50',
}
export const STATUS_LABEL = { 신규: '접수됨', 확인완료: '확인했어요', 의견보류: '의견 보류', 수정진행: '고치는 중', 수정완료: '고쳤어요' }

export function StatusChip({ status, admin }) {
  return <span className={`rounded-full border px-2 py-0.5 font-jua text-[11px] ${STATUS_STYLE[status] || STATUS_STYLE.의견보류}`}>{admin ? status : STATUS_LABEL[status] || status}</span>
}
export const fmtDay = (iso) => new Date(iso).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })

// 접수 시트 (아래에서 올라옴)
export function FeedbackSheet({ memberName, onClose, onSent }) {
  const [type, setType] = useState(TYPES[2])
  const [area, setArea] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    const c = text.trim()
    if (!c || busy) return
    setBusy(true); setErr('')
    try {
      const row = await db.addFeedback({ member_name: memberName, category: type.replace(/^\S+\s/, ''), area: area || null, content: c.slice(0, 2000) })
      setSent(true); onSent?.(row)
      setTimeout(onClose, 1400)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30" onClick={onClose}>
      <div className="safe-b max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-jua text-xl text-slate-deep">🛠 앱 수정요청하기</h2>
          <button onClick={onClose} aria-label="닫기" className="text-2xl text-soft">×</button>
        </div>
        {sent ? (
          <div className="py-10 text-center">
            <p className="pop text-4xl">✅</p>
            <p className="mt-2 font-jua text-lg text-slate-deep">접수됐어요! 확인하고 고칠게요 🙏</p>
          </div>
        ) : (
          <>
            <p className="label">어떤 종류인가요?</p>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {TYPES.map((t) => <button key={t} onClick={() => setType(t)} className={`chip ${type === t ? 'chip-on' : ''}`}>{t}</button>)}
            </div>
            <p className="label">어느 화면인가요? <span className="text-soft/70">(골라도 되고 안 골라도 돼요)</span></p>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {AREAS.map((a) => (
                <button key={a} onClick={() => setArea(area === a ? '' : a)}
                  className={`chip text-xs ${area === a ? 'chip-on' : ''}`}>{a}</button>
              ))}
            </div>
            <label className="label" htmlFor="fb-text">무엇이 이상했나요? 무엇을 바라나요?</label>
            <textarea id="fb-text" value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={2000}
              placeholder="예: 사진을 올리면 단어가 안 나와요 / 단어가 화면에서 잘려요 / 이런 기능이 있으면 좋겠어요"
              className="field mb-1 resize-y text-[15px]" />
            <p className="mb-3 text-right text-[11px] text-soft">{text.length} / 2000</p>
            {err && <p className="mb-2 text-sm text-coral">{err}</p>}
            <button className="btn-main w-full" disabled={busy || !text.trim()} onClick={submit}>{busy ? '보내는 중…' : '수정요청 보내기'}</button>
          </>
        )}
      </div>
    </div>
  )
}

// 요청 카드 (내 요청·관리자 공용 머리)
export function FeedbackHead({ r, admin }) {
  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
      <StatusChip status={r.status} admin={admin} />
      <span className="rounded-full bg-cream px-2 py-0.5 font-jua text-[11px] text-soft">{r.category}{r.area ? ` · ${r.area}` : ''}</span>
      {admin && <span className="font-jua text-[11px] text-slate-deep">{r.member_name} · {r.family_name}</span>}
      <span className="ml-auto text-[11px] text-soft">{fmtDay(r.created_at)}</span>
    </div>
  )
}

export function ReplyBubble({ r, label = '💬 윤멘토님의 답장' }) {
  if (!r.reply?.trim()) return null
  return (
    <div className="mt-2 rounded-2xl border-2 border-mustard/40 bg-mustard/10 px-3 py-2">
      <p className="font-jua text-[11px] text-[#9A7414]">{label}{r.reply_at ? ` · ${fmtDay(r.reply_at)}` : ''}</p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{r.reply}</p>
    </div>
  )
}
