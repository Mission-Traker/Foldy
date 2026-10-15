import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { gradeMeaning, gradeSpelling, speechScore, SPEECH_PASS } from '../lib/grading.js'
import { applyAnswer, applyReview, isDue, MODE_FIELD, MODE_LABEL, pickQuiz, sendToWrongNote, shuffle, statusOf, ymd } from '../lib/study.js'
import { canListen, listenOnce, speak } from '../lib/speech.js'
import { Blob, Empty, Header, Reaction } from '../components/ui.jsx'
import * as sfx from '../lib/sfx.js'
import MicPicker from '../components/MicPicker.jsx'
import PronSheet from '../components/PronSheet.jsx'
import { savedMic } from '../lib/mic.js'

// 완료 도전: ✕·△ 단어의 아직 못 맞힌 퀴즈만 모아서(단어 하나만 고를 수도 있음)
function focusQueue(words, ids) {
  const pick = ids ? words.filter((w) => ids.includes(w.id)) : shuffle(words.filter((w) => statusOf(w) !== 'o')).slice(0, 6)
  const items = []
  for (const w of pick) for (const m of ['ko', 'en', 'sp']) if (!w[MODE_FIELD[m]]) items.push({ id: w.id, mode: m })
  // 같은 단어가 연달아 나오지 않게 퀴즈 종류별로 묶어서 섞기
  return ['ko', 'en', 'sp'].flatMap((m) => items.filter((x) => x.mode === m)).slice(0, 18)
}

