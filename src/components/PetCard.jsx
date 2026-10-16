import { useEffect, useRef, useState } from 'react'
import { useApp } from '../App.jsx'
import { petState, wearing, WEAR_LABEL, PET_STAGES } from '../lib/pet.js'
import { Blob } from './ui.jsx'

// 내 캐릭터: 퀴즈를 통과할 때마다 단어를 '먹고' 자라요(쉬면 갉아먹고, 공부하면 자라요)
export default function PetCard() {
  const { member, words, updateMember, showToast } = useApp()
  const st = petState(words)
  const wear = wearing(member.pet, st.unlocked)
  const key = `foldy.petfood.${member.id}`
  const [ate, setAte] = useState(0)
  const [open, setOpen] = useState(false)
  const saving = useRef(false)

  // 지난번보다 먹은 만큼 '냠냠'
  useEffect(() => {
    let prev = null
    try { prev = Number(localStorage.getItem(key)) } catch { /* */ }
    if (Number.isFinite(prev) && prev !== null && st.food > prev) {
      setAte(st.food - prev)
      const t = setTimeout(() => setAte(0), 2600)
      try { localStorage.setItem(key, String(st.food)) } catch { /* */ }
      return () => clearTimeout(t)
    }
    try { localStorage.setItem(key, String(st.food)) } catch { /* */ }
  }, [st.food, key])

  // 새로 풀린 꾸미기는 자동으로 착용(가족 화면에도 같이 보이게 저장)
  useEffect(() => {
    const got = Array.isArray(member.pet?.got) ? member.pet.got : []
    const fresh = st.unlocked.filter((x) => !got.includes(x))
    if (!fresh.length || saving.current) return
    saving.current = true
    const nextWear = [...new Set([...(Array.isArray(member.pet?.wear) ? member.pet.wear : []), ...fresh])]
    updateMember({ pet: { got: st.unlocked, wear: nextWear } })
      .then(() => { if (got.length || st.unlocked.length === fresh.length) showToast(`✨ ${st.name}로 자랐어요! ${fresh.map((x) => WEAR_LABEL[x]).join('·')}가 생겼어요`) })
      .catch(() => {})
      .finally(() => { saving.current = false })
  }, [st.unlocked.join(','), member.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleWear(k) {
    const cur = wearing(member.pet, st.unlocked)
    const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]
    try { await updateMember({ pet: { got: st.unlocked, wear: next } }) } catch (e) { showToast(e.message) }
  }

  const size = 64 + st.stage * 6
  return (
    <section className="card mb-4 p-4">
      <div className="flex items-center gap-4">
        <div className="relative flex h-[100px] w-[100px] shrink-0 items-end justify-center">
          <span className="absolute bottom-1 h-3 w-16 rounded-full bg-line/70" aria-hidden="true" />
          <Blob i={member.avatar} size={size} wear={wear} className={ate ? 'pet-eat' : 'bob'} />
          {ate > 0 && <span className="pet-yum absolute -top-1 right-0 rounded-full bg-tang px-2 py-0.5 font-jua text-xs text-white">냠냠 +{ate}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-jua text-lg text-slate-deep">내 캐릭터 · <span className="text-tang">{st.name}</span></p>
          <p className="text-xs text-soft">지금까지 단어를 {st.food}번 맞혀서 먹었어요</p>
          {st.next ? (
            <>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-sage transition-all duration-700" style={{ width: `${st.pct}%` }} /></div>
              <p className="mt-1 text-[11px] text-soft"><span className="whitespace-nowrap">{st.toNext}번 더 맞히면</span> <span className="whitespace-nowrap">‘{st.next.name}’ · {WEAR_LABEL[st.next.unlock]}</span></p>
            </>
          ) : <p className="mt-2 text-xs text-sage">가장 크게 자랐어요! 👑</p>}
        </div>
      </div>
      {st.unlocked.length > 0 && (
        <div className="mt-3">
          <button className="text-sm text-slate underline" onClick={() => setOpen(!open)}>{open ? '꾸미기 닫기' : `꾸미기 (${st.unlocked.length}/${PET_STAGES.length - 1})`}</button>
          {open && (
            <div className="mt-2 flex flex-wrap gap-2">
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
          )}
        </div>
      )}
    </section>
  )
}
