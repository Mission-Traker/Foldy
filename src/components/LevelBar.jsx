import { useEffect, useRef, useState } from 'react'
import { levelProgress } from '../lib/levels.js'
import { fanfare } from '../lib/sfx.js'

// 게임 같은 레벨업 게이지 — 프로필 바로 밑. 퀴즈를 통과할 때마다 차오르고, 다 차면 레벨업 버튼
export default function LevelBar({ member, words, onLevelUp }) {
  const p = levelProgress(words, member.level)
  const pct = p.next ? Math.round((p.xp / p.need) * 100) : 100
  const key = `foldy.xp.${member.id}.${p.id}`
  const [shown, setShown] = useState(() => { try { const v = Number(localStorage.getItem(key)); return Number.isFinite(v) && v <= p.xp ? v : p.xp } catch { return p.xp } })
  const [gain, setGain] = useState(0)
  const first = useRef(true)
  useEffect(() => {
    // 홈으로 돌아왔을 때 지난번보다 오른 만큼 차오르는 모습 + '+N XP'
    const from = shown
    if (p.xp > from) {
      setGain(p.xp - from)
      const t = setTimeout(() => setShown(p.xp), first.current ? 350 : 50)
      const t2 = setTimeout(() => setGain(0), 1900)
      first.current = false
      try { localStorage.setItem(key, String(p.xp)) } catch { /* */ }
      return () => { clearTimeout(t); clearTimeout(t2) }
    }
    setShown(p.xp)
    try { localStorage.setItem(key, String(p.xp)) } catch { /* */ }
    first.current = false
  }, [p.xp, key]) // eslint-disable-line react-hooks/exhaustive-deps

  const shownPct = p.next ? Math.min(100, Math.round((shown / p.need) * 100)) : 100
  const leftWords = Math.max(0, Math.ceil((p.need - p.xp) / 3))
  async function up() {
    try { await onLevelUp(p.next); fanfare() } catch { /* 토스트는 부모가 */ }
  }
  return (
    <div className="mb-4" aria-label={`레벨 ${p.label}, 경험치 ${p.xp}/${p.need}`}>
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-lg bg-slate-deep px-2 py-0.5 font-title text-sm font-semibold text-white shadow-[0_2px_0_#2c3d63]">{p.label}</span>
        <div className="relative h-4 min-w-0 flex-1 overflow-hidden rounded-full border-2 border-line bg-paper" role="progressbar" aria-valuemin={0} aria-valuemax={p.need} aria-valuenow={p.xp}>
          <div className={`xpfill h-full rounded-full ${p.full ? 'xpfull' : ''}`} style={{ width: `${shownPct}%` }} />
          {gain > 0 && <span className="xpgain absolute right-1 top-1/2 -translate-y-1/2 font-title text-[11px] font-bold text-tang">+{gain} XP</span>}
        </div>
        <span className="shrink-0 font-title text-xs tabular-nums text-soft">{p.next ? `${p.xp}/${p.need}` : 'MAX'}</span>
      </div>
      {p.full ? (
        <button onClick={up} className="lvup mt-2 w-full rounded-2xl bg-tang py-2 font-jua text-base text-white shadow-[0_3px_0_#c4762f]">⬆ {p.nextLabel}로 레벨업!</button>
      ) : (
        <p className="mt-1 text-[11px] text-soft">{p.next ? <>퀴즈 하나 맞히면 1 XP · <span className="whitespace-nowrap">{p.nextLabel}까지 ○ 단어 {leftWords}개</span></> : '가장 높은 레벨이에요'}</p>
      )}
    </div>
  )
}
