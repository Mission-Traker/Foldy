import { useCallback, useEffect, useState } from 'react'
import * as db from '../lib/db.js'
import { Header } from '../components/ui.jsx'
import { FeedbackHead, ReplyBubble } from '../components/Feedback.jsx'

// 관리자 › 수정요청함 — 멘토링대학교 수정요청함과 같은 구조(상태 필터 · 확인/보류/완료 · 답장 · 삭제)
const QUICK = ['좋은 의견이에요, 반영할게요 🙏', '확인했어요. 지금은 고칠 필요가 없어 보여요.', '이미 되는 기능이에요! 사용법을 알려 드릴게요.']
const ACTIONS = [['✅ 확인·고치는 중', '확인완료'], ['의견 보류', '의견보류'], ['✔ 고쳤어요', '수정완료']]

export default function Admin() {
  const [admin, setAdmin] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('전체')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await db.listFeedback()) } catch (e) { setMsg(e.message) }
    setLoading(false)
  }, [])
  useEffect(() => { db.isAdmin().then((a) => { setAdmin(a); if (a) load(); else setLoading(false) }) }, [load])

  async function patch(r, p) {
    // '확인완료'는 바로 '수정진행'(처리 대기열)으로 — 멘토링대학교와 같은 규칙
    const eff = p.status === '확인완료' ? { ...p, status: '수정진행' } : p
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...eff } : x)))
    try { const saved = await db.updateFeedback(r.id, eff); setRows((prev) => prev.map((x) => (x.id === r.id ? saved : x))) }
    catch (e) { setMsg(e.message); load() }
  }
  async function remove(r) {
    if (!confirm('이 수정요청을 지울까요?')) return
    setRows((prev) => prev.filter((x) => x.id !== r.id))
    try { await db.deleteFeedback(r.id) } catch (e) { setMsg(e.message); load() }
  }

  if (admin === false) {
    return (
      <div>
        <Header title="수정요청함" back="/me" />
        <div className="card p-6 text-center text-soft">관리자 가족만 볼 수 있어요.</div>
      </div>
    )
  }

  const counts = {}
  rows.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1 })
  const shown = filter === '전체' ? rows : rows.filter((r) => r.status === filter)

  return (
    <div>
      <Header title="수정요청함" back="/me" />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {['전체', ...db.FEEDBACK_STATUSES].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`chip text-xs ${filter === s ? 'chip-on' : ''}`}>
            {s} {s === '전체' ? rows.length : counts[s] || 0}
          </button>
        ))}
      </div>
      <p className="mb-3 text-[11px] text-soft"><b>확인·고치는 중</b>을 누르면 ‘수정진행’으로 넘어가요. 상태를 바꾸거나 답장을 보내면 그 가족의 내 정보에 ‘새 소식’으로 떠요.</p>
      {msg && <p className="mb-2 text-sm text-coral">{msg}</p>}
      {loading ? <p className="py-10 text-center text-soft">불러오는 중…</p>
        : shown.length === 0 ? <div className="card p-6 text-center text-soft">📮 수정요청이 없어요</div>
        : <ul className="space-y-3">{shown.map((r) => <Row key={r.id} r={r} onPatch={patch} onRemove={remove} />)}</ul>}
    </div>
  )
}

function Row({ r, onPatch, onRemove }) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const hasReply = !!r.reply?.trim()

  async function send() {
    const t = draft.trim()
    if (!t) return
    await onPatch(r, { reply: t.slice(0, 2000) })
    setDraft(''); setEditing(false)
  }

  return (
    <li className="card p-4">
      <FeedbackHead r={r} admin />
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{r.content}</p>
      {hasReply && !editing && (
        <div className="relative">
          <ReplyBubble r={r} label="💬 내 답장" />
          <button className="absolute right-2 top-2 text-[11px] text-soft underline" onClick={() => { setDraft(r.reply); setEditing(true) }}>고치기</button>
        </div>
      )}
      {(!hasReply || editing) && (
        <div className="mt-3">
          <div className="mb-1.5 flex flex-wrap gap-1">
            {QUICK.map((q) => <button key={q} onClick={() => setDraft(q)} className="rounded-full bg-cream px-2 py-1 text-[11px] text-soft">{q}</button>)}
          </div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={2000}
            placeholder="이 가족에게 보낼 답장 (내 정보에 새 소식으로 떠요)" aria-label="답장"
            className="field resize-y py-2 text-sm" />
          <div className="mt-1.5 flex gap-2">
            <button className="chip border-tang bg-tang text-white disabled:opacity-50" disabled={!draft.trim()} onClick={send}>💬 답장 보내기</button>
            {editing && <button className="text-xs text-soft" onClick={() => setEditing(false)}>취소</button>}
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t-2 border-dashed border-line pt-3">
        {ACTIONS.map(([lab, val]) => {
          const on = r.status === val || (val === '확인완료' && r.status === '수정진행')
          return <button key={val} onClick={() => onPatch(r, { status: val })} className={`chip text-xs ${on ? 'chip-on' : ''}`}>{lab}</button>
        })}
        <button onClick={() => onRemove(r)} className="ml-auto text-xl text-soft hover:text-coral" aria-label="삭제">×</button>
      </div>
    </li>
  )
}
