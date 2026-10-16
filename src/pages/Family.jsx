import { useEffect, useState } from 'react'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { levelLabel } from '../lib/levels.js'
import { statusOf, ymd, liveStreak } from '../lib/study.js'
import { Blob, Header } from '../components/ui.jsx'

// 가족 학습현황 — 보기 전용(다른 사람 단어장은 고칠 수 없음)
export default function Family() {
  const { members, member, showToast } = useApp()
  const [data, setData] = useState(null)

  useEffect(() => {
    db.familyProgress().then(setData).catch((e) => showToast(e.message))
  }, [showToast])

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
      {!data ? <p className="py-10 text-center text-soft">불러오는 중…</p> : (
        <div className="space-y-3">
          {rows.map(({ m, total, c, done, newWeek, studiedToday }) => {
            const pct = total ? Math.round((c.o / total) * 100) : 0
            return (
              <div key={m.id} className={`card p-4 ${m.id === member.id ? 'ring-2 ring-slate' : ''}`}>
                <div className="mb-2 flex items-center gap-3">
                  <Blob i={m.avatar} size={48} />
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
