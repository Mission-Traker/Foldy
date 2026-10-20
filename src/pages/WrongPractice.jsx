import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { gradeMeaning, gradeSpelling, speechScore, SPEECH_PASS } from '../lib/grading.js'
import { applyWrongResult, meaningChoices, MODE_LABEL, wrongDueList, WRONG_DAILY, WRONG_GOAL, ymd } from '../lib/study.js'
import { canListen, listenOnce, speak } from '../lib/speech.js'
import { isIOS, openOutside, pronHereOK } from '../lib/browser.js'
import { loadIpa, ipaFromMap, ipaCached } from '../lib/ipa.js'
import { savedMic } from '../lib/mic.js'
import SelfPron from '../components/SelfPron.jsx'
import MyAnswer from '../components/MyAnswer.jsx'
import { Blob, Empty, FitWord, Header, Reaction } from '../components/ui.jsx'
import * as sfx from '../lib/sfx.js'
import { track } from '../lib/track.js'

// 오답노트 다시 익히기: ① 다시 보기 → ② 쉬운 문제(뜻 고르기) → ③ 원래 틀린 방식으로 다시 풀기
// ③을 모두 맞히면 '서로 다른 날 3번' 중 1번이 채워지고, 3번 채우면 오답노트에서 졸업
const STAGES = ['다시 보기', '쉬운 문제', '원래 방식']

export const Dots = ({ n, className = '' }) => (
  <span className={`inline-flex gap-1 ${className}`} aria-label={`${WRONG_GOAL}번 중 ${n}번`}>
    {Array.from({ length: WRONG_GOAL }, (_, k) => <span key={k} className={`h-2.5 w-2.5 rounded-full ${k < n ? 'bg-sage' : 'border-2 border-line'}`} />)}
  </span>
)
export const mdLabel = (day) => { const [, m, d] = day.split('-').map(Number); return `${m}/${d}` }

