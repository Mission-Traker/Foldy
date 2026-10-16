import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { addDays, examPlan, examReady, shuffle, ymd } from '../lib/study.js'
import { Empty, Header } from '../components/ui.jsx'
import MiniQuiz from '../components/MiniQuiz.jsx'
import { fanfare } from '../lib/sfx.js'

const fmtDay = (s) => { const [, m, d] = s.split('-').map(Number); return `${m}월 ${d}일` }

export default function Exam() {
  const { id } = useParams()
  return id === 'new' ? <ExamNew /> : <ExamDetail id={id} />
}

// 시험 만들기: 이름 · 날짜 · 범위(내 단어장에서, 넣은 날짜별로 묶어서 고르기)
function ExamNew() {
  const { member, words, showToast } = useApp()
  const nav = useNavigate()
  const today = ymd()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(addDays(today, 7))
  const [picked, setPicked] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  // 넣은 날짜별 묶음(사진 한 장 = 보통 한 날짜)
  const groups = useMemo(() => {
    const g = new Map()
    for (const w of [...words].sort((a, b) => (b.seq || 0) - (a.seq || 0))) {
      const k = String(w.created_at || '').slice(0, 10) || '날짜 없음'
      if (!g.has(k)) g.set(k, [])
      g.get(k).push(w)
    }
    return [...g.entries()]
  }, [words])
  const toggleGroup = (ws) => setPicked((p) => { const n = new Set(p); const all = ws.every((w) => n.has(w.id)); for (const w of ws) all ? n.delete(w.id) : n.add(w.id); return n })
  const toggle = (wid) => setPicked((p) => { const n = new Set(p); n.has(wid) ? n.delete(wid) : n.add(wid); return n })
  const okDate = date > today && date <= addDays(today, 180)
  const can = title.trim() && okDate && picked.size > 0 && picked.size <= 300

  async function save() {
    if (!can) return
    setBusy(true)
    try {
      const e = await db.addExam({ member_id: member.id, title: title.trim().slice(0, 30), exam_date: date, word_ids: [...picked] })
      showToast('시험 계획을 만들었어요')
      nav(`/exam/${e.id}`, { replace: true })
    } catch (err) { showToast(err.message) } finally { setBusy(false) }
  }

  if (!words.length) return <div><Header title="시험 대비" back="/study" /><Empty title="단어장이 비어 있어요" desc="시험 범위 단어를 먼저 사진으로 찍어 넣어 주세요."><Link to="/add?tab=photo" className="btn-tang mt-2">📷 사진으로 추가</Link></Empty></div>

  return (
    <div>
      <Header title="시험 대비 만들기" back="/study" />
      <section className="card mb-4 space-y-3 p-4">
        <label className="block"><span className="label">시험 이름</span>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={30} placeholder="예: 3단원 단어시험" /></label>
        <label className="block"><span className="label">시험 날짜</span>
          <input className="field" type="date" value={date} min={addDays(today, 1)} max={addDays(today, 180)} onChange={(e) => setDate(e.target.value)} /></label>
        {!okDate && <p className="text-xs text-coral">내일부터 180일 안의 날짜를 골라 주세요.</p>}
      </section>
      <section className="card mb-4 p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-jua text-lg text-slate-deep">시험 범위</h2>
          <span className="font-jua text-tang">{picked.size}개</span>
        </div>
        <p className="mb-3 text-xs text-soft">단어를 넣은 날짜별로 묶었어요. 날짜를 누르면 그날 넣은 단어를 한 번에 골라요.</p>
        <div className="max-h-[50vh] space-y-3 overflow-y-auto">
          {groups.map(([day, ws]) => {
            const all = ws.every((w) => picked.has(w.id))
            return (
              <div key={day} className="rounded-2xl border-2 border-line bg-paper p-3">
                <label className="mb-2 flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={all} onChange={() => toggleGroup(ws)} className="h-5 w-5 accent-[#3E5486]" aria-label={`${day} 단어 모두 고르기`} />
                  <b className="font-jua text-slate-deep">{day === '날짜 없음' ? day : fmtDay(day)}에 넣은 단어</b>
                  <span className="text-xs text-soft">{ws.length}개</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ws.map((w) => (
                    <button key={w.id} type="button" onClick={() => toggle(w.id)} className={`chip !py-1 font-title ${picked.has(w.id) ? 'chip-on' : ''}`}>{w.word}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>
      <button className="btn-main w-full" disabled={!can || busy} onClick={save}>{busy ? '만드는 중…' : can ? `${picked.size}개로 시험 계획 만들기` : '이름·날짜·범위를 정해 주세요'}</button>
    </div>
  )
}

// 시험 계획: D-day · 준비 정도 · 오늘 분량 · 철자 모의고사
function ExamDetail({ id }) {
  const { words, showToast } = useApp()
  const nav = useNavigate()
  const [exam, setExam] = useState(undefined)
  const [mock, setMock] = useState(null)
  const [result, setResult] = useState(null)
  const [del, setDel] = useState(false)
  const { member } = useApp()
  useEffect(() => { db.listExams(member.id).then((l) => setExam(l.find((e) => e.id === id) || null)).catch(() => setExam(null)) }, [id, member.id])

  if (exam === undefined) return <p className="py-20 text-center text-soft">불러오는 중…</p>
  if (!exam) return <div><Header title="시험 대비" back="/study" /><Empty title="시험을 찾을 수 없어요"><Link to="/study" className="btn-main mt-2">학습으로</Link></Empty></div>

  const p = examPlan(exam, words)
  const list = (exam.word_ids || []).map((wid) => words.find((w) => w.id === wid)).filter(Boolean)
  const pct = p.total ? Math.round((p.ready / p.total) * 100) : 0

  if (mock) {
    return (
      <div>
        <Header noProfile title={`${exam.title} · 모의고사`} back={() => setMock(null)} />
        <MiniQuiz items={mock} mode="en" onDone={async (rs) => {
          const score = rs.filter((r) => r.ok).length
          setResult(rs); setMock(null)
          if (score === rs.length) setTimeout(fanfare, 100)
          try { setExam(await db.updateExam(exam.id, { mock_score: score, mock_total: rs.length, mock_at: new Date().toISOString() })) } catch (e) { showToast(e.message) }
        }} />
      </div>
    )
  }

  const startMock = () => { setResult(null); setMock(shuffle(list).slice(0, 40).map((w) => ({ word: w.word, meaning: w.meaning }))) }
  async function remove() {
    if (!del) return setDel(true)
    try { await db.deleteExam(exam.id); showToast('시험 계획을 지웠어요'); nav('/study', { replace: true }) } catch (e) { showToast(e.message) }
  }

  return (
    <div>
      <Header title="시험 대비" back="/study" />
      <section className="card mb-4 p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-coral font-title leading-none text-white">
            <span className="text-xs">D</span><span className="text-xl font-bold">{p.dday < 0 ? '끝' : p.dday === 0 ? 'DAY' : `-${p.dday}`}</span>
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-jua text-xl text-slate-deep">{exam.title}</h1>
            <p className="text-sm text-soft">{fmtDay(exam.exam_date)} · 단어 {p.total}개</p>
          </div>
        </div>
        <div className="mb-1 flex justify-between text-sm"><span className="text-soft">준비 끝(한→영·영→한 모두 맞힘)</span><b className="font-title tabular-nums text-slate-deep">{p.ready}/{p.total}</b></div>
        <div className="h-3 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-sage transition-all" style={{ width: `${pct}%` }} /></div>
        {p.missing > 0 && <p className="mt-2 text-xs text-soft">단어장에서 지운 단어 {p.missing}개는 빼고 셌어요.</p>}
      </section>

      {p.dday >= 0 && (
        <section className="card mb-4 p-4">
          <h2 className="mb-1 font-jua text-lg text-slate-deep">오늘 할 분량</h2>
          {p.today.length ? (
            <>
              <p className="mb-3 text-sm text-soft">남은 {p.left.length}개를 시험까지 {Math.max(1, p.dday)}일로 나눴어요.</p>
              <div className="mb-3 flex flex-wrap gap-1.5">{p.today.map((w) => <span key={w.id} className="chip !py-1 font-title">{w.word}</span>)}</div>
              <Link to={`/quiz/focus?ids=${p.today.map((w) => w.id).join(',')}`} className="btn-main block w-full text-center">오늘 분량 {p.today.length}개 공부하기</Link>
            </>
          ) : (
            <p className="text-sm text-sage">범위의 단어를 모두 준비했어요! 모의고사로 확인해 보세요.</p>
          )}
        </section>
      )}

      <section className="card mb-4 p-4">
        <h2 className="mb-1 font-jua text-lg text-slate-deep">✏️ 실전 모의고사</h2>
        <p className="mb-3 text-sm text-soft">학교 시험처럼 뜻을 보고 영어 철자를 써요{list.length > 40 ? '(40문제)' : ''}. 단어장 기록은 바뀌지 않아요.</p>
        {result && <p className="pop mb-2 text-center font-jua text-2xl text-sage">{result.filter((r) => r.ok).length}/{result.length} 맞혔어요</p>}
        {!result && exam.mock_at && <p className="mb-2 text-center text-sm text-soft">지난 모의고사 {exam.mock_score}/{exam.mock_total}</p>}
        {result && result.some((r) => !r.ok) && (
          <div className="mb-3 rounded-2xl bg-cream p-3 text-sm">
            <p className="mb-1 font-jua text-coral">틀린 단어</p>
            <p className="font-title text-slate-deep">{result.filter((r) => !r.ok).map((r) => r.word).join(' · ')}</p>
          </div>
        )}
        <button className="btn-ghost w-full" disabled={!list.length} onClick={startMock}>{result || exam.mock_at ? '모의고사 다시 보기' : '모의고사 보기'}</button>
      </section>

      <details className="card mb-4 p-4">
        <summary className="cursor-pointer font-jua text-slate-deep">범위 단어 {list.length}개 보기</summary>
        <ul className="mt-2 divide-y-2 divide-dashed divide-line">
          {list.map((w) => (
            <li key={w.id} className="flex items-center gap-2 py-2">
              <span className={`font-jua ${examReady(w) ? 'text-sage' : 'text-soft'}`}>{examReady(w) ? '✓' : '·'}</span>
              <b className="font-title">{w.word}</b>
              <span className="min-w-0 flex-1 truncate text-right text-sm text-soft">{w.meaning}</span>
            </li>
          ))}
        </ul>
      </details>
      <button className="w-full py-2 text-sm text-coral" onClick={remove}>{del ? '한 번 더 누르면 시험 계획을 지워요' : '시험 계획 지우기'}</button>
    </div>
  )
}
