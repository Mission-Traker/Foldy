import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../App.jsx'
import { expandStage, sortWords, statusOf, cleanEntry, MODE_FIELD, PICK_MAX, pickNeed } from '../lib/study.js'
import { track } from '../lib/track.js'
import { Empty, Header, Speak, fmtDate, FitWord } from '../components/ui.jsx'
import { speak } from '../lib/speech.js'
import * as db from '../lib/db.js'
import { loadIpa, ipaFromMap, ipaCached, ipaSave } from '../lib/ipa.js'

const SORTS = [['seq', '번호'], ['date', '날짜'], ['abc', 'ABC']]
const HIDES = [['meaning', '뜻 가리기'], ['word', '영어 가리기'], ['none', '모두 보기']]

function Highlight({ text, word }) {
  const i = text.toLowerCase().indexOf(word.toLowerCase().slice(0, Math.max(3, word.length - 2)))
  if (i < 0) return text
  let j = i
  while (j < text.length && /[A-Za-z'-]/.test(text[j])) j++
  return <>{text.slice(0, i)}<b className="text-tang">{text.slice(i, j)}</b>{text.slice(j)}</>
}

function Extras({ w }) {
  const stage = expandStage(w)
  if (stage === 'none') return null
  const pair = [['syn', '유의어', w.syn, w.syn_ok], ['ant', '반의어', w.ant, w.ant_ok]].filter(([, , d]) => d)
  return (
    <div className="ml-8 mr-1 mb-2 space-y-2">
      {!w.enriched && <p className="text-xs text-soft">유의어·반의어를 준비하는 중이에요…</p>}
      {pair.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pair.map(([k, label, d, ok]) => ok ? (
            <span key={k} className="inline-flex items-center gap-1.5 rounded-2xl bg-sage/10 px-2.5 py-1 text-sm">
              <span className={`font-jua text-xs ${k === 'syn' ? 'text-sage' : 'text-coral'}`}>{label}</span>
              <b className="font-title">{d.word}</b><span className="text-soft">{d.meaning}</span>
              <Speak text={d.word} size="sm" className="!h-6 !w-6 !text-xs" />
            </span>
          ) : (
            <Link key={k} to="/expand" className="inline-flex items-center gap-1 rounded-2xl border-2 border-dashed border-line px-2.5 py-1 text-xs text-soft">
              🔒 {label} 퀴즈로 열기
            </Link>
          ))}
        </div>
      )}
      {stage === 'example' && w.example && (
        <div className="rounded-2xl border-2 border-mustard/40 bg-mustard/10 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-2xl tracking-widest">{w.example.scene}</span>
            {w.example.mine && <span className="rounded-full bg-tang/15 px-2 py-0.5 font-jua text-[11px] text-tang">✨ 내 예문</span>}
            <span className="flex-1" />
            <button onClick={() => speak(w.example.en, { rate: 0.8 })} className="chip border-mustard text-ink">▶ 문장 읽기</button>
          </div>
          <p className="font-title text-[17px] leading-snug text-ink"><Highlight text={w.example.en} word={w.word} /></p>
          <p className="mt-0.5 text-sm text-soft">{w.example.ko}</p>
        </div>
      )}
    </div>
  )
}

// 3단계 학습 아이콘(뜻·철자·발음): 통과한 단계는 색으로 켜짐 + 추가한 날짜
const STEPS = [['ko', '뜻', 'bg-tang border-tang'], ['en', '철자', 'bg-sage border-sage'], ['sp', '발음', 'bg-coral border-coral']]
function Steps({ w }) {
  return (
    <div className="mb-2 ml-8 mr-1 flex items-center gap-1.5">
      {STEPS.map(([m, label, on]) => {
        const ok = w[MODE_FIELD[m]]
        return (
          <span key={m} aria-label={`${label} ${ok ? '통과' : '아직'}`}
            className={`inline-flex items-center gap-0.5 rounded-full border-2 px-2 py-0.5 text-[11px] font-jua ${ok ? `${on} text-white` : 'border-line bg-white text-soft/70'}`}>
            {ok ? '✓' : ''}{label}
          </span>
        )
      })}
      <span className="flex-1" />
      <span className="text-[11px] text-soft">{fmtDate(w.created_at)}</span>
    </div>
  )
}

