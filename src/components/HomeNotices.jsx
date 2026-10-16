import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { examPlan } from '../lib/study.js'
import { Blob } from './ui.jsx'

const seenKey = (mid) => `foldy.chSeen.${mid}`
const loadSeen = (mid) => { try { return new Set(JSON.parse(localStorage.getItem(seenKey(mid)) || '[]')) } catch { return new Set() } }

// 홈 위쪽 알림 카드: 가족이 낸 문제 · 내가 낸 문제 결과 · 가까운 시험
export default function HomeNotices() {
  const { member, members, words } = useApp()
  const [chs, setChs] = useState([])
  const [exams, setExams] = useState([])
  const [seen, setSeen] = useState(() => loadSeen(member.id))
  useEffect(() => {
    let on = true
    db.challengesFor(member.id).then((l) => on && setChs(l)).catch(() => {})
    db.listExams(member.id).then((l) => on && setExams(l)).catch(() => {})
    setSeen(loadSeen(member.id))
    return () => { on = false }
  }, [member.id])

  const nameOf = (id) => members.find((m) => m.id === id) || {}
  const pending = chs.filter((c) => c.to_member === member.id && !c.done_at)
  const results = chs.filter((c) => c.from_member === member.id && c.done_at && !seen.has(c.id)).slice(0, 2)
  const markSeen = (id) => {
    const s = new Set(seen); s.add(id); setSeen(s)
    try { localStorage.setItem(seenKey(member.id), JSON.stringify([...s].slice(-100))) } catch { /* */ }
  }
  const exam = exams.map((e) => ({ e, p: examPlan(e, words) })).find(({ p }) => p.dday >= 0)

  if (!pending.length && !results.length && !exam) return null
  return (
    <div className="mb-4 space-y-2">
      {pending.slice(0, 2).map((c) => {
        const f = nameOf(c.from_member)
        return (
          <Link key={c.id} to={`/challenge/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-tang/50 bg-paper px-4 py-3">
            <Blob i={f.avatar || 0} size={34} wear={f.pet?.wear} />
            <span className="min-w-0 flex-1"><b className="font-jua text-slate-deep">{f.name || '가족'}가 문제 {c.words.length}개를 냈어요</b>
              <span className="block truncate text-xs text-soft">{c.note || '눌러서 맞혀 보세요'}</span></span>
            <span className="shrink-0 font-jua text-tang">풀기 ›</span>
          </Link>
        )
      })}
      {results.map((c) => {
        const t = nameOf(c.to_member)
        return (
          <Link key={c.id} to={`/challenge/${c.id}`} onClick={() => markSeen(c.id)} className="flex items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
            <Blob i={t.avatar || 1} size={34} wear={t.pet?.wear} />
            <span className="min-w-0 flex-1"><b className="font-jua text-slate-deep">{t.name || '가족'}가 내 문제를 풀었어요</b>
              <span className="block text-xs text-soft">{c.score}/{c.total} 맞혔어요{c.score === c.total ? ' 🎉' : ''}</span></span>
            <span className="text-soft">›</span>
          </Link>
        )
      })}
      {exam && (
        <Link to={`/exam/${exam.e.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
          <span className="w-12 shrink-0 text-center font-title text-base font-bold text-coral">{exam.p.dday === 0 ? 'D-DAY' : `D-${exam.p.dday}`}</span>
          <span className="min-w-0 flex-1"><b className="block truncate font-jua text-slate-deep">{exam.e.title}</b>
            <span className="block text-xs text-soft">{exam.p.today.length ? `오늘 ${exam.p.today.length}개 · 준비 ${exam.p.ready}/${exam.p.total}` : `준비 끝 ${exam.p.ready}/${exam.p.total} · 모의고사로 확인해요`}</span></span>
          <span className="text-soft">›</span>
        </Link>
      )}
    </div>
  )
}
