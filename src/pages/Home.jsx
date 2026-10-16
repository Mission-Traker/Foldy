import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { dailyPick, levelLabel } from '../lib/levels.js'
import { meaningsFor } from '../lib/enrich.js'
import { expandStage, reviewCount, statusOf, ymd, liveStreak, wrongDueList, WRONG_DAILY } from '../lib/study.js'
import { Blob, Ring, Speak, GoalStepper, FitWord } from '../components/ui.jsx'
import LevelBar from '../components/LevelBar.jsx'
import { usePet, PetSheet } from '../components/PetCard.jsx'
import HomeNotices from '../components/HomeNotices.jsx'

export default function Home() {
  const { member, words, daily, updateDaily, addWords, showToast, aiState, ready, openProfile, updateMember, patchMemberLocal } = useApp()
  const [goalEdit, setGoalEdit] = useState(false)
  const [petOpen, setPetOpen] = useState(false)
  const pet = usePet()
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
  const due = reviewCount(words, daily?.day === today ? daily.seen_ids : [], today)
  const expandTodo = words.filter((w) => expandStage(w) === 'synant' && w.enriched).length
  const expandDone = words.filter((w) => expandStage(w) === 'example').length
  const done = daily?.day === today ? daily.done : 0
  // 오늘의 학습에 끼워 넣는 오답노트 단어(다시 볼 날이 된 것, 하루 최대 3개)
  const again = Math.min(wrongDueList(words, today).length, WRONG_DAILY)

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
      updateDaily(() => ({ recs: items }))
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

  const goalMet = done >= member.daily_goal
  const total = words.length
  return (
    <div className="pt-[max(env(safe-area-inset-top),16px)]">
      {/* 머리: 캐릭터(누르면 내 캐릭터) · 인사 · 연속 학습일 */}
      <div className="mb-3 flex items-center gap-3">
        <button onClick={() => setPetOpen(true)} aria-label="내 캐릭터 보기" className="relative shrink-0 active:scale-95">
          <Blob i={member.avatar} size={56} className={pet.ate ? 'pet-eat' : 'bob'} wear={pet.wear} />
          {pet.ate > 0 && <span className="pet-yum absolute -right-2 -top-1 rounded-full bg-tang px-1.5 py-0.5 font-jua text-[11px] text-white">냠 +{pet.ate}</span>}
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="h-title text-2xl">안녕, {member.name}!</h1>
          <p className="text-xs text-soft">🔥 {liveStreak(member)}일 연속 학습 중</p>
        </div>
      </div>
      {ready && <LevelBar member={member} words={words} onLevelUp={async (lv) => { await updateMember({ level: lv }); showToast('🎉 레벨업! 이제 더 어려운 단어가 추천돼요') }} />}

      {/* 가장 중요한 것 하나: 오늘의 학습 */}
      <section className="mb-4 rounded-3xl bg-slate-deep p-5 text-white shadow-[0_4px_0_#2c3d63]">
        <div className="flex items-center gap-4">
          <Ring value={Math.min(done, member.daily_goal)} max={member.daily_goal} size={72} color="#E9954B" track="rgba(255,255,255,.18)" text="#fff" />
          <div className="min-w-0 flex-1">
            <p className="font-jua text-xl">{goalMet ? '오늘 목표 달성! 🎉' : '오늘의 목표'}</p>
            <p className="text-sm text-white/75"><span className="block">문제 {member.daily_goal}개 맞히기{again > 0 && <> + 다시 볼 단어 {again}개</>}</span><span className="block">지금 {done}개 맞혔어요</span></p>
          </div>
        </div>
        <Link to={!total ? '/add' : goalMet && again > 0 ? '/wrong/practice' : goalMet && due > 0 ? '/quiz/review' : '/study'}
          className="mt-4 flex w-full items-center justify-center rounded-full bg-paper py-3 font-jua text-lg text-slate-deep shadow-[0_3px_0_rgba(0,0,0,.18)] active:translate-y-[2px] active:shadow-none">
          {!total ? '첫 단어 넣기' : goalMet ? (again > 0 ? `다시 볼 단어 ${again}개 하기` : due > 0 ? `복습 ${due}개 하기` : '한 번 더 학습하기') : done > 0 ? '이어서 학습하기' : '학습 시작하기'}
        </Link>
        {!goalMet && again > 0 && total > 0 && (
          <Link to="/wrong/practice" className="mt-2 block text-center text-sm text-white/85">📌 다시 볼 단어 {again}개 먼저 하기 ›</Link>
        )}
        <button onClick={() => setGoalEdit((v) => !v)} className="mx-auto mt-2 block text-xs text-white/70 underline">✎ 목표 바꾸기</button>
        {goalEdit && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-paper p-3 text-ink">
            <span className="font-jua text-slate-deep">하루 목표</span>
            <GoalStepper value={goal} onChange={changeGoal} />
            <button className="chip" onClick={() => setGoalEdit(false)}>완료</button>
          </div>
        )}
      </section>

      {ready && <HomeNotices />}

      {/* 나머지는 조용한 목록으로 */}
      <nav className="mb-4 overflow-hidden rounded-3xl border border-line bg-paper" aria-label="더 할 수 있는 것">
        <Row to="/quiz/review" icon="⏰" title={`복습 ${due}개`} sub={due > 0 ? '오늘 푼 단어 한 번 더' : '오늘 복습 끝!'} />
        <Row to="/expand" icon="🌱" title={`확장 ${expandTodo}개`} sub={expandTodo > 0 ? '유의어·반의어' : expandDone > 0 ? `${expandDone}개 확장 완료 ✓` : '○ 단어부터 열려요'} />
        <Row to="/book" icon="📒" title={`내 단어 ${total}개`} sub={<><span className="text-sage">○{counts.o}</span> · <span className="text-mustard">△{counts.t}</span> · <span className="text-coral">✕{counts.x}</span></>} last />
      </nav>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Link to="/add?tab=photo" className="btn-ghost !py-2.5 text-base">📷 사진으로 추가</Link>
        <Link to="/add?tab=manual" className="btn-ghost !py-2.5 text-base">✍️ 직접 추가</Link>
      </div>

      <section className="rounded-3xl border border-line bg-paper p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-jua text-lg text-slate-deep">오늘의 추천 단어</h2>
          {recs?.length > 0 && <button className="chip" onClick={() => add(recs)}>모두 담기</button>}
        </div>
        <p className="mb-3 text-xs text-soft">
          {recs?.some((r) => r.related) ? '내가 외운 단어와 이어지는 단어예요' : `교육부 기본 어휘 ${levelLabel(member.level)}에서 골랐어요`}
        </p>
        {recBusy && !recs && <p className="py-4 text-center text-sm text-soft">단어를 고르는 중…</p>}
        <ul className="divide-y divide-line">
          {(recs || []).map((r) => {
            const has = owned.has(r.word.toLowerCase())
            return (
              <li key={r.word} className="flex items-center gap-2 py-2.5">
                <Speak text={r.word} size="sm" />
                <div className="min-w-0 flex-1">
                  <FitWord as="p" text={r.word} max={18} min={12} className="font-title font-semibold leading-tight text-ink" />
                  <p className="text-sm text-soft">{r.meaning || (recBusy ? '뜻 불러오는 중…' : '뜻은 AI 연결 후 표시돼요')}{r.why ? ` · ${r.why}` : ''}</p>
                </div>
                <button disabled={has} onClick={() => add([r])} className={`shrink-0 rounded-full px-3 py-1.5 font-jua text-sm ${has ? 'text-soft' : 'text-slate-deep active:bg-cream'}`}>{has ? '담음 ✓' : '＋ 담기'}</button>
              </li>
            )
          })}
        </ul>
      </section>
      {aiState === 'nokey' && (
        <p className="mt-3 text-center text-xs text-soft">AI 기능을 준비하고 있어서 사진 읽기·유의어·예문이 잠시 꺼져 있어요.</p>
      )}
      {petOpen && <PetSheet onClose={() => setPetOpen(false)} onProfile={() => { setPetOpen(false); openProfile() }} />}
    </div>
  )
}

function Row({ to, icon, title, sub, last }) {
  return (
    <Link to={to} className={`flex items-center gap-3 px-4 py-3 active:bg-cream ${last ? '' : 'border-b border-line'}`}>
      <span className="w-6 text-center text-lg" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1"><b className="font-jua text-slate-deep">{title}</b><span className="ml-2 whitespace-nowrap text-xs text-soft">{sub}</span></span>
      <span className="text-soft" aria-hidden="true">›</span>
    </Link>
  )
}
