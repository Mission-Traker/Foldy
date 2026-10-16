import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as db from '../lib/db.js'
import { useApp } from '../App.jsx'
import { examPlan, expandStage, MODE_FIELD, resolveTodaySet, reviewCount, statusOf, ymd } from '../lib/study.js'
import { Empty, Header } from '../components/ui.jsx'
import { canListen } from '../lib/speech.js'
import { isIOS, pronHereOK } from '../lib/browser.js'

const CARDS = [
  { mode: 'ko', icon: '🔤', title: '영어 보고 뜻 쓰기', desc: '비슷한 뜻이면 정답이에요', cls: 'bg-tang/15 border-tang/40' },
  { mode: 'en', icon: '✏️', title: '뜻 보고 영어 쓰기', desc: '철자까지 정확하게', cls: 'bg-sage/15 border-sage/40' },
  { mode: 'sp', icon: '🎤', title: '발음하기', desc: '정석 발음과 70% 비슷하면 통과', cls: 'bg-coral/15 border-coral/40' },
]

export default function Study() {
  const { words, daily, member } = useApp()
  const today = ymd()
  const isToday = daily && daily.day === today
  const due = reviewCount(words, isToday ? daily.seen_ids : [], today)
  const setIds = resolveTodaySet(words, isToday ? daily.set_ids : [], member?.daily_goal || 5)
  const setWords = setIds.map((id) => words.find((w) => w.id === id)).filter(Boolean)
  const expandTodo = words.filter((w) => expandStage(w) === 'synant' && w.enriched).length
  const [exams, setExams] = useState([])
  useEffect(() => { if (member) db.listExams(member.id).then(setExams).catch(() => {}) }, [member])

  if (!words.length) {
    return (
      <div>
        <Header title="학습" />
        <Empty title="단어장이 비어 있어요" desc="단어를 넣으면 세 가지 퀴즈로 외울 수 있어요"><Link to="/add" className="btn-main mt-2">단어 추가</Link></Empty>
      </div>
    )
  }

  return (
    <div>
      <Header title="학습" />
      <section className="card mb-4 p-4">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h2 className="font-jua text-lg text-slate-deep">오늘의 단어 {setWords.length}개</h2>
          <span className="text-xs text-soft">하루 목표 {member?.daily_goal || 5}개</span>
        </div>
        <p className="mb-3 text-sm text-soft">오늘은 이 단어들만 퀴즈에 나와요. 한 바퀴를 다 돌면 같은 단어로 다시 외워요.</p>
        {setWords.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {setWords.map((w) => {
              const st = statusOf(w)
              return (
                <li key={w.id} className={`rounded-full border-2 px-2.5 py-1 font-title text-sm ${st === 'o' ? 'border-sage bg-sage/15 text-[#5E7F4B]' : st === 't' ? 'border-mustard/60 bg-mustard/10 text-ink' : 'border-line bg-white text-ink'}`}>
                  {st === 'o' ? '○ ' : ''}{w.word}
                </li>
              )
            })}
          </ul>
        ) : <p className="text-sm text-sage">단어장의 모든 단어가 ○ 완료예요! 새 단어를 넣어 주세요.</p>}
      </section>
      <p className="mb-3 text-sm text-soft">세 가지 퀴즈를 모두 맞히면 단어에 <b className="text-sage">○</b>가 붙어요.</p>
      <div className="space-y-3">
        {CARDS.map((c) => {
          const left = setWords.filter((w) => !w[MODE_FIELD[c.mode]]).length
          const done = setWords.length - left
          const clear = setWords.length > 0 && left === 0
          return (
            <Link key={c.mode} to={`/quiz/${c.mode}`}
              className={`relative flex items-center gap-4 rounded-3xl border-2 p-4 shadow-card ${clear ? 'border-sage bg-sage/20' : c.cls}`}>
              <span className="text-4xl">{c.icon}</span>
              <span className="min-w-0 flex-1">
                <b className="font-jua text-xl text-slate-deep">{c.title}</b>
                <span className="block text-sm text-soft">{c.mode === 'sp' && !pronHereOK(canListen()) ? `${isIOS() ? '사파리' : '크롬'}에서 열려요 ↗` : clear ? '오늘의 단어 통과! 눌러서 다시 외우기' : c.desc}</span>
                <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-white/70">
                  <span className="block h-full rounded-full bg-sage transition-all" style={{ width: `${setWords.length ? (done / setWords.length) * 100 : 0}%` }} />
                </span>
              </span>
              {clear ? (
                <span className="pop flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sage text-2xl font-bold text-white shadow-[0_3px_0_#6E8E5B]" aria-label="클리어">✓</span>
              ) : (
                <span className="text-right"><b className="font-jua text-2xl text-ink">{left}</b><span className="block text-[11px] text-soft">남음</span></span>
              )}
            </Link>
          )
        })}
      </div>
      {setWords.some((w) => statusOf(w) !== 'o') && (
        <Link to="/quiz/focus" className="nudge mt-4 flex items-center gap-3 rounded-3xl border-2 border-dashed border-slate bg-paper p-4">
          <span className="text-3xl">🎯</span>
          <span className="flex-1"><b className="font-jua text-lg text-slate-deep">○ 만들기 도전</b><span className="block text-xs text-soft">오늘의 단어 중 못 맞힌 퀴즈만 한 번에</span></span>
          <span className="font-jua text-slate">시작 →</span>
        </Link>
      )}

      <div className="mb-2 mt-6 flex items-center justify-between">
        <h2 className="font-jua text-lg text-slate-deep">📅 시험 대비</h2>
        <Link to="/exam/new" className="chip border-tang text-tang">＋ 시험 만들기</Link>
      </div>
      {exams.length ? (
        <div className="space-y-2">
          {exams.map((e) => {
            const p = examPlan(e, words)
            return (
              <Link key={e.id} to={`/exam/${e.id}`} className="card flex items-center gap-3 p-3">
                <span className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl font-title leading-none text-white ${p.dday < 0 ? 'bg-soft' : 'bg-coral'}`}>
                  <span className="text-[10px]">D</span><span className="text-base font-bold">{p.dday < 0 ? '끝' : p.dday === 0 ? 'DAY' : `-${p.dday}`}</span>
                </span>
                <span className="min-w-0 flex-1"><b className="block truncate font-jua text-slate-deep">{e.title}</b>
                  <span className="block text-xs text-soft">준비 {p.ready}/{p.total}{p.dday >= 0 && p.today.length ? ` · 오늘 ${p.today.length}개` : ''}</span></span>
                <span className="text-soft">›</span>
              </Link>
            )
          })}
        </div>
      ) : (
        <p className="card p-4 text-sm text-soft">학교·학원 단어시험 날짜와 범위를 정하면 남은 날에 맞춰 하루 분량을 나눠 주고, 전날엔 철자 모의고사를 볼 수 있어요.</p>
      )}

      <h2 className="mb-2 mt-6 font-jua text-lg text-slate-deep">더 깊이</h2>
      <div className="grid grid-cols-2 gap-3">
        <Link to="/quiz/review" className="card p-4">
          <span className="text-3xl">⏰</span>
          <b className="mt-1 block font-jua text-slate-deep">오늘 복습 {due}</b>
          <span className="text-xs text-soft">오늘 푼 단어와 복습 날이 된 ○ 단어</span>
        </Link>
        <Link to="/expand" className="card p-4">
          <span className="text-3xl">🌱</span>
          <b className="mt-1 block font-jua text-slate-deep">확장 학습 {expandTodo}</b>
          <span className="text-xs text-soft">비슷한 말·반대말 → 예문</span>
        </Link>
      </div>
    </div>
  )
}
