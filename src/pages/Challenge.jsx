import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { Blob, Empty, Header } from '../components/ui.jsx'
import MiniQuiz from '../components/MiniQuiz.jsx'
import { fanfare } from '../lib/sfx.js'

// 가족이 낸 문제 풀기 / 결과 보기
export default function Challenge() {
  const { id } = useParams()
  const { member, members, words, addWords, showToast } = useApp()
  const [c, setC] = useState(undefined)
  const [playing, setPlaying] = useState(false)
  const [result, setResult] = useState(null)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    db.challengesFor(member.id).then((l) => setC(l.find((x) => x.id === id) || null)).catch(() => setC(null))
  }, [id, member.id])

  if (c === undefined) return <p className="py-20 text-center text-soft">불러오는 중…</p>
  if (!c) return <div><Header title="가족 문제" back="/family" /><Empty title="문제를 찾을 수 없어요" desc="지워졌거나 다른 가족의 문제예요."><Link to="/family" className="btn-main mt-2">가족으로</Link></Empty></div>

  const from = members.find((m) => m.id === c.from_member)
  const toM = members.find((m) => m.id === c.to_member)
  const mine = c.to_member === member.id

  async function done(rs) {
    const score = rs.filter((r) => r.ok).length
    setResult(rs); setPlaying(false)
    if (score === rs.length) setTimeout(fanfare, 100)
    try { setC(await db.finishChallenge(c.id, score, rs.length, rs.map((r) => r.ok))) } catch (e) { showToast(e.message) }
  }
  async function keepWrong() {
    const have = new Set(words.map((w) => w.word.toLowerCase()))
    const wrong = (result || []).filter((r) => !r.ok && !have.has(r.word.toLowerCase())).map((r) => ({ word: r.word, meaning: r.meaning }))
    if (!wrong.length) { setAdded(true); return showToast('이미 내 단어장에 있는 단어예요') }
    try { await addWords(wrong, 'family'); setAdded(true); showToast(`${wrong.length}개를 내 단어장에 담았어요`) } catch (e) { showToast(e.message) }
  }

  if (playing) {
    return (
      <div>
        <Header noProfile title={`${from?.name || '가족'}가 낸 문제`} back="/family" />
        <MiniQuiz items={c.words} mode="ko" onDone={done} />
      </div>
    )
  }

  const rs = result
  return (
    <div>
      <Header title="가족 문제" back="/family" />
      <div className="card mb-4 flex flex-col items-center gap-2 px-6 py-6 text-center">
        <div className="flex items-end gap-1">
          <Blob i={from?.avatar || 0} size={56} wear={from?.pet?.wear} />
          <span className="pb-3 text-2xl">➜</span>
          <Blob i={toM?.avatar || 1} size={56} wear={toM?.pet?.wear} />
        </div>
        <p className="font-jua text-xl text-slate-deep">{from?.name || '가족'}가 {toM?.name || '가족'}에게 낸 {c.words.length}문제</p>
        {c.note && <p className="rounded-2xl bg-cream px-4 py-2 text-sm text-slate-deep">“{c.note}”</p>}
        {c.done_at ? (
          <p className="pop font-jua text-2xl text-sage">{c.score}/{c.total} 맞혔어요{c.score === c.total ? ' 🎉' : ''}</p>
        ) : mine ? (
          <button className="btn-main mt-2 w-full" onClick={() => setPlaying(true)}>문제 풀기 시작</button>
        ) : (
          <p className="text-sm text-soft">{toM?.name || '가족'}가 아직 풀지 않았어요.</p>
        )}
      </div>

      <section className="card mb-4 p-4">
        <h2 className="mb-2 font-jua text-lg text-slate-deep">문제 단어</h2>
        <ul className="divide-y-2 divide-dashed divide-line">
          {c.words.map((w, i) => {
            const r = rs?.[i] || (Array.isArray(c.results) ? { ok: !!c.results[i] } : null)
            return (
              <li key={i} className="flex items-center gap-2 py-2">
                {r && <span className={`font-jua ${r.ok ? 'text-sage' : 'text-coral'}`}>{r.ok ? '○' : '✕'}</span>}
                <b className="font-title">{w.word}</b>
                <span className="min-w-0 flex-1 text-right text-sm text-soft">{c.done_at || !mine ? w.meaning : '···'}</span>
              </li>
            )
          })}
        </ul>
      </section>

      {rs && rs.some((r) => !r.ok) && !added && (
        <button className="btn-ghost mb-2 w-full" onClick={keepWrong}>틀린 단어 내 단어장에 담기</button>
      )}
      {c.done_at && mine && <Link to="/family" className="btn-main block w-full text-center">나도 {from?.name || '가족'}에게 문제 내기</Link>}
    </div>
  )
}
