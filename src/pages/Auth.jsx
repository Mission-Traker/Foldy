import { useState } from 'react'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { Blob } from '../components/ui.jsx'
import { PrivacySheet } from '../components/Privacy.jsx'
import { RecoveryCodeCard } from '../components/Account.jsx'

// preview: 관리자 페이지의 랜딩 미리보기 — 실제 가입·로그인은 하지 않음(지금 로그인이 풀리지 않게)
export default function Auth({ preview = false }) {
  const { setSession } = useApp()
  const [tab, setTab] = useState('login')
  const [f, setF] = useState({ login: '', pw: '', name: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [agree, setAgree] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [code, setCode] = useState(null) // 가입 직후 보여줄 복구 코드
  const [pending, setPending] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setErr('')
    const loginId = f.login.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,30}$/.test(loginId)) return setErr('아이디는 영어 소문자·숫자·_ 로 3~30자예요')
    if (f.pw.length < 4) return setErr('비밀번호는 4자 이상이에요')
    if (tab === 'signup' && !f.name.trim()) return setErr('가족 이름을 적어 주세요')
    if (tab === 'signup' && !agree) return setErr('개인정보 처리방침에 동의해 주세요')
    if (preview) return setErr('미리보기에서는 실제로 가입·로그인되지 않아요')
    setBusy(true)
    try {
      const s = tab === 'login' ? await db.login(loginId, f.pw) : await db.signup(loginId, f.pw, f.name.trim().slice(0, 30))
      if (tab === 'signup') {
        // 비밀번호를 잊었을 때 쓸 복구 코드를 먼저 보여 줌
        const c = await db.recoveryNew().catch(() => null)
        if (c) { setPending({ ...s, login_id: loginId }); setCode(c); return }
      }
      setSession({ ...s, login_id: loginId })
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  if (code) {
    return (
      <div className="flex min-h-screen flex-col justify-center py-10">
        <RecoveryCodeCard code={code} loginId={pending.login_id} first />
        <button className="btn-main mt-4 w-full" onClick={() => setSession(pending)}>저장했어요, 시작하기</button>
      </div>
    )
  }
  if (tab === 'forgot') return <Forgot preview={preview} onBack={() => { setTab('login'); setErr('') }} />

  return (
    <div className="flex min-h-screen flex-col justify-center py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-2 flex items-end gap-1">
          <Blob i={0} size={70} className="bob" />
          <Blob i={1} size={54} look="left" />
          <Blob i={3} size={62} />
        </div>
        <p className="font-title text-sm font-semibold tracking-[0.25em] text-coral">FOLD · LEARN · GROW</p>
        <h1 className="font-title text-6xl font-bold text-slate">Foldy</h1>
        <p className="mt-1 rounded-full bg-slate-deep px-4 py-1 font-jua text-white">접어서 외우는 우리 가족 단어장</p>
      </div>

      <div className="card p-5">
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-full bg-cream p-1">
          {[['login', '로그인'], ['signup', '가족 만들기']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => { setTab(k); setErr('') }}
              className={`rounded-full py-2 font-jua ${tab === k ? 'bg-paper text-slate-deep shadow-card' : 'text-soft'}`}>{l}</button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          {tab === 'signup' && (
            <div>
              <label className="label" htmlFor="fname">가족 이름</label>
              <input id="fname" className="field" placeholder="예: 윤씨네" value={f.name} onChange={set('name')} maxLength={30} />
            </div>
          )}
          <div>
            <label className="label" htmlFor="login">가족 아이디</label>
            <input id="login" className="field" placeholder="영어 소문자·숫자 (예: yoonfamily)" autoCapitalize="none" autoCorrect="off"
              value={f.login} onChange={set('login')} maxLength={30} />
          </div>
          <div>
            <label className="label" htmlFor="pw">비밀번호</label>
            <input id="pw" className="field" type="password" placeholder="4자 이상" value={f.pw} onChange={set('pw')} maxLength={64} />
          </div>
          {tab === 'signup' && (
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#3E5486]" aria-label="개인정보 처리방침 동의" />
              <span>[필수] <button type="button" className="font-jua text-slate underline" onClick={() => setPrivacy(true)}>개인정보 처리방침</button>을 읽고 동의해요. 자녀 프로필은 보호자인 제가 동의하고 추가해요.</span>
            </label>
          )}
          {err && <p className="wiggle text-sm text-coral">{err}</p>}
          <button className="btn-main w-full" disabled={busy}>{busy ? '잠시만요…' : tab === 'login' ? '들어가기' : '우리 가족 단어장 만들기'}</button>
        </form>
        {tab === 'signup' && <p className="mt-3 text-xs text-soft">가족이 하나의 아이디를 함께 쓰고, 들어간 뒤 각자 프로필을 고릅니다. 이메일·전화번호는 받지 않아요.</p>}
        {tab === 'login' && <button type="button" className="mt-3 w-full text-center text-sm text-soft underline" onClick={() => { setTab('forgot'); setErr('') }}>비밀번호를 잊었어요</button>}
      </div>
      <button type="button" className="mt-4 text-center text-xs text-soft underline" onClick={() => setPrivacy(true)}>개인정보 처리방침</button>
      {privacy && <PrivacySheet onClose={() => setPrivacy(false)} />}
    </div>
  )
}

// 비밀번호 찾기: 가족 아이디 + 복구 코드 → 새 비밀번호
function Forgot({ onBack, preview }) {
  const [f, setF] = useState({ login: '', code: '', pw: '', pw2: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (!f.login.trim()) return setErr('가족 아이디를 적어 주세요')
    if (f.code.replace(/[^0-9A-Za-z]/g, '').length !== 12) return setErr('복구 코드 12자리를 적어 주세요')
    if (f.pw.length < 4) return setErr('새 비밀번호는 4자 이상이에요')
    if (f.pw !== f.pw2) return setErr('새 비밀번호가 서로 달라요')
    if (preview) return setErr('미리보기에서는 실제로 가입·로그인되지 않아요')
    setBusy(true)
    try { await db.resetPassword(f.login, f.code, f.pw); setDone(true) } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  return (
    <div className="flex min-h-screen flex-col justify-center py-10">
      <div className="card p-5">
        <h2 className="mb-1 font-jua text-xl text-slate-deep">비밀번호 찾기</h2>
        {done ? (
          <>
            <p className="mb-4 text-sm text-ink">새 비밀번호로 바꿨어요. 이제 새 비밀번호로 로그인해 주세요. 이전 기기들은 모두 로그아웃됐어요.</p>
            <button className="btn-main w-full" onClick={onBack}>로그인하러 가기</button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-sm text-soft">가족을 만들 때 받은 <b className="text-ink">복구 코드</b>로 새 비밀번호를 정해요.</p>
            <div><label className="label" htmlFor="fg-login">가족 아이디</label><input id="fg-login" className="field" autoCapitalize="none" value={f.login} onChange={set('login')} maxLength={30} /></div>
            <div><label className="label" htmlFor="fg-code">복구 코드</label><input id="fg-code" className="field font-title tracking-widest" placeholder="XXXX-XXXX-XXXX" autoCapitalize="characters" value={f.code} onChange={set('code')} maxLength={20} /></div>
            <div><label className="label" htmlFor="fg-pw">새 비밀번호</label><input id="fg-pw" className="field" type="password" placeholder="4자 이상" value={f.pw} onChange={set('pw')} maxLength={64} /></div>
            <div><label className="label" htmlFor="fg-pw2">새 비밀번호 한 번 더</label><input id="fg-pw2" className="field" type="password" value={f.pw2} onChange={set('pw2')} maxLength={64} /></div>
            {err && <p className="wiggle text-sm text-coral">{err}</p>}
            <button className="btn-main w-full" disabled={busy}>{busy ? '잠시만요…' : '새 비밀번호로 바꾸기'}</button>
            <div className="rounded-2xl bg-cream p-3 text-xs leading-relaxed text-soft">
              <p className="mb-1 font-jua text-sm text-slate-deep">복구 코드가 없나요?</p>
              <p>가족 중 아직 로그인돼 있는 기기가 있으면 <b>내 정보 › 가족 계정</b>에서 비밀번호를 바로 바꿀 수 있어요. 그것도 어려우면 폴디를 알려 준 분(관리자)에게 연락해 주세요.</p>
            </div>
          </form>
        )}
        <button type="button" className="mt-3 w-full text-center text-sm text-soft underline" onClick={onBack}>로그인으로 돌아가기</button>
      </div>
    </div>
  )
}