function RowMenu({ w, onEdit, onClose }) {
  const { removeWord, showToast } = useApp()
  async function del() {
    onClose()
    if (!confirm(`'${w.word}'를 단어장에서 삭제할까요?\n학습 기록도 함께 지워지고 되돌릴 수 없어요.`)) return
    try { await removeWord(w.id); showToast(`‘${w.word}’ 삭제했어요`) } catch (e) { showToast(e.message) }
  }
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="pop absolute right-1 top-10 z-40 w-36 overflow-hidden rounded-2xl border-2 border-line bg-paper shadow-lg" role="menu">
        <button role="menuitem" onClick={() => { onClose(); onEdit() }} className="block w-full px-4 py-3 text-left font-jua text-slate-deep active:bg-cream">✏️ 고치기</button>
        <button role="menuitem" onClick={del} className="block w-full border-t-2 border-dashed border-line px-4 py-3 text-left font-jua text-coral active:bg-coral/10">🗑 삭제</button>
      </div>
    </>
  )
}

function Row({ w, hide, peek, onPeek, onEdit, inToday, onSend, ipa, picking, picked, onPick }) {
  const s = statusOf(w)
  const [menu, setMenu] = useState(false)
  const coverWord = hide === 'word' && !peek
  const coverMeaning = hide === 'meaning' && !peek
  return (
    <li className="relative border-b-2 border-dashed border-line last:border-0">
      <div className="flex items-stretch gap-2 py-2.5 pr-1">
        {picking
          ? <button onClick={onPick} role="checkbox" aria-checked={picked} aria-label={`${w.word} 선택`}
            className={`flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-lg border-2 font-bold ${picked ? 'border-coral bg-coral text-white' : 'border-line bg-paper text-transparent'}`}>✓</button>
          : <span className="w-6 shrink-0 self-center pl-1 text-right font-title text-xs text-soft">{w.seq}</span>}
        <div className="relative flex min-w-0 flex-[1.5] flex-col justify-center">
          <div className="flex min-w-0 items-center gap-1">
          <button onClick={() => (coverWord ? onPeek() : speak(w.word))} className="relative min-w-0 flex-1 text-left">
            <FitWord text={w.word} max={19} min={11} className="font-title font-semibold leading-tight text-ink" />
            {coverWord && <span className="absolute inset-0 rounded-xl bg-[repeating-linear-gradient(0deg,#FFFBF4,#FFFBF4_9px,#EFE5D3_10px)] border-2 border-line" />}
          </button>
          <Speak text={w.word} size="sm" className="!h-7 !w-7 !text-xs" label="발음 듣기" />
          </div>
          {ipa && <FitWord text={ipa} max={12} min={8} className={`ipa mt-0.5 leading-tight text-soft ${hide === 'word' && !peek ? 'invisible' : ''}`} />}
        </div>
        <button onClick={onPeek} className="relative min-w-[84px] flex-1 overflow-hidden rounded-xl text-left" aria-label="뜻 보기">
          <span className={`flex h-full items-center px-2 leading-tight text-slate-deep ${w.meaning.length > 5 ? "text-[13px]" : "text-[15px]"}`}>{w.meaning}</span>
          <span className={`flap absolute inset-0 flex items-center justify-center rounded-xl border-2 border-line bg-[repeating-linear-gradient(0deg,#FFFBF4,#FFFBF4_9px,#EFE5D3_10px)] text-xs text-soft ${coverMeaning ? '' : 'open'}`}>
            탭해서 보기
          </span>
        </button>
        {!picking && <><button onClick={onSend} aria-label={inToday ? `${w.word}: 오늘 학습할 단어에 있어요` : `${w.word} 오늘 학습할 단어로 보내기`} data-tip={inToday ? '오늘 학습 중이에요' : '학습 단어로 넣기'}
          className={`tip flex w-8 shrink-0 items-center justify-center self-center rounded-full border-2 text-sm font-bold leading-none h-8 ${inToday ? 'border-sage bg-sage/15 text-sage' : 'border-tang text-tang active:bg-tang/10'}`}>
          {inToday ? '✓' : '➜'}
        </button>
        <button onClick={() => setMenu(true)} aria-label={`${w.word} 메뉴`} aria-haspopup="menu" className="w-7 shrink-0 rounded-lg text-xl leading-none text-soft active:bg-cream">⋯</button></>}
      </div>
      {menu && <RowMenu w={w} onEdit={onEdit} onClose={() => setMenu(false)} />}
      <Steps w={w} />
      <Extras w={w} />
    </li>
  )
}