export default function WrongPractice() {
  const { words, ready, patchWord, bumpDaily, markSeen, member, showToast } = useApp()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const all = params.get('n') === 'all'
  const pronOK = true // 자동 채점이 안 되는 곳에서는 내 목소리로 확인(SelfPron)해서 어디서나 풀 수 있음
  const [batch, setBatch] = useState(0)
  const [session, setSession] = useState(null) // { list: 시작할 때의 단어 사본, q3: ③ 문제 }
  const [stage, setStage] = useState(0)
  const [i, setI] = useState(0)
  const [ipaMap, setIpaMap] = useState(null)
  const [results, setResults] = useState({}) // 단어 id → { ok, patch }
  const answers = useRef({}) // 단어 id → [true/false…]

  useEffect(() => { loadIpa().then(setIpaMap) }, [])
  useEffect(() => {
    if (!ready || session) return
    // 발음 인식이 안 되는 기기: 발음만 틀린 단어는 빼고(그 단어들이 자리를 차지해 다른 단어를 못 보는 일이 없게)
    const due = wrongDueList(words, ymd())
    const answerable = due.filter((w) => pronOK || w.wrong_modes.some((m) => m !== 'sp'))
    const list = answerable.slice(0, all ? 30 : WRONG_DAILY).map((w) => ({ ...w }))
    const q3 = []
    for (const w of list) for (const m of w.wrong_modes) if (m !== 'sp' || pronOK) q3.push({ id: w.id, mode: m })
    // 발음 문제를 여기서 못 푼 단어는 기록을 바꾸지 않음(졸업도 하지 않음) — 사파리·크롬에서 마저
    const partial = new Set(list.filter((w) => w.wrong_modes.some((m) => m === 'sp') && !pronOK).map((w) => w.id))
    setSession({ list, q3, partial, skipped: due.filter((w) => !answerable.includes(w)).length + partial.size })
    answers.current = {}; setResults({}); setStage(0); setI(0)
  }, [ready, batch]) // eslint-disable-line

  if (!session) return <p className="py-20 text-center text-soft">불러오는 중…</p>
  const { list, q3, skipped } = session
  if (!list.length) {
    return (
      <div>
        <Header noProfile title="다시 익히기" back="/wrong" />
        <Empty title={skipped ? '여기서는 발음 문제만 남았어요' : '오늘 다시 볼 단어가 없어요'} desc={skipped ? '발음은 마이크 인식이 되는 브라우저에서 풀어요' : '오답노트에 단어가 들어오거나 다시 볼 날이 되면 여기서 만나요'} i={1}>
          <Link to="/wrong" className="btn-main mt-2">오답노트로</Link>
        </Empty>
        {skipped > 0 && <div className="mt-4"><PronHandoff memberId={member?.id} showToast={showToast} /></div>}
      </div>
    )
  }

  const next = (len) => { if (i + 1 < len) setI(i + 1); else { setStage((s) => s + 1); setI(0) } }

  // ③ 한 문제의 결과 → 그 단어의 문제를 다 풀면 단어에 반영
  async function answer3(id, ok) {
    markSeen(id)
    if (ok) bumpDaily()
    const arr = [...(answers.current[id] || []), ok]
    answers.current[id] = arr
    if (arr.length < q3.filter((x) => x.id === id).length) return
    const w = list.find((x) => x.id === id)
    const all = arr.every(Boolean)
    if (session.partial.has(id)) { setResults((r) => ({ ...r, [id]: { ok: all, partial: true } })); return }
    const patch = applyWrongResult(w, all, ymd())
    setResults((r) => ({ ...r, [id]: { ok: all, patch } }))
    try { await patchWord(id, patch) } catch (e) { showToast(e.message) }
  }

  const ipaOf = (w) => ipaFromMap(w.word, ipaMap) || ipaCached(w.word) || ''
  const head = (
    <>
      <Header noProfile title="다시 익히기" back="/wrong" right={stage < 3 && <span className="font-jua text-soft">{i + 1}/{stage === 2 ? q3.length : list.length}</span>} />
      {stage < 3 && (
        <ol className="mb-4 flex gap-1.5" aria-label="단계">
          {STAGES.map((s, k) => (
            <li key={s} className={`flex-1 rounded-full py-1 text-center font-jua text-xs ${k === stage ? 'bg-slate-deep text-white' : k < stage ? 'bg-sage/20 text-sage' : 'bg-line/60 text-soft'}`}>
              {k + 1}. {s}
            </li>
          ))}
        </ol>
      )}
    </>
  )

  if (stage === 0) {
    const w = list[i]
    return <div>{head}<LookCard key={w.id} w={w} ipa={ipaOf(w)} onNext={() => next(list.length)} last={i + 1 === list.length} /></div>
  }
  if (stage === 1) {
    const w = list[i]
    return <div>{head}<ChoiceCard key={w.id} w={w} words={words} onNext={() => next(list.length)} /></div>
  }
  if (stage === 2 && i < q3.length) {
    const it = q3[i]
    const w = list.find((x) => x.id === it.id)
    return <div>{head}<AnswerCard key={`${it.id}-${it.mode}`} w={w} mode={it.mode} onAnswer={(ok) => answer3(it.id, ok)} onNext={() => next(q3.length)} showToast={showToast} /></div>
  }

  // 끝 화면
  const more = wrongDueList(words, ymd())
    .filter((w) => pronOK || w.wrong_modes.some((m) => m !== 'sp'))
    .filter((w) => !list.some((x) => x.id === w.id) || (results[w.id]?.ok === false && !results[w.id]?.partial))
  const grads = list.filter((w) => results[w.id]?.patch?.wrong_grad)
  if (!session.tracked) { session.tracked = true; track('wrong_end', { n: list.length, kind: `grad${grads.length}` }) }
  return (
    <div>
      <Header noProfile title="다시 익히기" back="/wrong" />
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <Blob i={grads.length ? 1 : 0} size={96} className="pop" />
        <h2 className="h-title text-2xl">{grads.length ? `${grads.length}개 졸업! 🎓` : '오늘 다시 익히기 끝!'}</h2>
        <p className="text-sm text-soft">서로 다른 날 {WRONG_GOAL}번 맞히면 오답노트에서 졸업해요.</p>
      </div>
      <ul className="mb-4 divide-y divide-line rounded-3xl border border-line bg-paper px-4">
        {list.map((w) => {
          const r = results[w.id]
          const p = r?.patch || {}
          return (
            <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <b className="min-w-0 break-words font-title text-lg">{w.word}</b>
              {!r || r.partial ? <span className="ml-auto whitespace-nowrap text-xs text-soft">발음은 {isIOS() ? '사파리' : '크롬'}에서 마저</span>
                : p.wrong_grad ? <span className="ml-auto whitespace-nowrap font-jua text-sm text-sage">🎓 졸업 · 캐릭터가 2번 더 먹어요</span>
                  : r.ok ? <span className="ml-auto flex items-center gap-2 whitespace-nowrap text-xs text-soft"><Dots n={p.wrong_step} />{mdLabel(p.wrong_next)}에 다시</span>
                    : <span className="ml-auto whitespace-nowrap text-xs text-coral">처음부터 · 오늘 다시 할 수 있어요</span>}
            </li>
          )
        })}
      </ul>
      {skipped > 0 && <PronHandoff memberId={member?.id} showToast={showToast} />}
      <div className="flex flex-col gap-2">
        {more.length > 0 && <button className="btn-main" onClick={() => { setSession(null); setBatch((b) => b + 1) }}>다시 볼 단어 {Math.min(more.length, all ? 30 : WRONG_DAILY)}개 더 하기</button>}
        <button className={more.length ? 'btn-ghost' : 'btn-main'} onClick={() => nav('/wrong')}>오답노트로</button>
        <button className="text-sm text-soft underline" onClick={() => nav('/')}>홈으로</button>
      </div>
    </div>
  )
}

