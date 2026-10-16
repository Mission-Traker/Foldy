import { useEffect, useRef, useState } from 'react'
import { gradeMeaning, gradeSpelling } from '../lib/grading.js'
import { speak } from '../lib/speech.js'
import * as sfx from '../lib/sfx.js'
import { FitWord, Reaction } from './ui.jsx'

// 가족 문제·시험 모의고사용 간단한 퀴즈(단어장 기록은 바꾸지 않음)
// items: [{ word, meaning, accepted? }], mode: 'ko'(뜻 적기) | 'en'(영어 철자 쓰기)
export default function MiniQuiz({ items, mode, onDone }) {
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [res, setRes] = useState(null)
  const results = useRef([])
  const inputRef = useRef()
  const w = items[idx]

  useEffect(() => {
    setInput(''); setRes(null)
    if (mode === 'ko' && w) setTimeout(() => speak(w.word), 250)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!w) return null
  function record(ok, close) {
    setRes({ ok, close })
    ok ? sfx.correct() : sfx.wrong()
    results.current[idx] = { word: w.word, meaning: w.meaning, ok, answer: input.trim() }
  }
  function submit(e) {
    e?.preventDefault()
    if (res || !input.trim()) return
    const g = mode === 'ko' ? gradeMeaning(input, w.meaning, w.accepted) : gradeSpelling(input, w.word)
    record(g.ok, g.close)
  }
  function next() {
    if (idx + 1 >= items.length) onDone(results.current.slice())
    else setIdx(idx + 1)
  }
  const progress = ((idx + (res ? 1 : 0)) / items.length) * 100
  return (
    <div>
      <div className="mb-1 flex justify-end font-jua text-soft">{idx + 1}/{items.length}</div>
      <div className="mb-4 h-3 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-sage transition-all" style={{ width: `${progress}%` }} /></div>
      <div className={`card relative mb-4 flex min-h-[200px] flex-col items-center justify-center gap-3 p-6 text-center ${res && !res.ok ? 'wiggle border-no' : ''} ${res?.ok ? 'pop glow-ok border-ok' : ''}`}>
        <Reaction kind={res ? (res.ok ? 'ok' : 'no') : null} k={`${idx}-${res?.ok}`} />
        <p className="font-jua text-sm text-soft">{mode === 'ko' ? '뜻을 적어 보세요' : '영어로 적어 보세요'}</p>
        {mode === 'en' ? (
          <>
            <p className={`break-words font-jua text-slate-deep ${w.meaning.length > 14 ? 'text-2xl' : 'text-3xl'}`}>{w.meaning}</p>
            <p className="font-title text-soft tracking-[0.2em]">{w.word.replace(/[A-Za-z]/g, '_')}</p>
          </>
        ) : (
          <div className="flex w-full max-w-full items-center justify-center gap-3">
            <FitWord as="p" text={w.word} max={36} min={18} className="min-w-0 flex-1 text-center font-title font-bold leading-tight text-ink" />
            <button type="button" onClick={() => speak(w.word)} className="h-11 w-11 rounded-full bg-slate/10 text-xl" aria-label="듣기">🔊</button>
          </div>
        )}
        {res?.ok && <p className="font-jua text-2xl text-sage">정답! 🎉</p>}
        {res && !res.ok && (
          <div className="space-y-1">
            <p className="font-jua text-xl text-coral">{res.close ? '아까워요!' : '틀렸어요'}</p>
            <p className="text-slate-deep">정답: <b className="font-title text-lg">{mode === 'ko' ? w.meaning : w.word}</b></p>
          </div>
        )}
      </div>
      {!res ? (
        <form onSubmit={submit} className="space-y-2">
          <input ref={inputRef} className="field text-center text-xl" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'ko' ? '한글 뜻' : 'English'} autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} lang={mode === 'ko' ? 'ko' : 'en'} maxLength={60} aria-label="답" />
          <div className="flex gap-2">
            <button type="button" onClick={() => record(false, false)} className="btn-ghost flex-1">모르겠어요</button>
            <button className="btn-main flex-[2]" disabled={!input.trim()}>확인</button>
          </div>
        </form>
      ) : (
        <button className="btn-main w-full" onClick={next} autoFocus>{idx + 1 >= items.length ? '결과 보기' : '다음 →'}</button>
      )}
    </div>
  )
}
