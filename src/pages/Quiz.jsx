import { useEffect, useMemo, useRef, useState } from 'react'
import { QuickStartButton } from '../components/QuickStart.jsx'
import PushAsk from '../components/PushAsk.jsx'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { gradeMeaning, gradeSpelling, speechScore, SPEECH_PASS } from '../lib/grading.js'
import { applyAnswer, applyReview, clozeOf, dailyRunQueue, wrongDueList, WRONG_DAILY, ENOUGH_X, MODE_FIELD, MODE_LABEL, nextCandidates, PRACTICE_MODES, practiceQueue, reviewQueue, shuffle, statusOf, todayQueue, ymd } from '../lib/study.js'
import { canListen, listenOnce, speak, speakTTS } from '../lib/speech.js'
import { isIOS, openOutside, pronHereOK } from '../lib/browser.js'
import SelfPron from '../components/SelfPron.jsx'
import MyAnswer from '../components/MyAnswer.jsx'
import { Blob, Empty, Header, Reaction, FitWord } from '../components/ui.jsx'
import * as sfx from '../lib/sfx.js'
import MicPicker from '../components/MicPicker.jsx'
import PronSheet from '../components/PronSheet.jsx'
import { savedMic } from '../lib/mic.js'
import { track } from '../lib/track.js'
import { loadVocab } from '../lib/vocab.js'
import SwapWord from '../components/SwapWord.jsx'

// 완료 도전: 오늘의 단어 중 ✕·△ 단어의 아직 못 맞힌 퀴즈만 모아서(단어 하나만 고를 수도 있음)
function focusQueue(words, ids, setIds) {
  const pool = ids ? words.filter((w) => ids.includes(w.id)) : words.filter((w) => setIds.includes(w.id) && statusOf(w) !== 'o')
  const items = []
  for (const w of pool) for (const m of ['ko', 'en']) if (!w[MODE_FIELD[m]]) items.push({ id: w.id, mode: m })
  // 같은 단어가 연달아 나오지 않게 퀴즈 종류별로 묶어서 섞기(○ = 뜻 + 철자, 발음은 따로)
  return ['ko', 'en'].flatMap((m) => shuffle(items.filter((x) => x.mode === m))).slice(0, 30)
}

// setIds: 오늘의 단어(하루 목표 개수). 일반 퀴즈는 이 단어들만 — 다 맞히면 같은 단어로 다시
function buildQueue(words, mode, src, ids, setIds, seenIds) {
  if (mode === 'focus') return focusQueue(words, ids, setIds)
  if (mode === 'review') return reviewQueue(words, seenIds)
  if (PRACTICE_MODES.includes(mode)) return practiceQueue(words, setIds, mode)
  if (mode === 'daily') return dailyRunQueue(words, setIds)
  if (src === 'wrong') {
    return shuffle(words.filter((w) => (w.wrong_modes || []).includes(mode))).slice(0, 20).map((w) => ({ id: w.id, mode }))
  }
  return todayQueue(words, setIds, mode)
}

