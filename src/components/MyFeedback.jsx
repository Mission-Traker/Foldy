import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as db from '../lib/db.js'
import { FeedbackHead, FeedbackSheet, ReplyBubble } from './Feedback.jsx'

// 내 정보 › 앱 수정요청 — 접수 버튼 + 우리 가족이 보낸 요청(상태·답장)
export default function MyFeedback({ memberName, memberId }) {
  const [rows, setRows] = useState(null)
  const [open, setOpen] = useState(false)
  const [all, setAll] = useState(false)
  const [admin, setAdmin] = useState(false)
  const [newCount, setNewCount] = useState(0)

  useEffect(() => {
    let alive = true
    db.myFeedback().then((r) => {
      if (!alive) return
      setRows(r)
      if (r.some(db.feedbackUnseen)) db.markFeedbackSeen() // 새 답장은 한 번 보면 읽음
    }).catch(() => alive && setRows([]))
    db.isAdminMember(memberId).then(async (a) => {
      if (!alive || !a) return
      setAdmin(true)
      try { const list = await db.listFeedback(); if (alive) setNewCount(list.filter((x) => x.status === '신규').length) } catch { /* 무시 */ }
    })
    return () => { alive = false }
  }, [memberId])

  const shown = rows ? (all ? rows : rows.slice(0, 3)) : []

  return (
    <section className="card mb-4 p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-jua text-lg text-slate-deep">🛠 앱 수정요청</h2>
        {admin && (
          <Link to="/admin?tab=feedback" className="chip relative border-slate-deep text-slate-deep">
            수정요청함
            {newCount > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-coral px-1 text-center text-[11px] leading-[18px] text-white">{newCount}</span>}
          </Link>
        )}
      </div>
      <p className="mb-3 text-xs text-soft">이상한 점·불편한 점·바라는 기능을 알려 주세요. 확인하면 여기서 답장을 볼 수 있어요.</p>
      <button className="btn-main w-full" onClick={() => setOpen(true)}>수정요청 보내기</button>

      {rows && rows.length > 0 && (
        <div className="mt-4">
          <p className="label">우리 가족이 보낸 요청 {rows.length}개</p>
          <ul className="space-y-2">
            {shown.map((r) => (
              <li key={r.id} className={`rounded-2xl border-2 bg-white p-3 ${db.feedbackUnseen(r) ? 'border-mustard' : 'border-line'}`}>
                <FeedbackHead r={r} />
                {db.feedbackUnseen(r) && <p className="mb-1 font-jua text-[11px] text-[#9A7414]">● 새 소식</p>}
                <p className="whitespace-pre-wrap text-sm text-ink">{r.content}</p>
                <p className="mt-1 text-[11px] text-soft">보낸 사람: {r.member_name}</p>
                <ReplyBubble r={r} />
              </li>
            ))}
          </ul>
          {rows.length > 3 && (
            <button className="mt-2 w-full text-center font-jua text-sm text-slate" onClick={() => setAll(!all)}>
              {all ? '접기 ▲' : `${rows.length - 3}개 더 보기 ▼`}
            </button>
          )}
        </div>
      )}

      {open && <FeedbackSheet memberName={memberName} onClose={() => setOpen(false)} onSent={(row) => row && setRows((r) => [row, ...(r || [])])} />}
    </section>
  )
}