// ① 다시 보기: 단어·발음기호·뜻·예문
function LookCard({ w, ipa, onNext, last }) {
  useEffect(() => { const t = setTimeout(() => speak(w.word), 250); return () => clearTimeout(t) }, [w.word])
  return (
    <>
      <div className="mb-4 flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-3xl border border-line bg-paper p-6 text-center">
        <p className="font-jua text-sm text-soft">천천히 보고 소리 내어 읽어 보세요</p>
        <div className="flex w-full max-w-full items-center justify-center gap-3">
          <FitWord as="p" text={w.word} max={36} min={18} className="min-w-0 flex-1 text-center font-title font-bold leading-tight text-ink" />
          <button onClick={() => speak(w.word)} className="h-11 w-11 shrink-0 rounded-full bg-slate/10 text-xl" aria-label="듣기">🔊</button>
        </div>
        {ipa && <p className="ipa text-soft">{ipa}</p>}
        <p className="font-jua text-2xl text-slate-deep">{w.meaning}</p>
        {w.example?.en && (
          <div className="mt-2 w-full rounded-2xl bg-cream px-4 py-3 text-left">
            <p className="font-title text-[16px] leading-snug text-ink">{w.example.en}</p>
            <p className="mt-0.5 text-sm text-soft">{w.example.ko}</p>
          </div>
        )}
        <p className="mt-1 text-xs text-soft">틀렸던 방식 · {w.wrong_modes.map((m) => MODE_LABEL[m]).join(', ')}</p>
      </div>
      <button className="btn-main w-full" onClick={onNext}>{last ? '쉬운 문제로 →' : '기억했어요 →'}</button>
    </>
  )
}