export default function Quiz() {
  const { mode } = useParams()
  const [params] = useSearchParams()
  const src = params.get('src') || 'all'
  const nav = useNavigate()
  const { words, ready, patchWord, bumpDaily, markSeen, daily, ensureTodaySet, extendTodaySet, member, showToast, updateDaily } = useApp()
  const [queue, setQueue] = useState(null)
  const [setIds, setSetIds] = useState([])
  const [round, setRound] = useState(1)
  // 자동 채점(음성 인식)이 안 되는 곳·마이크가 자꾸 바뀌는 곳에서는 '내 목소리로 확인'(녹음해서 비교)
  const [selfMode, setSelfMode] = useState(() => !pronHereOK(canListen()))
  const [spFails, setSpFails] = useState(0)
  const seenToday = () => (daily && daily.day === ymd() ? daily.seen_ids || [] : [])
  useEffect(() => {
    if (!ready || queue) return
    const ids = ensureTodaySet()
    setSetIds(ids)
    let q = buildQueue(words, mode, src, params.get('ids')?.split(',').filter(Boolean), ids, seenToday())
    setQueue(q)
    track('quiz_start', { mode, src: src || '', n: q.length })
  }, [ready]) // eslint-disable-line
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [res, setRes] = useState(null) // { ok, close, heard }
  const [score, setScore] = useState({ ok: 0, total: 0 })
  const [listening, setListening] = useState(false)
  const [judging, setJudging] = useState(false)
  const [pron, setPron] = useState(false)
  const [swap, setSwap] = useState(false)
  const inputRef = useRef()
  const endSound = useRef(false)
  const item = queue?.[idx]
  const w = useMemo(() => words.find((x) => x.id === item?.id), [words, item])
  const qmode = item?.mode

  useEffect(() => {
    setInput(''); setRes(null); setSpFails(0)
    // 영어→뜻·발음 문제는 들어오자마자 발음 재생(뜻→영어는 정답이 드러나므로 재생 안 함)
    // queue도 지켜봐야 첫 문제(단어 목록을 불러온 직후)에서도 재생됨
    if ((qmode === 'ko' || qmode === 'sp' || qmode === 'dict') && w) setTimeout(() => speak(w.word), 250)
    if (qmode !== 'sp') setTimeout(() => inputRef.current?.focus(), 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, queue])

  if (!queue) return <p className="py-20 text-center text-soft">불러오는 중…</p>
  if (!['ko', 'en', 'sp', 'review', 'focus', 'daily', ...PRACTICE_MODES].includes(mode)) return <Empty title="없는 퀴즈예요"><Link to="/study" className="btn-main mt-2">돌아가기</Link></Empty>

  const practiceRound = ['ko', 'en', 'sp'].includes(mode) && queue[0]?.practice
  const title = mode === 'daily' ? ((t) => (t ? `오늘의 한 판 · ${t}` : '오늘의 한 판'))(item?.review ? '복습' : MODE_LABEL[qmode] || '') : mode === 'review' ? '오늘 복습' : mode === 'focus' ? `○ 만들기 · ${MODE_LABEL[qmode] || ''}` : `${src === 'wrong' ? '오답노트 · ' : ''}${MODE_LABEL[mode]}${practiceRound ? ' · 다시 외우기' : ''}`

  if (!queue.length && ['ko', 'en', 'sp'].includes(mode) && src !== 'wrong' && words.length) {
    // 이 퀴즈는 모든 단어를 이미 통과함
    return (
      <div>
        <Header noProfile title={title} back />
        <div className="card flex flex-col items-center gap-2 px-6 py-8 text-center">
          <span className="pop flex h-16 w-16 items-center justify-center rounded-full bg-sage text-4xl font-bold text-white shadow-[0_4px_0_#6E8E5B]">✓</span>
          <p className="font-jua text-xl text-slate-deep">단어장의 모든 단어가 ○ 완료예요! 🎉</p>
          <p className="text-sm text-soft">새 단어를 넣으면 내일부터 오늘의 단어로 나와요.</p>
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
        <Empty title={mode === 'cloze' ? '예문이 준비된 단어가 아직 없어요' : mode === 'focus' ? '오늘의 단어가 모두 ○ 완료예요! 🎉' : mode === 'review' ? '오늘 복습할 단어가 없어요' : src === 'wrong' ? '오답노트가 비어 있어요' : '단어장에 단어를 먼저 넣어 주세요'}>
          {!words.length && src !== 'wrong' ? (
            <><QuickStartButton where="quiz" /><Link to="/add" className="btn-ghost mt-1 w-full max-w-xs">단어 직접 넣기</Link></>
          ) : <Link to={src === 'wrong' || mode === 'review' ? '/study' : '/add'} className="btn-main mt-2">{src === 'wrong' || mode === 'review' ? '학습으로' : '단어 추가'}</Link>}
        </Empty>
      </div>
    )
  }

  if (idx >= queue.length || !w) {
    const perfect = score.ok === score.total
    if (!endSound.current) {
      endSound.current = true
      track('quiz_end', { mode, n: score.total, ok: score.ok })
      setTimeout(() => (perfect || mode === 'daily' ? sfx.fanfare() : sfx.correct()), 50)
      if (mode === 'daily') setTimeout(() => updateDaily((d) => (d.run_done ? null : { run_done: true })), 0)
    }
    if (mode === 'daily') {
      const again = Math.min(wrongDueList(words, ymd()).length, WRONG_DAILY)
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
          <Blob i={1} size={110} className="pop" />
          <h2 className="h-title text-3xl">오늘의 한 판 끝! 🎉</h2>
          <p className="font-jua text-xl text-slate-deep">{score.total}문제 중 {score.ok}개 정답</p>
          <p className="text-sm text-soft">내일 또 한 판이면 기억이 훨씬 오래가요</p>
          <PushAsk member={member} showToast={showToast} />
          <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
            {again > 0 && <button className="btn-main" onClick={() => nav('/wrong/practice')}>📌 다시 볼 단어 {again}개</button>}
            <button className={again > 0 ? 'btn-ghost' : 'btn-main'} onClick={() => nav('/quiz/dict')}>🎧 듣고 쓰기로 연습하기</button>
            <button className="text-sm text-soft underline" onClick={() => nav('/')}>홈으로</button>
          </div>
        </div>
      )
    }
    const ids = params.get('ids')?.split(',').filter(Boolean)
    const daily3 = ['ko', 'en', 'sp'].includes(mode) && src !== 'wrong'
    const setWords = setIds.map((id) => words.find((x) => x.id === id)).filter(Boolean)
    // 남은(모르는) 문제 수: 방금 푼 결과가 화면 상태에 이미 반영돼 있으므로 그대로 계산
    const remaining = daily3 ? setWords.filter((x) => !x[MODE_FIELD[mode]]).length : mode === 'review' || PRACTICE_MODES.includes(mode) ? 0 : buildQueue(words, mode, src, ids, setIds, seenToday()).length
    const more = daily3 ? nextCandidates(words, setIds).length : 0
    const goal = member?.daily_goal || 5
    // 새로고침하지 않고 다시 시작(저장 중인 답이 끊기지 않게)
    const start = (q, ids2 = setIds) => {
      setSetIds(ids2); setQueue(q); setRound((r) => r + 1)
      setIdx(0); setScore({ ok: 0, total: 0 }); setRes(null); setInput('')
      endSound.current = false
    }
    const restart = () => start(daily3 ? todayQueue(words, setIds, mode) : buildQueue(words, mode, src, ids, setIds, seenToday()))
    const againAll = () => start(shuffle(setWords).map((x) => ({ id: x.id, mode, practice: true })))
    const addMore = () => { const ids2 = extendTodaySet(goal); start(todayQueue(words, ids2, mode), ids2) }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <Blob i={perfect ? 1 : 3} size={110} className="pop" />
        <h2 className="h-title text-3xl">{perfect ? '모두 맞혔어요!' : '수고했어요!'}</h2>
        <p className="font-jua text-xl text-slate-deep">{score.total}문제 중 {score.ok}개 정답</p>
        {daily3 && <p className="text-sm text-soft">오늘의 단어 {setWords.length}개 · {round}바퀴째</p>}
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
        {daily3 ? (
          <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
            {remaining > 0
              ? <button className="btn-main" onClick={restart}>모르는 단어 {remaining}개 한 번 더</button>
              : <p className="pop mx-auto flex items-center gap-2 rounded-full bg-sage px-4 py-1.5 font-jua text-white">✓ 오늘의 단어 이 퀴즈 통과!</p>}
            <button className={remaining > 0 ? 'btn-ghost' : 'btn-main'} onClick={againAll}>오늘의 단어 {setWords.length}개 처음부터 다시</button>
            {remaining === 0 && more > 0 && setWords.length < goal * ENOUGH_X && <button className="btn-ghost" onClick={addMore}>새 단어 {Math.min(goal, more)}개 더 하기</button>}
            {remaining === 0 && more > 0 && setWords.length >= goal * ENOUGH_X && <p className="text-sm text-soft">🌙 오늘 새 단어는 충분해요. 내일 이어서 해요</p>}
            <button className="text-sm text-soft underline" onClick={() => nav('/study')}>그만하기</button>
          </div>
        ) : remaining > 0 ? (
          <div className="mt-2 flex gap-2">
            <button className="btn-ghost" onClick={() => nav(src === 'wrong' ? '/wrong' : '/study')}>그만하기</button>
            <button className="btn-main" onClick={restart}>모르는 단어 {remaining}개 한 번 더</button>
          </div>
        ) : (
          <>
            <p className="pop flex items-center gap-2 rounded-full bg-sage px-4 py-1.5 font-jua text-white">✓ {mode === 'review' ? '오늘 복습 끝!' : PRACTICE_MODES.includes(mode) ? `${MODE_LABEL[mode]} 끝!` : src === 'wrong' ? '오답노트 모두 통과!' : '모두 통과!'}</p>
            <div className="mt-1 flex gap-2">
              <button className="btn-ghost" onClick={() => nav('/study')}>다른 퀴즈</button>
              {mode === 'review' || PRACTICE_MODES.includes(mode)
                ? <button className="btn-main" onClick={restart}>{mode === 'review' ? '한 번 더 복습' : '한 번 더 하기'}</button>
                : <button className="btn-main" onClick={() => nav('/book')}>단어장 보기</button>}
            </div>
          </>
        )}
      </div>
    )
  }

  // 빈칸 채우기는 예문 속 모양(studies 등)이 정답
  function ansOf(x) { return (qmode === 'cloze' && clozeOf(x)?.ans) || x.word }

  async function record(ok, extra = {}) {
    setRes({ ok, ...extra })
    ok ? sfx.correct() : sfx.wrong()
    setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }))
    markSeen(w.id)
    if (ok) setTimeout(() => setIdx((i) => i + 1), 900)
    // 다시 외우기·오늘 복습(이미 푼 단어)에서 틀려도 맞힌 기록은 그대로 둠 — 연습이니까
    if (item.review) updateDaily((d) => ({ rev_ok: (d.rev_ok || 0) + (ok ? 1 : 0), rev_n: (d.rev_n || 0) + 1 }))
    if (!(item.practice && !ok)) {
      const patch = item.review ? applyReview(w, qmode, ok) : item.practice ? {} : applyAnswer(w, qmode, ok)
      if (Object.keys(patch).length) await patchWord(w.id, patch)
    }
    if (ok) bumpDaily()
  }

  function submit(e) {
    e?.preventDefault()
    if (res || !input.trim()) return
    if (qmode === 'ko') {
      const g = gradeMeaning(input, w.meaning, w.accepted)
      record(g.ok, { close: g.close })
    } else {
      const g = gradeSpelling(input, ansOf(w))
      record(g.ok, { close: g.close })
    }
  }

  async function mic() {
    if (!canListen()) { setSelfMode(true); return }
    setListening(true)
    try {
      const alts = await listenOnce({ deviceId: savedMic() })
      const score = speechScore(alts, w.word)
      const heard = alts[0]?.t
      track('pron', { via: 'auto', ok: score >= SPEECH_PASS })
      if (score >= SPEECH_PASS) record(true, { heard, score })
      else { sfx.wrong(); markSeen(w.id); setSpFails((n) => n + 1); setRes({ ok: false, retry: true, heard: heard || '(잘 안 들렸어요)', score }) }
    } catch (err) {
      // 마이크·인식 서비스 문제면 내 목소리로 확인하는 방식으로 바로 넘어감
      setSelfMode(true)
      showToast(err.message === 'not-allowed' ? '마이크 권한이 꺼져 있어요 · 듣고 따라 말하기로 할게요' : '자동 채점이 안 돼서 내 목소리로 확인할게요')
    } finally { setListening(false) }
  }

  // 내 답을 맞다고 인정(사전에서 찾았거나 · AI가 맞다고 했거나 · AI가 바쁠 때 내가 맞다고 한 경우)
  async function acceptMine(note) {
    const fixed = applyAnswer({ ...w }, qmode, true)
    const accepted = [...new Set([...(w.accepted || []), input.trim()])].slice(0, 20)
    await patchWord(w.id, { ...fixed, accepted })
    setScore((s) => ({ ...s, ok: s.ok + 1 }))
    setRes({ ok: true, judged: note })
    sfx.correct()
    bumpDaily()
    setTimeout(() => setIdx((i) => i + 1), 1400)
  }
  async function aiJudge() {
    if (judging) return
    setJudging(true)
    try {
      // 1) 앱에 들어 있는 사전(허용 답안·유의어 뜻)에서 먼저 찾아봄 — AI를 기다리지 않음
      const map = await loadVocab().catch(() => null)
      const v = map && map.get(w.word.toLowerCase())
      const more = v ? [...(v.acc || []), ...(v.syn?.[1] ? [v.syn[1]] : [])] : []
      if (more.length && gradeMeaning(input, w.meaning, more).ok) { await acceptMine('사전에 있는 뜻이에요'); return }
      // 2) AI 재채점(오래 걸리면 25초에서 멈춤)
      const r = await db.ai('judge', { word: w.word, meaning: w.meaning, answer: input }, { timeout: 25000 })
      if (r.ok) await acceptMine(r.reason)
      else setRes((x) => ({ ...x, judgedNo: r.reason || 'AI도 다른 뜻으로 봤어요' }))
    } catch (err) {
      if (err.code === 'LIMIT') showToast(err.message)
      // AI가 바쁘거나 응답이 없으면: 다시 시도하거나 내가 맞다고 정할 수 있게
      setRes((x) => ({ ...x, aiBusy: err.code === 'NO_KEY' ? 'AI 기능을 준비하고 있어요' : err.code === 'LIMIT' ? err.message : 'AI가 지금 바빠서 채점하지 못했어요' }))
    } finally { setJudging(false) }
  }

  const cz = qmode === 'cloze' ? clozeOf(w) : null
  const progress = ((idx + (res ? 1 : 0)) / queue.length) * 100

  return (
    <div>
      <Header noProfile title={title} back right={<span className="font-jua text-soft">{idx + 1}/{queue.length}</span>} />
      <div className="mb-4 h-3 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-sage transition-all" style={{ width: `${progress}%` }} /></div>

      <div className={`card relative mb-4 flex min-h-[220px] flex-col items-center justify-center gap-3 p-6 text-center ${res && !res.ok ? 'wiggle border-no' : ''} ${res?.ok ? 'pop glow-ok border-ok' : ''}`}>
        <Reaction kind={res ? (res.ok ? 'ok' : 'no') : null} k={`${idx}-${res?.ok}-${res?.heard || ''}`} />
        <p className="font-jua text-sm text-soft">{qmode === 'ko' ? '뜻을 적어 보세요' : qmode === 'en' ? '영어로 적어 보세요' : qmode === 'dict' ? '들리는 단어를 영어로 적어 보세요' : qmode === 'cloze' ? '빈칸에 들어갈 영어를 적어 보세요' : selfMode ? '듣고 따라 말한 뒤 내 목소리와 비교해 보세요' : '마이크를 누르고 읽어 보세요 (70% 비슷하면 통과)'}</p>
        {qmode === 'dict' ? (
          <>
            <button onClick={() => speak(w.word)} className="flex h-20 w-20 items-center justify-center rounded-full bg-slate/10 text-4xl" aria-label="다시 듣기">🔊</button>
            <div className="flex gap-2">
              <button type="button" onClick={() => speakTTS(w.word, { rate: 0.5 })} className="chip">🐢 천천히</button>
              {res && <span className="chip">{w.meaning}</span>}
            </div>
            <p className="max-w-full break-words font-title tracking-[0.3em] text-soft">{w.word.replace(/[A-Za-z]/g, '_')}</p>
          </>
        ) : qmode === 'cloze' && cz ? (
          <>
            <p className="max-w-full break-keep font-title text-xl leading-relaxed text-ink">{cz.before}<span className="mx-0.5 inline-block min-w-[3ch] border-b-2 border-tang px-1 text-tang">{res ? cz.ans : cz.ans[0] + '…'}</span>{cz.after}</p>
            {cz.ko && <p className="break-keep text-sm text-soft">{cz.ko}</p>}
            <button onClick={() => speakTTS(cz.before + cz.ans + cz.after)} className="chip">🔊 문장 듣기</button>
          </>
        ) : qmode === 'en' ? (
          <>
            <p className={`break-words font-jua text-slate-deep ${w.meaning.length > 14 ? 'text-2xl' : 'text-3xl'}`}>{w.meaning}</p>
            <p className={`max-w-full break-words font-title text-soft ${w.word.length > 10 ? 'tracking-[0.15em]' : 'tracking-[0.3em]'}`}>{w.word[0]}{w.word.slice(1).replace(/[A-Za-z]/g, '_')}</p>
          </>
        ) : (
          <div className="flex w-full max-w-full items-center justify-center gap-3">
            <FitWord as="p" text={w.word} max={36} min={18} className="min-w-0 flex-1 text-center font-title font-bold leading-tight text-ink" />
            <button onClick={() => speak(w.word)} className="h-11 w-11 rounded-full bg-slate/10 text-xl" aria-label="듣기">🔊</button>
          </div>
        )}
        {res?.ok && <p className="font-jua text-2xl text-sage">정답! {res.judged ? '🤖' : '🎉'}</p>}
        {res?.judged && <p className="break-keep text-xs text-soft">{res.judged}</p>}
        {res && !res.ok && !res.retry && (
          <div className="space-y-1">
            <p className="font-jua text-xl text-coral">{res.close ? '아까워요!' : '틀렸어요'}</p>
            <MyAnswer input={input} word={ansOf(w)} mode={qmode === 'ko' ? 'ko' : 'en'} />
            <p className="text-slate-deep">정답: <b className="font-title text-lg">{qmode === 'ko' ? w.meaning : ansOf(w)}</b>
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
      {!res && item && !item.review && src !== 'wrong' && setIds.includes(item.id) && (
        <button type="button" onClick={() => setSwap(true)} className="mx-auto -mt-2 mb-3 block py-1 text-sm text-soft underline">🔄 다른 단어로 바꾸기</button>
      )}
      {swap && w && <SwapWord w={w} onClose={() => setSwap(false)} onSwapped={(n) => {
        const old = w.id
        setSetIds((ids) => ids.map((x) => (x === old ? n.id : x)))
        setQueue((q) => q.map((it) => (it.id === old ? { ...it, id: n.id } : it)))
      }} />}

      {qmode === 'sp' ? (
        (!res || res.retry) && selfMode ? (
          <div className="space-y-2">
            {!pronHereOK(canListen()) && idx === 0 && <PronNote />}
            <SelfPron key={`${idx}-${round}`} word={w.word} onResult={(ok) => record(ok, ok ? { self: true } : {})} />
            {pronHereOK(canListen()) && <button type="button" className="mx-auto block text-xs text-soft underline" onClick={() => setSelfMode(false)}>🎤 자동 채점으로 하기</button>}
            {!pronHereOK(canListen()) && <AutoGradeLink memberId={member?.id} showToast={showToast} />}
          </div>
        ) : !res || res.retry ? (
          <div className="space-y-2">
            {spFails >= 2 && <button type="button" onClick={() => { setSelfMode(true); setRes(null) }} className="btn-main w-full">🙋 내 목소리로 확인하기</button>}
            <button onClick={mic} disabled={listening} className={`btn-coral w-full py-5 text-xl ${listening ? 'animate-pulse' : ''}`}>
              {listening ? '듣고 있어요…' : res?.retry ? '🎤 다시 말하기' : '🎤 누르고 말하기'}
            </button>
            <button onClick={() => record(false)} disabled={listening} className="btn-ghost w-full">잘 모르겠어요</button>
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
              <button type="button" onClick={() => { setInput(''); record(false) }} className="btn-ghost flex-1">모르겠어요</button>
              <button className="btn-main flex-[2]" disabled={!input.trim()}>확인</button>
            </div>
          </form>
        )
      )}

      {res && !res.ok && !res.retry && (
        <div className="space-y-2">
          {qmode === 'ko' && input.trim() && !res.judgedNo && !res.aiBusy && (
            <button onClick={aiJudge} disabled={judging} className="btn-ghost w-full">{judging ? 'AI가 채점 중… (최대 25초)' : '🤖 내 답도 맞는 것 같아요 (AI 재채점)'}</button>
          )}
          {qmode === 'ko' && res.aiBusy && (
            <div className="rounded-2xl bg-paper p-3 text-center ring-1 ring-line">
              <p className="mb-2 break-keep text-sm text-soft">{res.aiBusy}</p>
              <div className="flex gap-2">
                <button onClick={() => { setRes((x) => ({ ...x, aiBusy: null })); setTimeout(aiJudge, 0) }} disabled={judging} className="btn-ghost flex-1 whitespace-nowrap !px-2 text-sm">🔄 다시 채점</button>
                <button onClick={() => acceptMine('내가 맞다고 정했어요')} disabled={judging} className="btn-ghost flex-1 whitespace-nowrap !px-2 text-sm">✓ 맞는 답이에요</button>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            {PRACTICE_MODES.includes(qmode) ? (
              <span className="flex-1 self-center text-center text-sm text-soft">연습 문제예요</span>
            ) : (
              <span className="flex-1 self-center text-center text-sm text-soft">📌 오답노트에 담았어요</span>
            )}
            <button onClick={() => setIdx((i) => i + 1)} className="btn-main flex-1">다음 →</button>
          </div>
        </div>
      )}
      {pron && <PronSheet word={w.word} heard={res?.heard} score={res?.score} onClose={() => setPron(false)} />}
    </div>
  )
}

// 이 브라우저에서 자동 채점이 안 될 때 첫 문제 위에 한 줄 안내
function PronNote() {
  useEffect(() => { track('pron_note') }, [])
  return (
    <p className="break-keep rounded-2xl bg-cream px-3 py-2 text-center text-xs text-ink/80">
      여기서는 자동 채점이 안 돼요. 들어 보고 따라 말한 뒤 직접 골라 주세요. {isIOS() ? '사파리' : '크롬'}에서 열면 자동으로 채점돼요.
    </p>
  )
}

// 자동 채점(70%)은 아이폰은 사파리, 그 밖엔 크롬에서 — 로그인은 한 번 쓰는 코드로 이어받음
function AutoGradeLink({ memberId, showToast }) {
  const [busy, setBusy] = useState(false)
  const where = isIOS() ? '사파리' : '크롬'
  async function go() {
    setBusy(true)
    try {
      const code = await db.handoffCreate(memberId)
      openOutside(`${window.location.origin}/#/handoff?c=${code}&to=${encodeURIComponent('/quiz/sp')}`)
    } catch (e) { showToast(e.message) } finally { setTimeout(() => setBusy(false), 1500) }
  }
  return <button type="button" className="mx-auto block text-xs text-soft underline" disabled={busy} onClick={go}>{busy ? '여는 중…' : `자동 채점은 ${where}에서 열기 ›`}</button>
}
