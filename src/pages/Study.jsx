import { Link } from 'react-router-dom'
import { useApp } from '../App.jsx'
import { expandStage, isDue, MODE_FIELD, ymd } from '../lib/study.js'
import { Empty, Header } from '../components/ui.jsx'

const CARDS = [
  { mode: 'ko', icon: '🔤', title: '영어 보고 뜻 쓰기', desc: '비슷한 뜻이면 정답이에요', cls: 'bg-tang/15 border-tang/40' },
  { mode: 'en', icon: '✏️', title: '뜻 보고 영어 쓰기', desc: '철자까지 정확하게', cls: 'bg-sage/15 border-sage/40' },
  { mode: 'sp', icon: '🎤', title: '발음하기', desc: '또박또박 읽으면 통과', cls: 'bg-coral/15 border-coral/40' },
]

export default function Study() {
  const { words } = useApp()
  const today = ymd()
  const due = words.filter((w) => isDue(w, today)).length
  const expandTodo = words.filter((w) => expandStage(w) === 'synant' && w.syn).length

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
      <p className="mb-3 text-sm text-soft">세 가지를 모두 맞히면 단어에 <b className="text-sage">○</b>가 붙어요. 한 번에 10문제씩, 아직 못 맞힌 단어부터 나와요.</p>
      <div className="space-y-3">
        {CARDS.map((c) => {
          const left = words.filter((w) => !w[MODE_FIELD[c.mode]]).length
          return (
            <Link key={c.mode} to={`/quiz/${c.mode}`} className={`flex items-center gap-4 rounded-3xl border-2 p-4 shadow-card ${c.cls}`}>
              <span className="text-4xl">{c.icon}</span>
              <span className="flex-1">
                <b className="font-jua text-xl text-slate-deep">{c.title}</b>
                <span className="block text-sm text-soft">{c.desc}</span>
              </span>
              <span className="text-right"><b className="font-jua text-2xl text-ink">{left}</b><span className="block text-[11px] text-soft">남음</span></span>
            </Link>
          )
        })}
      </div>

      <h2 className="mb-2 mt-6 font-jua text-lg text-slate-deep">더 깊이</h2>
      <div className="grid grid-cols-2 gap-3">
        <Link to="/quiz/review" className="card p-4">
          <span className="text-3xl">⏰</span>
          <b className="mt-1 block font-jua text-slate-deep">오늘 복습 {due}</b>
          <span className="text-xs text-soft">○ 단어를 1·3·7·30일 뒤 다시</span>
        </Link>
        <Link to="/expand" className="card p-4">
          <span className="text-3xl">🌱</span>
          <b className="mt-1 block font-jua text-slate-deep">확장 학습 {expandTodo}</b>
          <span className="text-xs text-soft">유의어·반의어 → 예문 열기</span>
        </Link>
      </div>
    </div>
  )
}
