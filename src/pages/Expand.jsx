import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../App.jsx'
import { gradeMeaning, speechScore, SPEECH_PASS } from '../lib/grading.js'
import { expandStage, shuffle } from '../lib/study.js'
import { canListen, listenOnce, speak } from '../lib/speech.js'
import { Blob, Empty, Header, Reaction, FitWord } from '../components/ui.jsx'
import { isIOS, pronHereOK } from '../lib/browser.js'
import * as sfx from '../lib/sfx.js'
import { savedMic } from '../lib/mic.js'

const KIND = { syn: { label: '유의어', hint: '비슷한 뜻', color: 'text-sage' }, ant: { label: '반의어', hint: '반대 뜻', color: 'text-coral' } }

export default function Expand() {
  const { words, ready, patchWord, bumpDaily, showToast, aiState } = useApp()
  const nav = useNavigate()
  const build = () => {
    const items = []
    for (const w of words) {
      if (expandStage(w) !== 'synant' || !w.enriched) continue
      if (w.syn && !w.syn_ok) items.push({ id: w.id, kind: 'syn' })
      if (w.ant && !w.ant_ok) items.push({ id: w.id, kind: 'ant' })
    }
    return shuffle(items).slice(0, 12)
  }
  const [queue, setQueue] = useState(null)
  useEffect(() => { if (ready && !queue) setQueue(build()) }, [ready]) // eslint-disable-line
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [res, setRes] = useState(null)
  const [opened, setOpened] = useState([])
  const [heard, setHeard] = useState('')
  const inputRef = useRef()
  const item = queue?.[idx]
  const w = useMemo(() => words.find((x) => x.id === item?.id), [words, item])
  const d = w && item ? w[item.kind] : null

  useEffect(() => { setInput(''); setRes(null); setHeard(''); if (d) setTimeout(() => speak(d.word), 250); setTimeout(() => inputRef.current?.focus(), 100) }, [idx, queue]) // eslint-disable-line

  if (!queue) return <p className="py-20 text-center text-soft">불러오는 중…</p>
  const waiting = words.filter((x) => expandStage(x) === 'synant' && !x.enriched).length

  if (!queue.length) {
    return (
      <div>
        <Header title="확장 학습" back />
        <Empty title="지금 확장할 단어가 없어요" desc={waiting ? (aiState === 'nokey' ? 'AI 기능이 준비되면 유의어·반의어가 만들어져요' : `유의어·반의어를 준비 중인 단어 ${waiting}개`) : '아래 순서대로 하면 확장 학습이 열려요'} i={1} />
        <div className="mt-4" />
        <ExpandGuide words={words} />
        <Link to="/study" className="btn-main mt-4 w-full">학습으로</Link>
      </div>
    )
  }

  if (idx >= queue.length || !w) {
    return (
      <div className="py-8">
        <div className="mb-4 flex flex-col items-center text-center">
          <Blob i={2} size={96} className="pop" />
          <h2 className="h-title text-3xl">확장 완료!</h2>
          {opened.length > 0 && <p className="text-soft">예문이 열린 단어 {opened.length}개</p>}
        </div>
        {opened.map((o) => (
          <div key={o.id} className="card mb-3 p-4">
            <p className="font-title text-xl font-semibold">{o.word} <span className="text-2xl">{o.example?.scene}</span></p>
            <p className="mt-1 font-title text-[17px]">{o.example?.en}</p>
            <p className="text-sm text-soft">{o.example?.ko}</p>
            <button className="chip mt-2" onClick={() => speak(o.example?.en, { rate: 0.8 })}>▶ 문장 읽기</button>
          </div>
        ))}
        <div className="flex gap-2"><button className="btn-ghost flex-1" onClick={() => nav('/study')}>학습으로</button><button className="btn-main flex-1" onClick={() => nav('/book?f=o')}>단어장 보기</button></div>
      </div>
    )
  }

  async function submit(e) {
    e?.preventDefault()
    if (res) return
    const g = gradeMeaning(input, d.meaning)
    setRes(g)
    g.ok ? sfx.correct() : sfx.wrong()
    if (g.ok) {
      const patch = { [`${item.kind}_ok`]: true }
      const after = { ...w, ...patch }
      await patchWord(w.id, patch)
      bumpDaily()
      if (expandStage(after) === 'example') { setOpened((o) => [...o, after]); showToast(`‘${w.word}’ 예문이 열렸어요!`) }
      setTimeout(() => setIdx((i) => i + 1), 900)
    }
  }

  async function practice() {
    if (!pronHereOK(canListen())) return showToast(`발음 연습은 ${isIOS() ? '사파리' : '크롬'}에서 돼요 — 학습 › 발음하기에서 열어 주세요`)
    try {
      const alts = await listenOnce({ deviceId: savedMic() })
      { const sc = speechScore(alts, d.word); setHeard(sc >= SPEECH_PASS ? `👍 ${Math.round(sc * 100)}%! “${alts[0]?.t}”` : `“${alts[0]?.t || '잘 안 들렸어요'}” ${Math.round(sc * 100)}% — 한 번 더!`) }
    } catch (err) { showToast(err.message) }
  }

  const k = KIND[item.kind]
  return (
    <div>
      <Header noProfile title="확장 학습" back right={<span className="font-jua text-soft">{idx + 1}/{queue.length}</span>} />
      <div className={`card relative mb-4 flex flex-col items-center gap-2 p-6 text-center ${res && !res.ok ? 'wiggle border-no' : ''} ${res?.ok ? 'pop glow-ok border-ok' : ''}`}>
        <Reaction kind={res ? (res.ok ? 'ok' : 'no') : null} k={`${idx}-${res?.ok}`} />
        <p className="text-sm text-soft"><b className="font-title text-base text-ink">{w.word}</b> ({w.meaning}) 의 <b className={`font-jua ${k.color}`}>{k.label}</b> · {k.hint}</p>
        <div className="flex w-full max-w-full items-center justify-center gap-3">
          <FitWord as="p" text={d.word} max={36} min={18} className="min-w-0 flex-1 text-center font-title font-bold leading-tight" />
          <button onClick={() => speak(d.word)} className="h-11 w-11 rounded-full bg-slate/10 text-xl" aria-label="듣기">🔊</button>
        </div>
        <button onClick={practice} className="chip">🎤 발음 연습</button>
        {heard && <p className="text-sm text-soft">{heard}</p>}
        {res?.ok && <p className="font-jua text-2xl text-sage">정답! 🎉</p>}
        {res && !res.ok && <p className="text-slate-deep">정답: <b>{d.meaning}</b></p>}
      </div>
      {!res ? (
        <form onSubmit={submit} className="space-y-2">
          <input ref={inputRef} className="field text-center text-xl" placeholder={`${d.word}의 뜻`} value={input} onChange={(e) => { setInput(e.target.value); sfx.tap() }} maxLength={60} />
          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1" onClick={() => { sfx.wrong(); setRes({ ok: false }) }}>모르겠어요</button>
            <button className="btn-main flex-[2]" disabled={!input.trim()}>확인</button>
          </div>
        </form>
      ) : !res.ok && (
        <button className="btn-main w-full" onClick={() => setIdx((i) => i + 1)}>다음 →</button>
      )}
      <details className="mt-6 text-sm">
        <summary className="cursor-pointer py-1 text-center text-soft">확장 학습은 어떻게 열리나요?</summary>
        <div className="mt-2"><ExpandGuide words={words} compact /></div>
      </details>
    </div>
  )
}

