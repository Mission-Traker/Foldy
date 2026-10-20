import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as db from '../lib/db.js'
import { PetArt } from './PetArt.jsx'
import { MOOD_TEXT, petMood, ticketTotal } from '../lib/familyPet.js'

// 홈의 '우리 가족 펫' 줄: 기분 + 지금 쓸 수 있는 돌봄권 수
export default function FamilyPetCard({ memberId, refreshKey }) {
  const [st, setSt] = useState(undefined)
  useEffect(() => {
    let on = true
    db.petGet(memberId).then((r) => on && setSt(r)).catch(() => on && setSt(null))
    return () => { on = false }
  }, [memberId, refreshKey])
  if (st === undefined || st === null) return null
  const p = st.pet
  const n = ticketTotal(st.tickets)
  return (
    <Link to="/pet" className="mb-4 flex items-center gap-3 rounded-3xl border border-line bg-paper p-3 active:scale-[.99]" aria-label="우리 가족 펫">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sage/15">
        {p ? <PetArt species={p.species} mood={petMood(p)} size={48} /> : <span className="text-3xl" aria-hidden="true">🐾</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-jua text-slate-deep">{p ? `우리 가족 펫 ${p.name}` : '우리 가족 펫을 데려와요'}</span>
        <span className="block break-keep text-xs text-soft">{p ? MOOD_TEXT[petMood(p)] : '가족이 함께 공부해서 함께 키워요'}</span>
      </span>
      {p && n > 0 ? <span className="shrink-0 rounded-full bg-tang px-2.5 py-1 font-jua text-xs text-white">돌봄권 {n}</span> : <span className="shrink-0 text-soft">›</span>}
    </Link>
  )
}
