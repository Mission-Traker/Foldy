// 가족 펫 그림 — 지금 캐릭터(동글동글한 원 덩어리 + 큰 흰 눈)와 같은 그림체에 입체감(빛·그늘·광택·그림자)
// mood: happy(신남) · ok(좋음) · bored(심심) · sleepy(졸림) — 아프거나 죽지 않음
import { useId } from 'react'

// 색 섞기(입체 그늘·빛)
function mix(hex, to, t) {
  const a = hex.replace('#', ''), b = to.replace('#', '')
  const n = (h, i) => parseInt(h.slice(i, i + 2), 16)
  const c = [0, 2, 4].map((i) => Math.round(n(a, i) + (n(b, i) - n(a, i)) * t))
  return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('')
}
export const SPECIES = [
  { key: 'dog', name: '강아지', color: '#E9954B', dark: '#C9773A' },
  { key: 'cat', name: '고양이', color: '#7E9AD0', dark: '#5F7DB5' },
  { key: 'bird', name: '새', color: '#8DAE78', dark: '#6F9160' },
  { key: 'pig', name: '돼지', color: '#EFA59B', dark: '#D9837A' },
  { key: 'rabbit', name: '토끼', color: '#C98BB9', dark: '#AE6E9E' },
  { key: 'hamster', name: '햄스터', color: '#E3B23C', dark: '#C4962A' },
]
export const speciesOf = (k) => SPECIES.find((s) => s.key === k) || SPECIES[0]

function Ears({ k, c, d }) {
  if (k === 'dog') return <g fill={d}><ellipse cx="22" cy="44" rx="10" ry="20" transform="rotate(18 22 44)" /><ellipse cx="78" cy="44" rx="10" ry="20" transform="rotate(-18 78 44)" /></g>
  if (k === 'cat') return <g fill={c}><path d="M20 38 L24 10 L44 28 Z" /><path d="M80 38 L76 10 L56 28 Z" /><path d="M26 30 L27 18 L36 27 Z" fill="#F4ECDF" opacity=".7" /><path d="M74 30 L73 18 L64 27 Z" fill="#F4ECDF" opacity=".7" /></g>
  if (k === 'rabbit') return <g fill={c}><ellipse cx="36" cy="14" rx="8" ry="22" transform="rotate(-8 36 14)" /><ellipse cx="64" cy="14" rx="8" ry="22" transform="rotate(8 64 14)" /><ellipse cx="36" cy="15" rx="3.5" ry="15" transform="rotate(-8 36 15)" fill="#F4ECDF" opacity=".7" /><ellipse cx="64" cy="15" rx="3.5" ry="15" transform="rotate(8 64 15)" fill="#F4ECDF" opacity=".7" /></g>
  if (k === 'pig') return <g fill={d}><path d="M24 30 L30 12 L42 26 Z" /><path d="M76 30 L70 12 L58 26 Z" /></g>
  if (k === 'hamster') return <g fill={c}><circle cx="27" cy="28" r="9" /><circle cx="73" cy="28" r="9" /><circle cx="27" cy="28" r="4.5" fill="#E08A7B" opacity=".55" /><circle cx="73" cy="28" r="4.5" fill="#E08A7B" opacity=".55" /></g>
  if (k === 'bird') return <g fill={d}><path d="M46 16 Q50 2 56 14 Q60 6 62 18 Z" /></g>
  return null
}

function Body({ k, c, d, u }) {
  if (k === 'bird') {
    return (
      <g>
        <ellipse cx="50" cy="56" rx="32" ry="30" fill={c} />
        <ellipse cx="24" cy="62" rx="9" ry="15" fill={d} transform="rotate(20 24 62)" />
        <ellipse cx="76" cy="62" rx="9" ry="15" fill={d} transform="rotate(-20 76 62)" />
        <ellipse cx="50" cy="66" rx="18" ry="15" fill={`url(#BELLY${u})`} />
        <g fill="#E3B23C"><path d="M42 86 L40 94 M42 86 L45 94" stroke="#C4962A" strokeWidth="2.5" strokeLinecap="round" /><path d="M58 86 L56 94 M58 86 L61 94" stroke="#C4962A" strokeWidth="2.5" strokeLinecap="round" /></g>
      </g>
    )
  }
  return (
    <g fill={c}>
      <circle cx="50" cy="56" r="31" />
      <circle cx="30" cy="74" r="12" fill={d} />
      <circle cx="70" cy="74" r="12" fill={d} />
      {k === 'cat' && <path d="M78 74 Q96 66 90 48" stroke={c} strokeWidth="7" fill="none" strokeLinecap="round" />}
      {k === 'dog' && <path d="M79 70 Q92 62 88 54" stroke={c} strokeWidth="7" fill="none" strokeLinecap="round" />}
      {k === 'pig' && <path d="M80 72 q6 -2 4 -7 q-3 -4 -6 0 q-2 4 3 6" stroke={d} strokeWidth="2.5" fill="none" strokeLinecap="round" />}
      {k === 'rabbit' && <circle cx="80" cy="76" r="7" fill="#F4ECDF" />}
      {k === 'hamster' && <g><circle cx="27" cy="58" r="11" /><circle cx="73" cy="58" r="11" /><ellipse cx="50" cy="68" rx="16" ry="13" fill={`url(#BELLY${u})`} /></g>}
      {k === 'dog' && <ellipse cx="50" cy="64" rx="15" ry="11" fill={`url(#BELLY${u})`} />}
    </g>
  )
}