// 확장 학습이 열리는 조건: ① ○ 받기 → ② 유의어·반의어 준비(AI 자동) → ③ 유의어·반의어 퀴즈 → 예문 열림
export function ExpandGuide({ words, compact = false }) {
  const st = { o: 0, wait: 0, ready: 0, open: 0, notO: 0 }
  for (const w of words || []) {
    const s = expandStage(w)
    if (s === 'none') st.notO++
    else { st.o++; if (s === 'example') st.open++; else if (w.enriched) st.ready++; else st.wait++ }
  }
  const steps = [
    { t: '단어에 ○ 받기', d: '영어 → 뜻, 뜻 → 영어 두 퀴즈를 모두 맞히면 ○가 붙어요', n: `○ 단어 ${st.o}개`, on: st.o > 0 },
    { t: '유의어·반의어 준비', d: '○를 받으면 AI가 비슷한 말과 반대말을 자동으로 만들어요', n: st.wait ? `준비 중 ${st.wait}개` : '기다릴 단어 없음', on: st.ready + st.open > 0 },
    { t: '유의어·반의어 퀴즈 맞히기', d: '비슷한 말·반대말의 뜻을 맞히면 그 단어의 예문이 열려요', n: `확장할 단어 ${st.ready}개`, on: st.ready > 0 },
    { t: '예문 열림', d: '예문은 단어장에서 단어를 눌러 볼 수 있어요', n: `예문 열린 단어 ${st.open}개`, on: st.open > 0 },
  ]
  return (
    <section className={`rounded-3xl border border-line bg-paper ${compact ? 'p-3' : 'p-4'}`} aria-label="확장 학습이 열리는 조건">
      {!compact && <h2 className="mb-2 font-jua text-lg text-slate-deep">확장 학습은 이렇게 열려요</h2>}
      <ol className="space-y-3">
        {steps.map((x, i) => (
          <li key={x.t} className="flex gap-3">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-jua text-sm ${x.on ? 'bg-sage text-white' : 'border-2 border-line text-soft'}`}>{i + 1}</span>
            <span className="min-w-0 flex-1">
              <b className="block font-jua text-slate-deep">{x.t}</b>
              <span className="block text-sm text-soft">{x.d}</span>
              <span className="mt-0.5 block text-xs text-slate">{x.n}</span>
            </span>
          </li>
        ))}
      </ol>
      {st.notO > 0 && <p className="mt-3 text-xs text-soft">아직 ○가 아닌 단어 {st.notO}개 — 학습에서 세 퀴즈를 마저 맞혀 보세요.</p>}
    </section>
  )
}
