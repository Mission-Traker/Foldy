import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { levelLabel } from '../lib/levels.js'
import { statusOf, ymd, liveStreak, weekStart, familyWeekRank } from '../lib/study.js'
import FamilyChallenge from '../components/FamilyChallenge.jsx'
import { Blob, Header } from '../components/ui.jsx'

// 가족 학습현황 — 보기 전용(다른 사람 단어장은 고칠 수 없음)
export default function Family() {
  const { members, member, showToast } = useApp()
  const [data, setData] = useState(null)
  const [week, setWeek] = useState(null)

  useEffect(() => {
    db.familyProgress().then(setData).catch((e) => showToast(e.message))
    db.familyWeek(weekStart()).then(setWeek).catch(() => setWeek([]))
  }, [showToast])
  const rank = week && members.length > 1 ? familyWeekRank(members, week) : null
  const MEDAL = ['🥇', '🥈', '🥉']

  const today = ymd()
  const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString()
  const rows = members.map((m) => {
    const ws = (data?.words || []).filter((w) => w.member_id === m.id)
    const c = { o: 0, t: 0, x: 0 }
    for (const w of ws) c[statusOf(w)]++
    const done = (data?.daily || []).find((d) => d.member_id === m.id)?.done || 0
    const newWeek = ws.filter((w) => w.created_at >= weekAgo).length
    return { m, total: ws.length, c, done, newWeek, studiedToday: m.last_study === today }
  })
  const best = [...rows].sort((a, b) => b.c.o - a.c.o)[0]

  return (
    <div>
      <Header title="가족 학습현황" back />
      <p className="mb-3 text-sm text-soft">서로의 공부 현황을 볼 수 있어요. 다른 가족의 단어장은 고칠 수 없어요.</p>
      {members.length > 1 && (
        <Link to="/week" className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
          <span className="text-2xl">👨‍👩‍👧</span>
          <span className="flex-1"><b className="font-jua text-slate-deep">가족 공동 목표</b><span className="block text-xs text-soft">이번 주 모두 5일 공부하기 · 👏 깨우기</span></span>
          <span className="text-soft">›</span>
        </Link>
      )}
      {rank && (
        <section className="card mb-4 p-4">
          <h2 className="font-jua text-lg text-slate-deep">🏆 이번 주 가족 순위</h2>
          <p className="mb-3 text-xs text-soft">월요일부터 하루 목표를 얼마나 채웠는지로 비교해요. 레벨·목표가 달라도 공평해요.</p>
          <ol className="space-y-2">
            {rank.map((r, i) => (
              <li key={r.m.id} className="flex items-center gap-2">
                <span className="w-6 text-center font-jua text-lg">{r.pct > 0 && i < 3 ? MEDAL[i] : i + 1}</span>
                <Blob i={r.m.avatar} size={30} wear={r.m.pet?.wear} />
                <span className="w-16 shrink-0 truncate font-jua text-slate-deep">{r.m.name}</span>
                <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-tang" style={{ width: `${Math.min(100, r.pct)}%` }} /></span>
                <span className="w-11 text-right font-title text-sm tabular-nums text-slate-deep">{r.pct}%</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <FamilyChallenge />
      {!data ? <p className="py-10 text-center text-soft">불러오는 중…</p> : (
        <div className="space-y-3">
          {rows.map(({ m, total, c, done, newWeek, studiedToday }) => {
            const pct = total ? Math.round((c.o / total) * 100) : 0
            return (
              <div key={m.id} className={`card p-4 ${m.id === member.id ? 'ring-2 ring-slate' : ''}`}>
                <div className="mb-2 flex items-center gap-3">
                  <Blob i={m.avatar} size={48} wear={m.pet?.wear} />
                  <div className="min-w-0 flex-1">
                    <p className="font-jua text-lg text-slate-deep">
                      <span className="whitespace-nowrap">{m.name}{m.id === member.id && <span className="ml-1 text-xs text-soft">(나)</span>}</span>
                      {best && best.m.id === m.id && best.c.o > 0 && <span className="ml-1" title="완료 단어 1등">👑</span>}
                    </p>
                    <p className="text-xs text-soft">{levelLabel(m.level)} · 🔥 {liveStreak(m)}일 연속</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-jua text-sm ${studiedToday ? 'text-sage' : 'text-soft'}`}>{studiedToday ? '오늘 공부함 ✓' : '오늘 아직'}</p>
                    <p className="text-xs text-soft">오늘 정답 {done}/{m.daily_goal}</p>
                  </div>
                </div>
                <div className="mb-1 flex h-3 overflow-hidden rounded-full bg-line" aria-label={`완료 ${c.o}, 학습 중 ${c.t}, 미학습 ${c.x}`}>
                  {total > 0 && <>
                    <div className="bg-sage" style={{ width: `${(c.o / total) * 100}%` }} />
                    <div className="bg-mustard" style={{ width: `${(c.t / total) * 100}%` }} />
                    <div className="bg-coral/70" style={{ width: `${(c.x / total) * 100}%` }} />
                  </>}
                </div>
                <div className="flex justify-between text-xs text-soft">
                  <span>단어 {total}개 · 이번 주 +{newWeek}</span>
                  <span><b className="text-sage">○{c.o}</b> <b className="text-mustard">△{c.t}</b> <b className="text-coral">✕{c.x}</b> · 완료 {pct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
