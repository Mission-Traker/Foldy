import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import * as db from './lib/db.js'
import { enrichPending, personalize, storyOn } from './lib/enrich.js'
import { enqueue, flushQueued, mergePatchResult, nextCandidates, nextStreak, PatchTracker, resolveTodaySet, sendToSet, ymd, gnawDays, pickGnawWords, reviewCount, wrongDue, ENOUGH_X } from './lib/study.js'
import { BottomNav, Confetti, Toast } from './components/ui.jsx'
import { fanfare } from './lib/sfx.js'
import { levelProgress, normLevel } from './lib/levels.js'
import { cacheGet, cacheSet, isNetErr, outboxAdd, outboxFlush, outboxSize } from './lib/offline.js'
import Auth from './pages/Auth.jsx'
import Profiles from './pages/Profiles.jsx'
import Home from './pages/Home.jsx'
import Wordbook from './pages/Wordbook.jsx'
import AddWords from './pages/AddWords.jsx'
import Study from './pages/Study.jsx'
import Quiz from './pages/Quiz.jsx'
import WrongNote from './pages/WrongNote.jsx'
import WrongPractice from './pages/WrongPractice.jsx'
import Expand from './pages/Expand.jsx'
import Me from './pages/Me.jsx'
import LevelTest from './pages/LevelTest.jsx'
import Family from './pages/Family.jsx'
import Admin, { LandingPreview } from './pages/Admin.jsx'
import Intro, { introSeen } from './components/Intro.jsx'
import GnawIntro from './components/GnawIntro.jsx'
import Challenge from './pages/Challenge.jsx'
import Exam from './pages/Exam.jsx'
import Sort from './pages/Sort.jsx'
import Week from './pages/Week.jsx'
import InAppBanner from './components/InAppBanner.jsx'
import ProfileSheet from './components/ProfileSheet.jsx'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export default function App() {
  const [session, setSession] = useState(db.getSession())
  // 새로고침 때 로그인·프로필 화면이 잠깐 보이지 않게: 마지막 구성원 목록으로 바로 그리고 뒤에서 새로 받음
  const [members, setMembers] = useState(() => (session && cacheGet('members:' + session.family_id)) || [])
  const [member, setMember] = useState(() => {
    const ms = session && cacheGet('members:' + session.family_id)
    const saved = db.savedMemberId()
    return (ms && saved && ms.find((x) => x.id === saved)) || null
  })
  const [membersReady, setMembersReady] = useState(false)
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

  // 사파리로 넘어온 경우: 한 번 쓰는 코드로 로그인 이어받기(#/handoff?c=…&to=/quiz/sp)
  const handoffTo = useRef(null)
  useEffect(() => {
    const m = window.location.hash.match(/^#\/handoff\?(.*)$/)
    if (!m) return
    const p = new URLSearchParams(m[1])
    window.history.replaceState(null, '', '#/')
    try { localStorage.setItem('foldy.introSeen', '1') } catch { /* */ }
    setIntroOpen(false)
    db.handoffRedeem(p.get('c') || '')
      .then(() => { handoffTo.current = p.get('to') || '/'; setSession(db.getSession()) })
      .catch((e) => showToast(e.message))
  }, [showToast])
  useEffect(() => {
    if (member && handoffTo.current) { const to = handoffTo.current; handoffTo.current = null; navTo(to) }
  }, [member, navTo])

  // 로그인 후 구성원 불러오기
  useEffect(() => {
    if (!session) return
    db.listMembers().catch((e) => {
      // 인터넷이 없으면 마지막으로 받은 구성원으로
      const c = isNetErr(e) && cacheGet('members:' + session.family_id)
      if (c) return c
      throw e
    }).then((ms) => {
      // 구성원이 하나도 안 보이면: 다른 기기에서 비밀번호를 바꿔 이 기기 로그인이 끝난 경우만 로그아웃
      if (!ms.length) db.sessionAlive().then(async (ok) => { if (ok === false) { await db.logout(); setSession(null); showToast('가족 비밀번호가 바뀌어서 다시 로그인해 주세요') } })
      setMembers(ms)
      const saved = db.savedMemberId()
      const found = ms.find((x) => x.id === saved)
      // 다른 기기에서 숫자 비밀번호가 걸렸는데 이 기기는 아직 안 열었으면: 프로필 고르기(비밀번호 입력)로
      const m = found && found.has_pin && !db.hasMemberToken(found.id) ? null : found
      // 같은 사람이면 새 정보만 덮고(단어를 다시 불러오지 않게), 없어진 사람이면 프로필 고르기로
      setMember((cur) => (m ? (cur && cur.id === m.id ? { ...cur, ...m } : m) : null))
      setMembersReady(true)
    }).catch((e) => {
      setMembersReady(true)
      showToast(e.message)
      // 로그아웃 버튼을 누르기 전엔 로그인을 유지: 로그인이 정말 끝났을 때만 로그인 화면으로
      db.sessionAlive().then((ok) => { if (ok === false) { db.logout(); setSession(null) } })
    })
  }, [session, showToast])

  // 구성원 선택 시 단어·오늘 기록 불러오기
  // 앱을 켜 둔 채 자정이 지나면 화면을 새 날짜로 다시 그림(오늘 맞힌 수·오늘의 단어·연속 학습일)
  const [today, setToday] = useState(ymd())
  useEffect(() => {
    const check = () => { const d = ymd(); setToday((t) => (t === d ? t : d)) }
    const t = setInterval(check, 30000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check) }
  }, [])
  // 바로 전날의 오늘의 단어(새 날엔 다른 단어부터)
  const [prevSet, setPrevSet] = useState([])
  useEffect(() => {
    const d = dailyRef.current
    if (d && d.day !== today) setPrevSet(d.set_ids || [])
  }, [today])
  const [loadError, setLoadError] = useState('')
  const [loadTry, setLoadTry] = useState(0)
  useEffect(() => {
    if (!member) return
    setLoading(true)
    setLoadError('')
    const id = member.id
    let alive = true // 그사이 다른 구성원으로 바뀌면 늦게 온 결과는 버림
    Promise.all([db.listWords(id), db.getDaily(id, ymd()), db.getPrevSetIds(id, ymd()).catch(() => [])])
      .catch((e) => {
        // 인터넷이 없으면 이 기기에 저장해 둔 단어로 공부(푼 답은 연결되면 보냄)
        const ws = isNetErr(e) && cacheGet('words:' + id)
        if (!ws) throw e
        const d = cacheGet('daily:' + id)
        showToast('오프라인이에요 · 저장해 둔 단어로 공부해요')
        return [ws, d && d.day === ymd() ? d : null, d && d.day !== ymd() ? d.set_ids || [] : []]
      })
      .then(([ws, d, prev]) => { if (!alive) return; dailyRef.current = d; setPrevSet(prev || []); setWords(ws); setDaily(d); setLoadedFor(id) })
      .catch((e) => { if (alive) setLoadError(e.message || '단어를 불러오지 못했어요') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [member?.id, loadTry])

  // 로그아웃하면 이전 가족의 구성원·단어를 화면에서 비움
  useEffect(() => {
    if (session) return
    setMembers([]); setMember(null); setMembersReady(false); setWords([]); setDaily(null); setLoadedFor(null)
    dailyRef.current = null
  }, [session])

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
      // 나만의 예문을 켰으면 새 단어 예문을 내 이야기로 바꿈(조용히, 실패해도 기본 예문 유지)
      if (updated.length && storyOn(member)) {
        personalize(updated, member).then((mine) => {
          if (mine.length) setWords((ws) => ws.map((w) => { const u = mine.find((x) => x.id === w.id); return u ? mergePatchResult(w, u, { example: 1 }) : w }))
        }).catch(() => {})
      }
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

  // 오프라인 대비: 구성원·받은 단어·오늘 기록을 기기에 보관
  useEffect(() => { if (session && members.length) cacheSet('members:' + session.family_id, members) }, [members, session])
  useEffect(() => { if (member && loadedFor === member.id) { const t = setTimeout(() => cacheSet('words:' + member.id, words), 400); return () => clearTimeout(t) } }, [words, member, loadedFor])
  useEffect(() => { if (member && daily) cacheSet('daily:' + member.id, daily) }, [daily, member])
  // 인터넷이 돌아오면 모아 둔 답을 보냄
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false)
  const flushOutbox = useCallback(async () => {
    if (!outboxSize()) return
    const ok = await outboxFlush((kind, id, patch) => (kind === 'daily' ? db.upsertDaily(patch) : db.updateWord(id, patch)))
    if (ok) showToast('오프라인에서 푼 기록을 저장했어요')
  }, [showToast])
  useEffect(() => {
    const on = () => { setOnline(true); flushOutbox() }
    const off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    if (session) flushOutbox()
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [session, flushOutbox])

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
      if (isNetErr(e)) { outboxAdd('word', id, patch); return } // 연결되면 보냄
      showToast('저장 실패: ' + e.message)
      // 잠금 해제가 만료된 경우: 다시 비밀번호를 받도록 프로필 선택으로
      if (/잠겨/.test(e.message) && member) { db.forgetMemberToken(member.id); db.saveMemberId(null); setMember(null) }
    }
  }, [showToast, member])

  const addWords = useCallback(async (entries, source) => {
    const { added, skipped } = await db.addWords(member.id, entries, source)
    // 연달아 담아도 앞에 담은 단어가 사라지지 않게(최신 목록에 덧붙임)
    setWords((ws) => [...ws, ...added.filter((a) => !ws.some((w) => w.id === a.id))])
    runEnrich(added)
    return { added, skipped }
  }, [member, runEnrich])

  const removeWord = useCallback(async (id) => {
    await db.deleteWord(id)
    setWords((ws) => ws.filter((w) => w.id !== id))
  }, [])

  const removeWords = useCallback(async (ids) => {
    const n = await db.deleteWords(ids)
    const gone = new Set(ids)
    setWords((ws) => ws.filter((w) => !gone.has(w.id)))
    return n
  }, [])

  const updateMember = useCallback(async (patch) => {
    // 레벨이 바뀌면 그 순간의 경험치를 기준점으로(새 레벨 게이지는 0부터)
    if (patch.level && normLevel(patch.level) !== normLevel(member.level)) patch = { ...patch, level_base: levelProgress(words, patch.level).total }
    const m = await db.updateMember(member.id, patch)
    setMember(m)
    setMembers((ms) => ms.map((x) => (x.id === m.id ? m : x)))
    return m
  }, [member, words])

  // 오늘 기록(맞힌 수·추천·오늘의 단어·오늘 푼 단어)은 한곳에서 순서대로 저장 — 연달아 바뀌어도 앞 값을 덮어쓰지 않게
  const updateDaily = useCallback((fn) => {
    if (!member) return null
    const day = ymd()
    const cur = dailyRef.current
    const base = cur && cur.day === day && cur.member_id === member.id ? cur : { member_id: member.id, day, done: 0, recs: null, set_ids: [], seen_ids: [], extra: 0 }
    const change = fn({ ...base, set_ids: base.set_ids || [], seen_ids: base.seen_ids || [] })
    if (!change || !Object.keys(change).length) return base
    const next = { ...base, ...change }
    dailyRef.current = next
    setDaily(next)
    enqueue('daily:' + member.id, () => db.upsertDaily(next)).catch((e) => { if (isNetErr(e)) outboxAdd('daily', member.id, next) })
    return next
  }, [member])

  // 정답 하나마다 오늘 기록 +1, 하루 첫 학습이면 연속 학습일 갱신
  const bumpDaily = useCallback(async () => {
    if (!member) return
    const day = ymd()
    const next = updateDaily((d) => ({ done: (d.done || 0) + 1 }))
    if (next && next.done === member.daily_goal) { setTimeout(fanfare, 700); showToast('🎉 오늘 목표 달성!') }
    if (next && next.done === member.daily_goal * ENOUGH_X) showToast('🌙 오늘은 충분해요! 쉬었다가 내일 하면 더 오래 기억나요')
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
    const today = d && d.day === ymd() ? d : null
    const rest = d && d.day !== ymd() ? d.set_ids || [] : prevSet
    return resolveTodaySet(words, saved, member?.daily_goal || 5, today?.seen_ids || [], today?.extra || 0, rest)
  }, [words, member, prevSet])
  const ensureTodaySet = useCallback(() => {
    const ids = todayIds()
    updateDaily((d) => (JSON.stringify(d.set_ids) === JSON.stringify(ids) ? null : { set_ids: ids }))
    return ids
  }, [todayIds, updateDaily])
  // '새 단어 더 하기': 오늘의 단어 수를 직접 늘림(extra에 기록해 다음 계산에도 유지)
  const extendTodaySet = useCallback((n) => {
    const cur = todayIds()
    const add = nextCandidates(words, cur, prevSet).slice(0, n).map((w) => w.id)
    const ids = [...cur, ...add]
    updateDaily((d) => ({ set_ids: ids, extra: (d.extra || 0) + add.length }))
    return ids
  }, [todayIds, words, updateDaily, prevSet])

  // 단어장에서 고른 단어를 오늘의 단어 맨 앞에 넣고 개수는 그대로(아직 안 푼 단어 하나가 빠짐) → 빠진 단어 id 목록
  const sendToToday = useCallback((id) => {
    const cur = todayIds()
    if (cur.includes(id)) return null
    const d = dailyRef.current
    const seen = d && d.day === ymd() ? d.seen_ids || [] : []
    const { ids, dropped } = sendToSet(cur, id, cur.length, seen)
    updateDaily(() => ({ set_ids: ids }))
    return dropped
  }, [todayIds, updateDaily])

  // 최근 단어 예문을 내 이야기로 다시 만들기(내 정보에서)
  const remakeStory = useCallback(async (n = 10) => {
    if (!member || !storyOn(member)) return 0
    const pick = [...words].filter((w) => w.enriched).sort((a, b) => (b.seq || 0) - (a.seq || 0)).slice(0, n)
    const mine = await personalize(pick, member)
    if (mine.length) setWords((ws) => ws.map((w) => { const u = mine.find((x) => x.id === w.id); return u ? mergePatchResult(w, u, { example: 1 }) : w }))
    return mine.length
  }, [member, words])

  const value = useMemo(() => ({
    session, setSession, members, setMembers, member, patchMemberLocal: (patch) => { setMember((m) => (m ? { ...m, ...patch } : m)); setMembers((ms) => ms.map((x) => (member && x.id === member.id ? { ...x, ...patch } : x))) }, setMember: (m) => { if (member && member.has_pin && member.id !== m?.id) db.forgetMemberToken(member.id); db.saveMemberId(m?.id || null); setMember(m); setWords([]); setLoadedFor(null); setLoadTry((n) => n + 1); dailyRef.current = null; setDaily(null); enrichedOnce.current = null; if (m) navTo('/') },
    openProfile: () => setProfileOpen(true), openIntro: () => setIntroOpen(true), words, setWords, loading, ready: !!member && loadedFor === member.id, daily, setDaily, updateDaily, patchWord, addWords, removeWord, removeWords, updateMember, bumpDaily, markSeen, todayIds, ensureTodaySet, extendTodaySet, sendToToday, remakeStory, showToast, aiState, runEnrich, today,
  }), [today, session, members, member, words, loading, loadedFor, daily, updateDaily, patchWord, addWords, removeWord, removeWords, updateMember, bumpDaily, markSeen, todayIds, ensureTodaySet, extendTodaySet, sendToToday, remakeStory, showToast, aiState, runEnrich])

  const wrongCount = words.filter((w) => wrongDue(w)).length // 오늘 다시 볼 단어만 배지로
  // 오래 쉬었다 들어오면(또는 학습 알림으로 들어오면) 하루 한 번 '갉아먹기' 장면 — 단어는 그대로
  const [gnaw, setGnaw] = useState(null)
  const fromPush = useRef(/[?&]gnaw=1/.test(window.location.hash))
  useEffect(() => {
    // 서버에서 받은 최신 구성원 정보로 판단(이 기기에 저장해 둔 옛 정보로 '며칠 만'을 잘못 세지 않게)
    if (!member || !membersReady || loadedFor !== member.id || introOpen || gnaw) return
    const push = fromPush.current
    fromPush.current = false
    if (/[?&]gnaw=1/.test(loc.search)) navTo('/', { replace: true })
    const today = ymd()
    const key = `foldy.gnaw.${member.id}`
    let seen = null
    try { seen = localStorage.getItem(key) } catch { /* */ }
    if (seen === today) return
    const days = gnawDays(member, today, push)
    if (!days) return
    const picks = pickGnawWords(words, today)
    if (!picks.length) return
    try { localStorage.setItem(key, today) } catch { /* */ }
    setGnaw({ days, words: picks.map((w) => ({ word: w.word, meaning: w.meaning })) })
  }, [member, membersReady, loadedFor, introOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const fullScreen = /^\/(quiz|expand|add|level-test|exam\/new|wrong\/practice|admin\/landing|sort)/.test(loc.pathname)

  return (
    <Ctx.Provider value={value}>
      <Confetti />
      {!online && <div className="fixed inset-x-0 top-0 z-[55] bg-slate-deep py-1 text-center font-jua text-xs text-white">오프라인이에요 · 푼 답은 연결되면 저장돼요</div>}
      {introOpen && <Intro onDone={() => setIntroOpen(false)} />}
      {gnaw && member && (
        <GnawIntro name={member.name} days={gnaw.days} words={gnaw.words}
          onClose={() => setGnaw(null)}
          onRescue={() => { const d = dailyRef.current; setGnaw(null); navTo(reviewCount(words, d && d.day === ymd() ? d.seen_ids : []) > 0 ? '/quiz/review' : '/study') }} />
      )}
      <div className="mx-auto min-h-screen max-w-md px-4 pb-28">
        {!session ? (
          <Auth />
        ) : !member && !membersReady && db.savedMemberId() ? (
          <div className="flex min-h-screen items-center justify-center text-soft" aria-busy="true">불러오는 중…</div>
        ) : !member ? (
          <Profiles />
        ) : loadError && loadedFor !== member.id ? (
          <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
            <p className="font-jua text-xl text-slate-deep">단어를 불러오지 못했어요</p>
            <p className="text-sm text-soft">{loadError}</p>
            <button className="btn-main" onClick={() => setLoadTry((n) => n + 1)}>다시 시도</button>
            <button className="text-sm text-soft underline" onClick={() => { db.saveMemberId(null); setMember(null) }}>프로필 다시 고르기</button>
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/book" element={<Wordbook />} />
            <Route path="/add" element={<AddWords />} />
            <Route path="/study" element={<Study />} />
            <Route path="/quiz/:mode" element={<Quiz key={loc.pathname + loc.search} />} />
            <Route path="/wrong" element={<WrongNote />} />
            <Route path="/wrong/practice" element={<WrongPractice />} />
            <Route path="/expand" element={<Expand />} />
            <Route path="/me" element={<Me />} />
            <Route path="/level-test" element={<LevelTest />} />
            <Route path="/family" element={<Family />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/landing" element={<LandingPreview />} />
            <Route path="/challenge/:id" element={<Challenge />} />
            <Route path="/exam/:id" element={<Exam />} />
            <Route path="/sort" element={<Sort />} />
            <Route path="/week" element={<Week />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </div>
      {session && member && !fullScreen && <BottomNav wrongCount={wrongCount} />}
      {profileOpen && member && <ProfileSheet onClose={() => setProfileOpen(false)} />}
      <InAppBanner />
      <Toast msg={toast} />
    </Ctx.Provider>
  )
}