// ② 쉬운 문제: 뜻 고르기(맞든 틀리든 기록은 바꾸지 않음 — 감 잡기용)
function ChoiceCard({ w, words, onNext }) {
  const choices = useMemo(() => meaningChoices(w, words), [w, words])
  const [pick, setPick] = useState(null)
  useEffect(() => { if (choices.length < 2) onNext() }, []) // eslint-disable-line
  const ok = pick === w.meaning
  // 정답을 고르면 잠깐 보여 주고 바로 다음으로(틀리면 정답을 보고 '다음'을 눌러 넘어감)
  useEffect(() => {
    if (!pick || !ok) return
    const t = setTimeout(onNext, 800)
    return () => clearTimeout(t)
  }, [pick]) // eslint-disable-line
  return (
    <>
      <div className={`relative mb-4 flex flex-col items-center gap-2 rounded-3xl border bg-paper p-6 text-center ${pick ? (ok ? 'border-ok' : 'border-no') : 'border-line'}`}>
        <Reaction kind={pick ? (ok ? 'ok' : 'no') : null} k={`${w.id}-${pick}`} />
        <p className="font-jua text-sm text-soft">알맞은 뜻을 골라 보세요</p>
        <div className="flex w-full max-w-full items-center justify-center gap-3">
          <FitWord as="p" text={w.word} max={32} min={18} className="min-w-0 flex-1 text-center font-title font-bold leading-tight text-ink" />
          <button onClick={() => speak(w.word)} className="h-10 w-10 shrink-0 rounded-full bg-slate/10 text-lg" aria-label="듣기">🔊</button>
        </div>
      </div>
      <div className="mb-3 grid gap-2">
        {choices.map((c) => {
          const state = !pick ? '' : c === w.meaning ? 'border-sage bg-sage/10 text-sage' : c === pick ? 'border-coral bg-coral/10 text-coral' : 'opacity-50'
          return (
            <button key={c} disabled={!!pick} onClick={() => { setPick(c); c === w.meaning ? sfx.correct() : sfx.wrong() }}
              className={`rounded-2xl border border-line bg-paper px-4 py-3 text-left font-jua text-slate-deep ${state}`}>{c}</button>
          )
        })}
      </div>
      {pick && (ok
        ? <p className="py-3 text-center font-jua text-lg text-sage">좋아요! 🎉</p>
        : <button className="btn-main w-full" onClick={onNext}>다음 →</button>)}
    </>
  )
}

