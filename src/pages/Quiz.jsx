import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { gradeMeaning, gradeSpeech, gradeSpelling } from '../lib/grading.js'
import { applyAnswer, applyReview, isDue, MODE_LABEL, pickQuiz, sendToWrongNote, shuffle, ymd } from '../lib/study.js'
import { canListen, listenOnce, speak } from '../lib/speech.js'
import { Blob, Empty, Header, Reaction } from '../components/ui.jsx'
import * as sfx from '../lib/sfx.js'
import MicPicker from '../components/MicPicker.jsx'
import { savedMic } from '../lib/mic.js'

function buildQueue(words, mode, src) {
  if (mode === 'review') {
    const today = ymd()
    return shuffle(words.filter((w) => isDue(w, today))).slice(0, 20).map((w) => ({ id: w.id, mode: Math.random() < 0.5 ? 'ko' : 'en', review: true }))
  }
  if (src === 'wrong') {
    return shuffle(words.filter((w) => (w.wrong_modes || []).includes(mode))).slice(0, 20).map((w) => ({ id: w.id, mode }))
  }
  return pickQuiz(words, mode, 10).map((w) => ({ id: w.id, mode }))
}

export default function Quiz() {
  const { mode } = useParams()
  const [params] = useSearchParams()
  const src = params.get('src') || 'all'
  const nav = useNavigate()
  const { words, ready, patchWord, bumpDaily, showToast } = useApp()
  const [queue, setQueue] = useState(null)
  useEffect(() => { if (ready && !queue) setQueue(buildQueue(words, mode, src)) }, [ready]) // eslint-disable-line
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [res, setRes] = useState(null) // { ok, close, heard }
  const [score, setScore] = useState({ ok: 0, total: 0 })
  const [listening, setListening] = useState(false)
  const [judging, setJudging] = useState(false)
  const [sent, setSent] = useState(false)
  const inputRef = useRef()
  const endSound = useRef(false)
  const item = queue?.[idx]
  const w = useMemo(() => words.find((x) => x.id === item?.id), [words, item])
  const qmode = item?.mode

  useEffect(() => {
    setInput(''); setRes(null); setSent(false)
    if (qmode === 'ko' && w) setTimeout(() => speak(w.word), 250)
    if (qmode !== 'sp') setTimeout(() => inputRef.current?.focus(), 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  if (!queue) return <p className="py-20 text-center text-soft">불러오는 중…</p>
  if (!['ko', 'en', 'sp', 'review'].includes(mode)) return <Empty title="없는 퀴즈예요"><Link to="/study" className="btn-main mt-2">돌아가기</Link></Empty>

  const title = mode === 'review' ? '복습' : `${src === 'wrong' ? '오답노트 · ' : ''}${MODE_LABEL[mode]}`

  if (!queue.length) {
    return (
      <div>
        <Header title={title} back />
        <Empty title={mode === 'review' ? '오늘 복습할 단어가 없어요' : src === 'wrong' ? '오답노트가 비어 있어요' : '단어장에 단어를 먼저 넣어 주세요'}>
          <Link to={src === 'wrong' || mode === 'review' ? '/study' : '/add'} className="btn-main mt-2">{src === 'wrong' || mode === 'review' ? '학습으로' : '단어 추가'}</Link>
        </Empty>
      </div>
    )
  }

  if (idx >= queue.length || !w) {
    const perfect = score.ok === score.total
    if (!endSound.current) { endSound.current = true; setTimeout(() => (perfect ? sfx.fanfare() : sfx.correct()), 50) }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <Blob i={perfect ? 1 : 3} size={110} className="pop" />
        <h2 className="h-title text-3xl">{perfect ? '모두 맞혔어요!' : '수고했어요!'}</h2>
        <p className="font-jua text-xl text-slate-deep">{score.total}문제 중 {score.ok}개 정답</p>
        <div className="mt-2 flex gap-2">
          <button className="btn-ghost" onClick={() => nav(src === 'wrong' ? '/wrong' : '/study')}>그만하기</button>
          <button className="btn-main" onClick={() => nav(0)}>한 번 더</button>
        </div>
      </div>
    )
  }

  async function record(ok, extra = {}) {
    setRes({ ok, ...extra })
    ok ? sfx.correct() : sfx.wrong()
    setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }))
    const patch = item.review ? applyReview(w, qmode, ok) : applyAnswer(w, qmode, ok)
    if (ok) setTimeout(() => setIdx((i) => i + 1), 900)
    await patchWord(w.id, patch)
    if (ok) bumpDaily()
  }

  function submit(e) {
    e?.preventDefault()
    if (res || !input.trim()) return
    if (qmode === 'ko') {
      const g = gradeMeaning(input, w.meaning, w.accepted)
      record(g.ok, { close: g.close })
    } else {
      const g = gradeSpelling(input, w.word)
      record(g.ok, { close: g.close })
    }
  }

  async function mic() {
    if (!canListen()) return showToast('이 브라우저는 음성 인식을 지원하지 않아요(크롬·사파리 권장)')
    setListening(true)
    try {
      const alts = await listenOnce({ deviceId: savedMic() })
      const ok = gradeSpeech(alts, w.word)
      if (ok) record(true, { heard: alts[0]?.t })
      else { sfx.wrong(); setRes({ ok: false, retry: true, heard: alts[0]?.t || '(잘 안 들렸어요)' }) }
    } catch (err) {
      showToast(err.message === 'not-allowed' ? '마이크 권한을 허용해 주세요' : '음성 인식 오류: ' + err.message)
    } finally { setListening(false) }
  }

  async function aiJudge() {
    setJudging(true)
    try {
      const r = await db.ai('judge', { word: w.word, meaning: w.meaning, answer: input })
      if (r.ok) {
        const fixed = applyAnswer({ ...w }, qmode, true)
        const accepted = [...new Set([...(w.accepted || []), input.trim()])].slice(0, 20)
        await patchWord(w.id, { ...fixed, accepted })
        setScore((s) => ({ ...s, ok: s.ok + 1 }))
        setRes({ ok: true, judged: r.reason })
        sfx.correct()
        bumpDaily()
        setTimeout(() => setIdx((i) => i + 1), 1400)
      } else {
        setRes((x) => ({ ...x, judgedNo: r.reason || 'AI도 다른 뜻으로 봤어요' }))
      }
    } catch (err) {
      showToast(err.code === 'NO_KEY' ? 'AI 키가 연결되면 쓸 수 있어요' : err.message)
    } finally { setJudging(false) }
  }

  async function toWrongNote() {
    await patchWord(w.id, sendToWrongNote(w, qmode))
    setSent(true)
    showToast('오답노트로 보냈어요')
  }

  const already = (w.wrong_modes || []).includes(qmode)
  const progress = ((idx + (res ? 1 : 0)) / queue.length) * 100

  return (
    <div>
      <Header title={title} back right={<span className="font-jua text-soft">{idx + 1}/{queue.length}</span>} />
      <div className="mb-4 h-3 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-sage transition-all" style={{ width: `${progress}%` }} /></div>

      <div className={`card relative mb-4 flex min-h-[220px] flex-col items-center justify-center gap-3 p-6 text-center ${res && !res.ok ? 'wiggle border-no' : ''} ${res?.ok ? 'pop glow-ok border-ok' : ''}`}>
        <Reaction kind={res ? (res.ok ? 'ok' : 'no') : null} k={`${idx}-${res?.ok}-${res?.heard || ''}`} />
        <p className="font-jua text-sm text-soft">{qmode === 'ko' ? '뜻을 적어 보세요' : qmode === 'en' ? '영어로 적어 보세요' : '마이크를 누르고 또박또박 읽어 보세요'}</p>
        {qmode === 'en' ? (
          <>
            <p className="font-jua text-3xl text-slate-deep">{w.meaning}</p>
            <p className="font-title tracking-[0.3em] text-soft">{w.word[0]}{w.word.slice(1).replace(/[A-Za-z]/g, '_')}</p>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <p className="font-title text-4xl font-bold text-ink">{w.word}</p>
            <button onClick={() => speak(w.word)} className="h-11 w-11 rounded-full bg-slate/10 text-xl" aria-label="듣기">🔊</button>
          </div>
        )}
        {res?.ok && <p className="font-jua text-2xl text-sage">정답! {res.judged ? '🤖' : '🎉'}</p>}
        {res?.judged && <p className="text-xs text-soft">AI: {res.judged}</p>}
        {res && !res.ok && !res.retry && (
          <div className="space-y-1">
            <p className="font-jua text-xl text-coral">{res.close ? '아까워요!' : '틀렸어요'}</p>
            <p className="text-slate-deep">정답: <b className="font-title text-lg">{qmode === 'ko' ? w.meaning : w.word}</b>
              {qmode !== 'ko' && <button onClick={() => speak(w.word)} className="ml-1">🔊</button>}</p>
            {res.judgedNo && <p className="text-xs text-soft">AI: {res.judgedNo}</p>}
          </div>
        )}
        {res?.heard && <p className="text-sm text-soft">들은 말: “{res.heard}”</p>}
      </div>

      {qmode === 'sp' ? (
        !res || res.retry ? (
          <div className="space-y-2">
            <button onClick={mic} disabled={listening} className={`btn-coral w-full py-5 text-xl ${listening ? 'animate-pulse' : ''}`}>
              {listening ? '듣고 있어요…' : res?.retry ? '🎤 다시 말하기' : '🎤 누르고 말하기'}
            </button>
            {!canListen() && <p className="text-center text-xs text-coral">이 브라우저는 음성 인식이 안 돼요. 크롬(안드로이드)이나 사파리(아이폰)에서 열어 주세요.</p>}
            <button onClick={() => record(false)} className="btn-ghost w-full">잘 모르겠어요</button>
            <details className="text-sm">
              <summary className="cursor-pointer py-1 text-center text-soft">🎙 마이크 바꾸기</summary>
              <div className="mt-2"><MicPicker compact /></div>
            </details>
          </div>
        ) : null
      ) : (
        !res && (
          <form onSubmit={submit} className="space-y-2">
            <input ref={inputRef} className="field text-center text-xl" value={input} onChange={(e) => { setInput(e.target.value); sfx.tap() }}
              placeholder={qmode === 'ko' ? '한글 뜻' : 'English'} autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} lang={qmode === 'ko' ? 'ko' : 'en'} maxLength={60} />
            <div className="flex gap-2">
              <button type="button" onClick={() => record(false)} className="btn-ghost flex-1">모르겠어요</button>
              <button className="btn-main flex-[2]" disabled={!input.trim()}>확인</button>
            </div>
          </form>
        )
      )}

      {res && !res.ok && !res.retry && (
        <div className="space-y-2">
          {qmode === 'ko' && input.trim() && !res.judgedNo && (
            <button onClick={aiJudge} disabled={judging} className="btn-ghost w-full">{judging ? 'AI가 채점 중…' : '🤖 내 답도 맞는 것 같아요 (AI 재채점)'}</button>
          )}
          <div className="flex gap-2">
            {!already && !sent ? (
              <button onClick={toWrongNote} className="btn-coral flex-1 whitespace-nowrap px-3">📌 오답노트로</button>
            ) : (
              <span className="flex-1 self-center text-center text-sm text-soft">📌 오답노트에 있어요</span>
            )}
            <button onClick={() => setIdx((i) => i + 1)} className="btn-main flex-1">다음 →</button>
          </div>
        </div>
      )}
    </div>
  )
}
