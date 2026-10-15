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

export function Blob({ i = 0, size = 64, look = 'up', className = '' }) {
  const color = COLORS[i % COLORS.length]
  const shape = SHAPES[Math.floor(i / 1) % SHAPES.length]
  const dx = look === 'left' ? -3 : 3
  const dy = look === 'down' ? 3 : -3
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      <g fill={color}>{shape.map(([cx, cy, r], k) => <circle key={k} cx={cx} cy={cy} r={r} />)}</g>
      <circle cx="40" cy="44" r="9" fill="#fff" />
      <circle cx="60" cy="44" r="9" fill="#fff" />
      <circle cx={40 + dx} cy={44 + dy} r="4.5" fill="#2E2E3A" />
      <circle cx={60 + dx} cy={44 + dy} r="4.5" fill="#2E2E3A" />
    </svg>
  )
}

// 배경 장식(첨부 디자인처럼 흩어진 도형)
export function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-10 top-24 h-24 w-24 rounded-full bg-sage/25" />
      <div className="absolute right-[-30px] top-10 h-20 w-20 rotate-12 rounded-2xl bg-mustard/25" />
      <div className="absolute left-8 bottom-40 h-4 w-4 rounded-full bg-coral/50" />
      <div className="absolute right-10 bottom-64 h-3 w-3 rounded-full bg-tang/60" />
      <div className="absolute right-16 top-48 h-3 w-3 rounded-full bg-sage/60" />
      <div className="absolute left-1/2 top-6 h-0 w-0 border-x-[18px] border-b-[30px] border-x-transparent border-b-coral/25" />
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
        <button onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))} aria-label="뒤로"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-paper border-2 border-line text-slate-deep font-jua">←</button>
      )}
      <h1 className="h-title flex-1 truncate text-2xl">{title}</h1>
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

export function Ring({ value, max, size = 64, color = '#8DAE78' }) {
  const r = 26
  const c = 2 * Math.PI * r
  const p = Math.min(1, max ? value / max : 0)
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-label={`${value}/${max}`}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="#E7DCC9" strokeWidth="8" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 32 32)" />
      <text x="32" y="37" textAnchor="middle" fontFamily="Jua" fontSize="15" fill="#3E5486">{value}/{max}</text>
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
