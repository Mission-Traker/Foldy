import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../App.jsx'
import * as db from '../lib/db.js'
import { LEVELS, normLevel } from '../lib/levels.js'
import { statusOf } from '../lib/study.js'
import { Blob, Header, GoalStepper } from '../components/ui.jsx'
import { MemberForm } from './Profiles.jsx'
import { soundOn, setSoundOn, correct } from '../lib/sfx.js'
import MicPicker from '../components/MicPicker.jsx'
import MyFeedback from '../components/MyFeedback.jsx'
import { AccountSection, InviteSection, NotifySection } from '../components/Account.jsx'
import { PrivacySheet } from '../components/Privacy.jsx'

export default function Me() {
  const { member, members, setMember, updateMember, patchMemberLocal, words, session, setSession, showToast, setMembers, aiState, openIntro } = useApp()
  const [adding, setAdding] = useState(false)
  const [sound, setSound] = useState(soundOn())
  const [privacy, setPrivacy] = useState(false)
  const [admin, setAdmin] = useState(false)
  useEffect(() => { db.isAdminMember(member?.id).then(setAdmin) }, [member?.id])
  const done = words.filter((w) => statusOf(w) === 'o').length

  async function setLevel(id) {
    try { await updateMember({ level: id }); showToast('레벨을 바꿨어요. 내일 추천부터 반영돼요') } catch (e) { showToast(e.message) }
  }
  const goalTimer = useRef()
  function setGoal(n) {
    patchMemberLocal({ daily_goal: n }) // 바로 보이게
    clearTimeout(goalTimer.current)
    goalTimer.current = setTimeout(() => updateMember({ daily_goal: n }).catch((e) => showToast(e.message)), 500)
  }
  async function removeMember(m) {
    if (!confirm(`${m.name}의 프로필과 단어장을 모두 지울까요? 되돌릴 수 없어요.`)) return
    try {
      await db.deleteMember(m.id)
      setMembers((ms) => ms.filter((x) => x.id !== m.id))
      if (m.id === member.id) setMember(null)
    } catch (e) { showToast(e.message) }
  }

  return (
    <div>
      <Header title="내 정보" />
      <div className="card mb-4 flex items-center gap-4 p-4">
        <Blob i={member.avatar} size={64} />
        <div className="flex-1">
          <p className="font-jua text-xl text-slate-deep">{member.name}</p>
          <p className="flex flex-wrap gap-x-2 text-sm text-soft"><span className="whitespace-nowrap">단어 {words.length}개</span><span className="whitespace-nowrap">○ {done}개</span><span className="whitespace-nowrap">최고 연속 {member.best_streak}일</span></p>
        </div>
        <button className="chip" onClick={() => setMember(null)}>바꾸기</button>
      </div>

      <section className="card mb-4 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-jua text-lg text-slate-deep">레벨</h2>
          <Link to="/level-test" className="chip border-tang text-tang">레벨 진단하기</Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {LEVELS.map((l) => (
            <button key={l.id} onClick={() => setLevel(l.id)}
              className={`rounded-2xl border-2 p-3 text-left ${normLevel(member.level) === l.id ? 'border-slate-deep bg-slate/10' : 'border-line'}`}>
              <b className="font-jua text-slate-deep">{l.label}</b>
              <span className="block text-[11px] text-soft">{l.desc}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-soft">기준: 2022 개정 영어과 교육과정 기본 어휘 3,000개를 자주 쓰는 순서로 9단계, Lv.10은 그 밖의 실전 단어예요.</p>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-1 font-jua text-lg text-slate-deep">오늘의 목표</h2>
        <p className="mb-3 text-xs text-soft">기본 5개 · 하루에 맞힐 문제 수이자, 홈에 나오는 오늘의 추천 단어 수예요(최대 50).</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <GoalStepper value={member.daily_goal} onChange={setGoal} />
          <div className="flex gap-1.5">
            {[5, 10, 20, 30].map((n) => (
              <button key={n} onClick={() => setGoal(n)} className={`chip ${member.daily_goal === n ? 'chip-on' : ''}`}>{n}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="card mb-4 flex items-center justify-between p-4">
        <div>
          <h2 className="font-jua text-lg text-slate-deep">효과음</h2>
          <p className="text-xs text-soft">타자 소리·정답·오답 소리 (이 기기에만 적용)</p>
        </div>
        <button role="switch" aria-checked={sound} aria-label="효과음"
          onClick={() => { const v = !sound; setSound(v); setSoundOn(v); if (v) correct() }}
          className={`relative h-8 w-14 rounded-full transition ${sound ? 'bg-sage' : 'bg-line'}`}>
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${sound ? 'left-7' : 'left-1'}`} />
        </button>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-2 font-jua text-lg text-slate-deep">발음 퀴즈 마이크</h2>
        <MicPicker />
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-2 font-jua text-lg text-slate-deep">우리 가족 ({session?.name})</h2>
        <ul className="mb-3 space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3">
              <Blob i={m.avatar} size={36} />
              <span className="flex-1 font-jua">{m.name}</span>
              <button className="text-xs text-soft underline" onClick={() => removeMember(m)}>지우기</button>
            </li>
          ))}
        </ul>
        {adding ? <MemberForm onDone={() => setAdding(false)} onCancel={() => setAdding(false)} /> : <button className="btn-ghost w-full" onClick={() => setAdding(true)}>＋ 가족 추가</button>}
        <p className="mt-2 text-[11px] text-soft">가족 아이디: <b>{session?.login_id}</b> — 다른 기기에서도 이 아이디로 들어오면 같은 단어장이 보여요.</p>
      </section>

      <NotifySection member={member} admin={admin} showToast={showToast} />

      <InviteSection session={session} showToast={showToast} />

      <MyFeedback memberName={member.name} memberId={member.id} />

      <AccountSection session={session} showToast={showToast} openPrivacy={() => setPrivacy(true)}
        onLeft={() => { setSession(null); setMember(null); showToast('탈퇴했어요. 그동안 고마웠어요') }} />

      {aiState === 'nokey' && <p className="mb-3 text-center text-xs text-coral">AI 키(ANTHROPIC_API_KEY)가 아직 연결되지 않았어요.</p>}
      <button className="btn-ghost w-full" onClick={async () => { await db.logout(); setSession(null); setMember(null) }}>로그아웃</button>
      <button className="mt-3 w-full text-center font-jua text-sm text-slate underline" onClick={openIntro}>폴디 소개 다시 보기</button>
      {privacy && <PrivacySheet onClose={() => setPrivacy(false)} />}
      <p className="mt-4 text-center text-[11px] text-soft">폴디 v1.0 · 홈 화면에 추가하면 앱처럼 쓸 수 있어요</p>
    </div>
  )
}
