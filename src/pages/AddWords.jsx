import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { resizeImage } from '../lib/enrich.js'
import { cleanEntry, parseLines } from '../lib/study.js'
import { Blob, Header } from '../components/ui.jsx'

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

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return showToast('사진 파일만 올릴 수 있어요')
    setImg(URL.createObjectURL(file))
    setBusy('사진에서 단어를 읽는 중… (10~20초)')
    try {
      const b64 = await resizeImage(file)
      const { words } = await db.ai('extract', { image: b64, mediaType: 'image/jpeg' })
      if (!words.length) showToast('단어를 찾지 못했어요. 더 밝고 반듯하게 찍어 주세요')
      setRows((rs) => [...rs, ...words.map((w) => ({ ...w, on: true }))])
    } catch (err) {
      showToast(err.code === 'NO_KEY' ? 'AI 키가 연결되면 사진 읽기를 쓸 수 있어요' : err.message)
    } finally { setBusy('') }
  }

  function parseText() {
    const parsed = parseLines(text)
    if (!parsed.length) return showToast('한 줄에 하나씩 "apple 사과" 처럼 적어 주세요')
    setRows((rs) => [...rs, ...parsed.map((p) => ({ ...p, on: true }))])
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
          <p className="mb-3 text-sm text-soft">영어 단어와 한글 뜻이 함께 보이는 교재·단어장을 찍어 주세요. 여러 장을 차례로 올려도 돼요.</p>
          {img && <img src={img} alt="올린 사진" className="mb-3 max-h-56 w-full rounded-2xl object-contain bg-cream" />}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <button className="btn-tang w-full" disabled={!!busy} onClick={() => fileRef.current?.click()}>
            {rows.length ? '📷 사진 한 장 더' : '📷 사진 찍기 / 고르기'}
          </button>
          {aiState === 'nokey' && <p className="mt-2 text-xs text-coral">AI 키가 아직 연결되지 않아 사진 읽기가 꺼져 있어요. ‘직접 적기’는 바로 쓸 수 있어요.</p>}
        </div>
      ) : (
        <div className="card mb-4 p-4">
          <label className="label" htmlFor="bulk">한 줄에 하나씩 (영어 뜻)</label>
          <textarea id="bulk" rows={5} className="field mb-2 font-title" placeholder={'apple 사과\nhappy - 행복한, 기쁜\nlibrary: 도서관'} value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn-ghost w-full" onClick={parseText}>아래 목록에 넣기</button>
        </div>
      )}

      {busy && <p className="mb-3 text-center font-jua text-slate">{busy}</p>}

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
