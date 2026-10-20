import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { Blob, Header } from '../components/ui.jsx'
import { PetArt, SPECIES, speciesOf } from '../components/PetArt.jsx'
import { MOOD_TEXT, PET_ACTIONS, petMood, petStage, ticketHint } from '../lib/familyPet.js'
import { track } from '../lib/track.js'
import usePetIdle from '../components/usePetIdle.js'
import * as sfx from '../lib/sfx.js'

// 우리 가족 펫: 가족이 함께 한 마리를 키움. 공부하면 생기는 돌봄권으로 밥·산책·목욕
export default function FamilyPet() {
  const { member, members, showToast } = useApp()
  const [st, setSt] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [anim, setAnim] = useState(null) // { key, n }

  const load = useCallback(() => db.petGet(member.id).then(setSt).catch((e) => setErr(e.message)), [member.id])
  useEffect(() => { load() }, [load])

  async function care(a) {
    if (busy) return
    setBusy(true)
    try {
      const r = await db.petCare(member.id, a.key)
      setSt(r)
      setAnim({ key: a.key, n: Date.now() })
      sfx.correct()
      track('pet', { kind: a.key })
      setTimeout(() => setAnim(null), 1800)
    } catch (e) { showToast(e.message) } finally { setBusy(false) }
  }

  if (err) return <div><Header title="우리 가족 펫" back="/" /><p className="card p-5 text-center text-coral">{err}</p></div>
  if (!st) return <div><Header title="우리 가족 펫" back="/" /><p className="py-16 text-center text-soft">불러오는 중…</p></div>
  if (!st.pet) return <Adopt onDone={(r) => { setSt({ ...r, tickets: st.tickets }); load() }} />

  const p = st.pet
  const mood = petMood(p)
  const stage = petStage(p.xp)
  const sp = speciesOf(p.species)
  const t = st.tickets || {}
  const byId = Object.fromEntries((members || []).map((m) => [m.id, m]))
  const week = (st.week || []).map((w) => ({ m: byId[w.member_id], n: w.n })).filter((x) => x.m).sort((a, b) => b.n - a.n)

  return (
    <div>
      <Header title="우리 가족 펫" back="/" />
      <section className={`relative mb-4 overflow-hidden rounded-3xl p-5 text-center ${mood === 'sleepy' ? 'bg-slate/10' : 'bg-sage/15'}`}>
        <div className="flex items-center justify-center gap-2">
          <h2 className="font-jua text-2xl text-slate-deep">{p.name}</h2>
          <RenameButton name={p.name} onDone={setSt} />
        </div>
        <p className="text-sm text-soft">{sp.name} · {stage.name}</p>
        <div className="relative mx-auto mt-2 flex h-[200px] items-end justify-center">
          <span className="absolute bottom-2 h-4 w-28 rounded-full bg-ink/10" aria-hidden="true" />
          <LivePet species={p.species} mood={mood} stage={stage.i} size={120 + stage.i * 14} anim={anim} />
          {anim && <CareFx k={anim.key} key={anim.n} />}
        </div>
        <p className="mt-1 font-jua text-slate-deep" aria-live="polite">{anim ? '고마워요! 💛' : MOOD_TEXT[mood]}</p>
        {stage.next && (
          <div className="mx-auto mt-3 max-w-xs text-left">
            <div className="flex justify-between text-xs text-soft"><span>자라기까지</span><span>다음: {stage.next.name}</span></div>
            <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-paper"><span className="block h-full rounded-full bg-mustard" style={{ width: `${stage.pct}%` }} /></span>
          </div>
        )}
      </section>

      <section className="card mb-4 space-y-2.5 p-4" aria-label="펫 상태">
        {PET_ACTIONS.map((a) => (
          <div key={a.key} className="flex items-center gap-2 text-sm">
            <span className="w-16 shrink-0 font-jua text-slate-deep">{a.meterLabel}</span>
            <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-line"><span className={`block h-full rounded-full transition-all ${p[a.meter] >= 40 ? 'bg-sage' : 'bg-tang'}`} style={{ width: `${p[a.meter]}%` }} /></span>
            <span className="w-9 shrink-0 text-right font-title tabular-nums text-soft">{p[a.meter]}</span>
          </div>
        ))}
        <p className="break-keep text-[11px] text-soft">시간이 지나면 줄어요(배부름이 가장 빨리, 깨끗함이 가장 천천히). 오래 못 돌봐도 아프지는 않고 졸려 할 뿐이에요.</p>
      </section>

      <h3 className="mb-2 font-jua text-slate-deep">{member.name}의 돌봄권</h3>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {PET_ACTIONS.map((a) => {
          const n = t[a.key] || 0
          return (
            <button key={a.key} disabled={busy || n < 1} onClick={() => care(a)} aria-label={`${a.label} (${n}개)`}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 ${n > 0 ? 'border-tang bg-tang/10 active:scale-95' : 'border-line bg-paper opacity-70'}`}>
              <span className="text-3xl" aria-hidden="true">{a.icon}</span>
              <span className="whitespace-nowrap font-jua text-sm text-slate-deep">{a.label}</span>
              <span className={`font-jua text-xs ${n > 0 ? 'text-tang' : 'text-soft'}`}>{n > 0 ? `${n}개 있어요` : '0개'}</span>
            </button>
          )
        })}
      </div>
      <ul className="mb-5 space-y-1 rounded-2xl bg-paper p-3 text-xs text-soft ring-1 ring-line">
        {PET_ACTIONS.map((a) => <li key={a.key} className="break-keep">{a.icon} {a.label}: {(t[a.key] || 0) > 0 ? a.how : ticketHint(a.key, t)}</li>)}
      </ul>
      {(t.feed || 0) + (t.walk || 0) + (t.bath || 0) === 0 && (
        <Link to="/quiz/daily" className="btn-main mb-5 block w-full text-center">▶ 오늘의 한 판으로 돌봄권 모으기</Link>
      )}

      <section className="card mb-4 p-4">
        <h3 className="mb-2 font-jua text-slate-deep">오늘 돌봐 준 가족</h3>
        {(st.today || []).length === 0 ? <p className="text-sm text-soft">아직 아무도 안 돌봤어요. 첫 번째가 되어 주세요!</p> : (
          <ul className="space-y-1.5">
            {st.today.slice(0, 12).map((l, k) => {
              const a = PET_ACTIONS.find((x) => x.key === l.action)
              return (
                <li key={k} className="flex items-center gap-2 text-sm">
                  <Blob i={l.avatar ?? 0} size={24} />
                  <span className="min-w-0 flex-1 truncate">{l.name || '가족'}</span>
                  <span className="shrink-0">{a?.icon} {a?.label}</span>
                  <span className="shrink-0 whitespace-nowrap text-right text-xs text-soft">{new Date(l.at).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}</span>
                </li>
              )
            })}
          </ul>
        )}
        {week.length > 1 && <p className="mt-3 break-keep text-xs text-soft">이번 주 가장 많이 돌본 가족: {week[0].m.name} {week[0].n}번</p>}
      </section>
    </div>
  )
}

// 돌볼 때는 돌봄 동작, 평소엔 몇 초마다 바뀌는 귀여운 동작 + 숨쉬기·깜빡임·두리번
export function LivePet({ species, mood, stage = 0, size = 120, anim = null }) {
  const idle = usePetIdle(mood, !!anim)
  return (
    <div className="relative">
      <div className={anim?.key === 'walk' ? 'pet-walk' : anim ? 'pet-joy' : 'pet-breathe'}>
        <div key={idle.key} className={anim ? '' : `pet-move ${idle.cls}`}>
          <PetArt species={species} mood={anim ? 'happy' : mood} size={size} stage={stage} blink={!anim && idle.blink} look={anim ? null : idle.look} />
        </div>
      </div>
      {!anim && idle.fx && <span key={idle.key + 'fx'} className="pet-idle-fx absolute -right-1 top-0 font-jua text-xl text-slate" aria-hidden="true">{idle.fx}</span>}
    </div>
  )
}

function CareFx({ k }) {
  const icons = k === 'feed' ? ['🍖', '😋', '💛'] : k === 'walk' ? ['🐾', '🐾', '🌳'] : ['🫧', '🫧', '✨']
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {icons.map((c, i) => <span key={i} className="pet-fx absolute text-2xl" style={{ left: `${30 + i * 20}%`, bottom: `${40 + (i % 2) * 18}%`, animationDelay: `${i * 0.18}s` }}>{c}</span>)}
    </div>
  )
}

function RenameButton({ name, onDone }) {
  const { showToast } = useApp()
  const [open, setOpen] = useState(false)
  const [v, setV] = useState(name)
  if (!open) return <button onClick={() => { setV(name); setOpen(true) }} className="text-sm text-soft" aria-label="이름 바꾸기">✏️</button>
  async function save(e) {
    e.preventDefault()
    try { onDone(await db.petRename(v.trim())); setOpen(false) } catch (e2) { showToast(e2.message) }
  }
  return (
    <form onSubmit={save} className="flex items-center gap-1">
      <input className="field h-9 w-28 py-1 text-center text-base" value={v} maxLength={12} onChange={(e) => setV(e.target.value)} aria-label="펫 이름" autoFocus />
      <button className="chip text-xs" disabled={!v.trim()}>저장</button>
    </form>
  )
}

function Adopt({ onDone }) {
  const { showToast } = useApp()
  const [sp, setSp] = useState('dog')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  async function go(e) {
    e.preventDefault()
    if (busy) return
    const nm = (name.trim() || speciesOf(sp).name).slice(0, 12)
    setBusy(true)
    try { const r = await db.petAdopt(sp, nm); track('pet', { kind: 'adopt_' + sp }); sfx.correct(); onDone(r) } catch (e2) { showToast(e2.message) } finally { setBusy(false) }
  }
  return (
    <div>
      <Header title="우리 가족 펫" back="/" />
      <p className="mb-4 break-keep text-center text-slate-deep">가족이 함께 키울 펫을 골라 주세요.<br /><span className="text-sm text-soft">공부하면 생기는 돌봄권으로 밥을 주고, 산책하고, 목욕시켜요.</span></p>
      <form onSubmit={go}>
        <div className="mb-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="펫 고르기">
          {SPECIES.map((s) => (
            <button type="button" key={s.key} role="radio" aria-checked={sp === s.key} onClick={() => setSp(s.key)}
              className={`flex flex-col items-center rounded-2xl border-2 p-2 ${sp === s.key ? 'border-slate-deep bg-slate/10' : 'border-line bg-paper'}`}>
              <PetArt species={s.key} mood={sp === s.key ? 'happy' : 'ok'} size={76} />
              <span className="font-jua text-sm text-slate-deep">{s.name}</span>
            </button>
          ))}
        </div>
        <label className="label" htmlFor="petname">이름 (12자까지)</label>
        <input id="petname" className="field mb-2" placeholder={`예: ${speciesOf(sp).name === '강아지' ? '뭉치' : speciesOf(sp).name === '고양이' ? '나비' : '콩이'}`} value={name} maxLength={12} onChange={(e) => setName(e.target.value)} />
        <p className="mb-4 text-xs text-soft">한 번 데려오면 가족 모두가 같은 펫을 키워요. 이름은 나중에 바꿀 수 있어요.</p>
        <button className="btn-main w-full py-4 text-lg" disabled={busy}>{busy ? '데려오는 중…' : `${name.trim() || speciesOf(sp).name} 데려오기`}</button>
      </form>
    </div>
  )
}
