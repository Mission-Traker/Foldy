import { useState } from 'react'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { Blob } from '../components/ui.jsx'

export default function Auth() {
  const { setSession } = useApp()
  const [tab, setTab] = useState('login')
  const [f, setF] = useState({ login: '', pw: '', name: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setErr('')
    const loginId = f.login.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,30}$/.test(loginId)) return setErr('아이디는 영어 소문자·숫자·_ 로 3~30자예요')
    if (f.pw.length < 4) return setErr('비밀번호는 4자 이상이에요')
    if (tab === 'signup' && !f.name.trim()) return setErr('가족 이름을 적어 주세요')
    setBusy(true)
    try {
      const s = tab === 'login' ? await db.login(loginId, f.pw) : await db.signup(loginId, f.pw, f.name.trim().slice(0, 30))
      setSession({ ...s, login_id: loginId })
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

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
          {err && <p className="wiggle text-sm text-coral">{err}</p>}
          <button className="btn-main w-full" disabled={busy}>{busy ? '잠시만요…' : tab === 'login' ? '들어가기' : '우리 가족 단어장 만들기'}</button>
        </form>
        {tab === 'signup' && <p className="mt-3 text-xs text-soft">가족이 하나의 아이디를 함께 쓰고, 들어간 뒤 각자 프로필을 고릅니다. 이메일·전화번호는 받지 않아요.</p>}
      </div>
    </div>
  )
}
