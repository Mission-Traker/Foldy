import { useState } from 'react'
import { useApp } from '../App.jsx'
import { track } from '../lib/track.js'

// 오늘의 단어 바꾸기: '이미 알아요'(○로 표시하고 교체) 또는 '그냥 다른 단어로'
export default function SwapWord({ w, onClose, onSwapped }) {
  const { swapToday, showToast } = useApp()
  const [busy, setBusy] = useState(false)
  async function go(known) {
    if (busy) return
    setBusy(true)
    try {
      const n = await swapToday(w.id, known)
      if (!n) { showToast('바꿀 새 단어가 없어요. 단어장에 단어를 더 넣어 주세요'); onClose(); return }
      track('swap_word', { kind: known ? 'known' : 'other' })
      showToast(known ? `‘${w.word}’ ○ 표시 · ‘${n.word}’로 바꿨어요` : `‘${n.word}’로 바꿨어요`)
      onSwapped?.(n)
      onClose()
    } catch (e) { showToast(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30" onClick={onClose} role="dialog" aria-modal="true" aria-label="다른 단어로 바꾸기">
      <div className="safe-b w-full max-w-md rounded-t-3xl bg-paper p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
        <p className="mb-1 text-center font-jua text-lg text-slate-deep">‘{w.word}’ 바꾸기</p>
        <p className="mb-4 break-keep text-center text-sm text-soft">오늘의 단어에서 빼고 아직 모르는 단어로 바꿔요</p>
        <button disabled={busy} onClick={() => go(true)} className="btn-main mb-2 w-full">✅ 이미 알아요 · ○ 표시하고 바꾸기</button>
        <button disabled={busy} onClick={() => go(false)} className="btn-ghost mb-2 w-full">🔄 그냥 다른 단어로 바꾸기</button>
        <button onClick={onClose} className="mx-auto block py-2 text-sm text-soft">취소</button>
      </div>
    </div>
  )
}
