import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { statusOf } from '../lib/study.js'
import { Blob } from './ui.jsx'

const MAX = 10
const nameOf = (members, id) => members.find((m) => m.id === id)?.name || '가족'

// 가족에게 단어 문제 내기 + 주고받은 문제
export default function FamilyChallenge() {
  const { member, members, words, showToast } = useApp()
  const others = members.filter((m) => m.id !== member.id)
  const [to, setTo] = useState(null)
  const [picked, setPicked] = useState([])
  const [q, setQ] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [list, setList] = useState(null)

  const load = () => db.challengesFor(member.id).then(setList).catch(() => setList([]))
  useEffect(() => { load() }, [member.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // 내가 공부한 단어부터(○·△), 최근 것 먼저
  const pool = useMemo(() => {
    const t = q.trim().toLowerCase()
    const ws = words.filter((w) => !t || w.word.toLowerCase().includes(t) || w.meaning.includes(q.trim()))
    const rank = (w) => (statusOf(w) === 'o' ? 0 : statusOf(w) === 't' ? 1 : 2)
    return [...ws].sort((a, b) => rank(a) - rank(b) || (b.seq || 0) - (a.seq || 0)).slice(0, 40)
  }, [words, q])

  const toggle = (w) => setPicked((p) => (p.some((x) => x.id === w.id) ? p.filter((x) => x.id !== w.id) : p.length >= MAX ? (showToast(`한 번에 ${MAX}개까지 낼 수 있어요`), p) : [...p, w]))

  async function send() {
    if (!to || !picked.length) return
    setBusy(true)
    try {
      await db.sendChallenge(member.id, to, picked.map((w) => ({ word: w.word, meaning: w.meaning, accepted: (w.accepted || []).slice(0, 8) })), note.trim().slice(0, 60))
      showToast(`${nameOf(members, to)}에게 문제 ${picked.length}개를 보냈어요`)
      setPicked([]); setNote(''); setQ('')
      load()
    } catch (e) { showToast(e.message) } finally { setBusy(false) }
  }

  const received = (list || []).filter((c) => c.to_member === member.id)
  const sent = (list || []).filter((c) => c.from_member === member.id)

  return (
    <>
      <section className="card mb-4 p-4">
        <h2 className="mb-1 font-jua text-lg text-slate-deep">🎯 가족에게 문제 내기</h2>
        {!others.length ? (
          <p className="text-sm text-soft">가족 구성원이 두 명 이상이어야 문제를 낼 수 있어요.</p>
        ) : !words.length ? (
          <p className="text-sm text-soft">내 단어장에 단어를 먼저 넣어 주세요. 내가 외운 단어로 문제를 내요.</p>
        ) : (
          <>
            <p className="mb-3 text-xs text-soft">내 단어장에서 골라 보내면 받은 사람이 뜻을 맞혀요. 한 번에 {MAX}개까지예요.</p>
            <p className="label">누구에게?</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {others.map((m) => (
                <button key={m.id} type="button" onClick={() => setTo(m.id)} className={`chip gap-1 ${to === m.id ? 'chip-on' : ''}`}>
                  <Blob i={m.avatar} size={20} wear={m.pet?.wear} />{m.name}
                </button>
              ))}
            </div>
            {to && (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <span className="label !mb-0">낼 단어 고르기</span>
                  <span className="font-jua text-sm text-tang">{picked.length}/{MAX}</span>
                </div>
                <input className="field mb-2" value={q} onChange={(e) => setQ(e.target.value)} placeholder="단어·뜻 찾기" aria-label="낼 단어 찾기" />
                <ul className="mb-3 max-h-60 divide-y-2 divide-dashed divide-line overflow-y-auto rounded-2xl border-2 border-line bg-paper px-3">
                  {pool.map((w) => {
                    const on = picked.some((x) => x.id === w.id)
                    return (
                      <li key={w.id}>
                        <label className="flex cursor-pointer items-center gap-2 py-2">
                          <input type="checkbox" checked={on} onChange={() => toggle(w)} className="h-5 w-5 accent-[#3E5486]" aria-label={`${w.word} 고르기`} />
                          <b className="font-title">{w.word}</b>
                          <span className="min-w-0 flex-1 truncate text-sm text-soft">{w.meaning}</span>
                        </label>
                      </li>
                    )
                  })}
                  {!pool.length && <li className="py-3 text-sm text-soft">찾는 단어가 없어요</li>}
                </ul>
                <input className="field mb-3" value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} placeholder="한마디(선택) · 예: 다 맞히면 아이스크림!" aria-label="한마디" />
                <button className="btn-main w-full" disabled={busy || !picked.length} onClick={send}>
                  {busy ? '보내는 중…' : picked.length ? `${nameOf(members, to)}에게 ${picked.length}문제 보내기` : '단어를 골라 주세요'}
                </button>
              </>
            )}
          </>
        )}
      </section>

      {list && (received.length > 0 || sent.length > 0) && (
        <section className="card mb-4 p-4">
          <h2 className="mb-2 font-jua text-lg text-slate-deep">주고받은 문제</h2>
          <ul className="divide-y-2 divide-dashed divide-line">
            {received.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2.5">
                <span className="text-xl">📩</span>
                <span className="min-w-0 flex-1 text-sm"><b className="font-jua text-slate-deep">{nameOf(members, c.from_member)}</b>
                  <span className="text-soft">가 낸 {c.words.length}문제</span></span>
                {c.done_at
                  ? <Link to={`/challenge/${c.id}`} className="font-jua text-sm text-sage">{c.score}/{c.total} ✓</Link>
                  : <Link to={`/challenge/${c.id}`} className="chip chip-on">풀기</Link>}
              </li>
            ))}
            {sent.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2.5">
                <span className="text-xl">📤</span>
                <span className="min-w-0 flex-1 text-sm"><b className="font-jua text-slate-deep">{nameOf(members, c.to_member)}</b>
                  <span className="text-soft">에게 낸 {c.words.length}문제</span></span>
                {c.done_at
                  ? <Link to={`/challenge/${c.id}`} className="font-jua text-sm text-sage">{c.score}/{c.total} 맞힘</Link>
                  : <span className="text-xs text-soft">아직 안 풀었어요</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
