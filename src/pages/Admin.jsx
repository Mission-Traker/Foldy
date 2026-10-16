import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../App.jsx'
import Auth from './Auth.jsx'
import { INVITE_URL } from '../components/Account.jsx'
import * as db from '../lib/db.js'
import { Header } from '../components/ui.jsx'
import { FeedbackHead, ReplyBubble } from '../components/Feedback.jsx'

// 관리자 페이지: 한눈에(통계) · 가족(유료 AI 켜기·테스트 가족 정리) · 수정요청함 · 랜딩 미리보기
// 관리자 › 수정요청함 — 멘토링대학교 수정요청함과 같은 구조(상태 필터 · 확인/보류/완료 · 답장 · 삭제)
const QUICK = ['좋은 의견이에요, 반영할게요 🙏', '확인했어요. 지금은 고칠 필요가 없어 보여요.', '이미 되는 기능이에요! 사용법을 알려 드릴게요.']
const ACTIONS = [['✅ 확인·고치는 중', '확인완료'], ['의견 보류', '의견보류'], ['✔ 고쳤어요', '수정완료']]

export default function Admin() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'home'
  const [ok, setOk] = useState(null)
  useEffect(() => { db.adminOk().then(setOk) }, [])
  if (ok === null) return <div><Header title="관리자" back="/me" /><p className="py-10 text-center text-soft">확인하는 중…</p></div>
  if (!ok) {
    return (
      <div>
        <Header title="관리자" back="/me" />
        <div className="card p-6 text-center text-soft">관리자만 볼 수 있어요.</div>
      </div>
    )
  }
  return (
    <div>
      <Header title="관리자" back="/me" />
      <nav className="mb-4 grid grid-cols-4 gap-1 rounded-full bg-paper p-1 ring-1 ring-line" aria-label="관리자 메뉴">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setParams({ tab: k }, { replace: true })} aria-pressed={tab === k}
            className={`whitespace-nowrap rounded-full py-2 font-jua text-sm ${tab === k ? 'bg-slate-deep text-white' : 'text-soft'}`}>{l}</button>
        ))}
      </nav>
      {tab === 'home' && <Overview go={(k) => setParams({ tab: k }, { replace: true })} />}
      {tab === 'families' && <Families />}
      {tab === 'feedback' && <FeedbackInbox />}
      {tab === 'landing' && <Landing />}
    </div>
  )
}

const TABS = [['home', '한눈에'], ['families', '가족'], ['feedback', '수정요청'], ['landing', '랜딩']]
const AI_LABEL = { text: 'Claude 글', vision: 'Claude 사진', free_text: '무료 글', free_vision: '무료 사진' }
const dayLabel = (d) => { if (!d) return '기록 없음'; const [, m, dd] = String(d).slice(0, 10).split('-').map(Number); return `${m}/${dd}` }

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-line bg-paper px-3 py-3">
      <p className="text-xs text-soft">{label}</p>
      <p className="font-jua text-2xl text-slate-deep">{value}</p>
      {sub && <p className="text-[11px] text-soft">{sub}</p>}
    </div>
  )
}

function Overview({ go }) {
  const [o, setO] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { db.adminOverview().then(setO).catch((e) => setErr(e.message)) }, [])
  if (err) return <p className="card p-4 text-sm text-coral">{err}</p>
  if (!o) return <p className="py-10 text-center text-soft">불러오는 중…</p>
  const ai = o.ai_today || {}
  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-slate-deep p-5 text-white shadow-[0_4px_0_#2c3d63]">
        <p className="text-sm text-white/70">오늘 공부한 가족</p>
        <p className="font-jua text-4xl">{o.active_today}<span className="ml-1 text-lg text-white/70">/ {o.families}가족</span></p>
        <p className="mt-1 text-sm text-white/80">오늘 맞힌 문제 {o.answers_today}개 · 최근 7일 공부한 가족 {o.active_7d}</p>
      </section>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="가족" value={o.families} sub={`최근 7일 새 가족 ${o.families_new7}`} />
        <Stat label="구성원" value={o.members} />
        <Stat label="단어" value={o.words} />
        <button onClick={() => go('feedback')} className="text-left"><Stat label="처리할 수정요청" value={o.feedback_open} sub="신규·수정진행 ›" /></button>
      </div>
      <section className="rounded-3xl border border-line bg-paper p-4">
        <h2 className="mb-2 font-jua text-slate-deep">오늘 AI 사용</h2>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {Object.keys(AI_LABEL).map((k) => <li key={k} className="flex justify-between"><span className="text-soft">{AI_LABEL[k]}</span><b className="font-jua text-slate-deep">{ai[k] || 0}</b></li>)}
        </ul>
        <p className="mt-2 text-[11px] text-soft">무료 AI는 가족당 하루 글 200회·사진 15장, Claude는 유료 가족만 하루 글 150회·사진 20장까지예요.</p>
      </section>
      <p className="text-center text-[11px] text-soft">테스트 가족(아이디 e2e_…) {o.tests}개는 숫자에서 뺐어요.</p>
    </div>
  )
}

