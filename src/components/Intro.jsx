import { useEffect, useRef, useState } from 'react'
import { Blob } from './ui.jsx'
import { tap } from '../lib/sfx.js'

// 처음 접속하면 뜨는 소개 슬라이드 — 아이콘 3개가 하나씩 나오며 주요 기능을 알려 주고, 마지막에 '폴디 시작하기'
const KEY = 'foldy.introSeen'
export const introSeen = () => { try { return localStorage.getItem(KEY) === '1' } catch { return true } }
const markSeen = () => { try { localStorage.setItem(KEY, '1') } catch { /* 저장 불가 */ } }

const SLIDES = [
  { tone: 'bg-slate/10', icons: [['blob0', '나'], ['blob1', '엄마·아빠'], ['blob2', '동생']], title: '안녕, 나는 폴디!',
    text: '가족이 함께 쓰는 접어서 외우는 영어 단어장이에요. 초등 1학년부터 어른까지, 교육부 기본 어휘로 레벨을 맞춰요.' },
  { tone: 'bg-tang/15', icons: [['📷', '사진 찍기'], ['✨', 'AI가 읽기'], ['📒', '단어장에 쏙']], title: '사진 한 장이면 단어가 한꺼번에',
    text: '교재·프린트를 찍으면 영어와 뜻을 읽어서 넣어 줘요. 한글이나 영어로 검색해서 하나씩 담을 수도 있어요.' },
  { tone: 'bg-mustard/20', icons: [['🙈', '가리고'], ['📒', '여러 개 한 번에'], ['👀', '탭해서 확인']], title: '접어서 외우는 단어장',
    text: '수첩처럼 뜻을 가림판으로 가리고 외워요. 단어 옆 🔊를 누르면 발음이 나와요.' },
  { tone: 'bg-sage/20', icons: [['🔤', '뜻'], ['✏️', '철자'], ['🎤', '발음']], title: '세 가지 퀴즈로 ○ 만들기',
    text: '뜻·철자·발음을 모두 맞히면 그 단어에 ○가 붙어요. 통과한 단계는 단어장에 색으로 표시돼요.' },
  { tone: 'bg-coral/15', icons: [['🔊', '아나운서 발음'], ['🐢', '천천히 듣기'], ['🎯', '70%면 통과']], title: '또박또박 발음 연습',
    text: '기본 어휘는 아나운서 목소리로 들려줘요. 내 발음이 70% 이상 비슷하면 통과, 어려우면 요령도 알려 줘요.' },
  { tone: 'bg-slate/10', icons: [['📌', '오답노트'], ['🔁', '한 번 더'], ['⏰', '복습 알림']], title: '틀린 단어는 다시, 외운 단어는 오래',
    text: '틀린 단어는 오답노트에서 다시 풀고, ○ 단어는 1·3·7·30일 뒤에 다시 물어봐요.' },
  { tone: 'bg-sage/20', icons: [['🌱', '○ 단어'], ['↔️', '유의어·반의어'], ['💬', '예문 열기']], title: '○ 다음엔 확장 학습',
    text: '외운 단어로 비슷한 말·반대말 퀴즈를 풀면 영어·한글 예문과 장면이 단어장에 열려요.' },
  { tone: 'bg-tang/15', icons: [['👨‍👩‍👧', '가족 단어장'], ['🔒', '내 비밀번호'], ['🔥', '연속 학습일']], title: '가족이 함께 자라요',
    text: '한 아이디로 가족이 함께 써요. 내 단어장은 비밀번호로 지키고, 서로의 학습현황을 보며 응원해요.' },
]

function Icon({ v, size }) {
  if (v.startsWith('blob')) return <Blob i={Number(v.slice(4))} size={size} />
  return <span style={{ fontSize: size * 0.55 }} aria-hidden="true">{v}</span>
}

export default function Intro({ onDone }) {
  const [i, setI] = useState(0)
  const touch = useRef(null)
  const s = SLIDES[i]
  const last = i === SLIDES.length - 1

  const go = (n) => { if (n < 0 || n >= SLIDES.length) return; tap(); setI(n) }
  const finish = () => { markSeen(); onDone() }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, SLIDES.length - 1))
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div role="dialog" aria-modal="true" aria-label="폴디 소개" className="fixed inset-0 z-[60] overflow-y-auto bg-cream"
      onTouchStart={(e) => { touch.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (touch.current == null) return
        const dx = e.changedTouches[0].clientX - touch.current
        touch.current = null
        if (dx < -50) go(i + 1)
        else if (dx > 50) go(i - 1)
      }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-10 top-20 h-28 w-28 rounded-full bg-sage/25" />
        <div className="absolute right-[-24px] top-8 h-20 w-20 rotate-12 rounded-2xl bg-mustard/25" />
        <div className="absolute bottom-40 left-6 h-4 w-4 rounded-full bg-coral/50" />
        <div className="absolute bottom-60 right-10 h-3 w-3 rounded-full bg-tang/60" />
      </div>

      <div className="safe-b relative mx-auto flex min-h-full max-w-md flex-col px-6 pt-[max(env(safe-area-inset-top),20px)]">
        <div className="flex items-center justify-between py-2">
          <span className="font-title text-xl font-bold text-slate-deep">Foldy</span>
          <span className="font-jua text-sm text-soft">{i + 1} / {SLIDES.length}</span>
        </div>

        <div key={i} className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <div className={`mb-8 flex w-full items-start justify-center gap-1 rounded-[2rem] px-2 py-7 ${s.tone}`}>
            {s.icons.map(([v, label], k) => (
              <div key={k} className="flex items-start">
                {k > 0 && <span className="intro-arrow mt-7 px-0.5 font-jua text-lg text-soft/60" style={{ animationDelay: `${k * 0.35}s` }}>›</span>}
                <div className="intro-ic flex w-[84px] flex-col items-center" style={{ animationDelay: `${k * 0.35}s` }}>
                  <div className="flex h-[72px] w-[72px] items-center justify-center rounded-3xl border-2 border-line bg-paper shadow-card">
                    <Icon v={v} size={i === 0 ? 62 : 64} />
                  </div>
                  <span className="mt-2 font-jua text-[13px] leading-tight text-slate-deep">{label}</span>
                </div>
              </div>
            ))}
          </div>
          <h2 className="intro-rise mb-3 break-keep font-jua text-[26px] leading-snug text-slate-deep" style={{ animationDelay: '1.05s' }}>{s.title}</h2>
          <p className="intro-rise max-w-xs break-keep text-[16px] leading-relaxed text-ink/80" style={{ animationDelay: '1.25s' }}>{s.text}</p>
        </div>

        <div className="mb-5 flex justify-center gap-1.5" aria-hidden="true">
          {SLIDES.map((_, k) => (
            <span key={k} className={`h-2 rounded-full transition-all ${k === i ? 'w-6 bg-slate-deep' : k < i ? 'w-2 bg-slate/50' : 'w-2 bg-line'}`} />
          ))}
        </div>

        <div className="mb-4 flex gap-2">
          {i > 0 && <button className="btn-ghost px-5" onClick={() => go(i - 1)} aria-label="이전">←</button>}
          {last
            ? <button className="btn-main flex-1 py-4 text-lg" onClick={finish}>폴디 시작하기</button>
            : <button className="btn-main flex-1 py-4 text-lg" onClick={() => go(i + 1)}>다음</button>}
        </div>
      </div>
    </div>
  )
}
