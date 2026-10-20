import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../App.jsx'
import Auth from './Auth.jsx'
import { INVITE_URL } from '../components/Account.jsx'
import * as db from '../lib/db.js'
import { Header } from '../components/ui.jsx'
import { FeedbackHead, ReplyBubble } from '../components/Feedback.jsx'
import AdminStats from './AdminStats.jsx'

// 관리자 페이지: 한눈에(통계) · 가족(현황·테스트 가족 정리) · 수정요청함 · 랜딩 미리보기
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
      <nav className="mb-4 grid grid-cols-3 gap-1 rounded-3xl bg-paper p-1 ring-1 ring-line" aria-label="관리자 메뉴">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setParams({ tab: k }, { replace: true })} aria-pressed={tab === k}
            className={`whitespace-nowrap rounded-full py-2 font-jua text-[13px] ${tab === k ? 'bg-slate-deep text-white' : 'text-soft'}`}>{l}</button>
        ))}
      </nav>
      {tab === 'home' && <Overview go={(k) => setParams({ tab: k }, { replace: true })} />}
      {tab === 'stats' && <AdminStats />}
      {tab === 'families' && <Families />}
      {tab === 'feedback' && <FeedbackInbox />}
      {tab === 'errors' && <Errors />}
      {tab === 'landing' && <Landing />}
    </div>
  )
}

const TABS = [['home', '한눈에'], ['stats', '분석'], ['families', '가족'], ['feedback', '수정요청'], ['errors', '오류'], ['landing', '랜딩']]
const AI_LABEL = { free_text: '무료 AI 글', free_vision: '무료 AI 사진' }
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

