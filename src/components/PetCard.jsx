import { useEffect, useRef, useState } from 'react'
import { useApp } from '../App.jsx'
import { petState, wearing, WEAR_LABEL, PET_STAGES } from '../lib/pet.js'
import { Blob } from './ui.jsx'

// 홈에서 늘 돌아가는 캐릭터 상태: 자람·새 꾸미기 저장·'냠냠 +N'
export function usePet() {
  const { member, words, updateMember, showToast, ready } = useApp()
  const st = petState(words, member.pet)
  const wear = wearing(member.pet, st.unlocked)
  const key = `foldy.petfood.${member.id}`
  const [ate, setAte] = useState(0)
  const saving = useRef(false)

  useEffect(() => {
    if (!ready) return
    let prev = null
    try { const v = localStorage.getItem(key); prev = v === null ? null : Number(v) } catch { /* */ }
    try { localStorage.setItem(key, String(st.food)) } catch { /* */ }
    if (prev !== null && Number.isFinite(prev) && st.food > prev) {
      setAte(st.food - prev)
      const t = setTimeout(() => setAte(0), 2600)
      return () => clearTimeout(t)
    }
  }, [st.food, key, ready])

  // 새로 풀린 꾸미기는 자동으로 착용하고 저장(가족 화면에도 보이게)
  useEffect(() => {
    if (!ready) return
    const got = Array.isArray(member.pet?.got) ? member.pet.got : []
    const fresh = st.unlocked.filter((x) => !got.includes(x))
    if (!fresh.length || saving.current) return
    saving.current = true
    const nextWear = [...new Set([...(Array.isArray(member.pet?.wear) ? member.pet.wear : []), ...fresh])]
    updateMember({ pet: { ...(member.pet || {}), got: st.unlocked, wear: nextWear } })
      .then(() => showToast(`✨ ${st.name}로 자랐어요! ${fresh.map((x) => WEAR_LABEL[x]).join('·')}가 생겼어요`))
      .catch(() => {})
      .finally(() => { saving.current = false })
  }, [st.unlocked.join(','), member.id, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  return { st, wear, ate }
}

// 왼쪽 위 캐릭터를 누르면 열리는 '내 캐릭터'
export function PetSheet({ onClose, onProfile }) {
  const { member, words, updateMember, showToast } = useApp()
  const st = petState(words, member.pet)
  const wear = wearing(member.pet, st.unlocked)
  async function toggleWear(k) {
    const next = wear.includes(k) ? wear.filter((x) => x !== k) : [...wear, k]
    try { await updateMember({ pet: { ...(member.pet || {}), got: st.unlocked, wear: next } }) } catch (e) { showToast(e.message) }
  }
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30" onClick={onClose} role="dialog" aria-modal="true" aria-label="내 캐릭터">
      <div className="safe-b w-full max-w-md rounded-t-3xl bg-paper p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
        <div className="flex flex-col items-center text-center">
          <div className="relative flex h-[132px] items-end justify-center">
            <span className="absolute bottom-1 h-3 w-20 rounded-full bg-line/70" aria-hidden="true" />
            <Blob i={member.avatar} size={84 + st.stage * 8} wear={wear} className="bob" />
          </div>
          <p className="mt-2 font-jua text-xl text-slate-deep">내 캐릭터 · {st.name}</p>
          <p className="text-sm text-soft">공부해서 맞힌 단어를 먹고 자라요. 지금까지 {st.food}번 먹었어요.</p>
        </div>
        {st.next ? (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-slate transition-all duration-700" style={{ width: `${st.pct}%` }} /></div>
            <p className="mt-1.5 text-center text-xs text-soft"><span className="whitespace-nowrap">{st.toNext}번 더 맞히면</span> <span className="whitespace-nowrap">‘{st.next.name}’ · {WEAR_LABEL[st.next.unlock]}</span></p>
          </div>
        ) : <p className="mt-4 text-center text-sm text-slate-deep">가장 크게 자랐어요 👑</p>}

        <p className="label mt-5">꾸미기</p>
        <div className="flex flex-wrap gap-2">
          {PET_STAGES.slice(1).map((s) => {
            const has = st.unlocked.includes(s.unlock)
            const on = wear.includes(s.unlock)
            return (
              <button key={s.unlock} type="button" disabled={!has} onClick={() => toggleWear(s.unlock)}
                className={`chip ${on ? 'chip-on' : ''} ${has ? '' : 'opacity-40'}`} aria-pressed={on}>
                {has ? WEAR_LABEL[s.unlock] : `🔒 ${s.name}`}
              </button>
            )
          })}
        </div>

        <div className="mt-6 flex gap-2">
          <button className="btn-ghost flex-1" onClick={onProfile}>내 프로필 열기</button>
          <button className="btn-main flex-1" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
