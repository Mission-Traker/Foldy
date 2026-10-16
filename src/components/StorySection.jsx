import { useState } from 'react'
import { useApp } from '../App.jsx'
import { storyOn } from '../lib/enrich.js'

// 나만의 예문: 별명·좋아하는 것을 넣으면 AI 예문에 내 이야기가 나와요(직접 켠 사람만, 실명 대신 별명)
export default function StorySection() {
  const { member, updateMember, remakeStory, showToast, aiState } = useApp()
  const s = member.story || {}
  const [on, setOn] = useState(!!s.on)
  const [nick, setNick] = useState(s.nick || '')
  const [likes, setLikes] = useState(() => [...(s.likes || []), '', '', ''].slice(0, 3))
  const [busy, setBusy] = useState(false)
  const dirty = on !== !!s.on || nick.trim() !== (s.nick || '') || likes.map((x) => x.trim()).filter(Boolean).join('|') !== (s.likes || []).join('|')

  async function save() {
    const n = nick.trim().slice(0, 10)
    if (on && !n) return showToast('별명을 적어 주세요')
    try {
      await updateMember({ story: { on, nick: n, likes: likes.map((x) => x.trim().slice(0, 12)).filter(Boolean).slice(0, 3) } })
      showToast(on ? '저장했어요. 새 단어부터 내 이야기 예문이 나와요' : '나만의 예문을 껐어요')
    } catch (e) { showToast(e.message) }
  }
  async function remake() {
    setBusy(true)
    try { const n = await remakeStory(10); showToast(n ? `예문 ${n}개를 내 이야기로 바꿨어요` : '바꿀 단어가 없어요') } catch (e) { showToast(e.message) } finally { setBusy(false) }
  }

  return (
    <section className="card mb-4 p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="font-jua text-lg text-slate-deep">✨ 나만의 예문</h2>
        <label className="flex items-center gap-2 text-sm text-soft">
          <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-5 w-5 accent-[#3E5486]" aria-label="나만의 예문 켜기" /> 켜기
        </label>
      </div>
      <p className="mb-3 text-xs text-soft">예문에 내가 주인공으로 나와서 더 오래 기억나요. 실제 이름 대신 <b>별명</b>을 써 주세요. 별명과 좋아하는 것만 AI에 보내요.</p>
      {on && (
        <div className="space-y-2">
          <input className="field" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={10} placeholder="별명 (예: 콩이)" aria-label="별명" />
          <div className="grid grid-cols-3 gap-2">
            {likes.map((v, i) => (
              <input key={i} className="field !px-3 text-sm" value={v} maxLength={12} onChange={(e) => setLikes((l) => l.map((x, k) => (k === i ? e.target.value : x)))} placeholder={['축구', '고양이', '피아노'][i]} aria-label={`좋아하는 것 ${i + 1}`} />
            ))}
          </div>
          <p className="text-[11px] text-soft">좋아하는 것은 선택이에요(3개까지).</p>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button className="btn-main flex-1" disabled={!dirty} onClick={save}>저장</button>
        {storyOn(member) && <button className="btn-ghost flex-1" disabled={busy || aiState === 'nokey'} onClick={remake}>{busy ? '만드는 중…' : '최근 10개 다시 만들기'}</button>}
      </div>
    </section>
  )
}
