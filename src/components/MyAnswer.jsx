import { spellDiff } from '../lib/grading.js'

// 틀렸을 때 '내가 쓴 답' — 철자 문제는 틀린 글자(빨강)·빠진 글자(_) 표시
export default function MyAnswer({ input, word, mode }) {
  const t = String(input || '').trim()
  if (!t) return null
  // 거의 맞힌 철자만 글자별로 표시(아주 다른 답은 그냥 빨간 글씨로)
  const d = mode === 'en' ? spellDiff(t, word) : null
  const close = d && d.filter((c) => c.ok).length >= Math.ceil(String(word).length / 2)
  return (
    <p className="max-w-full break-words text-sm text-soft">
      내가 쓴 답: {close
        ? <b className="font-title text-lg tracking-wide">{d.map((c, i) => (
          <span key={i} className={c.ok ? 'text-ink' : c.miss ? 'text-coral/70' : 'text-coral underline decoration-2 underline-offset-4'}>{c.ch}</span>
        ))}</b>
        : <b className={mode === 'en' ? 'font-title text-lg text-coral' : 'font-jua text-base text-coral'}>{t}</b>}
    </p>
  )
}