// ③ 원래 틀린 방식으로 다시 풀기
function AnswerCard({ w, mode, onAnswer, onNext, showToast }) {
  const [input, setInput] = useState('')
  const [res, setRes] = useState(null)
  const [listening, setListening] = useState(false)
  const [selfMode, setSelfMode] = useState(() => !pronHereOK(canListen()))
  const [fails, setFails] = useState(0)
  const ref = useRef()
  useEffect(() => {
    if (mode !== 'en') setTimeout(() => speak(w.word), 250)
    if (mode !== 'sp') setTimeout(() => ref.current?.focus(), 100)
  }, []) // eslint-disable-line
  function done(ok, extra = {}) {
    setRes({ ok, ...extra }); ok ? sfx.correct() : sfx.wrong(); onAnswer(ok)
  }
  function submit(e) {
    e.preventDefault()
    if (res || !input.trim()) return
    const g = mode === 'ko' ? gradeMeaning(input, w.meaning, w.accepted) : gradeSpelling(input, w.word)
    done(g.ok, { close: g.close })
  }
  async function mic() {
    if (!canListen()) { setSelfMode(true); return }
    setListening(true)
    try {
      const alts = await listenOnce({ deviceId: savedMic() })
      const score = speechScore(alts, w.word)
      if (score >= SPEECH_PASS) done(true, { heard: alts[0]?.t, score })
      else { sfx.wrong(); setFails((n) => n + 1); setRes({ ok: false, retry: true, heard: alts[0]?.t || '(잘 안 들렸어요)', score }) }
    } catch (err) {
      setSelfMode(true)
      showToast(err.message === 'not-allowed' ? '마이크 권한이 꺼져 있어요 · 듣고 따라 말하기로 할게요' : '자동 채점이 안 돼서 내 목소리로 확인할게요')
    } finally { setListening(false) }
  }
  const final = res && !res.retry
  return (
    <>
      <div className={`relative mb-4 flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-3xl border bg-paper p-6 text-center ${final ? (res.ok ? 'border-ok' : 'border-no') : 'border-line'}`}>
        <Reaction kind={final ? (res.ok ? 'ok' : 'no') : null} k={`${w.id}-${mode}-${res?.ok}`} />
        <p className="font-jua text-sm text-soft">{MODE_LABEL[mode]} · {mode === 'ko' ? '뜻을 적어 보세요' : mode === 'en' ? '영어로 적어 보세요' : selfMode ? '듣고 따라 말해 보세요' : '마이크를 누르고 읽어 보세요'}</p>
        {mode === 'en' ? (
          <>
            <p className="font-jua text-3xl text-slate-deep">{w.meaning}</p>
            <p className="max-w-full break-words font-title tracking-[0.2em] text-soft">{w.word[0]}{w.word.slice(1).replace(/[A-Za-z]/g, '_')}</p>
          </>
        ) : (
          <div className="flex w-full max-w-full items-center justify-center gap-3">
            <FitWord as="p" text={w.word} max={36} min={18} className="min-w-0 flex-1 text-center font-title font-bold leading-tight text-ink" />
            <button onClick={() => speak(w.word)} className="h-11 w-11 shrink-0 rounded-full bg-slate/10 text-xl" aria-label="듣기">🔊</button>
          </div>
        )}
        {final && res.ok && <p className="font-jua text-2xl text-sage">정답! 🎉</p>}
        {final && !res.ok && <MyAnswer input={input} word={w.word} mode={mode} />}
        {final && !res.ok && <p className="text-slate-deep">정답: <b className="font-title text-lg">{mode === 'ko' ? w.meaning : w.word}</b></p>}
        {res?.heard && <p className="text-sm text-soft">들은 말: “{res.heard}”{res.score != null && ` · ${Math.round(res.score * 100)}%`}</p>}
      </div>
      {final ? (
        <button className="btn-main w-full" onClick={onNext}>다음 →</button>
      ) : mode === 'sp' && selfMode ? (
        <SelfPron word={w.word} onResult={(ok) => done(ok)} />
      ) : mode === 'sp' ? (
        <div className="space-y-2">
          {fails >= 2 && <button type="button" onClick={() => { setSelfMode(true); setRes(null) }} className="btn-main w-full">🙋 내 목소리로 확인하기</button>}
          <button onClick={mic} disabled={listening} className={`btn-coral w-full py-5 text-xl ${listening ? 'animate-pulse' : ''}`}>{listening ? '듣고 있어요…' : res?.retry ? '🎤 다시 말하기' : '🎤 누르고 말하기'}</button>
          <button onClick={() => done(false)} disabled={listening} className="btn-ghost w-full">잘 모르겠어요</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <input ref={ref} className="field text-center text-xl" value={input} onChange={(e) => { setInput(e.target.value); sfx.tap() }}
            placeholder={mode === 'ko' ? '한글 뜻' : 'English'} autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} lang={mode === 'ko' ? 'ko' : 'en'} maxLength={60} />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setInput(''); done(false) }} className="btn-ghost flex-1">모르겠어요</button>
            <button className="btn-main flex-[2]" disabled={!input.trim()}>확인</button>
          </div>
        </form>
      )}
    </>
  )
}

// 발음만 틀렸던 단어는 음성 인식이 되는 브라우저에서
function PronHandoff({ memberId, showToast }) {
  const [busy, setBusy] = useState(false)
  const where = isIOS() ? '사파리' : '크롬'
  async function go() {
    setBusy(true)
    try {
      const code = await db.handoffCreate(memberId)
      openOutside(`${window.location.origin}/#/handoff?c=${code}&to=${encodeURIComponent('/wrong/practice')}`)
    } catch (e) { showToast(e.message) } finally { setTimeout(() => setBusy(false), 1500) }
  }
  return (
    <div className="mb-4 rounded-2xl border border-line bg-paper px-4 py-3 text-sm">
      <p className="text-slate-deep">발음 문제는 여기서 마이크 인식이 안 돼서 {where}에서 이어서 풀어요.</p>
      <button className="mt-2 font-jua text-slate underline" disabled={busy} onClick={go}>{busy ? '여는 중…' : `${where}로 열기 ›`}</button>
    </div>
  )
}
