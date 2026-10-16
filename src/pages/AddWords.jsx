import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { toJpegBase64, looksLikeImage } from '../lib/image.js'
import { ocrCanvas } from '../lib/ocr.js'
import { loadDict, searchEntries } from '../lib/dict.js'
import { cleanEntry, parseLines } from '../lib/study.js'
import { Blob, Header, Speak } from '../components/ui.jsx'
import PhotoWait from '../components/PhotoWait.jsx'
import * as sfx from '../lib/sfx.js'

// 직접 적기: 영어나 한글을 치는 동안 바로 찾아 주고, 탭하면 단어장에 담김
function SearchAdd() {
  const { words, addWords, showToast } = useApp()
  const [dict, setDict] = useState(null)
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState('')
  const [aiItems, setAiItems] = useState({ q: '', items: [], busy: false, err: '' })
  useEffect(() => { loadDict().then(setDict) }, [])
  const owned = useMemo(() => new Set(words.map((w) => w.word.toLowerCase())), [words])
  const results = useMemo(() => (dict ? searchEntries(dict, q, 8) : []), [dict, q])

  // 사전에 없으면 잠시 뒤 AI가 자동으로 찾아 줌(같은 검색어는 다시 묻지 않음)
  useEffect(() => {
    const query = q.trim()
    if (!dict || !query || results.length >= 3 || query.length < (/[가-힣]/.test(query) ? 1 : 3)) return
    if (aiItems.q === query) return
    const t = setTimeout(async () => {
      setAiItems({ q: query, items: [], busy: true, err: '' })
      try {
        const key = 'lookup:' + query.toLowerCase()
        const cached = await db.getCache([key])
        const items = cached[key]?.items || (await db.ai('lookup', { q: query })).items
        if (!cached[key] && items.length) db.putCache([{ word: key, items }]).catch(() => {})
        setAiItems({ q: query, items, busy: false, err: '' })
      } catch (e) {
        setAiItems({ q: query, items: [], busy: false, err: e.code === 'NO_KEY' ? '' : e.message })
      }
    }, 650)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, dict, results.length])
  const extra = aiItems.q === q.trim()
    ? aiItems.items.filter((a) => !results.some((r) => r.lw === a.word.toLowerCase())).map((a) => ({ word: a.word, meaning: a.meaning, lw: a.word.toLowerCase(), ai: true }))
    : []
  const shown = [...results, ...extra]

  async function add(e) {
    if (owned.has(e.lw)) return
    setAdding(e.word)
    try {
      const r = await addWords([{ word: e.word, meaning: e.meaning }], 'manual')
      if (r.added.length) { sfx.correct(); showToast(`‘${e.word}’ 담았어요`) }
    } catch (err) { showToast(err.message) } finally { setAdding('') }
  }

  return (
    <div className="card mb-4 p-4">
      <label className="label" htmlFor="search">영어나 한글로 찾기</label>
      <div className="relative">
        <input id="search" className="field pl-10 font-title" placeholder="예: app, 사과, 행복" value={q}
          onChange={(e) => { setQ(e.target.value); sfx.tap() }} autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} />
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg">🔎</span>
        {q && <button type="button" onClick={() => setQ('')} aria-label="지우기" className="absolute right-3 top-1/2 -translate-y-1/2 text-soft">✕</button>}
      </div>
      {q.trim() && (
        <ul className="mt-2 divide-y-2 divide-dashed divide-line" aria-label="검색 결과">
          {shown.map((e) => {
            const has = owned.has(e.lw)
            return (
              <li key={e.word}>
                <button type="button" disabled={has || adding === e.word} onClick={() => add(e)}
                  className="flex w-full items-center gap-2 py-2.5 text-left active:bg-cream disabled:opacity-60">
                  <Speak text={e.word} size="sm" />
                  <span className="min-w-0 flex-1">
                    <b className="font-title text-lg">{e.word}</b>
                    <span className="ml-2 text-sm text-soft">{e.meaning}</span>
                    {e.ai && <span className="ml-1 rounded-full bg-slate/10 px-1.5 text-[10px] text-slate-deep">AI</span>}
                  </span>
                  <span className={`chip ${has ? '' : 'border-sage text-sage'}`}>{has ? '담음' : adding === e.word ? '…' : '＋ 담기'}</span>
                </button>
              </li>
            )
          })}
          {aiItems.busy && aiItems.q === q.trim() && <li className="py-3 text-sm text-slate">🤖 사전에 없어서 AI가 찾는 중…</li>}
          {dict && !shown.length && !aiItems.busy && <li className="py-3 text-sm text-soft">찾는 단어가 없어요{aiItems.err ? ` (${aiItems.err})` : ''}. 아래 ‘여러 개 한 번에 적기’로 직접 넣어 주세요.</li>}
        </ul>
      )}
      {!q.trim() && <p className="mt-2 text-xs text-soft">자주 쓰는 영어 단어 9,000여 개에서 바로 찾아요. 몇 글자만 쳐도 나오고, 사전에 없으면 AI가 찾아 줘요.</p>}
    </div>
  )
}

