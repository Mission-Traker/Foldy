import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { LEVELS, normLevel } from '../lib/levels.js'
import { Blob } from './ui.jsx'
import { nameLocked } from '../lib/study.js'
import PinPad from './PinPad.jsx'

// 상단 프로필 아이콘을 누르면 열리는 내 프로필 편집
export default function ProfileSheet({ onClose }) {
  const { member, setMember, updateMember, patchMemberLocal, showToast } = useApp()
  const nav = useNavigate()
  const [name, setName] = useState(member.name)
  const [avatar, setAvatar] = useState(member.avatar)
  const [level, setLevel] = useState(normLevel(member.level))
  const [pinMode, setPinMode] = useState(false)
  const [busy, setBusy] = useState(false)

  const lockedUntil = nameLocked(member.name_changed_at)
  const newName = name.trim().slice(0, 20)
  const renaming = newName !== member.name
  async function save() {
    if (!name.trim()) return showToast('이름을 적어 주세요')
    setBusy(true)
    try {
      await updateMember(renaming ? { name: newName, avatar, level } : { avatar, level })
      showToast('프로필을 저장했어요')
      onClose()
    } catch (e) { showToast(e.message) } finally { setBusy(false) }
  }
  async function removePin() {
    if (!confirm('비밀번호를 없앨까요? 가족 누구나 이 프로필로 공부할 수 있게 돼요.')) return
    try {
      await db.setPin(member.id, '')
      patchMemberLocal({ has_pin: false })
      showToast('비밀번호를 없앴어요')
    } catch (e) { showToast(e.message) }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30" onClick={onClose}>
      <div className="safe-b max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <Blob i={avatar} size={56} />
          <div className="flex-1">
            <h3 className="h-title text-xl">내 프로필</h3>
            <p className="text-xs text-soft">{member.has_pin ? '🔒 비밀번호로 보호 중' : '비밀번호 없음 — 가족 누구나 이 프로필을 열 수 있어요'}</p>
          </div>
          <button onClick={onClose} aria-label="닫기" className="text-2xl text-soft">×</button>
        </div>

        <label className="label" htmlFor="pname">이름(닉네임)</label>
        <input id="pname" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} disabled={!!lockedUntil} />
        <p className="mb-3 mt-1 text-xs text-soft">
          {lockedUntil
            ? `한 달에 한 번 바꿀 수 있어요 · ${lockedUntil.getMonth() + 1}월 ${lockedUntil.getDate()}일부터 다시 바꿀 수 있어요`
            : renaming && newName
              ? <span className="text-coral">저장하면 한 달 동안 다시 바꿀 수 없어요</span>
              : '가족이 누군지 헷갈리지 않게 한 달에 한 번만 바꿀 수 있어요'}
        </p>

        <span className="label">캐릭터</span>
        <div className="mb-3 grid grid-cols-6 gap-2">
          {Array.from({ length: 12 }, (_, i) => (
            <button type="button" key={i} onClick={() => setAvatar(i)} aria-label={`캐릭터 ${i + 1}`}
              className={`rounded-2xl p-1 ${avatar === i ? 'bg-slate/15 ring-2 ring-slate' : ''}`}><Blob i={i} size={38} /></button>
          ))}
        </div>

        <span className="label">레벨</span>
        <div className="mb-4 flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button type="button" key={l.id} onClick={() => setLevel(l.id)} className={`chip ${level === l.id ? 'chip-on' : ''}`}>{l.short}</button>
          ))}
          <button type="button" className="chip" onClick={() => { onClose(); nav('/level-test') }}>진단하기</button>
        </div>

        <button className="btn-main mb-4 w-full" disabled={busy} onClick={save}>저장</button>

        <div className="mb-4 rounded-2xl border-2 border-line p-3">
          <p className="mb-2 font-jua text-slate-deep">🔒 내 비밀번호</p>
          <p className="mb-2 text-xs text-soft">비밀번호를 걸면 다른 가족은 내 단어장을 고칠 수 없어요. 대신 서로의 학습현황은 볼 수 있어요.</p>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1 py-2 text-base" onClick={() => setPinMode(true)}>{member.has_pin ? '비밀번호 바꾸기' : '비밀번호 만들기'}</button>
            {member.has_pin && <button className="btn-ghost py-2 text-base text-coral" onClick={removePin}>없애기</button>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost py-2 text-base" onClick={() => { onClose(); nav('/family') }}>👨‍👩‍👧 가족 학습현황</button>
          <button className="btn-ghost py-2 text-base" onClick={() => { onClose(); setMember(null) }}>🔁 프로필 바꾸기</button>
        </div>
      </div>
      {pinMode && (
        <PinPad confirmMode title="새 비밀번호 (숫자 4~6자리)" avatar={avatar} onCancel={() => setPinMode(false)}
          onSubmit={async (pin) => {
            await db.setPin(member.id, pin)
            patchMemberLocal({ has_pin: true })
            setPinMode(false)
            showToast('비밀번호를 걸었어요')
          }} />
      )}
    </div>
  )
}
