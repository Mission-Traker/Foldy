import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { isInApp, isIOS, isKakao, openOutside } from '../lib/browser.js'
import { track } from '../lib/track.js'

// 카카오톡 등 앱 안 브라우저로 열렸을 때: 사파리·크롬으로 열도록 안내
// 가입·로그인 화면을 가리지 않게, 가족에 들어와 첫 단어를 담은 뒤에만 띄움.
// 누르면 한 번 쓰는 코드로 로그인을 그대로 이어서 엶(다시 로그인할 필요 없음)
export default function InAppBanner() {
  const { session, member, words } = useApp()
  const [hide, setHide] = useState(() => { try { return sessionStorage.getItem('foldy.inappHide') === '1' } catch { return false } })
  const [busy, setBusy] = useState(false)
  const loc = useLocation()
  // 첫 단어를 담은 뒤, 홈 화면에서만(시작 안내 창·퀴즈 답 버튼을 가리지 않게)
  if (!isInApp() || hide || !session || !member || !words?.length || loc.pathname !== '/') return null
  const where = isIOS() ? '사파리' : '크롬'
  async function go() {
    if (busy) return
    setBusy(true)
    track('inapp_out', { kind: isKakao() ? 'kakao' : 'other' })
    let url = `${location.origin}/?src=inapp`
    try {
      const code = await db.handoffCreate(member.id)
      url = `${location.origin}/?src=inapp#/handoff?c=${code}&to=${encodeURIComponent('/')}`
    } catch { /* 코드를 못 만들면 그냥 열기(다시 로그인) */ }
    setBusy(false)
    openOutside(url)
  }
  return (
    <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[58] px-3">
      <div className="mx-auto max-w-md rounded-3xl border-2 border-slate-deep bg-paper p-4 shadow-pop" role="dialog" aria-label="다른 브라우저로 열기">
        <p className="font-jua text-slate-deep">{isKakao() ? '카카오톡 안에서 열렸어요' : '앱 안 브라우저로 열렸어요'}</p>
        <p className="mt-1 break-keep text-sm text-ink/80">{where}로 열면 발음 자동 채점·알림·‘홈 화면에 추가’가 돼요. 로그인은 그대로 이어져요.</p>
        <div className="mt-3 flex gap-2">
          <button className="btn-ghost px-4" onClick={() => { setHide(true); try { sessionStorage.setItem('foldy.inappHide', '1') } catch { /* */ } }}>나중에</button>
          <button className="btn-main flex-1" disabled={busy} onClick={go}>{busy ? '여는 중…' : `${where}로 열기`}</button>
        </div>
      </div>
    </div>
  )
}
