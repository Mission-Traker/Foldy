import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { dailyPick, levelLabel } from '../lib/levels.js'
import { meaningsFor } from '../lib/enrich.js'
import { expandStage, isDue, statusOf, ymd } from '../lib/study.js'
import { Blob, Ring, Speak, GoalStepper } from '../components/ui.jsx'

export default function Home() {
  const { member, words, daily, setDaily, addWords, showToast, aiState, ready, openProfile, updateMember, patchMemberLocal } = useApp()
  const [goalEdit, setGoalEdit] = useState(false)
  const goalTimer = useRef()
  const goal = member.daily_goal
  const [recGoal, setRecGoal] = useState(goal) // 추천 단어 수(목표를 다 바꾼 뒤에 반영)
  function changeGoal(n) {
    patchMemberLocal({ daily_goal: n })
    clearTimeout(goalTimer.current)
    goalTimer.current = setTimeout(() => { setRecGoal(n); updateMember({ daily_goal: n }).catch((e) => showToast(e.message)) }, 600)
  }
  const [recs, setRecs] = useState(null)
  const [recBusy, setRecBusy] = useState(false)
  const today = ymd()
  const owned = useMemo(() => new Set(words.map((w) => w.word.toLowerCase())), [words])

  const counts = useMemo(() => {
    const c = { o: 0, t: 0, x: 0 }
    for (const w of words) c[statusOf(w)]++
    return c
  }, [words])
  const due = words.filter((w) => isDue(w, today)).length
  const expandTodo = words.filter((w) => expandStage(w) === 'synant' && w.enriched).length
  const done = daily?.day === today ? daily.done : 0

  // 오늘의 추천 5개: 처음엔 레벨 목록에서, 단어가 20개 이상 쌓이면 내 단어와 연관된 단어로
  useEffect(() => {
    if (!ready) return
    if (daily?.day === today && Array.isArray(daily.recs) && daily.recs.length >= recGoal) { setRecs(daily.recs.slice(0, recGoal)); return }
    let alive = true
    ;(async () => {
      setRecBusy(true)
      let items = []
      if (words.length >= 20) {
        try {
          const recent = [...words].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 30).map((w) => w.word)
          const r = await db.ai('recommend', { recent, owned: [...owned], level: member.level, count: Math.min(recGoal, 10) })
          items = r.items.map((x) => ({ ...x, related: true }))
        } catch { /* 레벨 목록으로 대체 */ }
      }
      if (items.length < recGoal) {
        const have = new Set([...owned, ...items.map((x) => x.word.toLowerCase())])
        const picks = dailyPick(member.level, have, `${member.id}-${today}`, recGoal - items.length)
        items = [...items, ...(await meaningsFor(picks, member.level))]
      }
      if (!alive) return
      setRecs(items)
      setRecBusy(false)
      // 뜻을 못 불러왔으면(AI 미연결) 저장하지 않아 다음에 다시 시도
      if (items.some((x) => !x.meaning)) return
      const row = { member_id: member.id, day: today, done, recs: items }
      setDaily(row)
      try { await db.upsertDaily(row) } catch { /* */ }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, member.id, today, recGoal])

  async function add(list) {
    const ok = list.filter((r) => r.meaning && !owned.has(r.word.toLowerCase()))
    if (!ok.length) return showToast(list.some((r) => !r.meaning) ? '뜻을 불러온 뒤에 담을 수 있어요' : '이미 단어장에 있어요')
    try {
      const { added } = await addWords(ok.map((r) => ({ word: r.word, meaning: r.meaning })), 'recommend')
      showToast(`${added.length}개를 단어장에 담았어요`)
    } catch (e) { showToast(e.message) }
  }

  return (
    <div className="pt-[max(env(safe-area-inset-top),16px)]">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={openProfile} aria-label="내 프로필 수정" className="relative active:scale-95">
          <Blob i={member.avatar} size={60} className="bob" />
          <span className="absolute -bottom-1 -right-1 rounded-full bg-paper px-1 text-[11px] border border-line">✎</span>
        </button>
        <div className="flex-1">
          <p className="text-sm text-soft">{levelLabel(member.level)}</p>
          <h1 className="h-title text-2xl">안녕, {member.name}!</h1>
        </div>
        <div className="rounded-2xl bg-paper px-3 py-2 text-center border-2 border-line">
          <div className="font-jua text-xl text-tang">🔥 {member.streak || 0}</div>
          <div className="text-[11px] text-soft">연속 학습일</div>
        </div>
      </div>

      <div className="card mb-4 flex items-center gap-4 p-4">
        <Ring value={Math.min(done, member.daily_goal)} max={member.daily_goal} />
        <div className="flex-1">
          <p className="font-jua text-lg text-slate-deep">{done >= member.daily_goal ? '오늘 목표 달성! 🎉' : '오늘의 목표'}</p>
          <p className="text-sm text-soft">문제 {member.daily_goal}개 맞히기 · 지금 {done}개</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Link to="/study" className="btn-main px-4 py-2 text-base">학습</Link>
          <button onClick={() => setGoalEdit((v) => !v)} className="text-xs text-soft underline">✎ 목표 바꾸기</button>
        </div>
      </div>
      {goalEdit && (
        <div className="card -mt-2 mb-4 flex flex-wrap items-center justify-between gap-2 p-3">
          <span className="font-jua text-slate-deep">하루 목표</span>
          <GoalStepper value={goal} onChange={changeGoal} />
          <button className="chip" onClick={() => setGoalEdit(false)}>완료</button>
        </div>
      )}

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        {[['x', '미학습', 'text-coral'], ['t', '학습 중', 'text-mustard'], ['o', '완료', 'text-sage']].map(([k, l, c]) => (
          <Link key={k} to={`/book?f=${k}`} className="card py-3">
            <div className={`font-jua text-2xl ${c}`}>{counts[k]}</div>
            <div className="text-xs text-soft">{k === 'o' ? '○' : k === 't' ? '△' : '✕'} {l}</div>
          </Link>
        ))}
      </div>

      {(due > 0 || expandTodo > 0) && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          {due > 0 && (
            <Link to="/quiz/review" className="card flex items-center gap-2 p-3">
              <span className="text-2xl">⏰</span>
              <span><b className="font-jua text-slate-deep">복습 {due}개</b><br /><span className="text-xs text-soft">잊기 전에 한 번 더</span></span>
            </Link>
          )}
          {expandTodo > 0 && (
            <Link to="/expand" className="card flex items-center gap-2 p-3">
              <span className="text-2xl">🌱</span>
              <span><b className="font-jua text-slate-deep">확장 {expandTodo}개</b><br /><span className="text-xs text-soft">유의어·반의어</span></span>
            </Link>
          )}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Link to="/add?tab=photo" className="btn-tang">📷 사진으로 추가</Link>
        <Link to="/add?tab=manual" className="btn-ghost">✍️ 직접 추가</Link>
      </div>

      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-jua text-xl text-slate-deep">오늘의 추천 단어</h2>
          {recs?.length > 0 && <button className="chip" onClick={() => add(recs)}>모두 담기</button>}
        </div>
        <p className="mb-3 text-xs text-soft">
          {recs?.some((r) => r.related) ? '내가 외운 단어와 이어지는 단어예요' : `${levelLabel(member.level)} 교육부 기본 어휘에서 골랐어요`}
        </p>
        {recBusy && !recs && <p className="py-4 text-center text-sm text-soft">단어를 고르는 중…</p>}
        <ul className="divide-y-2 divide-dashed divide-line">
          {(recs || []).map((r) => {
            const has = owned.has(r.word.toLowerCase())
            return (
              <li key={r.word} className="flex items-center gap-2 py-2.5">
                <Speak text={r.word} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-title text-lg font-semibold leading-tight text-ink [overflow-wrap:anywhere]">{r.word}</p>
                  <p className="truncate text-sm text-soft">{r.meaning || (recBusy ? '뜻 불러오는 중…' : '뜻은 AI 연결 후 표시돼요')}{r.why ? ` · ${r.why}` : ''}</p>
                </div>
                <button disabled={has} onClick={() => add([r])} className={`chip ${has ? '' : 'border-sage text-sage'}`}>{has ? '담음' : '＋ 담기'}</button>
              </li>
            )
          })}
        </ul>
      </section>
      {aiState === 'nokey' && (
        <p className="mt-3 text-center text-xs text-soft">AI 키가 아직 연결되지 않아 사진 읽기·유의어·예문 기능이 잠시 꺼져 있어요.</p>
      )}
    </div>
  )
}
