import { useEffect, useRef, useState } from 'react'

// 가족 펫이 가만히 있지 않게: 몇 초마다 귀여운 동작을 바꿔 가며(같은 동작 연속 X) + 눈 깜빡임 + 두리번
const MOVES = {
  happy: ['hop', 'sway', 'spin', 'wiggle', 'stretch', 'look', 'heart', 'tilt', 'twirl', 'sing'],
  ok: ['hop', 'sway', 'stretch', 'look', 'tilt', 'sit', 'heart', 'wiggle'],
  bored: ['sway', 'look', 'sit', 'sigh', 'tilt'],
  sleepy: ['snore'],
}
const FX = { heart: '💛', sing: '♪', sigh: '…', snore: 'z' }
const reduce = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

export default function usePetIdle(mood = 'ok', paused = false) {
  const [move, setMove] = useState({ name: null, n: 0 })
  const [blink, setBlink] = useState(false)
  const [look, setLook] = useState(null)
  const last = useRef(null)

  useEffect(() => {
    if (paused || reduce()) { setMove({ name: null, n: 0 }); return }
    const list = MOVES[mood] || MOVES.ok
    let t
    const next = () => {
      const pool = list.length > 1 ? list.filter((m) => m !== last.current) : list
      const name = pool[Math.floor(Math.random() * pool.length)]
      last.current = name
      setMove({ name, n: Date.now() })
      if (name === 'look') { setLook('left'); setTimeout(() => setLook('right'), 600); setTimeout(() => setLook(null), 1300) }
      t = setTimeout(next, (mood === 'sleepy' ? 4200 : mood === 'bored' ? 3800 : 2600) + Math.random() * 1400)
    }
    t = setTimeout(next, 900)
    return () => clearTimeout(t)
  }, [mood, paused])

  useEffect(() => {
    if (mood === 'sleepy' || paused) return
    let t
    const loop = () => { t = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 150); loop() }, 2200 + Math.random() * 2800) }
    loop()
    return () => clearTimeout(t)
  }, [mood, paused])

  return { cls: move.name ? `pet-m-${move.name}` : '', key: move.n, blink, look, fx: FX[move.name] || null }
}
