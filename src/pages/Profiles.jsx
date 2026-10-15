import { useState } from 'react'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { LEVELS } from '../lib/levels.js'
import { Blob } from '../components/ui.jsx'
import PinPad from '../components/PinPad.jsx'
import { Link } from 'react-router-dom'

export function MemberForm({ onDone, onCancel }) {
  const { setMembers, showToast } = useApp()
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(0)
  const [level, setLevel] = useState('e1')
  const [busy, setBusy] = useState(false)
  async function save(e) {
    e.preventDefault()
    if (!name.trim()) return showToast('이름을 적어 주세요')
    setBusy(true)
    try {
      const m = await db.addMember({ name: name.trim().slice(0, 20), avatar, level })
      setMembers((ms) => [...ms, m])
      onDone?.(m)
    } catch (err) { showToast(err.message) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <div>
        <label className="label" htmlFor="mname">이름</label>
        <input id="mname" className="field" placeholder="예: 하은" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
      </div>
      <div>
        <span className="label">캐릭터</span>
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 12 }, (_, i) => (
            <button type="button" key={i} onClick={() => setAvatar(i)} aria-label={`캐릭터 ${i + 1}`}
              className={`rounded-2xl p-1 ${avatar === i ? 'bg-slate/15 ring-2 ring-slate' : ''}`}>
              <Blob i={i} size={40} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">레벨 (나중에 진단 테스트로 바꿀 수 있어요)</span>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button type="button" key={l.id} onClick={() => setLevel(l.id)} className={`chip ${level === l.id ? 'chip-on' : ''}`}>{l.short}</button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        {onCancel && <button type="button" className="btn-ghost flex-1" onClick={onCancel}>취소</button>}
        <button className="btn-main flex-1" disabled={busy}>추가하기</button>
      </div>
    </form>
  )
}

export default function Profiles() {
  const { members, setMember, session, setSession } = useApp()
  const [adding, setAdding] = useState(false)
  const [locked, setLocked] = useState(null)
  function choose(m) {
    if (m.has_pin && !db.hasMemberToken(m.id)) return setLocked(m)
    setMember(m)
  }
  return (
    <div className="py-10">
      <p className="text-center font-title text-sm font-semibold tracking-[0.25em] text-coral">{session?.name}</p>
      <h1 className="h-title mb-6 text-center text-3xl">누가 공부할까요?</h1>
      {adding || !members.length ? (
        <MemberForm onDone={(m) => { setAdding(false); setMember(m) }} onCancel={members.length ? () => setAdding(false) : null} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {members.map((m) => (
              <button key={m.id} onClick={() => choose(m)} className="card relative flex flex-col items-center gap-1 py-5 active:translate-y-[2px]">
                {m.has_pin && <span className="absolute right-3 top-3 text-sm" aria-label="비밀번호 잠김">🔒</span>}
                <Blob i={m.avatar} size={72} />
                <span className="font-jua text-lg text-slate-deep">{m.name}</span>
                <span className="text-xs text-soft">{LEVELS.find((l) => l.id === m.level)?.label}</span>
              </button>
            ))}
            <button onClick={() => setAdding(true)} className="flex flex-col items-center justify-center gap-1 rounded-3xl border-2 border-dashed border-line py-5 text-soft">
              <span className="text-3xl">＋</span><span className="font-jua">가족 추가</span>
            </button>
          </div>
          <button className="mx-auto mt-8 block text-sm text-soft underline" onClick={async () => { await db.logout(); setSession(null) }}>로그아웃</button>
        </>
      )}
      {locked && (
        <PinPad title={`${locked.name}의 비밀번호`} sub="숫자 4~6자리" avatar={locked.avatar}
          onCancel={() => setLocked(null)}
          onSubmit={async (pin) => { await db.unlockMember(locked.id, pin); const m = locked; setLocked(null); setMember(m) }} />
      )}
    </div>
  )
}
