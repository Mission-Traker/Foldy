import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App.jsx'
import { dailyPick } from '../lib/levels.js'
import { meaningsFor } from '../lib/enrich.js'
import { ymd } from '../lib/study.js'
import { track } from '../lib/track.js'

export const STARTER_N = 5
const skipKey = (id) => 'foldy.starterSkip.' + id

// 단어가 하나도 없을 때: 내 레벨 추천 단어 5개를 담고 곧바로 '오늘의 한 판' 시작
export function useQuickStart() {
  const { member, words, addWords, showToast } = useApp()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  async function start(where) {
    if (busy) return
    setBusy(true)
    try {
      const owned = new Set(words.map((w) => w.word.toLowerCase()))
      const picks = dailyPick(member.level, owned, `${member.id}-start-${ymd()}`, STARTER_N)
      const items = (await meaningsFor(picks, member.level)).filter((x) => x.meaning)
      if (!items.length) { showToast('추천 단어를 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요'); return }
      await addWords(items.map((x) => ({ word: x.word, meaning: x.meaning })), 'recommend')
      track('first_start', { kind: where, n: items.length })
      nav('/quiz/daily?start=1')
    } catch (e) { showToast(e.message) } finally { setBusy(false) }
  }
  return { start, busy }
}

export function QuickStartButton({ where, className = 'btn-main mt-2 w-full max-w-xs' }) {
  const { start, busy } = useQuickStart()
  return (
    <button type="button" className={className} disabled={busy} onClick={() => start(where)}>
      {busy ? '단어 담는 중…' : `⚡ 추천 단어 ${STARTER_N}개로 바로 시작`}
    </button>
  )
}

// 구성원을 막 만들고 단어가 0개일 때 홈에서 한 번 띄우는 시작 안내
export function StarterSheet() {
  const { member, words } = useApp()
  const nav = useNavigate()
  const { start, busy } = useQuickStart()
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(skipKey(member.id)) === '1' || localStorage.getItem('foldy.noStarter') === '1' } catch { return false } })
  if (hidden || words.length > 0) return null
  const skip = () => { setHidden(true); try { localStorage.setItem(skipKey(member.id), '1') } catch { /* */ } }
  return (
    <div className="fixed inset-0 z-[57] flex items-end justify-center bg-ink/40 px-3 pb-[max(env(safe-area-inset-bottom),12px)]" role="dialog" aria-modal="true" aria-label="바로 시작하기">
      <div className="pop w-full max-w-md rounded-3xl bg-paper p-5 shadow-pop">
        <p className="font-jua text-xl text-slate-deep">{member.name}, 바로 시작해 볼까요?</p>
        <p className="mt-1 break-keep text-sm text-ink/80">내 레벨에 맞는 추천 단어 {STARTER_N}개를 담고 첫 퀴즈를 바로 풀어요. 1~2분이면 끝나요.</p>
        <button className="btn-main mt-4 w-full py-4 text-lg" disabled={busy} onClick={() => start('sheet')}>{busy ? '단어 담는 중…' : `⚡ 추천 단어 ${STARTER_N}개로 바로 시작`}</button>
        <button className="btn-ghost mt-2 w-full" disabled={busy} onClick={() => { skip(); nav('/add?tab=photo') }}>📷 내 교재 단어부터 넣을래요</button>
        <button className="mt-2 w-full py-2 text-sm text-soft" onClick={skip}>나중에 할게요</button>
      </div>
    </div>
  )
}
