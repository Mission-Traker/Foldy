import { useEffect, useState } from 'react'
import * as db from '../lib/db.js'
import { currentSub, disablePush, enablePush, pushMember, pushSupport, testNotice } from '../lib/push.js'
import { isIOS, isStandalone } from '../lib/browser.js'

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true } catch {
    const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select()
    const ok = document.execCommand('copy'); t.remove(); return ok
  }
}

// 복구 코드 카드(가입 직후·새로 만들 때)
export function RecoveryCodeCard({ code, loginId, first }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="card p-5 text-center">
      <p className="text-4xl">🔑</p>
      <h2 className="mt-1 font-jua text-xl text-slate-deep">{first ? '비밀번호 복구 코드' : '새 복구 코드'}</h2>
      <p className="mt-1 text-sm text-soft">비밀번호를 잊었을 때 이 코드로 새 비밀번호를 정해요. <b className="text-coral">지금 한 번만 보여 드려요.</b> 사진을 찍거나 메모해 두세요.</p>
      <p className="my-4 select-all rounded-2xl border-2 border-dashed border-slate bg-white py-3 font-title text-2xl font-bold tracking-[0.15em] text-slate-deep">{code}</p>
      <p className="mb-3 text-xs text-soft">가족 아이디: <b className="text-ink">{loginId}</b></p>
      <button className="btn-ghost w-full" onClick={async () => setCopied(await copy(`폴디 가족 아이디: ${loginId}\n복구 코드: ${code}`))}>{copied ? '✓ 복사했어요' : '아이디와 코드 복사하기'}</button>
    </div>
  )
}

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30" onClick={onClose}>
    <div className="safe-b max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-jua text-xl text-slate-deep">{title}</h2>
        <button onClick={onClose} aria-label="닫기" className="text-2xl text-soft">×</button>
      </div>
      {children}
    </div>
  </div>
)

// 내 정보 › 가족 계정: 비밀번호 바꾸기 · 복구 코드 · 탈퇴
export function AccountSection({ session, onLeft, showToast, openPrivacy }) {
  const [mode, setMode] = useState(null) // 'pw' | 'code' | 'leave'
  const [status, setStatus] = useState(null)
  useEffect(() => { db.recoveryStatus().then(setStatus).catch(() => {}) }, [mode])
  return (
    <section className="card mb-4 p-4">
      <h2 className="mb-1 font-jua text-lg text-slate-deep">가족 계정</h2>
      <p className="mb-3 text-xs text-soft">
        <span className="whitespace-nowrap">아이디 <b className="text-ink">{session?.login_id}</b></span>{' · '}
        <span className="whitespace-nowrap">복구 코드 {status ? (status.has ? '있음' : <b className="text-coral">없음</b>) : '…'}</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-ghost px-2 text-[15px]" onClick={() => setMode('pw')}>비밀번호 바꾸기</button>
        <button className="btn-ghost px-2 text-[15px]" onClick={() => setMode('code')}>{status?.has ? '복구 코드 새로 받기' : '복구 코드 만들기'}</button>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button className="text-xs text-soft underline" onClick={openPrivacy}>개인정보 처리방침</button>
        <button className="text-xs text-coral underline" onClick={() => setMode('leave')}>가족 계정 탈퇴</button>
      </div>
      {mode === 'pw' && <ChangePw onClose={() => setMode(null)} showToast={showToast} />}
      {mode === 'code' && <NewCode loginId={session?.login_id} had={status?.has} onClose={() => setMode(null)} />}
      {mode === 'leave' && <Leave name={session?.name} onClose={() => setMode(null)} onLeft={onLeft} />}
    </section>
  )
}