function buildQueue(words, mode, src, ids) {
  if (mode === 'focus') return focusQueue(words, ids)
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
  useEffect(() => { if (ready && !queue) setQueue(buildQueue(words, mode, src, params.get('ids')?.split(',').filter(Boolean))) }, [ready]) // eslint-disable-line
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [res, setRes] = useState(null) // { ok, close, heard }
  const [score, setScore] = useState({ ok: 0, total: 0 })
  const [listening, setListening] = useState(false)
  const [judging, setJudging] = useState(false)
  const [sent, setSent] = useState(false)
  const [pron, setPron] = useState(false)
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
  if (!['ko', 'en', 'sp', 'review', 'focus'].includes(mode)) return <Empty title="없는 퀴즈예요"><Link to="/study" className="btn-main mt-2">돌아가기</Link></Empty>

  const title = mode === 'review' ? '복습' : mode === 'focus' ? `○ 만들기 · ${MODE_LABEL[qmode] || ''}` : `${src === 'wrong' ? '오답노트 · ' : ''}${MODE_LABEL[mode]}`

  if (!queue.length && ['ko', 'en', 'sp'].includes(mode) && src !== 'wrong' && words.length) {
    // 이 퀴즈는 모든 단어를 이미 통과함
    return (
      <div>
        <Header noProfile title={title} back />
        <div className="card flex flex-col items-center gap-2 px-6 py-8 text-center">
          <span className="pop flex h-16 w-16 items-center justify-center rounded-full bg-sage text-4xl font-bold text-white shadow-[0_4px_0_#6E8E5B]">✓</span>
          <p className="font-jua text-xl text-slate-deep">{MODE_LABEL[mode]} — 모두 통과했어요! 🎉</p>
          <p className="text-sm text-soft">통과한 단어는 다시 나오지 않아요. 새 단어를 넣거나 다른 퀴즈를 풀어 보세요.</p>
          <div className="mt-2 flex gap-2">
            <Link to="/study" className="btn-ghost">다른 퀴즈</Link>
            <Link to="/add" className="btn-main">단어 추가</Link>
          </div>
        </div>
      </div>
    )
  }

  if (!queue.length) {
    return (
      <div>
        <Header title={title} back />
        <Empty title={mode === 'focus' ? '모든 단어가 ○ 완료예요! 🎉' : mode === 'review' ? '오늘 복습할 단어가 없어요' : src === 'wrong' ? '오답노트가 비어 있어요' : '단어장에 단어를 먼저 넣어 주세요'}>
          <Link to={src === 'wrong' || mode === 'review' ? '/study' : '/add'} className="btn-main mt-2">{src === 'wrong' || mode === 'review' ? '학습으로' : '단어 추가'}</Link>
        </Empty>
      </div>
    )
  }

  if (idx >= queue.length || !w) {
    const perfect = score.ok === score.total
    if (!endSound.current) { endSound.current = true; setTimeout(() => (perfect ? sfx.fanfare() : sfx.correct()), 50) }
    // 남은(모르는) 문제 수: 방금 푼 결과가 화면 상태에 이미 반영돼 있으므로 그대로 계산
    const ids = params.get('ids')?.split(',').filter(Boolean)
    const remaining = ['ko', 'en', 'sp'].includes(mode) && src !== 'wrong'
      ? words.filter((x) => !x[MODE_FIELD[mode]]).length
      : buildQueue(words, mode, src, ids).length
    // '한 번 더': 새로고침하지 않고 남은 문제로 다시 시작(저장 중인 답이 끊기지 않게)
    const restart = () => {
      setQueue(buildQueue(words, mode, src, ids))
      setIdx(0); setScore({ ok: 0, total: 0 }); setRes(null); setInput(''); setSent(false)
      endSound.current = false
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <Blob i={perfect ? 1 : 3} size={110} className="pop" />
        <h2 className="h-title text-3xl">{perfect ? '모두 맞혔어요!' : '수고했어요!'}</h2>
        <p className="font-jua text-xl text-slate-deep">{score.total}문제 중 {score.ok}개 정답</p>
        {mode === 'focus' && (
          <ul className="card w-full max-w-xs divide-y-2 divide-dashed divide-line px-3 text-left">
            {[...new Set(queue.map((x) => x.id))].map((id) => {
              const ww = words.find((x) => x.id === id)
              if (!ww) return null
              const o = statusOf(ww) === 'o'
              return (
                <li key={id} className="flex items-center gap-2 py-2">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full font-jua ${o ? 'pop bg-sage text-white' : 'border-2 border-mustard text-mustard'}`}>{o ? '✓' : '△'}</span>
                  <b className="flex-1 font-title">{ww.word}</b>
                  <span className={`text-xs ${o ? 'text-sage' : 'text-soft'}`}>{o ? '○ 완료!' : '조금 더'}</span>
                </li>
              )
            })}
          </ul>
        )}
        {remaining > 0 ? (
          <div className="mt-2 flex gap-2">
            <button className="btn-ghost" onClick={() => nav(src === 'wrong' ? '/wrong' : '/study')}>그만하기</button>
            <button className="btn-main" onClick={restart}>모르는 단어 {remaining}개 한 번 더</button>
          </div>
        ) : (
          <>
            <p className="pop flex items-center gap-2 rounded-full bg-sage px-4 py-1.5 font-jua text-white">✓ {mode === 'review' ? '오늘 복습 끝!' : src === 'wrong' ? '오답노트 모두 통과!' : '이 퀴즈는 모두 통과!'}</p>
            <div className="mt-1 flex gap-2">
              <button className="btn-ghost" onClick={() => nav('/study')}>다른 퀴즈</button>
              <button className="btn-main" onClick={() => nav('/book')}>단어장 보기</button>
            </div>
          </>
        )}
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
      const score = speechScore(alts, w.word)
      const heard = alts[0]?.t
      if (score >= SPEECH_PASS) record(true, { heard, score })
      else { sfx.wrong(); setRes({ ok: false, retry: true, heard: heard || '(잘 안 들렸어요)', score }) }
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
      <Header noProfile title={title} back right={<span className="font-jua text-soft">{idx + 1}/{queue.length}</span>} />
      <div className="mb-4 h-3 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-sage transition-all" style={{ width: `${progress}%` }} /></div>

      <div className={`card relative mb-4 flex min-h-[220px] flex-col items-center justify-center gap-3 p-6 text-center ${res && !res.ok ? 'wiggle border-no' : ''} ${res?.ok ? 'pop glow-ok border-ok' : ''}`}>
        <Reaction kind={res ? (res.ok ? 'ok' : 'no') : null} k={`${idx}-${res?.ok}-${res?.heard || ''}`} />
        <p className="font-jua text-sm text-soft">{qmode === 'ko' ? '뜻을 적어 보세요' : qmode === 'en' ? '영어로 적어 보세요' : '마이크를 누르고 읽어 보세요 (70% 비슷하면 통과)'}</p>
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
        {res?.score != null && (
          <div className="w-full max-w-[220px]">
            <div className="h-2.5 overflow-hidden rounded-full bg-line">
              <div className={`h-full rounded-full transition-all duration-700 ${res.score >= SPEECH_PASS ? 'bg-sage' : 'bg-coral'}`} style={{ width: `${Math.round(res.score * 100)}%` }} />
            </div>
            <p className="mt-0.5 text-xs text-soft">발음 정확도 <b className={res.score >= SPEECH_PASS ? 'text-sage' : 'text-coral'}>{Math.round(res.score * 100)}%</b> · 70% 이상 통과</p>
          </div>
        )}
        {qmode === 'sp' && (
          <button type="button" onClick={() => setPron(true)} className="chip border-slate text-slate-deep">🎧 더 정확한 발음 들어보기</button>
        )}
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
      {pron && <PronSheet word={w.word} heard={res?.heard} score={res?.score} onClose={() => setPron(false)} />}
    </div>
  )
}
