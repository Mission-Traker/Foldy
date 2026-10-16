import { useLayoutEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { STATUS_MARK } from '../lib/study.js'
import { speak } from '../lib/speech.js'
import { useApp } from '../App.jsx'

const COLORS = ['#E9954B', '#8DAE78', '#E08A7B', '#E3B23C', '#7E9AD0', '#C98BB9']
// 동글동글한 덩어리 모양(원 여러 개를 겹침)
const SHAPES = [
  [[50, 52, 30], [30, 40, 18], [70, 40, 18], [32, 66, 18], [68, 66, 18]],
  [[50, 55, 32], [50, 30, 20], [28, 45, 16], [72, 45, 16]],
  [[50, 50, 33], [26, 32, 14], [74, 32, 14], [26, 70, 14], [74, 70, 14], [50, 22, 14], [50, 80, 14]],
  [[50, 54, 31], [36, 32, 17], [64, 32, 17], [78, 58, 12], [22, 58, 12]],
]

// 캐릭터 꾸미기(공부해서 푼 것만) — 그림은 SVG로 캐릭터 위에 겹침
function Wear({ items = [] }) {
  const has = (k) => items.includes(k)
  return (
    <g aria-hidden="true">
      {has('scarf') && <g><path d="M24 70 Q50 80 76 70 L76 78 Q50 88 24 78 Z" fill="#E3B23C" /><path d="M64 76 L70 94 L61 93 L57 79 Z" fill="#E3B23C" /><path d="M30 74 Q50 82 70 74" stroke="#C99A2A" strokeWidth="2" fill="none" /></g>}
      {has('glasses') && <g fill="none" stroke="#2E2E3A" strokeWidth="2.6"><circle cx="40" cy="44" r="11.5" /><circle cx="60" cy="44" r="11.5" /><path d="M51.5 43 Q50 41 48.5 43" /></g>}
      {has('cap') && <g><path d="M27 30 Q30 8 52 8 Q72 9 74 30 Z" fill="#4F6EA8" /><path d="M24 30 L82 30 Q90 31 92 35 L24 35 Z" fill="#3E5486" /><circle cx="51" cy="9" r="3" fill="#E9954B" /></g>}
      {has('crown') && <g><path d="M30 26 L32 8 L42 18 L50 4 L58 18 L68 8 L70 26 Z" fill="#E3B23C" stroke="#C99A2A" strokeWidth="1.5" /><circle cx="50" cy="16" r="2.6" fill="#E08A7B" /><circle cx="38" cy="20" r="2" fill="#8DAE78" /><circle cx="62" cy="20" r="2" fill="#7E9AD0" /></g>}
      {has('ribbon') && !has('crown') && !has('cap') && <g transform="translate(66 14) rotate(18)"><path d="M0 0 L-12 -8 L-12 8 Z" fill="#E08A7B" /><path d="M0 0 L12 -8 L12 8 Z" fill="#E08A7B" /><circle r="3.6" fill="#C96F60" /></g>}
    </g>
  )
}

export function Blob({ i = 0, size = 64, look = 'up', className = '', wear }) {
  const color = COLORS[i % COLORS.length]
  const shape = SHAPES[Math.floor(i / 1) % SHAPES.length]
  const dx = look === 'left' ? -3 : 3
  const dy = look === 'down' ? 3 : -3
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true" style={{ overflow: 'visible' }}>
      <g fill={color}>{shape.map(([cx, cy, r], k) => <circle key={k} cx={cx} cy={cy} r={r} />)}</g>
      <circle cx="40" cy="44" r="9" fill="#fff" />
      <circle cx="60" cy="44" r="9" fill="#fff" />
      <circle cx={40 + dx} cy={44 + dy} r="4.5" fill="#2E2E3A" />
      <circle cx={60 + dx} cy={44 + dy} r="4.5" fill="#2E2E3A" />
      {Array.isArray(wear) && wear.length > 0 && <Wear items={wear} />}
    </svg>
  )
}

// 배경 장식(첨부 디자인처럼 흩어진 도형)
export function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-12 top-28 h-28 w-28 rounded-full bg-sage/10" />
      <div className="absolute right-[-36px] top-10 h-24 w-24 rotate-12 rounded-3xl bg-mustard/10" />
    </div>
  )
}