function Preview({ rows, setRows }) {
  const upd = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => {
        const c = cleanEntry(r)
        return (
          <li key={i} className={`rounded-2xl border-2 p-2 ${r.on ? 'border-line bg-white' : 'border-dashed border-line opacity-50'}`}>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={r.on} onChange={(e) => upd(i, 'on', e.target.checked)} className="h-5 w-5 accent-[#3E5486]" aria-label="포함" />
              <input className="w-[42%] rounded-xl border-2 border-line px-2 py-1.5 font-title" value={r.word} onChange={(e) => upd(i, 'word', e.target.value)} autoCapitalize="none" />
              <input className="min-w-0 flex-1 rounded-xl border-2 border-line px-2 py-1.5" value={r.meaning} placeholder="뜻" onChange={(e) => upd(i, 'meaning', e.target.value)} />
            </div>
            {r.on && c.errors.length > 0 && <p className="mt-1 pl-7 text-xs text-coral">{c.errors[0]}</p>}
          </li>
        )
      })}
    </ul>
  )
}

export default function AddWords() {
  const { addWords, showToast, aiState } = useApp()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const tab = params.get('tab') === 'manual' ? 'manual' : 'photo'
  const [rows, setRows] = useState([])
  const [img, setImg] = useState(null)
  const [busy, setBusy] = useState('')
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const fileRef = useRef()

  const valid = useMemo(() => rows.filter((r) => r.on).map(cleanEntry).filter((c) => !c.errors.length), [rows])
  const invalid = rows.filter((r) => r.on).length - valid.length

  const [wait, setWait] = useState(null) // { index, total, found, stage, ocrProgress }
  const [fails, setFails] = useState([])

  async function onFiles(e) {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    const bad = files.filter((f) => !looksLikeImage(f))
    const list = files.filter((f) => looksLikeImage(f))
    const failed = bad.map((f) => ({ name: f.name, reason: '사진 파일이 아니에요' }))
    if (!list.length) { setFails(failed); return }
    setImg(URL.createObjectURL(list[0]))
    let found = 0
    let aiDown = false
    for (let i = 0; i < list.length; i++) {
      const f = list[i]
      setWait({ index: i, total: list.length, found, stage: 'convert' })
      let pic
      try { pic = await toJpegBase64(f) } catch (err) { failed.push({ name: f.name, reason: err.message }); continue }
      let got = []
      if (!aiDown) {
        setWait({ index: i, total: list.length, found, stage: 'ai' })
        try {
          got = (await db.ai('extract', { image: pic.base64, mediaType: 'image/jpeg' })).words
        } catch (err) {
          // AI를 못 쓰면(키·크레딧·서버 오류) 기기 안 무료 글자 인식으로 대신
          aiDown = true
          showToast('AI 대신 기기에서 글자를 읽어요(조금 덜 정확해요): ' + err.message)
        }
      }
      if (aiDown) {
        setWait({ index: i, total: list.length, found, stage: 'ocr', ocrProgress: 0 })
        try {
          got = await ocrCanvas(pic.canvas, (p) => setWait((w) => (w ? { ...w, ocrProgress: p } : w)))
        } catch (err) { failed.push({ name: f.name, reason: '글자 인식 실패: ' + err.message }); continue }
      }
      if (!got.length) { failed.push({ name: f.name, reason: '단어를 찾지 못했어요(더 밝고 반듯하게 찍어 주세요)' }); continue }
      // 뜻이 빠진 단어는 내장 사전으로 채움
      const dict = await loadDict()
      const dm = Object.fromEntries(dict.map((d) => [d.lw, d.meaning]))
      got = got.map((w) => ({ ...w, meaning: w.meaning || dm[w.word.toLowerCase()] || '' }))
      found += got.length
      setRows((rs) => {
        const have = new Set(rs.map((r) => r.word.toLowerCase()))
        return [...rs, ...got.filter((w) => !have.has(w.word.toLowerCase())).map((w) => ({ ...w, on: true }))]
      })
    }
    setWait(null)
    setFails(failed)
    if (found) sfx.correct()
    else if (failed.length) sfx.wrong()
  }

  function parseText() {
    const parsed = parseLines(text)
    if (!parsed.length) return showToast('한 줄에 하나씩 "apple 사과" 처럼 적어 주세요')
    loadDict().then((dict) => {
      const dm = Object.fromEntries(dict.map((d) => [d.lw, d.meaning]))
      setRows((rs) => [...rs, ...parsed.map((p) => ({ ...p, meaning: p.meaning || dm[p.word.toLowerCase()] || '', on: true }))])
    })
    setText('')
  }

  async function save() {
    if (!valid.length) return showToast('저장할 단어가 없어요')
    setBusy('단어장에 넣는 중…')
    try {
      const r = await addWords(valid.map(({ word, meaning }) => ({ word, meaning })), tab === 'photo' ? 'photo' : 'manual')
      setResult(r)
      setRows([])
      setImg(null)
    } catch (err) { showToast(err.message) } finally { setBusy('') }
  }

  if (result) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <Blob i={1} size={96} className="pop" />
        <h2 className="h-title text-3xl">{result.added.length}개 담았어요!</h2>
        {result.skipped > 0 && <p className="text-soft">이미 있던 단어 {result.skipped}개는 건너뛰었어요</p>}
        <p className="text-sm text-soft">유의어·반의어·예문은 뒤에서 자동으로 준비돼요</p>
        <div className="mt-2 flex gap-2">
          <button className="btn-ghost" onClick={() => setResult(null)}>더 추가</button>
          <button className="btn-main" onClick={() => nav('/book')}>단어장 보기</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="단어 추가" back="/" />
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-full bg-paper p-1 border-2 border-line">
        {[['photo', '📷 사진으로'], ['manual', '✍️ 직접 적기']].map(([k, l]) => (
          <button key={k} onClick={() => setParams({ tab: k })} className={`rounded-full py-2 font-jua ${tab === k ? 'bg-slate-deep text-white' : 'text-soft'}`}>{l}</button>
        ))}
      </div>

      {tab === 'photo' ? (
        <div className="card mb-4 p-4">
          <p className="mb-3 text-sm text-soft">영어 단어와 한글 뜻이 함께 보이는 교재·단어장을 찍어 주세요. <b>여러 장을 한 번에</b> 골라도 돼요. (JPG·PNG·아이폰 HEIC 등 모든 사진)</p>
          {img && <img src={img} alt="올린 사진" className="mb-3 max-h-56 w-full rounded-2xl object-contain bg-cream" />}
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={onFiles} />
          <button className="btn-tang w-full" disabled={!!busy} onClick={() => fileRef.current?.click()}>
            {rows.length ? '📷 사진 더 올리기' : '📷 사진 찍기 / 고르기'}
          </button>
          {aiState === 'nokey' && <p className="mt-2 text-xs text-soft">AI가 준비되기 전에는 기기 안에서 글자를 읽어요(조금 덜 정확해요).</p>}
          {fails.length > 0 && (
            <div className="mt-3 rounded-2xl border-2 border-coral/40 bg-coral/10 p-3 text-sm">
              <p className="mb-1 font-jua text-coral">못 읽은 사진 {fails.length}장</p>
              <ul className="space-y-0.5 text-xs text-ink">{fails.map((f, i) => <li key={i}><b>{f.name}</b> — {f.reason}</li>)}</ul>
            </div>
          )}
        </div>
      ) : (
        <>
          <SearchAdd />
          <details className="card mb-4 p-4" open={rows.length > 0}>
            <summary className="cursor-pointer font-jua text-slate-deep">✍️ 여러 개 한 번에 적기</summary>
            <label className="label mt-3" htmlFor="bulk">한 줄에 하나씩 (영어 뜻)</label>
            <textarea id="bulk" rows={5} className="field mb-2 font-title" placeholder={'apple 사과\nhappy - 행복한, 기쁜\nlibrary: 도서관'} value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn-ghost w-full" onClick={parseText}>아래 목록에 넣기</button>
          </details>
        </>
      )}

      {busy && <p className="mb-3 text-center font-jua text-slate">{busy}</p>}
      {wait && <PhotoWait {...wait} />}

      {rows.length > 0 && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-jua text-lg text-slate-deep">확인하고 고치기 ({rows.length})</h2>
            <button className="text-sm text-soft underline" onClick={() => setRows([])}>모두 지우기</button>
          </div>
          <Preview rows={rows} setRows={setRows} />
          <div className="safe-b sticky bottom-0 -mx-4 mt-4 bg-cream/95 px-4 pt-2">
            <button className="btn-main w-full" disabled={!!busy || !valid.length} onClick={save}>
              {valid.length}개 단어장에 넣기{invalid > 0 ? ` (고칠 것 ${invalid}개 제외)` : ''}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
