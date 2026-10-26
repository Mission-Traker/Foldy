import { useEffect, useState } from 'react'
import { currentSub, enablePush, pushMember, pushSupport } from '../lib/push.js'
import { isInApp, isIOS, isStandalone } from '../lib/browser.js'
import { track } from '../lib/track.js'

// '오늘의 한 판'을 끝낸 축하 화면에서 알림 켜기를 권함(공부를 막 마친 지금이 가장 잘 켜 줌)
// 한 번 '괜찮아요'를 누르면 7일 동안은 다시 묻지 않음
const askKey = (id) => 'foldy.pushAsk.' + id
const WAIT_DAYS = 7
function askedRecently(id) {
  try { const t = Number(localStorage.getItem(askKey(id)) || 0); return t && Date.now() - t < WAIT_DAYS * 864e5 } catch { return false }
}

export default function PushAsk({ member, showToast }) {
  const [state, setState] = useState('check') // check | ask | ios | inapp | hide | done
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let on = true
    ;(async () => {
      if (askedRecently(member.id)) return on && setState('hide')
      if (isInApp()) return on && setState('inapp')
      if (isIOS() && !isStandalone()) return on && setState('ios')
      if (pushSupport() !== 'yes') return on && setState('hide')
      const sub = await currentSub()
      if (sub && pushMember() === member.id) return on && setState('hide')
      if (on) setState('ask')
    })()
    return () => { on = false }
  }, [member.id])
  useEffect(() => { if (['ask', 'ios', 'inapp'].includes(state)) track('push_ask', { kind: state }) }, [state])

  const later = () => { try { localStorage.setItem(askKey(member.id), String(Date.now())) } catch { /* */ } track('push_ask', { kind: 'no' }); setState('hide') }
  async function yes() {
    setBusy(true)
    try { await enablePush(member.id); track('push_ask', { kind: 'yes' }); setState('done') } catch (e) { showToast?.(e.message); later() } finally { setBusy(false) }
  }

  if (state === 'done') return <p className="w-full max-w-xs rounded-2xl bg-sage/15 px-4 py-3 text-sm text-slate-deep">🔔 알림을 켰어요. 내일 잊지 않게 알려 드릴게요</p>
  if (!['ask', 'ios', 'inapp'].includes(state)) return null
  return (
    <div className="w-full max-w-xs rounded-3xl border-2 border-line bg-paper p-4 text-left">
      <p className="font-jua text-slate-deep">🔔 내일 잊지 않게 알려 드릴까요?</p>
      <p className="mt-1 break-keep text-xs text-soft">마지막 공부 뒤 24시간이 지나면 한 번 알려 드려요. 오전 8시~밤 9시 사이에만 와요.</p>
      {state === 'ask' && (
        <div className="mt-3 flex gap-2">
          <button className="btn-ghost px-4" onClick={later}>괜찮아요</button>
          <button className="btn-main flex-1" disabled={busy} onClick={yes}>{busy ? '켜는 중…' : '알림 받기'}</button>
        </div>
      )}
      {state === 'ios' && (
        <>
          <p className="mt-2 break-keep text-xs text-ink/80">아이폰은 폴디를 홈 화면에 추가해야 알림을 받을 수 있어요.</p>
          <ol className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            {[['⬆️', '사파리 아래 공유 버튼'], ['➕', '‘홈 화면에 추가’'], ['🔔', '홈 화면 폴디에서 알림 켜기']].map(([i, t], k) => (
              <li key={k} className="rounded-2xl bg-cream px-1 py-2">
                <span className="block text-xl" aria-hidden="true">{i}</span>
                <span className="mt-0.5 block break-keep text-[11px] leading-snug text-ink">{k + 1}. {t}</span>
              </li>
            ))}
          </ol>
          <button className="mt-2 w-full text-center text-xs text-soft underline" onClick={later}>다음에 할게요</button>
        </>
      )}
      {state === 'inapp' && (
        <>
          <p className="mt-2 break-keep text-xs text-ink/80">카카오톡 같은 앱 안에서는 알림을 받을 수 없어요. {isIOS() ? '사파리' : '크롬'}로 열면 받을 수 있어요(홈 화면 아래 안내를 눌러 주세요).</p>
          <button className="mt-2 w-full text-center text-xs text-soft underline" onClick={later}>다음에 할게요</button>
        </>
      )}
    </div>
  )
}
