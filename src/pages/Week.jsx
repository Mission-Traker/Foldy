import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { familyGoal, liveStreak, statusOf, weekStart, weekSummary, ymd } from '../lib/study.js'
import { Blob, Header } from '../components/ui.jsx'

const DOW = ['월', '화', '수', '목', '금', '토', '일']

// 이번 주 성장 카드 + 가족 공동 목표(👏 깨우기)
export default function Week() {
  const { member, members, words, showToast, today } = useApp()
  const [rows, setRows] = useState(null)
  const [fam, setFam] = useState(null)
  const [nudged, setNudged] = useState(new Set())
  const start = weekStart(today)
  useEffect(() => {
    let on = true
    db.myWeek(member.id, start).then((r) => on && setRows(r)).catch(() => on && setRows([]))
    if (members.length > 1) {
      db.familyWeek(start).then((r) => on && setFam(r)).catch(() => on && setFam([]))
      db.nudgesToday(today).then((r) => on && setNudged(new Set(r.filter((x) => x.from_member === member.id).map((x) => x.to_member)))).catch(() => {})
    }
    return () => { on = false }
  }, [member.id, members.length, start, today])
  const sum = useMemo(() => (rows ? weekSummary(rows, today) : null), [rows, today])
  const goal = useMemo(() => (fam ? familyGoal(members, fam, today) : null), [fam, members, today])
  const o = words.filter((w) => statusOf(w) === 'o').length
  const newWords = words.filter((w) => String(w.created_at || '').slice(0, 10) >= start).length
  const streak = liveStreak(member, today)

  async function wake(m) {
    try {
      const r = await db.nudge(member.id, m.id)
      setNudged((s) => new Set([...s, m.id]))
      showToast(r === 'already' ? `오늘은 이미 ${m.name}를 깨웠어요` : `👏 ${m.name}에게 알림을 보냈어요`)
    } catch (e) { showToast(e.message) }
  }
  async function share() {
    const text = `📈 폴디 이번 주 성장 (${member.name})\n공부한 날 ${sum.studied}/7일 · 맞힌 문제 ${sum.answers}개\n${sum.review != null ? `복습 기억률 ${sum.review}% · ` : ''}○ 단어 ${o}개 · 🔥 ${streak}일 연속`
    try {
      if (navigator.share) { await navigator.share({ text }); return }
    } catch (e) { if (e?.name === 'AbortError') return }
    try { await navigator.clipboard.writeText(text); showToast('복사했어요. 카톡에 붙여넣어 보내세요') } catch { showToast('복사하지 못했어요') }
  }

  return (
    <div>
      <Header title="이번 주 성장" back />
      {!sum ? <p className="py-10 text-center text-soft">불러오는 중…</p> : (
        <>
          <section className="mb-4 rounded-3xl bg-slate-deep p-5 text-white">
            <p className="font-jua text-sm text-white/70">{start.slice(5).replace('-', '/')}부터 이번 주</p>
            <p className="mt-1 font-jua text-2xl">공부한 날 {sum.studied}/7일</p>
            <div className="mt-3 grid grid-cols-7 gap-1.5" aria-label="요일별 공부">
              {sum.days.map((d, k) => (
                <div key={d.day} className="flex flex-col items-center gap-1">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full font-jua text-sm ${d.done > 0 ? 'bg-tang text-white' : d.future ? 'border border-white/20 text-white/40' : 'bg-white/10 text-white/50'}`}>{d.done > 0 ? '✓' : d.day === today ? '?' : ''}</span>
                  <span className="text-[11px] text-white/70">{DOW[k]}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="mb-4 grid grid-cols-2 gap-2">
            <Stat label="맞힌 문제" value={`${sum.answers}개`} />
            <Stat label="복습 기억률" value={sum.review != null ? `${sum.review}%` : '아직 없어요'} sub="복습에서 맞힌 비율" />
            <Stat label="○ 단어" value={`${o}개`} sub={`이번 주 새 단어 ${newWords}개`} />
            <Stat label="연속 학습" value={`🔥 ${streak}일`} sub={`오늘의 한 판 ${sum.runs}번`} />
          </section>
          <button className="btn-ghost mb-6 w-full" onClick={share}>📤 이번 주 성장 공유하기</button>

          {members.length > 1 && (
            <section className="card p-4">
              <h2 className="font-jua text-lg text-slate-deep">👨‍👩‍👧 가족 공동 목표</h2>
              <p className="mb-3 break-keep text-xs text-soft">이번 주 가족 모두 {goal?.goal || 5}일 이상 공부하기. 오늘 아직인 가족은 👏로 깨워 주세요(하루 한 번, 알림을 켠 사람에게).</p>
              {!goal ? <p className="py-4 text-center text-sm text-soft">불러오는 중…</p> : (
                <>
                  {goal.done && <p className="pop mb-3 rounded-2xl bg-sage/15 px-3 py-2 text-center font-jua text-sage">🏆 이번 주 가족 목표 달성!</p>}
                  <ul className="space-y-2.5">
                    {goal.per.map(({ m, days }) => {
                      const todayDone = m.last_study === today
                      return (
                        <li key={m.id} className="flex items-center gap-2">
                          <Blob i={m.avatar} size={30} wear={m.pet?.wear} />
                          <span className="w-16 shrink-0 truncate font-jua text-slate-deep">{m.name}</span>
                          <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-line"><span className={`block h-full rounded-full ${days >= goal.goal ? 'bg-sage' : 'bg-tang'}`} style={{ width: `${Math.min(100, (days / goal.goal) * 100)}%` }} /></span>
                          <span className="w-9 shrink-0 text-right font-title text-sm tabular-nums">{days}/{goal.goal}</span>
                          {m.id === member.id ? <span className="w-14 shrink-0 text-center text-xs text-soft">나</span>
                            : todayDone ? <span className="w-14 shrink-0 text-center text-xs text-sage">오늘 ✓</span>
                              : <button className="w-14 shrink-0 whitespace-nowrap rounded-full border border-line py-1 font-jua text-xs text-slate-deep disabled:opacity-40" disabled={nudged.has(m.id)} onClick={() => wake(m)} aria-label={`${m.name} 깨우기`}>{nudged.has(m.id) ? '깨웠어요' : '👏 깨우기'}</button>}
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-3">
      <p className="text-xs text-soft">{label}</p>
      <p className="font-jua text-xl text-slate-deep">{value}</p>
      {sub && <p className="break-keep text-[11px] text-soft">{sub}</p>}
    </div>
  )
}
