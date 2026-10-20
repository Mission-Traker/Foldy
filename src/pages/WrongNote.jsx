import { Link } from 'react-router-dom'
import { useApp } from '../App.jsx'
import { MODE_LABEL, MODES, wrongDue, wrongDueList, wrongNextVisit, WRONG_DAILY, WRONG_GOAL, ymd } from '../lib/study.js'
import { Empty, Header, Speak } from '../components/ui.jsx'
import { Dots, mdLabel } from './WrongPractice.jsx'

export default function WrongNote() {
  const { words, patchWord } = useApp()
  const today = ymd()
  const list = words.filter((w) => (w.wrong_modes || []).length)
    .sort((a, b) => Number(wrongDue(b, today)) - Number(wrongDue(a, today)) || (a.wrong_next || '').localeCompare(b.wrong_next || ''))
  const due = wrongDueList(words, today)
  const nextVisit = wrongNextVisit(words, today)
  const grads = words.reduce((n, w) => n + (w.wrong_grad || 0), 0)

  return (
    <div>
      <Header title="오답노트" />
      {!list.length ? (
        <Empty title="오답노트가 비어 있어요" desc={grads ? `지금까지 ${grads}개 단어가 졸업했어요 🎓` : '퀴즈에서 틀리거나 ‘모르겠어요’한 단어가 여기 모여요'} i={3} />
      ) : (
        <>
          <section className="mb-4 rounded-3xl bg-slate-deep p-5 text-white shadow-[0_4px_0_#2c3d63]">
            {due.length ? (
              <>
                <p className="text-sm text-white/70">오늘 다시 볼 단어</p>
                <p className="font-jua text-3xl">{due.length}개</p>
                <Link to="/wrong/practice" className="mt-3 block rounded-full bg-paper py-3 text-center font-jua text-lg text-slate-deep">
                  {Math.min(due.length, WRONG_DAILY)}개 다시 익히기
                </Link>
                {due.length > WRONG_DAILY && <Link to="/wrong/practice?n=all" className="mt-2 block text-center text-sm text-white/80 underline">한 번에 모두 하기</Link>}
              </>
            ) : (
              <>
                <p className="text-sm text-white/70">오늘 다시 볼 단어를 다 했어요</p>
                <p className="font-jua text-2xl">{nextVisit ? `${mdLabel(nextVisit.day)}에 ${nextVisit.count}개 다시 만나요` : '잘했어요!'}</p>
              </>
            )}
          </section>

          <p className="mb-3 text-sm leading-relaxed text-soft">
            다시 보기 → 쉬운 문제 → 원래 틀린 방식, 세 단계로 다시 익혀요. 서로 다른 날 {WRONG_GOAL}번 맞히면 졸업이에요(3일 뒤, 7일 뒤에 다시 만나요).
            {grads > 0 && <> 지금까지 <b className="text-sage">{grads}개 졸업</b>.</>}
          </p>

          <ul className="divide-y divide-line rounded-3xl border border-line bg-paper px-4">
            {list.map((w) => {
              const isDue = wrongDue(w, today)
              return (
                <li key={w.id} className="flex items-center gap-3 py-3">
                  <Speak text={w.word} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-title text-lg font-semibold">{w.word} <span className="font-body text-sm text-soft">{w.meaning}</span></p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-soft">
                      <Dots n={w.wrong_step || 0} />
                      <span className={isDue ? 'font-jua text-coral' : ''}>{isDue ? '오늘' : `${mdLabel(w.wrong_next)}에 다시`}</span>
                      <span>· {MODES.filter((m) => w.wrong_modes.includes(m)).map((m) => MODE_LABEL[m]).join(', ')}</span>
                    </p>
                  </div>
                  <button className="shrink-0 text-xs text-soft underline" onClick={() => patchWord(w.id, { wrong_modes: [], wrong_step: 0, wrong_next: null })}>빼기</button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