function EditSheet({ w, onClose }) {
  const { patchWord, removeWord, showToast, runEnrich } = useApp()
  const [word, setWord] = useState(w.word)
  const [meaning, setMeaning] = useState(w.meaning)
  async function save() {
    const c = cleanEntry({ word, meaning })
    if (c.errors.length) return showToast(c.errors[0])
    const patch = { word: c.word, meaning: c.meaning }
    const spelling = c.word.toLowerCase() !== w.word.toLowerCase()
    if (spelling || c.meaning !== w.meaning) Object.assign(patch, { enriched: false, accepted: [] })
    // 철자를 바꾸면 다른 단어가 된 것이므로 학습 기록·유의어·예문을 처음부터
    if (spelling) Object.assign(patch, { attempted: false, ko_ok: false, en_ok: false, sp_ok: false, syn_ok: false, ant_ok: false, syn: null, ant: null, example: null, review_step: 0, next_review: null, wrong_modes: [], wrong_step: 0, wrong_next: null })
    await patchWord(w.id, patch)
    if (patch.enriched === false) runEnrich([{ ...w, ...patch }])
    onClose()
  }
  async function del() {
    if (!confirm(`'${w.word}'를 단어장에서 지울까요?`)) return
    try { await removeWord(w.id); onClose() } catch (e) { showToast(e.message) }
  }
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink/30" onClick={onClose}>
      <div className="safe-b mx-auto w-full max-w-md rounded-t-3xl bg-paper p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="h-title mb-3 text-xl">{w.seq}번 단어 고치기</h3>
        <label className="label" htmlFor="ew">영어</label>
        <input id="ew" className="field mb-2" value={word} onChange={(e) => setWord(e.target.value)} maxLength={60} autoCapitalize="none" />
        <label className="label" htmlFor="em">뜻 (내가 이해하기 쉬운 말로 바꿔도 돼요)</label>
        <input id="em" className="field mb-4" value={meaning} onChange={(e) => setMeaning(e.target.value)} maxLength={120} />
        <div className="flex gap-2">
          <button className="btn-ghost text-coral" onClick={del}>지우기</button>
          <button className="btn-ghost flex-1" onClick={onClose}>취소</button>
          <button className="btn-main flex-1" onClick={save}>저장</button>
        </div>
      </div>
    </div>
  )
}