// 앱 오류 기록(사용자 화면에서 난 오류가 자동으로 쌓임)
function Errors() {
  const [rows, setRows] = useState(null)
  const [open, setOpen] = useState(null)
  const [arm, setArm] = useState(false)
  const [msg, setMsg] = useState('')
  const load = () => db.adminErrors().then(setRows).catch((e) => { setMsg(e.message); setRows([]) })
  useEffect(() => { load() }, [])
  async function clear() {
    if (!arm) { setArm(true); setTimeout(() => setArm(false), 4000); return }
    setArm(false)
    try { const n = await db.adminClearErrors(); setMsg(`오류 기록 ${n}개를 지웠어요`); load() } catch (e) { setMsg(e.message) }
  }
  const t = (s) => { const d = new Date(s); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
  const dev = (ua) => (/iPhone|iPad/.test(ua) ? '아이폰' : /Android/.test(ua) ? '안드로이드' : /Mac/.test(ua) ? '맥' : /Windows/.test(ua) ? '윈도' : '기타') + (/KAKAOTALK/i.test(ua) ? '·카톡' : '')
  return (
    <div>
      <p className="mb-3 break-keep text-sm text-soft">사용자 화면에서 난 오류가 자동으로 쌓여요(같은 오류는 한 사람에 한 번). 이름·단어 같은 내용은 담지 않아요.</p>
      {msg && <p className="mb-2 text-sm text-slate-deep">{msg}</p>}
      {!rows ? <p className="py-10 text-center text-soft">불러오는 중…</p> : !rows.length ? <p className="card p-6 text-center text-sm text-soft">아직 오류 기록이 없어요 🎉</p> : (
        <ul className="divide-y divide-line rounded-3xl border border-line bg-paper px-4">
          {rows.map((r) => (
            <li key={r.id} className="py-3">
              <button className="w-full text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>
                <p className="break-words font-title text-sm text-coral">{r.message}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-xs text-soft">
                  {[t(r.at), r.path, dev(r.ua || ''), r.family ? `${r.family}(${r.login_id})` : '로그인 전', r.build].filter(Boolean).map((x, i) => <span key={i} className="whitespace-nowrap">{i ? '· ' : ''}{x}</span>)}
                </p>
              </button>
              {open === r.id && r.stack && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-cream p-2 text-[11px] text-ink">{r.stack}</pre>}
            </li>
          ))}
        </ul>
      )}
      {rows?.length > 0 && <button onClick={clear} className={`mt-4 w-full rounded-full border py-2.5 font-jua text-sm ${arm ? 'border-coral text-coral' : 'border-line text-soft'}`}>{arm ? '한 번 더 누르면 오류 기록을 모두 지워요' : '오류 기록 모두 지우기'}</button>}
    </div>
  )
}

// 재방문·기억 지표(테스트 가족 제외)
function Retention() {
  const [r, setR] = useState(null)
  useEffect(() => { db.adminRetention().then(setR).catch(() => setR({})) }, [])
  const pct = (v) => (v == null ? '—' : `${v}%`)
  return (
    <section className="rounded-3xl border border-line bg-paper p-4">
      <h2 className="mb-2 font-jua text-slate-deep">재방문·기억</h2>
      {!r ? <p className="text-sm text-soft">불러오는 중…</p> : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <li className="flex justify-between gap-2"><span className="text-soft">최근 7일 공부한 사람</span><b className="font-jua text-slate-deep">{r.active7 ?? '—'}/{r.members ?? '—'}</b></li>
          <li className="flex justify-between gap-2"><span className="text-soft">주 4일 이상</span><b className="font-jua text-slate-deep">{r.regular7 ?? '—'}</b></li>
          <li className="flex justify-between gap-2"><span className="text-soft">다음 날 다시 옴</span><b className="font-jua text-slate-deep">{pct(r.next_day)}</b></li>
          <li className="flex justify-between gap-2"><span className="text-soft">복습 기억률(7일)</span><b className="font-jua text-slate-deep">{pct(r.review7)}</b></li>
          <li className="flex justify-between gap-2"><span className="text-soft">오늘의 한 판(7일)</span><b className="font-jua text-slate-deep">{r.runs7 ?? '—'}번</b></li>
          <li className="flex justify-between gap-2"><span className="text-soft">○ 단어 비율</span><b className="font-jua text-slate-deep">{pct(r.o_pct)}</b></li>
          <li className="flex justify-between gap-2"><span className="text-soft">소개로 온 가족</span><b className="font-jua text-slate-deep">{r.invited ?? '—'}</b></li>
          <li className="flex justify-between gap-2"><span className="text-soft">그중 최근 7일</span><b className="font-jua text-slate-deep">{r.invited7 ?? '—'}</b></li>
        </ul>
      )}
      {r?.inviters?.length > 0 && <p className="mt-2 break-keep text-xs text-soft">많이 소개한 가족: {r.inviters.map((x) => `${x.name} ${x.n}`).join(' · ')}</p>}
      <p className="mt-2 text-[11px] text-soft">다음 날 다시 옴: 최근 2주, 공부한 날 다음 날에도 공부한 비율</p>
    </section>
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
      <Retention />
      <section className="rounded-3xl border border-line bg-paper p-4">
        <h2 className="mb-2 font-jua text-slate-deep">오늘 AI 사용</h2>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {Object.keys(AI_LABEL).map((k) => <li key={k} className="flex justify-between"><span className="text-soft">{AI_LABEL[k]}</span><b className="font-jua text-slate-deep">{ai[k] || 0}</b></li>)}
        </ul>
        <p className="mt-2 text-[11px] text-soft">유료 AI는 쓰지 않아요. 기본 어휘 2,898개는 앱에 넣어 둔 데이터로 처리하고, 그 밖의 단어만 무료 AI(가족당 하루 글 200회·사진 15장)를 써요.</p>
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
  // 베타 설문 요약: 별점 평균·응답 수(3일째·7일째 따로)
  const survey = rows.filter((r) => r.category === '베타 설문').map((r) => ({ day: (String(r.area || '').match(/(\d+)일째/) || [])[1], stars: (String(r.area || '').match(/★/g) || []).length })).filter((x) => x.stars > 0)
  const avg = (xs) => (xs.length ? (xs.reduce((a, x) => a + x.stars, 0) / xs.length).toFixed(1) : '—')

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {['전체', ...db.FEEDBACK_STATUSES].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`chip text-xs ${filter === s ? 'chip-on' : ''}`}>
            {s} {s === '전체' ? rows.length : counts[s] || 0}
          </button>
        ))}
      </div>
      {survey.length > 0 && (
        <section className="mb-3 rounded-2xl border border-line bg-paper p-3" aria-label="베타 설문 요약">
          <p className="font-jua text-slate-deep">⭐ 베타 설문 {survey.length}명 · 평균 {avg(survey)}점</p>
          <p className="mt-1 text-xs text-soft">3일째 {survey.filter((x) => x.day === '3').length}명 · {avg(survey.filter((x) => x.day === '3'))}점 / 7일째 {survey.filter((x) => x.day === '7').length}명 · {avg(survey.filter((x) => x.day === '7'))}점</p>
          <p className="mt-1 text-xs text-soft">{[5, 4, 3, 2, 1].map((n) => `${'★'.repeat(n)} ${survey.filter((x) => x.stars === n).length}`).join(' · ')}</p>
        </section>
      )}
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
