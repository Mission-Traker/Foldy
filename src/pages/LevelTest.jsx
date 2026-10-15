import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App.jsx'
import { LEVELS, levelLabel, levelTestSet, recommendLevel } from '../lib/levels.js'
import { Blob, Header } from '../components/ui.jsx'
import { speak } from '../lib/speech.js'

export default function LevelTest() {
  const { member, updateMember, showToast } = useApp()
  const nav = useNavigate()
  const [set] = useState(() => levelTestSet(`${member.id}-${Date.now()}`))
  const [step, setStep] = useState(0)
  const [known, setKnown] = useState({})
  const [result, setResult] = useState(null)

  const group = set[step]
  const toggle = (w) => setKnown((k) => ({ ...k, [w]: !k[w] }))

  function next() {
    const results = set.slice(0, step + 1).map((g) => ({ level: g.level, known: g.words.filter((w) => known[w]).length }))
    const last = results[results.length - 1]
    // 이 단계에서 4개 미만이면 바로 끝, 아니면 다음 단계
    if (last.known < 4 || step === set.length - 1) setResult(recommendLevel(results))
    else setStep(step + 1)
  }

  async function apply() {
    try { await updateMember({ level: result }); showToast('레벨을 바꿨어요'); nav('/') } catch (e) { showToast(e.message) }
  }

  if (result) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <Blob i={member.avatar} size={100} className="pop" />
        <p className="text-soft">{member.name}에게 맞는 레벨은</p>
        <h2 className="h-title text-4xl">{levelLabel(result)}</h2>
        <p className="text-sm text-soft">{LEVELS.find((l) => l.id === result)?.desc}</p>
        <div className="mt-3 flex gap-2">
          <button className="btn-ghost" onClick={() => nav('/me')}>그대로 둘게요</button>
          <button className="btn-main" onClick={apply}>이 레벨로 바꾸기</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="레벨 진단" back="/me" right={<span className="font-jua text-soft">{step + 1}/{set.length}</span>} />
      <p className="mb-1 font-jua text-lg text-slate-deep">뜻을 아는 단어를 모두 눌러 주세요</p>
      <p className="mb-4 text-sm text-soft">{LEVELS.find((l) => l.id === group.level)?.label} 단어예요 · 5개 중 4개 이상 알면 다음 단계로</p>
      <div className="grid grid-cols-1 gap-2">
        {group.words.map((w) => (
          <button key={w} onClick={() => toggle(w)}
            className={`flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-left ${known[w] ? 'border-sage bg-sage/15' : 'border-line bg-paper'}`}>
            <span className="font-title text-2xl font-semibold">{w}</span>
            <span className="flex items-center gap-2">
              <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); speak(w) }} className="text-lg">🔊</span>
              <span className={`font-jua ${known[w] ? 'text-sage' : 'text-soft'}`}>{known[w] ? '알아요 ✓' : '몰라요'}</span>
            </span>
          </button>
        ))}
      </div>
      <button className="btn-main mt-5 w-full" onClick={next}>다음</button>
    </div>
  )
}