const MARK_STYLE = {
  o: 'text-sage border-sage bg-sage/10',
  t: 'text-mustard border-mustard bg-mustard/10',
  x: 'text-coral border-coral bg-coral/10',
}
export function Mark({ s, className = '' }) {
  return (
    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 font-jua text-base leading-none ${MARK_STYLE[s]} ${className}`}>
      {STATUS_MARK[s]}
    </span>
  )
}

export function Speak({ text, className = '', label = '듣기', size = 'md' }) {
  const s = size === 'sm' ? 'h-8 w-8 text-sm' : 'h-10 w-10 text-lg'
  return (
    <button type="button" aria-label={`${text} ${label}`} onClick={(e) => { e.stopPropagation(); speak(text) }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-slate/10 text-slate-deep active:scale-95 ${s} ${className}`}>
      🔊
    </button>
  )
}

export function ProfileButton({ size = 40 }) {
  const app = useApp()
  if (!app?.member) return null
  return (
    <button onClick={app.openProfile} aria-label="내 프로필" className="relative shrink-0 rounded-full bg-paper border-2 border-line p-0.5 active:scale-95">
      <Blob i={app.member.avatar} size={size - 6} />
      {app.member.has_pin && <span className="absolute -bottom-1 -right-1 text-[11px]">🔒</span>}
    </button>
  )
}

export function Header({ title, back, right, noProfile }) {
  const nav = useNavigate()
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-3 flex items-center gap-2 bg-cream/95 px-4 pb-2 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur">
      {back && (
        <button onClick={() => (typeof back === 'function' ? back() : typeof back === 'string' ? nav(back) : window.history.state?.idx > 0 ? nav(-1) : nav('/'))} aria-label="뒤로"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-paper border-2 border-line text-slate-deep font-jua">←</button>
      )}
      <h1 className="h-title min-w-0 flex-1 text-2xl leading-tight">{title}</h1>
      {right}
      {!noProfile && <ProfileButton />}
    </div>
  )
}

