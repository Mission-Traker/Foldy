import { useEffect, useRef, useState } from 'react'
import { canPickMic, listMics, meter, openMic, saveMic, savedMic } from '../lib/mic.js'

// 마이크 선택 + 소리 크기 막대로 확인
export default function MicPicker({ compact = false, onChange }) {
  const [mics, setMics] = useState(null)
  const [sel, setSel] = useState(savedMic())
  const [level, setLevel] = useState(0)
  const [testing, setTesting] = useState(false)
  const [err, setErr] = useState('')
  const stop = useRef(null)

  useEffect(() => () => stopTest(), []) // eslint-disable-line

  async function load() {
    setErr('')
    try {
      const list = await listMics()
      setMics(list)
      if (sel !== 'default' && !list.some((m) => m.id === sel)) { setSel('default'); saveMic('default') }
    } catch (e) {
      setErr(e.message === 'MIC_DENIED' ? '마이크 권한을 허용해 주세요 (주소창 왼쪽 자물쇠 → 마이크 허용)' : '마이크를 찾지 못했어요')
    }
  }

  function stopTest() {
    if (stop.current) { stop.current(); stop.current = null }
    setTesting(false); setLevel(0)
  }

  async function test() {
    if (testing) return stopTest()
    try {
      const st = await openMic(sel)
      const end = meter(st, setLevel)
      stop.current = () => { end(); st.getTracks().forEach((t) => t.stop()) }
      setTesting(true)
      setTimeout(() => { if (stop.current) stopTest() }, 8000)
    } catch { setErr('이 마이크를 열 수 없어요. 다른 마이크를 골라 주세요') }
  }

  function pick(id) {
    stopTest()
    setSel(id); saveMic(id); onChange?.(id)
  }

  if (!canPickMic()) return null

  return (
    <div className={compact ? 'rounded-2xl border-2 border-line bg-white p-3' : ''}>
      {!mics ? (
        <button type="button" className="chip w-full justify-center" onClick={load}>🎙 마이크 목록 불러오기</button>
      ) : (
        <>
          <label className="label" htmlFor="mic">사용할 마이크</label>
          <select id="mic" className="field !py-2 !text-[15px]" value={sel} onChange={(e) => pick(e.target.value)}>
            <option value="default">기본 마이크 (기기 설정)</option>
            {mics.filter((m) => m.id !== 'default').map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" className={`chip ${testing ? 'chip-on' : ''}`} onClick={test}>{testing ? '■ 멈춤' : '▶ 마이크 테스트'}</button>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-line" aria-label="소리 크기">
              <div className="h-full rounded-full bg-sage transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
          </div>
          <p className="mt-1 text-[11px] text-soft">테스트를 누르고 말해 보세요. 막대가 움직이면 그 마이크가 잘 들려요. 골라도 인식이 안 되면 컴퓨터 설정에서 기본 마이크를 바꿔 주세요.</p>
        </>
      )}
      {err && <p className="mt-1 text-xs text-coral">{err}</p>}
    </div>
  )
}