function Families() {
  const [rows, setRows] = useState(null)
  const [tests, setTests] = useState(false)
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const [arm, setArm] = useState(false)
  const seq = useRef(0)
  // 늦게 온 이전 응답(테스트 포함 전 목록)이 새 목록을 덮지 않게
  const load = useCallback(() => {
    const n = ++seq.current
    db.adminFamilies(tests).then((r) => { if (n === seq.current) setRows(r) }).catch((e) => { setMsg(e.message); setRows([]) })
  }, [tests])
  useEffect(() => { setRows(null); load() }, [load])
  async function togglePaid(f) {
    setRows((rs) => rs.map((x) => (x.id === f.id ? { ...x, ai_paid: !f.ai_paid } : x)))
    try { await db.adminSetPaid(f.id, !f.ai_paid); setMsg(`${f.name}: ${!f.ai_paid ? '유료 AI(Claude) 켬' : '무료 AI만'}`) } catch (e) { setMsg(e.message); load() }
  }
  async function cleanup() {
    if (!arm) { setArm(true); setTimeout(() => setArm(false), 4000); return }
    setArm(false)
    try { const n = await db.adminCleanupTests(); setMsg(`테스트 가족 ${n}개를 지웠어요`); load() } catch (e) { setMsg(e.message) }
  }
  const t = q.trim().toLowerCase()
  const shown = (rows || []).filter((f) => !t || String(f.name || '').toLowerCase().includes(t) || String(f.login_id || '').includes(t))
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input className="field !py-2 text-base" placeholder="가족 이름·아이디 찾기" value={q} onChange={(e) => setQ(e.target.value)} aria-label="가족 찾기" maxLength={30} />
        <button className={`chip shrink-0 whitespace-nowrap ${tests ? 'chip-on' : ''}`} onClick={() => setTests((v) => !v)} aria-pressed={tests}>테스트 포함</button>
      </div>
      {msg && <p className="mb-2 text-sm text-slate-deep">{msg}</p>}
      {!rows ? <p className="py-10 text-center text-soft">불러오는 중…</p> : (
        <ul className="divide-y divide-line rounded-3xl border border-line bg-paper px-4">
          {shown.map((f) => {
            const ai = f.ai_today || {}
            const used = Object.values(ai).reduce((a, b) => a + b, 0)
            return (
              <li key={f.id} className="py-3">
                <div className="flex items-center gap-2">
                  <b className="min-w-0 flex-1 truncate font-jua text-slate-deep">{f.name}{f.mine && <span className="ml-1 text-xs text-sage">· 우리 가족</span>}</b>
                  <button onClick={() => togglePaid(f)} aria-pressed={f.ai_paid}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 font-jua text-xs ${f.ai_paid ? 'bg-slate-deep text-white' : 'border border-line text-soft'}`}>
                    {f.ai_paid ? '유료 AI 켜짐' : '무료 AI'}
                  </button>
                </div>
                <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-xs text-soft">
                  {[f.login_id, `가입 ${dayLabel(f.created_at)}`, `구성원 ${f.members}`, `단어 ${f.words}`, `마지막 학습 ${dayLabel(f.last_study)}`, used ? `오늘 AI ${used}회` : null]
                    .filter(Boolean).map((t, i) => <span key={i} className="whitespace-nowrap">{i ? '· ' : ''}{t}</span>)}
                </p>
              </li>
            )
          })}
          {!shown.length && <li className="py-6 text-center text-sm text-soft">찾는 가족이 없어요</li>}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-soft">‘유료 AI’를 켠 가족은 Claude를 먼저 쓰고, 나머지는 무료 AI(Gemini)만 써요.</p>
      <button onClick={cleanup} className={`mt-4 w-full rounded-full border py-2.5 font-jua text-sm ${arm ? 'border-coral text-coral' : 'border-line text-soft'}`}>
        {arm ? '한 번 더 누르면 테스트 가족을 지워요' : '🧹 자동 테스트가 만든 가족 지우기'}
      </button>
    </div>
  )
}

function Landing() {
  const { openIntro } = useApp()
  const nav = useNavigate()
  const meta = (p) => document.querySelector(`meta[property="${p}"]`)?.getAttribute('content') || ''
  return (
    <div className="space-y-3">
      <p className="text-sm text-soft">처음 들어온 사람이 보는 화면이에요. 눌러서 그대로 확인할 수 있어요(가입·로그인은 되지 않아요).</p>
      <button onClick={openIntro} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-left">
        <span className="text-2xl">🎞</span>
        <span className="min-w-0 flex-1"><b className="block font-jua text-slate-deep">소개 슬라이드</b><span className="text-xs text-soft">처음 열면 나오는 폴디 소개</span></span>
        <span className="text-soft">›</span>
      </button>
      <button onClick={() => nav('/admin/landing')} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-left">
        <span className="text-2xl">🏠</span>
        <span className="min-w-0 flex-1"><b className="block font-jua text-slate-deep">첫 화면(로그인·가족 만들기)</b><span className="text-xs text-soft">소개 다음에 나오는 시작 화면</span></span>
        <span className="text-soft">›</span>
      </button>
      <section className="rounded-2xl border border-line bg-paper p-4">
        <h2 className="mb-2 font-jua text-slate-deep">카톡으로 보냈을 때 미리보기</h2>
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <img src="/og.png" alt="링크 미리보기 그림" className="block aspect-[1200/630] w-full bg-cream object-cover" />
          <div className="px-3 py-2">
            <p className="font-jua text-sm text-ink">{meta('og:title') || document.title}</p>
            <p className="text-xs text-soft">{meta('og:description')}</p>
            <p className="mt-0.5 text-[11px] text-soft">{INVITE_URL.replace('https://', '')}</p>
          </div>
        </div>
      </section>
    </div>
  )
}

// 랜딩 미리보기(전체 화면): 실제 첫 화면을 그대로 보여 주되 가입·로그인은 막음
export function LandingPreview() {
  const nav = useNavigate()
  const [ok, setOk] = useState(null)
  useEffect(() => { db.adminOk().then(setOk) }, [])
  if (ok === false) return <div className="card mt-10 p-6 text-center text-soft">관리자만 볼 수 있어요.</div>
  return (
    <div>
      <div className="sticky top-0 z-30 -mx-4 flex items-center gap-2 bg-slate-deep px-4 pb-2 pt-[max(env(safe-area-inset-top),10px)] text-white">
        <span className="min-w-0 flex-1 font-jua text-sm">👀 랜딩 미리보기 · 가입·로그인은 되지 않아요</span>
        <button onClick={() => nav('/admin?tab=landing')} className="shrink-0 rounded-full bg-paper px-3 py-1 font-jua text-sm text-slate-deep">닫기</button>
      </div>
      <Auth preview />
    </div>
  )
}

function FeedbackInbox() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('전체')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await db.listFeedback()) } catch (e) { setMsg(e.message) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function patch(r, p) {
    // '확인완료'는 바로 '수정진행'(처리 대기열)으로 — 멘토링대학교와 같은 규칙
    const eff = p.status === '확인완료' ? { ...p, status: '수정진행' } : p
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...eff } : x)))
    try { const saved = await db.updateFeedback(r.id, eff); setRows((prev) => prev.map((x) => (x.id === r.id ? saved : x))); return true }
    catch (e) { setMsg(e.message); load(); return false }
  }
  async function remove(r) {
    if (!confirm('이 수정요청을 지울까요?')) return
    setRows((prev) => prev.filter((x) => x.id !== r.id))
    try { await db.deleteFeedback(r.id) } catch (e) { setMsg(e.message); load() }
  }

  const counts = {}
  rows.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1 })
  const shown = filter === '전체' ? rows : rows.filter((r) => r.status === filter)

  return (
    <div>
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
    // 저장에 실패하면 쓴 답장을 지우지 않음
    if (await onPatch(r, { reply: t.slice(0, 2000) })) { setDraft(''); setEditing(false) }
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