function Face({ k, mood, d, blink, look, u }) {
  const sleepy = mood === 'sleepy'
  const happy = mood === 'happy'
  const lx = look === 'left' ? -3 : look === 'right' ? 3 : 0
  return (
    <g>
      {sleepy || blink ? (
        <g stroke="#2E2E3A" strokeWidth="3" strokeLinecap="round" fill="none"><path d="M33 47 Q40 51 47 47" /><path d="M53 47 Q60 51 67 47" /></g>
      ) : (
        <g>
          <circle cx="40" cy="46" r="9" fill={`url(#EYE${u})`} /><circle cx="60" cy="46" r="9" fill={`url(#EYE${u})`} />
          <circle cx={(happy ? 40 : 41) + lx} cy={happy ? 44 : 47} r="4.8" fill={`url(#PUPIL${u})`} /><circle cx={(happy ? 60 : 61) + lx} cy={happy ? 44 : 47} r="4.8" fill={`url(#PUPIL${u})`} />
          <circle cx={42.2 + lx} cy="42.6" r="1.8" fill="#fff" /><circle cx={62.2 + lx} cy="42.6" r="1.8" fill="#fff" />
          <circle cx={39 + lx} cy="48.5" r=".9" fill="#fff" opacity=".8" /><circle cx={59 + lx} cy="48.5" r=".9" fill="#fff" opacity=".8" />
        </g>
      )}
      {k === 'bird' && <path d="M45 56 L55 56 L50 64 Z" fill="#E3B23C" />}
      {k === 'pig' && <g><ellipse cx="50" cy="61" rx="9" ry="6.5" fill={d} /><circle cx="47" cy="61" r="1.8" fill="#8A4F48" /><circle cx="53" cy="61" r="1.8" fill="#8A4F48" /></g>}
      {(k === 'dog' || k === 'cat' || k === 'rabbit' || k === 'hamster') && <ellipse cx="50" cy="57" rx="3.6" ry="2.6" fill="#2E2E3A" />}
      {k === 'cat' && <g stroke="#2E2E3A" strokeWidth="1.4" strokeLinecap="round" opacity=".6"><path d="M30 58 L18 56" /><path d="M30 62 L18 64" /><path d="M70 58 L82 56" /><path d="M70 62 L82 64" /></g>}
      {k !== 'bird' && k !== 'pig' && (
        <path d={mood === 'bored' ? 'M45 64 L55 64' : 'M44 62 Q50 68 56 62'} stroke="#2E2E3A" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      )}
      {(happy || mood === 'ok') && <g fill="#E08A7B" opacity=".45"><ellipse cx="28" cy="58" rx="6" ry="3.5" /><ellipse cx="72" cy="58" rx="6" ry="3.5" /></g>}
      {sleepy && <text x="76" y="22" fontSize="14" fill="#7E9AD0" fontFamily="Jua, sans-serif">z</text>}
    </g>
  )
}

export function PetArt({ species = 'dog', mood = 'ok', size = 120, stage = 0, className = '', blink = false, look = null }) {
  const s = speciesOf(species)
  const uid = useId().replace(/:/g, '')
  const id = (k) => `${k}${uid}`
  // 그라디언트 id를 이 그림 전용으로(여러 마리가 한 화면에 있어도 섞이지 않게)
  const body = `url(#${id('B')})`, part = `url(#${id('P')})`
  const svg = (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true" style={{ overflow: 'visible' }}>
      <defs>
        {/* 왼쪽 위에서 빛이 오는 둥근 덩어리: 밝은 쪽 → 본래 색 → 어두운 가장자리 */}
        <radialGradient id={id('B')} cx="36%" cy="30%" r="78%">
          <stop offset="0" stopColor={mix(s.color, '#ffffff', 0.5)} />
          <stop offset=".45" stopColor={s.color} />
          <stop offset="1" stopColor={mix(s.dark, '#2E2E3A', 0.25)} />
        </radialGradient>
        <radialGradient id={id('P')} cx="35%" cy="28%" r="80%">
          <stop offset="0" stopColor={mix(s.color, '#ffffff', 0.25)} />
          <stop offset=".55" stopColor={s.dark} />
          <stop offset="1" stopColor={mix(s.dark, '#2E2E3A', 0.35)} />
        </radialGradient>
        <radialGradient id={id('BELLY')} cx="40%" cy="30%" r="80%">
          <stop offset="0" stopColor="#FFFDF8" stopOpacity=".95" />
          <stop offset="1" stopColor="#EADFCB" stopOpacity=".75" />
        </radialGradient>
        <radialGradient id={id('EYE')} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".8" stopColor="#F3F1F6" />
          <stop offset="1" stopColor="#D9D6E2" />
        </radialGradient>
        <radialGradient id={id('PUPIL')} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#55556A" />
          <stop offset="1" stopColor="#17171F" />
        </radialGradient>
        <filter id={id('SH')} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="3.5" stdDeviation="2.6" floodColor="#2E2E3A" floodOpacity=".22" />
        </filter>
        <filter id={id('BL')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" /></filter>
      </defs>
      <g filter={`url(#${id('SH')})`}>
        <Ears k={s.key} c={body} d={part} />
        <Body k={s.key} c={body} d={part} u={uid} />
      </g>
      {/* 광택: 머리 왼쪽 위 반짝임 */}
      <ellipse cx="36" cy="33" rx="11" ry="6" transform="rotate(-25 36 33)" fill="#fff" opacity=".45" filter={`url(#${id('BL')})`} />
      <Face k={s.key} mood={mood} d={part} blink={blink} look={look} u={uid} />
      {stage >= 4 && <path d="M36 14 L38 4 L45 10 L50 1 L55 10 L62 4 L64 14 Z" fill="#E3B23C" stroke="#C4962A" strokeWidth="1.2" transform="translate(0 -2)" />}
    </svg>
  )
  return svg
}