function ChangePw({ onClose, showToast }) {
  const [f, setF] = useState({ old: '', pw: '', pw2: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  async function submit(e) {
    e.preventDefault(); setErr('')
    if (f.pw.length < 8) return setErr('새 비밀번호는 8자 이상이에요')
    if (f.pw !== f.pw2) return setErr('새 비밀번호가 서로 달라요')
    setBusy(true)
    try { await db.changePassword(f.old, f.pw); showToast('가족 비밀번호를 바꿨어요'); onClose() } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  return (
    <Modal title="가족 비밀번호 바꾸기" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label" htmlFor="cp-old">지금 비밀번호</label><input id="cp-old" className="field" type="password" value={f.old} onChange={set('old')} maxLength={64} /></div>
        <div><label className="label" htmlFor="cp-new">새 비밀번호</label><input id="cp-new" className="field" type="password" placeholder="8자 이상" value={f.pw} onChange={set('pw')} maxLength={64} /></div>
        <div><label className="label" htmlFor="cp-new2">새 비밀번호 한 번 더</label><input id="cp-new2" className="field" type="password" value={f.pw2} onChange={set('pw2')} maxLength={64} /></div>
        {err && <p className="wiggle text-sm text-coral">{err}</p>}
        <button className="btn-main w-full" disabled={busy}>{busy ? '잠시만요…' : '바꾸기'}</button>
        <p className="text-xs text-soft">지금 비밀번호가 기억나지 않으면 로그아웃 후 로그인 화면의 ‘비밀번호를 잊었어요’에서 복구 코드로 바꿀 수 있어요.</p>
      </form>
    </Modal>
  )
}

function NewCode({ loginId, had, onClose }) {
  const [code, setCode] = useState(null)
  const [err, setErr] = useState('')
  return (
    <Modal title="복구 코드" onClose={onClose}>
      {code ? (
        <>
          <RecoveryCodeCard code={code} loginId={loginId} />
          <button className="btn-main mt-3 w-full" onClick={onClose}>저장했어요</button>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink">비밀번호를 잊었을 때 새 비밀번호를 정하는 코드예요.{had && <> 새로 받으면 <b className="text-coral">예전 코드는 쓸 수 없어요.</b></>}</p>
          {err && <p className="mb-2 text-sm text-coral">{err}</p>}
          <button className="btn-main w-full" onClick={async () => { try { setCode(await db.recoveryNew()) } catch (e) { setErr(e.message) } }}>{had ? '새 코드 받기' : '코드 만들기'}</button>
        </>
      )}
    </Modal>
  )
}

function Leave({ name, onClose, onLeft }) {
  const [pw, setPw] = useState('')
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault(); setErr('')
    if (!ok) return setErr('안내를 확인하고 체크해 주세요')
    setBusy(true)
    try { await disablePush().catch(() => {}); await db.deleteFamily(pw); onLeft() } catch (e2) { setErr(e2.message); setBusy(false) }
  }
  return (
    <Modal title="가족 계정 탈퇴" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="rounded-2xl border-2 border-coral/40 bg-coral/10 p-3 text-sm leading-relaxed text-ink">
          <p className="mb-1 font-jua text-coral">탈퇴하면 바로 지워지고 되돌릴 수 없어요</p>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>{name || '우리 가족'}의 모든 구성원과 단어장·학습 기록</li>
            <li>보낸 수정요청, 알림 설정, 복구 코드</li>
            <li>모든 기기의 로그인</li>
          </ul>
        </div>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#E08A7B]" aria-label="탈퇴 안내 확인" />
          <span>위 내용을 확인했고, 가족 모두의 기록을 지우는 데 동의해요.</span>
        </label>
        <div><label className="label" htmlFor="lv-pw">가족 비밀번호</label><input id="lv-pw" className="field" type="password" value={pw} onChange={(e) => setPw(e.target.value)} maxLength={64} /></div>
        {err && <p className="wiggle text-sm text-coral">{err}</p>}
        <button className="btn w-full bg-coral text-white" disabled={busy}>{busy ? '지우는 중…' : '탈퇴하고 모두 지우기'}</button>
        <button type="button" className="w-full text-center text-sm text-soft underline" onClick={onClose}>그만두기</button>
      </form>
    </Modal>
  )
}

// 내 정보 › 알림
export function NotifySection({ member, admin, showToast }) {
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const sup = pushSupport()
  const iosNeedsHome = isIOS() && !isStandalone()
  useEffect(() => { currentSub().then((s) => setOn(!!s && pushMember() === member.id)) }, [member.id])
  async function toggle() {
    setBusy(true)
    try {
      if (on) { await disablePush(); setOn(false); showToast('알림을 껐어요') }
      else { await enablePush(member.id); setOn(true); showToast('알림을 켰어요') }
    } catch (e) { showToast(e.message) } finally { setBusy(false) }
  }
  return (
    <section className="card mb-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-jua text-lg text-slate-deep">알림</h2>
          <p className="text-xs text-soft">마지막 학습 뒤 24시간이 지나면 ‘오늘도 짧게 영어단어 하나 배워볼까요?’를 보내요 <span className="whitespace-nowrap">(오전 8시~밤 9시)</span>.{admin && ' 관리자라서 새 수정요청 알림도 와요.'}</p>
        </div>
        {sup === 'yes' && !iosNeedsHome && (
          <button role="switch" aria-checked={on} aria-label="알림" disabled={busy} onClick={toggle}
            className={`relative h-8 w-14 shrink-0 rounded-full transition ${on ? 'bg-sage' : 'bg-line'}`}>
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-1'}`} />
          </button>
        )}
      </div>
      {iosNeedsHome && <p className="mt-2 rounded-2xl bg-cream p-3 text-xs leading-relaxed text-ink">아이폰은 <b>홈 화면에 추가한 폴디</b>에서만 알림을 받을 수 있어요. 사파리 아래 <b>공유 버튼 → 홈 화면에 추가</b> 후, 홈 화면의 폴디를 열어 여기서 켜 주세요.</p>}
      {sup !== 'yes' && !iosNeedsHome && <p className="mt-2 text-xs text-coral">이 브라우저는 알림을 지원하지 않아요. 크롬이나 사파리에서 열어 주세요.</p>}
      {on && <button className="mt-2 text-xs text-slate underline" onClick={() => testNotice().catch(() => showToast('알림을 띄우지 못했어요'))}>알림 시험해 보기</button>}
    </section>
  )
}

// 내 정보 › 가족 초대 — 보내는 글에 브라우저 안내를 함께 넣음
export const INVITE_URL = 'https://bit.ly/foldy-voca'
export function inviteText(familyName, loginId) {
  return [
    `📒 우리 가족 영어 단어장 '폴디'에 초대해요!`,
    INVITE_URL,
    '',
    `가족 아이디: ${loginId}  (비밀번호는 따로 알려 줄게요)`,
    '',
    '👉 열 때 꼭 확인해 주세요',
    '· 카카오톡에서 링크를 누르면 카톡 안에서 열려요. 오른쪽 아래(아이폰은 오른쪽 위) ⋯ 를 눌러 ‘다른 브라우저로 열기’를 골라 주세요.',
    '· 발음 자동 채점은 아이폰은 사파리, 안드로이드는 크롬에서 돼요(다른 곳에선 내 목소리로 확인해요).',
    '· 열고 나서 ‘홈 화면에 추가’를 하면 앱처럼 쓸 수 있어요.',
  ].join('\n')
}
export function InviteSection({ session, showToast }) {
  const text = inviteText(session?.name, session?.login_id)
  async function share() {
    if (navigator.share && /Android|iPhone|iPad/.test(navigator.userAgent)) {
      try { await navigator.share({ text }); return } catch (e) { if (e?.name === 'AbortError') return }
    }
    if (await copy(text)) showToast('초대 글을 복사했어요. 카톡에 붙여넣어 보내세요')
  }
  return (
    <section className="card mb-4 p-4">
      <h2 className="mb-1 font-jua text-lg text-slate-deep">가족 초대하기</h2>
      <p className="mb-3 text-xs text-soft">링크와 함께 ‘사파리·크롬으로 열기’ 안내가 들어간 글을 보내요.</p>
      <pre className="mb-3 max-h-40 overflow-y-auto whitespace-pre-wrap break-keep rounded-2xl bg-white p-3 font-body text-[13px] leading-relaxed text-ink">{text}</pre>
      <button className="btn-main w-full" onClick={share}>초대 글 보내기</button>
    </section>
  )
}
