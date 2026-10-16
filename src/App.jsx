import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import * as db from './lib/db.js'
import { enrichPending } from './lib/enrich.js'
import { enqueue, flushQueued, mergePatchResult, nextCandidates, nextStreak, PatchTracker, resolveTodaySet, ymd } from './lib/study.js'
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
import Admin from './pages/Admin.jsx'
import Intro, { introSeen } from './components/Intro.jsx'
import ProfileSheet from './components/ProfileSheet.jsx'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export default function App() {
  const [session, setSession] = useState(db.getSession())
  const [members, setMembers] = useState([])
  const [member, setMember] = useState(null)
  const [words, setWords] = useState([])
  const [daily, setDaily] = useState(null)
  const dailyRef = useRef(null) // 오늘 기록의 최신값(자식 화면 effect가 부모보다 먼저 돌아도 맞는 값을 보게 바로 넣어 둠)
  const [loading, setLoading] = useState(false)
  const [loadedFor, setLoadedFor] = useState(null)
  const [toast, setToastMsg] = useState('')
  const [aiState, setAiState] = useState('idle') // idle | busy | nokey | error
  const [profileOpen, setProfileOpen] = useState(false)
  const [introOpen, setIntroOpen] = useState(() => !introSeen())
  const toastTimer = useRef()
  const tracker = useRef(new PatchTracker())
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
      .then(([ws, d]) => { dailyRef.current = d; setWords(ws); setDaily(d); setLoadedFor(member.id) })
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
      // AI 정보 칸만 반영(그사이 푼 퀴즈 결과를 덮어쓰지 않게)
      const ENRICH = { accepted: 1, syn: 1, ant: 1, example: 1, enriched: 1 }
      if (updated.length) setWords((ws) => ws.map((w) => { const u = updated.find((x) => x.id === w.id); return u ? mergePatchResult(w, u, ENRICH) : w }))
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

  // 화면을 닫거나 다른 앱으로 갈 때 줄 서 있던 저장을 바로 보냄
  useEffect(() => {
    const flush = () => flushQueued()
    const onVis = () => { if (document.visibilityState === 'hidden') flushQueued() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVis)
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  const patchWord = useCallback(async (id, patch) => {
    setWords((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)))
    try {
      // 같은 단어 저장은 순서대로, 응답은 바꾼 칸만 반영
      const ticket = tracker.current.begin(id, patch)
      const saved = await enqueue(id, () => db.updateWord(id, patch))
      // 그사이 더 새로 바뀐 칸은 덮어쓰지 않음
      setWords((ws) => ws.map((w) => (w.id === id ? mergePatchResult(w, saved, tracker.current.fresh(id, ticket)) : w)))
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

  // 오늘 기록(맞힌 수·추천·오늘의 단어·오늘 푼 단어)은 한곳에서 순서대로 저장 — 연달아 바뀌어도 앞 값을 덮어쓰지 않게
  const updateDaily = useCallback((fn) => {
    if (!member) return null
    const day = ymd()
    const cur = dailyRef.current
    const base = cur && cur.day === day && cur.member_id === member.id ? cur : { member_id: member.id, day, done: 0, recs: null, set_ids: [], seen_ids: [] }
    const change = fn({ ...base, set_ids: base.set_ids || [], seen_ids: base.seen_ids || [] })
    if (!change || !Object.keys(change).length) return base
    const next = { ...base, ...change }
    dailyRef.current = next
    setDaily(next)
    enqueue('daily:' + member.id, () => db.upsertDaily(next)).catch(() => { /* 다음 저장 때 같이 감 */ })
    return next
  }, [member])

  // 정답 하나마다 오늘 기록 +1, 하루 첫 학습이면 연속 학습일 갱신
  const bumpDaily = useCallback(async () => {
    if (!member) return
    const day = ymd()
    const next = updateDaily((d) => ({ done: (d.done || 0) + 1 }))
    if (next && next.done === member.daily_goal) { setTimeout(fanfare, 700); showToast('🎉 오늘 목표 달성!') }
    const s = nextStreak(member, day)
    if (s) { try { await updateMember(s) } catch { /* */ } }
  }, [member, updateMember, showToast, updateDaily])

  // 오늘 한 번이라도 푼 단어(오늘 복습에 자동으로 들어감)
  const markSeen = useCallback((id) => {
    updateDaily((d) => (d.seen_ids.includes(id) ? null : { seen_ids: [...d.seen_ids, id] }))
  }, [updateDaily])

  // 오늘의 단어: 하루 목표 개수만큼 고정해 두고 그날은 이 단어들만 반복
  const todayIds = useCallback(() => {
    const d = dailyRef.current
    const saved = d && d.day === ymd() ? d.set_ids || [] : []
    return resolveTodaySet(words, saved, member?.daily_goal || 5)
  }, [words, member])
  const ensureTodaySet = useCallback(() => {
    const ids = todayIds()
    updateDaily((d) => (JSON.stringify(d.set_ids) === JSON.stringify(ids) ? null : { set_ids: ids }))
    return ids
  }, [todayIds, updateDaily])
  const extendTodaySet = useCallback((n) => {
    const cur = todayIds()
    const ids = [...cur, ...nextCandidates(words, cur).slice(0, n).map((w) => w.id)]
    updateDaily(() => ({ set_ids: ids }))
    return ids
  }, [todayIds, words, updateDaily])

  const value = useMemo(() => ({
    session, setSession, members, setMembers, member, patchMemberLocal: (patch) => { setMember((m) => (m ? { ...m, ...patch } : m)); setMembers((ms) => ms.map((x) => (member && x.id === member.id ? { ...x, ...patch } : x))) }, setMember: (m) => { if (member && member.has_pin && member.id !== m?.id) db.forgetMemberToken(member.id); db.saveMemberId(m?.id || null); setMember(m); setWords([]); dailyRef.current = null; setDaily(null); enrichedOnce.current = null; if (m) navTo('/') },
    openProfile: () => setProfileOpen(true), openIntro: () => setIntroOpen(true), words, setWords, loading, ready: !!member && loadedFor === member.id, daily, setDaily, updateDaily, patchWord, addWords, removeWord, updateMember, bumpDaily, markSeen, todayIds, ensureTodaySet, extendTodaySet, showToast, aiState, runEnrich,
  }), [session, members, member, words, loading, loadedFor, daily, updateDaily, patchWord, addWords, removeWord, updateMember, bumpDaily, markSeen, todayIds, ensureTodaySet, extendTodaySet, showToast, aiState, runEnrich])

  const wrongCount = words.filter((w) => (w.wrong_modes || []).length).length
  const fullScreen = /^\/(quiz|expand|add|level-test)/.test(loc.pathname)

  return (
    <Ctx.Provider value={value}>
      <Confetti />
      {introOpen && <Intro onDone={() => setIntroOpen(false)} />}
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
            <Route path="/quiz/:mode" element={<Quiz key={loc.pathname + loc.search} />} />
            <Route path="/wrong" element={<WrongNote />} />
            <Route path="/expand" element={<Expand />} />
            <Route path="/me" element={<Me />} />
            <Route path="/level-test" element={<LevelTest />} />
            <Route path="/family" element={<Family />} />
            <Route path="/admin" element={<Admin />} />
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
