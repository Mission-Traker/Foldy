import { useState } from 'react'
import { isInApp, isIOS, isKakao, openOutside } from '../lib/browser.js'

// 카카오톡 등 앱 안 브라우저로 열렸을 때: 사파리·크롬으로 열도록 안내
export default function InAppBanner() {
  const [hide, setHide] = useState(() => { try { return sessionStorage.getItem('foldy.inappHide') === '1' } catch { return false } })
  if (!isInApp() || hide) return null
  const where = isIOS() ? '사파리' : '크롬'
  return (
    <div className="fixed inset-x-0 bottom-0 z-[58] px-3 pb-[max(env(safe-area-inset-bottom),10px)]">
      <div className="mx-auto max-w-md rounded-3xl border-2 border-slate-deep bg-paper p-4 shadow-pop" role="dialog" aria-label="다른 브라우저로 열기">
        <p className="font-jua text-slate-deep">{isKakao() ? '카카오톡 안에서 열렸어요' : '앱 안 브라우저로 열렸어요'}</p>
        <p className="mt-1 text-sm text-ink/80">{where}로 열어야 발음 퀴즈 마이크와 ‘홈 화면에 추가’가 잘 돼요.</p>
        <div className="mt-3 flex gap-2">
          <button className="btn-ghost px-4" onClick={() => { setHide(true); try { sessionStorage.setItem('foldy.inappHide', '1') } catch { /* */ } }}>나중에</button>
          <button className="btn-main flex-1" onClick={() => openOutside()}>{where}로 열기</button>
        </div>
      </div>
    </div>
  )
}