export default function Wordbook() {
  const { words, ready, daily, todayIds, sendToToday, chooseToday, showToast, today, removeWords, member } = useApp()
  const need = pickNeed(member?.daily_goal || 5, words.length)
  const nav = useNavigate()
  // 선택해서 오늘 학습할 단어로 보내기 / 한꺼번에 지우기(이미 아는 단어 정리)
  const [pick, setPick] = useState(() => { try { return new URLSearchParams(location.hash.split('?')[1] || '').get('pick') ? new Set() : null } catch { return null } }) // null: 끔, Set: 고른 단어 id
  const [arm, setArm] = useState(false)
  const [busy, setBusy] = useState(false)
  const togglePick = (id) => { setArm(false); setPick((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  async function delPicked() {
    if (!pick?.size || busy) return
    if (!arm) { setArm(true); setTimeout(() => setArm(false), 4000); return }
    setBusy(true); setArm(false)
    try { const n = await removeWords([...pick]); showToast(`${n}개를 단어장에서 지웠어요`); setPick(null) } catch (e) { showToast(e.message) } finally { setBusy(false) }
  }
  async function studyPicked() {
    if (!pick?.size || busy) return
    if (pick.size < need) { showToast(`하루 목표 ${need}개를 채워 골라 주세요`); return }
    if (pick.size > PICK_MAX) { showToast(`한 번에 ${PICK_MAX}개까지 고를 수 있어요`); return }
    setBusy(true)
    try {
      const ids = await chooseToday([...pick])
      track('pick_today', { n: ids.length })
      showToast(`고른 ${ids.length}개로 오늘 학습해요`)
      setPick(null)
      nav('/study')
    } finally { setBusy(false) }
  }
  const todaySet = useMemo(() => new Set(ready ? todayIds() : []), [ready, todayIds, daily, today])
  function send(w) {
    if (todaySet.has(w.id)) { showToast('이미 오늘 학습할 단어예요'); return }
    const dropped = sendToToday(w.id) || []
    const out = dropped.map((id) => words.find((x) => x.id === id)?.word).filter(Boolean)
    showToast(out.length ? `‘${w.word}’를 먼저 학습해요 · ‘${out[0]}’는 다음에` : `‘${w.word}’ → 오늘의 단어에 넣었어요`)
  }
  const [params, setParams] = useSearchParams()
  const [sort, setSort] = useState('seq')
  const [dir, setDir] = useState('asc')
  const [hide, setHide] = useState('meaning')
  const [peek, setPeek] = useState(() => new Set())
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)
  const filter = params.get('f') || 'all'
  // 발음기호: 앱 안 목록 → 없으면 AI로 한 번(이 기기에 저장)
  const [ipaMap, setIpaMap] = useState(null)
  const [ipaExtra, setIpaExtra] = useState({})
  useEffect(() => { let on = true; loadIpa().then((m) => on && setIpaMap(m)); return () => { on = false } }, [])
  const ipaOf = (w) => { const a = ipaFromMap(w.word, ipaMap); if (a) return a; return ipaExtra[w.word.toLowerCase()] ?? ipaCached(w.word) ?? '' }
  useEffect(() => {
    if (!ipaMap || !ready) return
    const need = [...new Set(words.map((w) => w.word).filter((x) => !ipaFromMap(x, ipaMap) && ipaCached(x) === null))].slice(0, 30)
    if (!need.length) return
    let on = true
    db.ai('ipa', { words: need }).then((r) => {
      const got = r.ipa || {}
      for (const x of need) ipaSave(x, got[x.toLowerCase()] || '')
      if (on) setIpaExtra((e) => ({ ...e, ...got }))
    }).catch(() => { /* 인터넷·AI가 안 되면 발음기호 없이 */ })
    return () => { on = false }
  }, [ipaMap, ready, words])

  const list = useMemo(() => {
    let ws = words
    if (filter !== 'all') ws = ws.filter((w) => statusOf(w) === filter)
    if (q.trim()) {
      const t = q.trim().toLowerCase()
      ws = ws.filter((w) => w.word.toLowerCase().includes(t) || w.meaning.includes(q.trim()))
    }
    return sortWords(ws, sort, dir)
  }, [words, filter, q, sort, dir])

  const counts = useMemo(() => {
    const c = { all: words.length, o: 0, t: 0, x: 0 }
    for (const w of words) c[statusOf(w)]++
    return c
  }, [words])

  const togglePeek = (id) => setPeek((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div>
      <Header title="단어장" right={<div className="flex items-center gap-1.5">
        {words.length > 0 && <button className={`chip whitespace-nowrap ${pick ? 'chip-on' : ''}`} onClick={() => { setArm(false); setPick((p) => (p ? null : new Set())) }}>{pick ? '선택 끝' : '☑ 선택'}</button>}
        <Link to="/add" className="chip whitespace-nowrap">＋ 추가</Link>
      </div>} />

      <div className="mb-2 flex flex-wrap gap-1.5 pb-1">
        {[['all', '전체'], ['x', '미학습'], ['t', '△ 학습 중'], ['o', '○ 완료']].map(([k, l]) => (
          <button key={k} onClick={() => setParams(k === 'all' ? {} : { f: k })} className={`chip shrink-0 ${filter === k ? 'chip-on' : ''}`}>
            {l} <span className="opacity-70">{counts[k]}</span>
          </button>
        ))}
      </div>
      <div className="mb-2 flex items-center gap-2">
        <div className="flex rounded-full bg-paper p-1 border-2 border-line">
          {SORTS.map(([k, l]) => (
            <button key={k} onClick={() => (sort === k ? setDir(dir === 'asc' ? 'desc' : 'asc') : (setSort(k), setDir('asc')))}
              className={`rounded-full px-3 py-1 font-jua text-sm ${sort === k ? 'bg-slate-deep text-white' : 'text-soft'}`}>
              {l}{sort === k ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
            </button>
          ))}
        </div>
        <input className="field !py-1.5 !text-sm flex-1" placeholder="찾기" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {HIDES.map(([k, l]) => (
          <button key={k} onClick={() => { setHide(k); setPeek(new Set()) }} className={`chip ${hide === k ? 'chip-on' : ''}`}>{l}</button>
        ))}
      </div>

      {ready && filter === 'x' && counts.x >= 10 && (
        <Link to="/sort" className="mb-3 flex items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
          <span className="text-2xl">🧹</span>
          <span className="flex-1 text-sm"><b className="font-jua text-slate-deep">아는 단어 빨리 거르기</b><span className="block text-xs text-soft">한 장씩 넘기며 ‘알아요’면 바로 ○</span></span>
          <span className="text-soft">›</span>
        </Link>
      )}
      {ready && (counts.t + counts.x) > 0 && filter !== 'o' && (
        <Link to="/quiz/focus" className="mb-3 flex items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
          <span className="text-2xl">🎯</span>
          <span className="flex-1 text-sm">
            <b className="font-jua text-slate-deep">○를 기다리는 단어 {counts.x + counts.t}개</b>
            <span className="block text-xs text-soft">뜻·철자 퀴즈를 다 맞히면 ○</span>
          </span>
          <span className="whitespace-nowrap text-sm text-soft">지금 끝내기 ›</span>
        </Link>
      )}
      {!ready ? (
        <p className="py-10 text-center text-soft">불러오는 중…</p>
      ) : !words.length ? (
        <Empty title="아직 단어가 없어요" desc="교재 사진을 찍어 한 번에 넣거나, 직접 적어 보세요.">
          <div className="mt-2 flex gap-2"><Link to="/add?tab=photo" className="btn-tang">📷 사진</Link><Link to="/add?tab=manual" className="btn-ghost">✍️ 직접</Link></div>
        </Empty>
      ) : !list.length ? (
        <Empty title="조건에 맞는 단어가 없어요" i={2} />
      ) : (
        <>
        {pick && (
          <div className="sticky top-2 z-20 mb-3 rounded-2xl border-2 border-slate/40 bg-paper p-3 shadow-card">
            <p className="mb-2 text-sm text-slate-deep"><b className="font-jua">{pick.size}개 선택</b> <span className="text-soft">· 공부할 단어를 골라 오늘 학습하거나, 아는 단어를 한꺼번에 지워요</span></p>
            <div className="flex flex-wrap gap-1.5">
              <button className="chip whitespace-nowrap" onClick={() => { setArm(false); setPick(new Set(list.map((w) => w.id))) }}>보이는 단어 모두 ({list.length})</button>
              {counts.x > 0 && counts.x <= PICK_MAX && <button className="chip whitespace-nowrap" onClick={() => { setArm(false); setPick(new Set(words.filter((w) => statusOf(w) === 'x').map((w) => w.id))) }}>안 배운 단어 ({counts.x})</button>}
              {counts.o > 0 && <button className="chip whitespace-nowrap" onClick={() => { setArm(false); setPick(new Set(words.filter((w) => statusOf(w) === 'o').map((w) => w.id))) }}>○ 완료만 ({counts.o})</button>}
              {pick.size > 0 && <button className="chip whitespace-nowrap" onClick={() => { setArm(false); setPick(new Set()) }}>선택 풀기</button>}
            </div>
            <button disabled={pick.size < need || busy} onClick={studyPicked} className="btn-main mt-2 w-full whitespace-nowrap !px-3 !py-2.5 !text-base">
              {pick.size >= need ? `📚 고른 ${pick.size}개로 오늘 학습하기` : `📚 ${need - pick.size}개 더 골라 주세요 (목표 ${need}개)`}
            </button>
            {pick.size > PICK_MAX && <p className="mt-1 text-center text-xs text-coral">오늘 학습은 {PICK_MAX}개까지 고를 수 있어요</p>}
            <button disabled={!pick.size || busy} onClick={delPicked}
              className={`mt-2 w-full rounded-full py-2 font-jua text-sm text-white disabled:opacity-40 ${arm ? 'bg-coral' : 'bg-coral/70'}`}>
              {busy ? '지우는 중…' : arm ? `한 번 더 누르면 ${pick.size}개를 지워요 (되돌릴 수 없어요)` : `🗑 고른 ${pick.size}개 지우기`}
            </button>
          </div>
        )}
        <div className="card relative overflow-hidden pl-6">
          {/* 스프링 노트 고리 */}
          <div className="absolute inset-y-0 left-0 flex w-6 flex-col items-center gap-5 bg-line/50 py-4" aria-hidden="true">
            {Array.from({ length: Math.min(40, list.length * 2) }, (_, i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-cream ring-2 ring-soft/40" />)}
          </div>
          <ul>
            {list.map((w) => (
              <Row key={w.id} w={w} hide={hide} peek={peek.has(w.id)} onPeek={() => togglePeek(w.id)} onEdit={() => setEdit(w)} inToday={todaySet.has(w.id)} onSend={() => send(w)} ipa={ipaOf(w)}
                picking={!!pick} picked={!!pick?.has(w.id)} onPick={() => togglePick(w.id)} />
            ))}
          </ul>
        </div>
        </>
      )}
      {list.length > 0 && <p className="mt-3 text-center text-xs text-soft">가림판을 탭하면 정답이 열려요 · ➜ 오늘 학습할 단어로 보내기 · ⋯ 고치기·삭제 · ☑ 선택해서 오늘 학습하기·여러 개 지우기</p>}
      {edit && <EditSheet w={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}
