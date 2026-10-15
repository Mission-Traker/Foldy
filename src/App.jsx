import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import * as db from './lib/db.js'
import { enrichPending } from './lib/enrich.js'
import { enqueue, mergePatchResult, nextStreak, ymd } from './lib/study.js'
import { BottomNav, Confetti, Toast } from './components/ui.jsx'
import { fanfare } from './lib/sfx.js'
import Auth from './pages/Auth.jsx'
import Profiles from './pages/Profiles.jsx'
import Home from './pages/Home.jsx'
import Wordbook from './pages/Wordbook.jsx'
import AddWords from './pages/AddWords.jsx'
import Study from './pages/Study.jsx'
import Quiz from './pages/Quiz.jsx'
import WrongNote from './pages/WrongNote.jsx'
import Expand from './pages/Expand.jsx'
import Me from './pages/Me.jsx'
import LevelTest from './pages/LevelTest.jsx'
import Family from './pages/Family.jsx'
import ProfileSheet from './components/ProfileSheet.jsx'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export default function App() {
  const [session, setSession] = useState(db.getSession())
  const [members, setMembers] = useState([])
  const [member, setMember] = useState(null)
  const [words, setWords] = useState([])
  const [daily, setDaily] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadedFor, setLoadedFor] = useState(null)
  const [toast, setToastMsg] = useState('')
  const [aiState, setAiState] = useState('idle') // idle | busy | nokey | error
  const [profileOpen, setProfileOpen] = useState(false)
  const toastTimer = useRef()
  const loc = useLocation()
  const navTo = useNavigate()

  const showToast = useCallback((msg) => {
    setToastMsg(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(''), 2200)
  }, [])

  // 로그인 후 구성원 불러오기
  useEffect(() => {
    if (!session) return
    db.listMembers().then((ms) => {
      setMembers(ms)
      const saved = db.savedMemberId()
      const m = ms.find((x) => x.id === saved)
      if (m) setMember(m)
    }).catch((e) => {
      showToast(e.message)
      if (/JWT|permission|401/.test(e.message)) { db.logout(); setSession(null) }
    })
  }, [session, showToast])

  // 구성원 선택 시 단어·오늘 기록 불러오기
  useEffect(() => {
    if (!member) return
    setLoading(true)
    Promise.all([db.listWords(member.id), db.getDaily(member.id, ymd())])
      .then(([ws, d]) => { setWords(ws); setDaily(d); setLoadedFor(member.id) })
      .catch((e) => showToast(e.message))
      .finally(() => setLoading(false))
  }, [member?.id, showToast])

  const runEnrich = useCallback(async (list) => {
    if (!member) return
    const pending = (list || []).filter((w) => !w.enriched)
    if (!pending.length) return
    setAiState('busy')
    try {
      const { updated, error } = await enrichPending(pending, member.level)
      if (updated.length) setWords((ws) => ws.map((w) => updated.find((u) => u.id === w.id) || w))
      setAiState(error ? (error.code === 'NO_KEY' ? 'nokey' : 'error') : 'idle')
    } catch {
      setAiState('error')
    }
  }, [member])

  // 처음 불러온 뒤 AI 정보가 없는 단어가 있으면 백그라운드로 채움
  const enrichedOnce = useRef(null)
  useEffect(() => {
    if (!member || loadedFor !== member.id || enrichedOnce.current === member.id) return
    enrichedOnce.current = member.id
    runEnrich(words)
  }, [member, loadedFor, words, runEnrich])

  const patchWord = useCallback(async (id, patch) => {
    setWords((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)))
    try {
      // 같은 단어 저장은 순서대로, 응답은 바꾼 칸만 반영
      const saved = await enqueue(id, () => db.updateWord(id, patch))
      setWords((ws) => ws.map((w) => (w.id === id ? mergePatchResult(w, saved, patch) : w)))
    } catch (e) {
      showToast('저장 실패: ' + e.message)
      // 잠금 해제가 만료된 경우: 다시 비밀번호를 받도록 프로필 선택으로
      if (/잠겨/.test(e.message) && member) { db.forgetMemberToken(member.id); db.saveMemberId(null); setMember(null) }
    }
  }, [showToast, member])

  const addWords = useCallback(async (entries, source) => {
    const { added, skipped } = await db.addWords(member.id, entries, source)
    const merged = [...words, ...added]
    setWords(merged)
    runEnrich(added)
    return { added, skipped }
  }, [member, words, runEnrich])

  const removeWord = useCallback(async (id) => {
    await db.deleteWord(id)
    setWords((ws) => ws.filter((w) => w.id !== id))
  }, [])

  const updateMember = useCallback(async (patch) => {
    const m = await db.updateMember(member.id, patch)
    setMember(m)
    setMembers((ms) => ms.map((x) => (x.id === m.id ? m : x)))
    return m
  }, [member])

  // 정답 하나마다 오늘 기록 +1, 하루 첫 학습이면 연속 학습일 갱신
  const bumpDaily = useCallback(async () => {
    if (!member) return
    const day = ymd()
    const done = (daily?.day === day ? daily.done : 0) + 1
    const row = { member_id: member.id, day, done, recs: daily?.day === day ? daily.recs : null }
    setDaily(row)
    if (done === member.daily_goal) { setTimeout(fanfare, 700); showToast('🎉 오늘 목표 달성!') }
    try { await db.upsertDaily(row) } catch { /* 다음 정답 때 다시 저장 */ }
    const s = nextStreak(member, day)
    if (s) { try { await updateMember(s) } catch { /* */ } }
  }, [member, daily, updateMember, showToast])

  const value = useMemo(() => ({
    session, setSession, members, setMembers, member, patchMemberLocal: (patch) => { setMember((m) => (m ? { ...m, ...patch } : m)); setMembers((ms) => ms.map((x) => (member && x.id === member.id ? { ...x, ...patch } : x))) }, setMember: (m) => { if (member && member.has_pin && member.id !== m?.id) db.forgetMemberToken(member.id); db.saveMemberId(m?.id || null); setMember(m); setWords([]); setDaily(null); enrichedOnce.current = null; if (m) navTo('/') },
    openProfile: () => setProfileOpen(true), words, setWords, loading, ready: !!member && loadedFor === member.id, daily, setDaily, patchWord, addWords, removeWord, updateMember, bumpDaily, showToast, aiState, runEnrich,
  }), [session, members, member, words, loading, loadedFor, daily, patchWord, addWords, removeWord, updateMember, bumpDaily, showToast, aiState, runEnrich])

  const wrongCount = words.filter((w) => (w.wrong_modes || []).length).length
  const fullScreen = /^\/(quiz|expand|add|level-test)/.test(loc.pathname)

  return (
    <Ctx.Provider value={value}>
      <Confetti />
      <div className="mx-auto min-h-screen max-w-md px-4 pb-28">
        {!session ? (
          <Auth />
        ) : !member ? (
          <Profiles />
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/book" element={<Wordbook />} />
            <Route path="/add" element={<AddWords />} />
            <Route path="/study" element={<Study />} />
            <Route path="/quiz/:mode" element={<Quiz />} />
            <Route path="/wrong" element={<WrongNote />} />
            <Route path="/expand" element={<Expand />} />
            <Route path="/me" element={<Me />} />
            <Route path="/level-test" element={<LevelTest />} />
            <Route path="/family" element={<Family />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </div>
      {session && member && !fullScreen && <BottomNav wrongCount={wrongCount} />}
      {profileOpen && member && <ProfileSheet onClose={() => setProfileOpen(false)} />}
      <Toast msg={toast} />
    </Ctx.Provider>
  )
}
