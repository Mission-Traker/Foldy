import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../App.jsx'
import { gradeMeaning, gradeSpeech } from '../lib/grading.js'
import { expandStage, shuffle } from '../lib/study.js'
import { canListen, listenOnce, speak } from '../lib/speech.js'
import { Blob, Empty, Header } from '../components/ui.jsx'

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

  useEffect(() => { setInput(''); setRes(null); setHeard(''); if (d) setTimeout(() => speak(d.word), 250); setTimeout(() => inputRef.current?.focus(), 100) }, [idx]) // eslint-disable-line

  if (!queue) return <p className="py-20 text-center text-soft">불러오는 중…</p>
  const waiting = words.filter((x) => expandStage(x) === 'synant' && !x.enriched).length

  if (!queue.length) {
    return (
      <div>
        <Header title="확장 학습" back />
        <Empty title="지금 확장할 단어가 없어요" desc={waiting ? (aiState === 'nokey' ? 'AI 키가 연결되면 유의어·반의어가 만들어져요' : `유의어·반의어를 준비 중인 단어 ${waiting}개`) : '세 가지 퀴즈를 모두 맞혀 ○를 받은 단어가 여기로 와요'} i={1}>
          <Link to="/study" className="btn-main mt-2">학습으로</Link>
        </Empty>
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
    if (!canListen()) return showToast('이 브라우저는 음성 인식을 지원하지 않아요')
    try {
      const alts = await listenOnce()
      setHeard(gradeSpeech(alts, d.word) ? `👍 좋아요! “${alts[0]}”` : `“${alts[0] || '잘 안 들렸어요'}” — 한 번 더!`)
    } catch (err) { showToast(err.message) }
  }

  const k = KIND[item.kind]
  return (
    <div>
      <Header title="확장 학습" back right={<span className="font-jua text-soft">{idx + 1}/{queue.length}</span>} />
      <div className={`card mb-4 flex flex-col items-center gap-2 p-6 text-center ${res && !res.ok ? 'wiggle' : ''} ${res?.ok ? 'pop' : ''}`}>
        <p className="text-sm text-soft"><b className="font-title text-base text-ink">{w.word}</b> ({w.meaning}) 의 <b className={`font-jua ${k.color}`}>{k.label}</b> · {k.hint}</p>
        <div className="flex items-center gap-3">
          <p className="font-title text-4xl font-bold">{d.word}</p>
          <button onClick={() => speak(d.word)} className="h-11 w-11 rounded-full bg-slate/10 text-xl" aria-label="듣기">🔊</button>
        </div>
        <button onClick={practice} className="chip">🎤 발음 연습</button>
        {heard && <p className="text-sm text-soft">{heard}</p>}
        {res?.ok && <p className="font-jua text-2xl text-sage">정답! 🎉</p>}
        {res && !res.ok && <p className="text-slate-deep">정답: <b>{d.meaning}</b></p>}
      </div>
      {!res ? (
        <form onSubmit={submit} className="space-y-2">
          <input ref={inputRef} className="field text-center text-xl" placeholder={`${d.word}의 뜻`} value={input} onChange={(e) => setInput(e.target.value)} maxLength={60} />
          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1" onClick={() => setRes({ ok: false })}>모르겠어요</button>
            <button className="btn-main flex-[2]" disabled={!input.trim()}>확인</button>
          </div>
        </form>
      ) : !res.ok && (
        <button className="btn-main w-full" onClick={() => setIdx((i) => i + 1)}>다음 →</button>
      )}
    </div>
  )
}
