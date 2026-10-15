import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp } from '../App.jsx'
import { expandStage, sortWords, statusOf, STATUS_LABEL, cleanEntry } from '../lib/study.js'
import { Empty, Header, Mark, Speak, fmtDate } from '../components/ui.jsx'
import { speak } from '../lib/speech.js'

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
    <div className="ml-[4.25rem] mr-1 mb-2 space-y-2">
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

function Row({ w, hide, peek, onPeek, onEdit }) {
  const s = statusOf(w)
  const coverWord = hide === 'word' && !peek
  const coverMeaning = hide === 'meaning' && !peek
  return (
    <li className="border-b-2 border-dashed border-line last:border-0">
      <div className="flex items-stretch gap-2 py-2.5 pr-1">
        <div className="flex w-[3.75rem] shrink-0 items-center gap-1.5 pl-1">
          <span className="w-6 text-right font-title text-xs text-soft">{w.seq}</span>
          <Mark s={s} />
        </div>
        <button onClick={() => (coverWord ? onPeek() : speak(w.word))} className="relative min-w-0 flex-[1.1] text-left">
          <span className="block truncate font-title text-[19px] font-semibold text-ink">{w.word}</span>
          <span className="block text-[11px] text-soft">{fmtDate(w.created_at)} · {STATUS_LABEL[s]}</span>
          {coverWord && <span className="absolute inset-0 rounded-xl bg-[repeating-linear-gradient(0deg,#FFFBF4,#FFFBF4_9px,#EFE5D3_10px)] border-2 border-line" />}
        </button>
        <button onClick={onPeek} className="relative min-w-0 flex-1 overflow-hidden rounded-xl text-left" aria-label="뜻 보기">
          <span className="flex h-full items-center px-2 text-[15px] leading-tight text-slate-deep">{w.meaning}</span>
          <span className={`flap absolute inset-0 flex items-center justify-center rounded-xl border-2 border-line bg-[repeating-linear-gradient(0deg,#FFFBF4,#FFFBF4_9px,#EFE5D3_10px)] text-xs text-soft ${coverMeaning ? '' : 'open'}`}>
            탭해서 보기
          </span>
        </button>
        <button onClick={onEdit} aria-label="단어 고치기" className="w-6 shrink-0 text-soft">⋯</button>
      </div>
      <Extras w={w} />
    </li>
  )
}

function EditSheet({ w, onClose }) {
  const { patchWord, removeWord, showToast } = useApp()
  const [word, setWord] = useState(w.word)
  const [meaning, setMeaning] = useState(w.meaning)
  async function save() {
    const c = cleanEntry({ word, meaning })
    if (c.errors.length) return showToast(c.errors[0])
    const patch = { word: c.word, meaning: c.meaning }
    if (c.word.toLowerCase() !== w.word.toLowerCase() || c.meaning !== w.meaning) Object.assign(patch, { enriched: false, accepted: [] })
    await patchWord(w.id, patch)
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
  const { words, ready } = useApp()
  const [params, setParams] = useSearchParams()
  const [sort, setSort] = useState('seq')
  const [dir, setDir] = useState('asc')
  const [hide, setHide] = useState('meaning')
  const [peek, setPeek] = useState(() => new Set())
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)
  const filter = params.get('f') || 'all'

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
      <Header title="단어장" right={<Link to="/add" className="btn-tang px-4 py-2 text-base">＋ 추가</Link>} />

      <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
        {[['all', '전체'], ['x', '✕ 미학습'], ['t', '△ 학습 중'], ['o', '○ 완료']].map(([k, l]) => (
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
      <div className="mb-3 flex gap-2">
        {HIDES.map(([k, l]) => (
          <button key={k} onClick={() => { setHide(k); setPeek(new Set()) }} className={`chip ${hide === k ? 'border-tang bg-tang text-white' : ''}`}>{l}</button>
        ))}
      </div>

      {!ready ? (
        <p className="py-10 text-center text-soft">불러오는 중…</p>
      ) : !words.length ? (
        <Empty title="아직 단어가 없어요" desc="교재 사진을 찍어 한 번에 넣거나, 직접 적어 보세요.">
          <div className="mt-2 flex gap-2"><Link to="/add?tab=photo" className="btn-tang">📷 사진</Link><Link to="/add?tab=manual" className="btn-ghost">✍️ 직접</Link></div>
        </Empty>
      ) : !list.length ? (
        <Empty title="조건에 맞는 단어가 없어요" i={2} />
      ) : (
        <div className="card relative overflow-hidden pl-6">
          {/* 스프링 노트 고리 */}
          <div className="absolute inset-y-0 left-0 flex w-6 flex-col items-center gap-5 bg-line/50 py-4" aria-hidden="true">
            {Array.from({ length: Math.min(40, list.length * 2) }, (_, i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-cream ring-2 ring-soft/40" />)}
          </div>
          <ul>
            {list.map((w) => (
              <Row key={w.id} w={w} hide={hide} peek={peek.has(w.id)} onPeek={() => togglePeek(w.id)} onEdit={() => setEdit(w)} />
            ))}
          </ul>
        </div>
      )}
      {list.length > 0 && <p className="mt-3 text-center text-xs text-soft">가림판을 탭하면 정답이 열려요 · 영어를 탭하면 발음을 들려줘요</p>}
      {edit && <EditSheet w={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}
