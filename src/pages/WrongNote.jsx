import { Link } from 'react-router-dom'
import { useApp } from '../App.jsx'
import { MODE_LABEL, MODES } from '../lib/study.js'
import { Empty, Header, Speak } from '../components/ui.jsx'

const TAG = { ko: 'bg-tang/15 text-tang', en: 'bg-sage/15 text-sage', sp: 'bg-coral/15 text-coral' }

export default function WrongNote() {
  const { words, patchWord } = useApp()
  const list = words.filter((w) => (w.wrong_modes || []).length)

  return (
    <div>
      <Header title="오답노트" />
      {!list.length ? (
        <Empty title="오답노트가 비어 있어요" desc="퀴즈에서 틀린 단어를 ‘오답노트로 보내기’ 하면 여기 모여요" i={3} />
      ) : (
        <>
          <p className="mb-3 text-sm text-soft">틀린 방식별로 다시 연습해요. 맞히면 그 방식은 오답노트에서 빠져요.</p>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {MODES.map((m) => {
              const n = list.filter((w) => w.wrong_modes.includes(m)).length
              return (
                <Link key={m} to={n ? `/quiz/${m}?src=wrong` : '#'} aria-disabled={!n}
                  className={`card flex flex-col items-center py-3 ${n ? '' : 'pointer-events-none opacity-40'}`}>
                  <b className="font-jua text-2xl text-slate-deep">{n}</b>
                  <span className="text-xs text-soft">{MODE_LABEL[m]}</span>
                </Link>
              )
            })}
          </div>
          <ul className="card divide-y-2 divide-dashed divide-line px-3">
            {list.map((w) => (
              <li key={w.id} className="flex items-center gap-2 py-3">
                <Speak text={w.word} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-title text-lg font-semibold">{w.word} <span className="font-body text-sm text-soft">{w.meaning}</span></p>
                  <div className="mt-0.5 flex gap-1">
                    {w.wrong_modes.map((m) => <span key={m} className={`rounded-full px-2 py-0.5 text-[11px] font-jua ${TAG[m]}`}>{MODE_LABEL[m]}</span>)}
                  </div>
                </div>
                <button className="text-xs text-soft underline" onClick={() => patchWord(w.id, { wrong_modes: [] })}>빼기</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
