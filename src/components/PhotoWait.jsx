import { useEffect, useState } from 'react'
import { Blob } from './ui.jsx'
import { tap } from '../lib/sfx.js'

const TIPS = [
  '단어는 하루에 5개씩만 외워도 한 달이면 150개예요',
  '가림판을 탭해서 정답을 확인해 보세요',
  '뜻과 철자를 모두 맞히면 ○가 붙어요',
  '틀린 단어는 오답노트에서 다시 만나요',
  '○ 단어는 유의어·반의어를 맞히면 예문이 열려요',
  '캐릭터를 톡 누르면 점프해요!',
]

// 사진을 읽는 동안 보여주는 대기 화면(이탈 방지)
export default function PhotoWait({ index, total, found, stage, ocrProgress }) {
  const [tip, setTip] = useState(0)
  const [jump, setJump] = useState(-1)
  const [sec, setSec] = useState(0)
  useEffect(() => {
    const a = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 3200)
    const b = setInterval(() => setSec((s) => s + 1), 1000)
    return () => { clearInterval(a); clearInterval(b) }
  }, [])
  useEffect(() => { setSec(0) }, [index, stage])
  const pct = Math.round(((index + (ocrProgress || Math.min(0.9, sec / 25))) / total) * 100)
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-cream/95 px-6 backdrop-blur" role="status" aria-live="polite">
      <div className="mb-6 flex items-end gap-2">
        {[0, 1, 3, 2].map((i, k) => (
          <button key={i} type="button" aria-label="캐릭터" onClick={() => { tap(); setJump(k); setTimeout(() => setJump(-1), 600) }}
            className={`wait-bob ${jump === k ? 'hop' : ''}`} style={{ animationDelay: `${k * 0.18}s` }}>
            <Blob i={i} size={k === 1 ? 74 : 58} look={k % 2 ? 'left' : 'up'} />
          </button>
        ))}
      </div>
      <h2 className="h-title mb-1 text-center text-2xl">
        {stage === 'ocr' ? '기기에서 글자를 읽는 중…' : stage === 'convert' ? '사진을 준비하는 중…' : '사진 속 단어를 찾는 중…'}
      </h2>
      <p className="mb-4 font-jua text-slate-deep">
        {total > 1 ? `사진 ${index + 1} / ${total}` : '잠시만 기다려 주세요'}{found > 0 ? ` · 지금까지 ${found}개 찾음` : ''}
      </p>
      <div className="mb-5 h-4 w-full max-w-xs overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-gradient-to-r from-tang via-mustard to-sage transition-all duration-700" style={{ width: `${Math.max(6, Math.min(99, pct))}%` }} />
      </div>
      <p key={tip} className="pop max-w-xs text-center text-sm text-soft">💡 {TIPS[tip]}</p>
      {stage === 'ai' && sec > 20 && <p className="mt-3 break-keep text-center text-xs text-soft">AI가 조금 붐벼요. 길어도 1분 안에 끝나요</p>}
    </div>
  )
}