const TABS = [
  { to: '/', label: '홈', icon: '🏠' },
  { to: '/book', label: '단어장', icon: '📒' },
  { to: '/study', label: '학습', icon: '✏️' },
  { to: '/wrong', label: '오답노트', icon: '📌' },
  { to: '/me', label: '내 정보', icon: '🙂' },
]
export function BottomNav({ wrongCount = 0 }) {
  return (
    <nav className="safe-b fixed inset-x-0 bottom-0 z-30 border-t-2 border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}
            className={({ isActive }) => `relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1 text-[12px] font-jua ${isActive ? 'text-slate-deep' : 'text-soft'}`}>
            {({ isActive }) => (
              <>
                <span className={`text-xl transition ${isActive ? 'scale-110' : 'opacity-70'}`}>{t.icon}</span>
                {t.label}
                {t.to === '/wrong' && wrongCount > 0 && (
                  <span className="absolute right-[22%] top-1 rounded-full bg-coral px-1.5 text-[10px] text-white">{wrongCount}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function Empty({ title, desc, children, i = 1 }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-8 text-center">
      <Blob i={i} size={72} className="bob" />
      <p className="font-jua text-lg text-slate-deep">{title}</p>
      {desc && <p className="text-sm text-soft">{desc}</p>}
      {children}
    </div>
  )
}

export function Toast({ msg }) {
  if (!msg) return null
  return (
    <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-6">
      <div className="pop rounded-full bg-ink/90 px-4 py-2 text-center text-sm text-white shadow-lg">{msg}</div>
    </div>
  )
}

export function Ring({ value, max, size = 64, color = '#8DAE78', track = '#E7DCC9', text = '#3E5486' }) {
  const r = 26
  const c = 2 * Math.PI * r
  const p = Math.min(1, max ? value / max : 0)
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-label={`${value}/${max}`}>
      <circle cx="32" cy="32" r={r} fill="none" stroke={track} strokeWidth="8" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 32 32)" />
      <text x="32" y="37" textAnchor="middle" fontFamily="Jua" fontSize="15" fill={text}>{value}/{max}</text>
    </svg>
  )
}

export function fmtDate(iso) {
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// 정답·오답 반응 캐릭터 + 색종이
const BURST = ['#E9954B', '#8DAE78', '#E08A7B', '#E3B23C', '#7E9AD0', '#C98BB9']
export function Reaction({ kind, k }) {
  if (!kind) return null
  const ok = kind === 'ok'
  return (
    <div key={k} className="pointer-events-none absolute inset-0 z-10 overflow-visible" aria-hidden="true">
      {ok && Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2
        const dist = 90 + (i % 3) * 30
        return (
          <span key={i} className="burst absolute left-1/2 top-1/2"
            style={{
              '--tx': `${Math.cos(a) * dist}px`, '--ty': `${Math.sin(a) * dist - 20}px`, '--rot': `${i * 47}deg`,
              background: BURST[i % BURST.length], width: i % 2 ? 10 : 14, height: i % 2 ? 10 : 6,
              borderRadius: i % 3 === 0 ? '50%' : '3px', animationDelay: `${(i % 4) * 15}ms`,
            }} />
        )
      })}
      <div className={`absolute -top-9 right-3 ${ok ? 'hop' : 'shake'}`}>
        <svg viewBox="0 0 100 100" width="66" height="66">
          <g fill={ok ? '#8DAE78' : '#E08A7B'}>
            <circle cx="50" cy="55" r="30" /><circle cx="30" cy="42" r="17" /><circle cx="70" cy="42" r="17" /><circle cx="50" cy="30" r="16" />
          </g>
          {ok ? (
            <g stroke="#2E2E3A" strokeWidth="5" fill="none" strokeLinecap="round">
              <path d="M32 48 q8 -10 16 0" /><path d="M54 48 q8 -10 16 0" /><path d="M40 62 q10 10 20 0" />
            </g>
          ) : (
            <g stroke="#2E2E3A" strokeWidth="5" strokeLinecap="round">
              <path d="M34 42 l10 10 M44 42 l-10 10" /><path d="M56 42 l10 10 M66 42 l-10 10" />
              <path d="M42 68 q8 -7 16 0" fill="none" />
            </g>
          )}
          {!ok && <path d="M80 26 q6 10 0 14 q-6 -4 0 -14z" fill="#7E9AD0" />}
        </svg>
      </div>
    </div>
  )
}

// 긴 영어 단어도 잘리지 않게: 글자 수에 따라 크기를 줄이고 줄바꿈 허용
export function fitWord(word, sizes = ['text-[19px]', 'text-[16px]', 'text-[14px]', 'text-[12.5px]']) {
  const n = String(word || '').length
  return n <= 9 ? sizes[0] : n <= 12 ? sizes[1] : n <= 16 ? sizes[2] : sizes[sizes.length - 1]
}

// 영어 단어를 절대 중간에서 자르지 않고, 칸에 들어갈 때까지 글자를 줄여서 보여줌(띄어쓰기 있는 구는 띄어쓰기에서만 줄바꿈)
export function FitWord({ text, max = 19, min = 11, className = '', as: Tag = 'span' }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      let size = max
      el.style.fontSize = size + 'px'
      while (size > min && el.scrollWidth > el.clientWidth + 0.5) { size -= 1; el.style.fontSize = size + 'px' }
    }
    fit()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
    if (ro && el.parentElement) ro.observe(el.parentElement)
    if (document.fonts?.ready) document.fonts.ready.then(fit).catch(() => {})
    return () => ro?.disconnect()
  }, [text, max, min])
  return <Tag ref={ref} className={`block max-w-full ${className}`} style={{ fontSize: max, overflowWrap: 'normal', wordBreak: 'normal' }}>{text}</Tag>
}

// 하루 목표 개수 정하기(1~50)
export function GoalStepper({ value, onChange, min = 1, max = 50 }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, v)))
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="목표 줄이기" onClick={() => set(value - 1)} disabled={value <= min}
        className="h-10 w-10 rounded-full border-2 border-line bg-paper font-jua text-xl text-slate-deep active:scale-95 disabled:opacity-40">−</button>
      <span className="w-14 text-center font-jua text-2xl text-slate-deep" aria-live="polite">{value}개</span>
      <button type="button" aria-label="목표 늘리기" onClick={() => set(value + 1)} disabled={value >= max}
        className="h-10 w-10 rounded-full border-2 border-line bg-paper font-jua text-xl text-slate-deep active:scale-95 disabled:opacity-40">＋</button>
    </div>
  )
}
