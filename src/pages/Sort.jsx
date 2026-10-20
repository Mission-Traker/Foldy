import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../App.jsx'
import { markKnown, statusOf } from '../lib/study.js'
import { speak } from '../lib/speech.js'
import { Blob, Empty, FitWord, Header } from '../components/ui.jsx'
import * as sfx from '../lib/sfx.js'

// 쌓인 단어 정리 도우미: 아직 안 배운 단어를 한 장씩 넘기며 '알아요(바로 ○)' · '배울게요' · '지우기'
export default function Sort() {
  const { words, ready, patchWord, removeWord, showToast } = useApp()
  const nav = useNavigate()
  // 시작할 때의 목록을 고정(넘기는 도중 목록이 바뀌어 건너뛰지 않게)
  const start = useRef(null)
  if (!start.current && ready) start.current = words.filter((w) => statusOf(w) === 'x').sort((a, b) => (a.seq || 0) - (b.seq || 0)).map((w) => w.id)
  const ids = start.current || []
  const [i, setI] = useState(0)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tally, setTally] = useState({ known: 0, learn: 0, del: 0 })
  const w = useMemo(() => words.find((x) => x.id === ids[i]), [words, ids, i])

  if (!ready) return <p className="py-20 text-center text-soft">불러오는 중…</p>
  if (!ids.length) {
    return (
      <div>
        <Header title="아는 단어 거르기" back />
        <Empty title="안 배운 단어가 없어요" desc="단어장의 단어를 모두 한 번 이상 공부했어요" i={1}><Link to="/" className="btn-main mt-2">홈으로</Link></Empty>
      </div>
    )
  }
  if (i >= ids.length) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-center">
        <Blob i={1} size={96} className="pop" />
        <h2 className="h-title text-2xl">정리 끝!</h2>
        <p className="text-slate-deep">알아요 <b className="text-sage">{tally.known}</b> · 배울게요 <b className="text-tang">{tally.learn}</b> · 지움 <b className="text-coral">{tally.del}</b></p>
        <p className="text-sm text-soft">‘알아요’ 단어는 ○가 되고 3일 뒤에 한 번 확인해요</p>
        <button className="btn-main mt-2" onClick={() => nav('/quiz/daily')}>▶ 오늘의 한 판</button>
        <button className="text-sm text-soft underline" onClick={() => nav('/')}>홈으로</button>
      </div>
    )
  }

  const next = (k) => { setTally((t) => ({ ...t, [k]: t[k] + 1 })); setShow(false); setI((n) => n + 1) }
  async function act(k) {
    if (busy || !w) return
    setBusy(true)
    try {
      if (k === 'known') { await patchWord(w.id, markKnown(w)); sfx.correct() }
      if (k === 'del') { await removeWord(w.id); showToast(`‘${w.word}’ 지웠어요`) }
      next(k)
    } catch (e) { showToast(e.message) } finally { setBusy(false) }
  }

  return (
    <div>
      <Header title="아는 단어 거르기" back right={<span className="font-jua text-soft">{i + 1}/{ids.length}</span>} />
      <div className="mb-4 h-3 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-sage transition-all" style={{ width: `${(i / ids.length) * 100}%` }} /></div>
      <p className="mb-3 text-center text-sm text-soft">이미 아는 단어는 ‘알아요’로 넘기면 바로 ○가 돼요</p>
      {w ? (
        <div className="card mb-4 flex min-h-[200px] flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="flex w-full max-w-full items-center justify-center gap-3">
            <FitWord as="p" text={w.word} max={36} min={18} className="min-w-0 flex-1 text-center font-title font-bold leading-tight text-ink" />
            <button onClick={() => speak(w.word)} className="h-11 w-11 shrink-0 rounded-full bg-slate/10 text-xl" aria-label="듣기">🔊</button>
          </div>
          {show
            ? <p className="pop break-keep font-jua text-2xl text-slate-deep">{w.meaning}</p>
            : <button className="chip" onClick={() => setShow(true)}>뜻 보기</button>}
        </div>
      ) : <p className="py-10 text-center text-soft">이미 지운 단어예요</p>}
      <div className="grid grid-cols-2 gap-2">
        <button disabled={busy || !w} onClick={() => act('known')} className="btn-main py-4 text-lg">✅ 알아요</button>
        <button disabled={busy || !w} onClick={() => act('learn')} className="btn-ghost py-4 text-lg">📖 배울게요</button>
      </div>
      <button disabled={busy || !w} onClick={() => act('del')} className="mt-3 w-full py-2 text-sm text-coral">🗑 필요 없는 단어 — 지우기</button>
      <button onClick={() => setI(ids.length)} className="mx-auto mt-2 block text-xs text-soft underline">여기까지 할게요</button>
    </div>
  )
}
