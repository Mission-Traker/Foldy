// 학습 상태·복습 일정·정렬 — 의존성 없음(단위 테스트 대상)

export const MODES = ['ko', 'en', 'sp'] // ko: 영어 보고 뜻 쓰기, en: 뜻 보고 영어 쓰기, sp: 발음
export const MODE_LABEL = { ko: '영어 → 뜻', en: '뜻 → 영어', sp: '발음', dict: '듣고 쓰기', cloze: '빈칸 채우기' }
// 연습 퀴즈(○·복습 기록은 바꾸지 않음, 맞힌 수·연속 학습일에는 들어감)
export const PRACTICE_MODES = ['dict', 'cloze']
// 예문 속 그 단어 자리를 빈칸으로 → { before, after, ans } (예문에 단어가 없으면 null)
export function clozeOf(w) {
  const en = w?.example?.en
  if (!en || !w.word || /\s/.test(w.word.trim())) return null
  const base = w.word.trim().toLowerCase().replace(/[^a-z]/g, '')
  if (base.length < 2) return null
  const stem = base.length > 4 ? base.replace(/e$|y$/, '') : base
  const re = new RegExp(`\\b(${stem}[a-z]*)\\b`, 'i')
  const m = en.match(re)
  if (!m || m[1].length > base.length + 4) return null
  return { before: en.slice(0, m.index), after: en.slice(m.index + m[1].length), ans: m[1], ko: w.example.ko || '' }
}
// 오늘의 단어로 연습 문제(모자라면 다른 단어로 채움, 최대 10개)
export function practiceQueue(words, setIds, mode, rand = Math.random) {
  const ok = (w) => (mode === 'cloze' ? !!clozeOf(w) : true)
  const inSet = setIds.map((id) => words.find((w) => w.id === id)).filter((w) => w && ok(w))
  const rest = shuffle(words.filter((w) => !setIds.includes(w.id) && ok(w)), rand)
  return [...shuffle(inSet, rand), ...rest].slice(0, 10).map((w) => ({ id: w.id, mode, practice: true }))
}
export const MODE_FIELD = { ko: 'ko_ok', en: 'en_ok', sp: 'sp_ok' }

// ○ 완료 / △ 학습 중 / × 미학습
// ○ = 뜻 + 철자. 발음은 ○와 따로 모으는 배지(마이크 환경 때문에 ○가 막히지 않게)
export function statusOf(w) {
  if (w.en_ok && w.ko_ok) return 'o'
  if (w.attempted || w.en_ok || w.ko_ok || w.sp_ok) return 't'
  return 'x'
}
export const STATUS_MARK = { o: '○', t: '△', x: '✕' }
export const STATUS_LABEL = { o: '완료', t: '학습 중', x: '미학습' }

// 확장 단계: none → synant(유의어·반의어 퀴즈) → example(예문 열림)
export function expandStage(w) {
  if (statusOf(w) !== 'o') return 'none'
  if (!w.enriched) return 'synant' // 유의어·반의어를 준비하는 중
  const synDone = w.syn_ok || !w.syn // 자연스러운 유의어·반의어가 없는 단어는 건너뜀
  const antDone = w.ant_ok || !w.ant
  if (synDone && antDone) return 'example'
  return 'synant'
}

// 날짜(로컬 기준 YYYY-MM-DD)
export function ymd(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return ymd(dt)
}

// 퀴즈 한 문제 결과를 단어에 반영 → 바뀐 필드만 반환
export const REVIEW_GAPS = [1, 3, 7, 30, 60]
export function applyAnswer(w, mode, ok, today = ymd()) {
  const field = MODE_FIELD[mode]
  const next = { ...w, attempted: true, [field]: ok }
  const patch = { attempted: true, [field]: ok }
  const wasO = statusOf(w) === 'o'
  const isO = statusOf(next) === 'o'
  if (!wasO && isO) {
    patch.review_step = 1
    patch.ivl = 1
    patch.next_review = addDays(today, 1)
  }
  if (wasO && !isO) {
    // 잊어버린 단어: 다음엔 간격이 덜 벌어지게(ease를 낮춤)
    patch.review_step = 0
    patch.next_review = null
    patch.ivl = 0
    patch.ease = Math.max(EASE_MIN, Math.round(((w.ease || EASE_START) - 0.2) * 100) / 100)
  }
  // 오답노트 단어는 일반 퀴즈에서 한 번 맞혀도 빠지지 않음 — 오답노트 '다시 익히기'에서 서로 다른 날 3번 맞혀야 졸업
  return patch
}

// 똑똑한 복습 간격: 단어마다 ease(배율)를 기억. 맞히면 간격 × ease로 늘고(최대 180일), 틀리면 ease를 낮추고 처음부터
export const EASE_START = 2.5
export const EASE_MIN = 1.3
export const IVL_MAX = 180
export function nextInterval(w) {
  const ivl = Math.max(1, w.ivl || REVIEW_GAPS[Math.max(0, (w.review_step || 1) - 1)] || 1)
  return Math.min(IVL_MAX, Math.max(ivl + 1, Math.round(ivl * (w.ease || EASE_START))))
}
// 복습 결과(○ 단어 재출제)
export function applyReview(w, mode, ok, today = ymd()) {
  if (!ok) return { ...applyAnswer(w, mode, false, today) }
  const ivl = nextInterval(w)
  return {
    review_step: Math.min((w.review_step || 1) + 1, REVIEW_GAPS.length),
    ivl,
    ease: Math.min(3, Math.round(((w.ease || EASE_START) + 0.05) * 100) / 100),
    next_review: addDays(today, ivl),
  }
}

// 이미 아는 단어: 바로 ○(뜻·철자) + 3일 뒤 첫 복습
export function markKnown(w, today = ymd()) {
  return { attempted: true, ko_ok: true, en_ok: true, review_step: 1, ivl: 3, next_review: addDays(today, 3) }
}

// 오늘의 한 판: 복습할 단어 먼저(최대 5) → 오늘의 단어 중 못 맞힌 뜻·철자(최대 10). 둘 다 없으면 오늘의 단어로 연습
export const RUN_REVIEW = 5
export const RUN_MAX = 15
export function dailyRunQueue(words, setIds, today = ymd(), rand = Math.random) {
  const out = []
  const due = words.filter((w) => isDue(w, today)).sort((a, b) => (a.next_review < b.next_review ? -1 : 1)).slice(0, RUN_REVIEW)
  for (const w of due) out.push({ id: w.id, mode: rand() < 0.5 ? 'ko' : 'en', review: true })
  const set = setIds.map((id) => words.find((w) => w.id === id)).filter(Boolean)
  const learn = []
  for (const m of ['ko', 'en']) for (const w of set) if (!w[MODE_FIELD[m]] && !due.includes(w)) learn.push({ id: w.id, mode: m })
  out.push(...shuffle(learn, rand).sort((a, b) => (a.mode === b.mode ? 0 : a.mode === 'ko' ? -1 : 1)).slice(0, RUN_MAX - out.length))
  if (!out.length) for (const w of shuffle(set, rand).slice(0, 10)) out.push({ id: w.id, mode: rand() < 0.5 ? 'ko' : 'en', practice: true })
  return out
}

// 이번 주 성장(월요일부터): 공부한 날·맞힌 수·복습 기억률·한 판 완료
export function weekSummary(rows, today = ymd()) {
  const start = weekStart(today)
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i)
    const r = rows.find((x) => x.day === d)
    days.push({ day: d, done: r?.done || 0, future: d > today })
  }
  const inWeek = rows.filter((r) => r.day >= start && r.day <= today)
  const sum = (k) => inWeek.reduce((a, r) => a + (r[k] || 0), 0)
  const revN = sum('rev_n')
  return {
    start, days,
    studied: days.filter((d) => d.done > 0).length,
    answers: sum('done'),
    review: revN ? Math.round((sum('rev_ok') / revN) * 100) : null,
    runs: inWeek.filter((r) => r.run_done).length,
  }
}

// 가족 공동 목표: 이번 주 모두 N일 이상 공부
export const FAMILY_GOAL_DAYS = 5
export function familyGoal(members, rows, today = ymd()) {
  const start = weekStart(today)
  const per = members.map((m) => ({ m, days: new Set(rows.filter((r) => r.member_id === m.id && r.day >= start && r.day <= today && r.done > 0).map((r) => r.day)).size }))
  return { per, done: per.length > 0 && per.every((x) => x.days >= FAMILY_GOAL_DAYS), goal: FAMILY_GOAL_DAYS }
}

export function isDue(w, today = ymd()) {
  return statusOf(w) === 'o' && !!w.next_review && w.next_review <= today
}

export function sendToWrongNote(w, mode) {
  const set = new Set(w.wrong_modes || [])
  set.add(mode)
  // 새로 들어온 단어(또는 새 방식이 더해진 단어)는 처음부터: 오늘 바로 다시 보기
  return { wrong_modes: [...set], wrong_step: 0, wrong_next: null }
}

// ── 오답노트: 3단계 다시 익히기 + 날짜 간격 졸업 ──
// 서로 다른 날 3번 맞히면 졸업. 1번째 맞힘 → 3일 뒤, 2번째 → 7일 뒤, 3번째 → 졸업
export const WRONG_GOAL = 3
export const WRONG_GAPS = [3, 7]
export const WRONG_DAILY = 3 // 오늘의 학습에 끼워 넣는 다시 볼 단어 수
export const inWrong = (w) => !!(w && (w.wrong_modes || []).length)
export const wrongDue = (w, today = ymd()) => inWrong(w) && (!w.wrong_next || w.wrong_next <= today)
// 다시 볼 순서: 날짜가 지난 것 → 단계가 낮은 것 → 단어 번호
export function wrongDueList(words, today = ymd()) {
  return (words || []).filter((w) => wrongDue(w, today))
    .sort((a, b) => (a.wrong_next || '').localeCompare(b.wrong_next || '') || (a.wrong_step || 0) - (b.wrong_step || 0) || (a.seq || 0) - (b.seq || 0))
}
// 다음에 다시 볼 날이 가장 빠른 단어의 날짜와 그날 볼 단어 수(오늘 볼 단어가 없을 때 안내용)
export function wrongNextVisit(words, today = ymd()) {
  const later = (words || []).filter((w) => inWrong(w) && w.wrong_next && w.wrong_next > today).map((w) => w.wrong_next).sort()
  if (!later.length) return null
  return { day: later[0], count: later.filter((d) => d === later[0]).length }
}
// 3단계(원래 틀린 방식)를 모두 맞혔는지에 따라 단어에 반영할 내용
export function applyWrongResult(w, ok, today = ymd()) {
  if (!ok) return { wrong_step: 0, wrong_next: null }
  const step = Math.min((w.wrong_step || 0) + 1, WRONG_GOAL)
  if (step >= WRONG_GOAL) return { wrong_modes: [], wrong_step: 0, wrong_next: null, wrong_grad: (w.wrong_grad || 0) + 1 }
  return { wrong_step: step, wrong_next: addDays(today, WRONG_GAPS[step - 1]) }
}
// 2단계 쉬운 문제: 뜻 4지선다 보기(정답 + 다른 단어 뜻 최대 3개, 뜻이 같으면 제외)
export function meaningChoices(w, words, rand = Math.random) {
  const seen = new Set([w.meaning])
  const others = []
  for (const x of shuffle((words || []).filter((x) => x.id !== w.id && x.meaning), rand)) {
    if (seen.has(x.meaning)) continue
    seen.add(x.meaning); others.push(x.meaning)
    if (others.length === 3) break
  }
  return shuffle([w.meaning, ...others], rand)
}

// 정렬: seq(번호) / date(추가한 날짜) / abc(알파벳)
export function sortWords(words, by = 'seq', dir = 'asc') {
  const arr = [...words]
  const cmp = {
    seq: (a, b) => a.seq - b.seq,
    date: (a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.seq - b.seq),
    abc: (a, b) => a.word.toLowerCase().localeCompare(b.word.toLowerCase(), 'en'),
  }[by] || ((a, b) => a.seq - b.seq)
  arr.sort(cmp)
  if (dir === 'desc') arr.reverse()
  return arr
}

// 퀴즈 출제: 그 퀴즈를 이미 통과한 단어는 빼고, 남은 단어만 10개씩
export function pickQuiz(words, mode, limit = 10) {
  const field = MODE_FIELD[mode]
  return shuffle(words.filter((w) => !w[field])).slice(0, limit)
}

export function shuffle(arr, rand = Math.random) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 날짜+사람 기준으로 매일 같은 결과가 나오는 난수
export function seeded(seedStr) {
  let h = 2166136261
  for (const ch of seedStr) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 연속 학습일 갱신
// 쉼표: 7일에 한 번, 하루를 통째로 쉬어도 연속 학습일이 끊기지 않음
export const REST_GAP = 7
// 하루 목표의 이만큼을 넘기면 '오늘은 충분해요'(몰아서 하고 끊기는 것을 막음) — 새 단어도 더 열지 않음
export const ENOUGH_X = 3
export function restAvailable(member, today = ymd()) {
  if (!member?.rest_day) return true
  return member.rest_day <= addDays(today, -REST_GAP)
}
export function nextStreak(member, today = ymd()) {
  if (member.last_study === today) return null
  const yesterday = addDays(today, -1)
  let streak = 1
  let rest = null
  if (member.last_study === yesterday) streak = (member.streak || 0) + 1
  else if (member.last_study === addDays(today, -2) && restAvailable(member, today)) { streak = (member.streak || 0) + 1; rest = yesterday }
  const out = { streak, best_streak: Math.max(streak, member.best_streak || 0), last_study: today }
  if (rest) out.rest_day = rest
  return out
}

// 단어 입력 검증(사진·직접 추가 공통)
export function cleanEntry(e) {
  const word = String(e.word || '').trim().replace(/\s+/g, ' ')
  const meaning = String(e.meaning || '').trim().replace(/\s+/g, ' ')
  const errors = []
  if (!word) errors.push('영어 단어가 비어 있어요')
  else if (word.length > 60) errors.push('영어 단어는 60자까지예요')
  else if (!/^[A-Za-z][A-Za-z '\-.]*$/.test(word)) errors.push('영어 단어에는 알파벳만 써 주세요')
  if (!meaning) errors.push('뜻이 비어 있어요')
  else if (meaning.length > 120) errors.push('뜻은 120자까지예요')
  return { word, meaning, errors }
}

// "apple - 사과", "apple: 사과", "apple 사과" 모두 인식
export function parseLines(text) {
  return String(text || '')
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const sep = l.match(/^([^:=\t|]+?)\s*(?:\s-\s|[:=\t|])\s*(.+)$/)
      if (sep) return { word: sep[1].trim(), meaning: sep[2].trim() }
      const k = l.search(/[ㄱ-힝]/) // 첫 한글 위치에서 나눔
      if (k > 0) return { word: l.slice(0, k).replace(/[-\s]+$/, '').trim(), meaning: l.slice(k).trim() }
      return { word: l, meaning: '' }
    })
}


// 서버 응답을 화면 상태에 반영할 때, 이번 요청에서 바꾼 칸만 덮어씀
// (먼저 보낸 요청의 응답이 나중에 바꾼 칸을 되돌리지 않도록)
export function mergePatchResult(current, saved, patch) {
  const out = { ...current }
  for (const k of Object.keys(patch)) if (k in saved) out[k] = saved[k]
  return out
}

// 같은 단어에 대한 저장 요청을 순서대로 실행
const queues = new Map()
export function enqueue(id, job) {
  const prev = queues.get(id) || Promise.resolve()
  // 아직 시작 못 한 저장은 waiting에 두었다가, 화면을 닫을 때(flushQueued) 바로 보낸다
  let started = null
  const start = () => { if (!started) { waiting.delete(start); started = Promise.resolve().then(job) } return started }
  waiting.add(start)
  const next = prev.catch(() => {}).then(start)
  queues.set(id, next)
  next.finally(() => { if (queues.get(id) === next) queues.delete(id) }).catch(() => {}) // 실패는 호출한 쪽에서 처리
  return next
}
const waiting = new Set()
// 앱을 닫거나 새로고침하기 직전: 줄 서 있던 저장을 기다리지 않고 한꺼번에 보냄(keepalive 요청이라 닫혀도 끝까지 감)
export function flushQueued() { for (const start of [...waiting]) start() }
export const pendingSaves = () => queues.size

// 단어별·칸별 저장 순번 — 응답이 왔을 때 그 뒤로 더 바뀐 칸은 건너뜀
export class PatchTracker {
  constructor() { this.v = new Map(); this.n = 0 }
  begin(id, patch) {
    const ticket = {}
    let m = this.v.get(id)
    if (!m) { m = {}; this.v.set(id, m) }
    for (const k of Object.keys(patch)) { m[k] = ++this.n; ticket[k] = m[k] }
    return { patch, ticket }
  }
  // 아직 최신인 칸만 남긴 patch
  fresh(id, { patch, ticket }) {
    const m = this.v.get(id) || {}
    const out = {}
    for (const k of Object.keys(patch)) if (m[k] === ticket[k]) out[k] = patch[k]
    return out
  }
}

// ── 오늘의 단어(하루 목표 개수만큼 고정) ──
// 아직 ○가 아닌 단어 중: 학습 중(△) → 미학습(✕), 같은 상태면 번호 순
// later: 바로 전날 오늘의 단어 — 다 못 끝냈어도 새 날엔 다른 단어부터 하고, 모자랄 때만 다시 넣음(다음 날 다시 돌아옴)
export function nextCandidates(words, exclude = [], later = []) {
  const ex = new Set(exclude)
  const lt = new Set(later || [])
  const rank = (w) => (lt.has(w.id) ? 2 : 0) + (statusOf(w) === 'x' ? 1 : 0)
  return words
    .filter((w) => statusOf(w) !== 'o' && !ex.has(w.id))
    .sort((a, b) => rank(a) - rank(b) || (a.seq || 0) - (b.seq || 0))
}
// 오늘의 단어 수는 '하루 목표 + 직접 더 하기로 한 개수(extra)'로 고정
// 저장된 세트를 지키되, 지워진 단어는 빼고, 많으면 뒤에서부터(오늘 아직 안 푼 단어 먼저) 덜어 내고, 모자라면 채움(○가 된 단어는 세트에 그대로 남아 반복 학습)
export function resolveTodaySet(words, savedIds = [], goal = 5, seenIds = [], extra = 0, restIds = []) {
  const have = new Set(words.map((w) => w.id))
  const cap = Math.max(1, goal + (extra || 0))
  let kept = (savedIds || []).filter((id, i, a) => have.has(id) && a.indexOf(id) === i)
  if (kept.length > cap) kept = trimSet(kept, cap, seenIds)
  if (kept.length >= cap) return kept
  return [...kept, ...nextCandidates(words, kept, restIds).slice(0, cap - kept.length).map((w) => w.id)]
}
// 뒤에서부터 덜어 냄: 오늘 이미 푼 단어는 되도록 남김
export function trimSet(ids, cap, seenIds = []) {
  const seen = new Set(seenIds || [])
  const out = [...ids]
  for (let i = out.length - 1; i >= 0 && out.length > cap; i--) if (!seen.has(out[i])) out.splice(i, 1)
  return out.slice(0, cap)
}
// 단어장에서 고른 단어를 맨 앞에 넣고, 개수는 그대로(뒤에서 하나 덜어 냄) → { ids, dropped }
export function sendToSet(ids, id, cap, seenIds = []) {
  if (ids.includes(id)) return { ids, dropped: [] }
  const next = trimSet([id, ...ids], cap, [...(seenIds || []), id])
  return { ids: next, dropped: ids.filter((x) => !next.includes(x)) }
}
// 퀴즈 한 판: 오늘 세트 중 이 퀴즈를 아직 못 맞힌 단어. 모두 맞혔으면 오늘 세트 전체를 다시(외울 때까지 반복)
export function todayQueue(words, setIds, mode) {
  const set = setIds.map((id) => words.find((w) => w.id === id)).filter(Boolean)
  const left = set.filter((w) => !w[MODE_FIELD[mode]])
  if (left.length) return shuffle(left).map((w) => ({ id: w.id, mode }))
  return shuffle(set).map((w) => ({ id: w.id, mode, practice: true }))
}
// 오늘 복습: 복습 날짜가 된 ○ 단어 + 오늘 한 번이라도 푼 단어
export function reviewQueue(words, seenIds = [], today = ymd(), rand = Math.random) {
  const out = []
  const used = new Set()
  for (const w of words) if (isDue(w, today)) { out.push({ id: w.id, mode: rand() < 0.5 ? 'ko' : 'en', review: true }); used.add(w.id) }
  for (const id of seenIds) {
    const w = words.find((x) => x.id === id)
    if (w && !used.has(id)) { out.push({ id, mode: rand() < 0.5 ? 'ko' : 'en', practice: true }); used.add(id) }
  }
  return shuffle(out, rand).slice(0, 40)
}
export const reviewCount = (words, seenIds = [], today = ymd()) => {
  const ids = new Set(words.filter((w) => isDue(w, today)).map((w) => w.id))
  const have = new Set(words.map((w) => w.id))
  for (const id of seenIds) if (have.has(id)) ids.add(id)
  return ids.size
}
// 화면에 보일 연속 학습일: 어제나 오늘 공부했으면 이어지는 중, 그보다 오래됐으면 0(끊김)
export function liveStreak(member, today = ymd()) {
  if (!member?.last_study) return 0
  if (member.last_study === today || member.last_study === addDays(today, -1)) return member.streak || 0
  // 어제 하루 쉬었지만 쉼표가 남아 있으면 오늘 하면 이어짐
  if (member.last_study === addDays(today, -2) && restAvailable(member, today)) return member.streak || 0
  return 0
}
// 연속일이 지금 쉼표 덕분에 살아 있는지(오늘 해야 이어짐)
export const onRest = (member, today = ymd()) => !!member?.last_study && member.last_study === addDays(today, -2) && restAvailable(member, today) && (member.streak || 0) > 0

// 갉아먹기 장면(오래 쉬었다 돌아왔을 때) — 실제 단어는 바꾸지 않는 연출
// 며칠 쉬었는지: 마지막 학습일로부터 2일 이상 지났거나(=하루 이상 통째로 쉼) 학습 알림으로 들어왔을 때만
export function gnawDays(member, today = ymd(), fromPush = false) {
  if (!member?.last_study) return 0
  const [a, b] = [member.last_study, today].map((s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) })
  const days = Math.round((b - a) / 86400000)
  if (days >= 2) return days
  if (fromPush && days >= 1) return days
  return 0
}
// 갉아먹을 단어 3개: 복습할 때가 된 단어 → 공부했던(○·△) 단어, 글자 3개 이상
export function pickGnawWords(words, today = ymd(), n = 3) {
  const ok = (w) => /^[a-z][a-z'-]{2,13}$/i.test(String(w.word || '').trim())
  const due = words.filter((w) => ok(w) && isDue(w, today))
  const studied = words.filter((w) => ok(w) && !isDue(w, today) && statusOf(w) !== 'x')
  const rest = words.filter((w) => ok(w) && statusOf(w) === 'x')
  const rand = seeded(today + (words[0]?.member_id || ''))
  return [...shuffle(due, rand), ...shuffle(studied, rand), ...shuffle(rest, rand)].slice(0, n)
}
export const gnawEat = (word) => Math.max(1, Math.min(word.length - 2, Math.ceil(word.length * 0.45)))

// ── 가족 주간 순위: 이번 주(월요일부터) 하루 목표를 얼마나 채웠나(레벨·목표가 달라도 공평하게 %)
export function weekStart(today = ymd()) {
  const [y, m, d] = today.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=일
  return addDays(today, -((dow + 6) % 7))
}
export function familyWeekRank(members, dailyRows, today = ymd()) {
  const start = weekStart(today)
  return members.map((m) => {
    const created = String(m.created_at || '').slice(0, 10)
    // 이번 주에 가입했으면 가입한 날부터
    const from = created && created > start ? created : start
    let days = 0
    for (let d = from; d <= today; d = addDays(d, 1)) days++
    const goal = Math.max(1, m.daily_goal || 5)
    let sum = 0, studied = 0
    for (const r of dailyRows) {
      if (r.member_id !== m.id || r.day < from || r.day > today) continue
      sum += Math.min(r.done || 0, goal)
      if ((r.done || 0) > 0) studied++
    }
    const pct = days ? Math.round((sum / (goal * days)) * 100) : 0
    return { m, pct, studied, days }
  }).sort((a, b) => b.pct - a.pct || b.studied - a.studied)
}

// ── 시험 대비: 시험 날까지 남은 날로 나눈 오늘 분량(한→영·영→한을 둘 다 맞힌 단어 = 준비 끝)
export const examReady = (w) => !!(w && w.ko_ok && w.en_ok)
export function daysUntil(dateStr, today = ymd()) {
  const t = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  return Math.round((t(dateStr) - t(today)) / 86400000)
}
export function examPlan(exam, words, today = ymd()) {
  const byId = new Map(words.map((w) => [w.id, w]))
  const list = (exam.word_ids || []).map((id) => byId.get(id)).filter(Boolean)
  const ready = list.filter(examReady)
  const left = list.filter((w) => !examReady(w)).sort((a, b) => (a.seq || 0) - (b.seq || 0))
  const dday = daysUntil(exam.exam_date, today)
  // 시험 당일은 남은 것 전부, 전날까지는 남은 날(오늘 포함)로 나눔
  const slots = Math.max(1, dday)
  const todayN = dday < 0 ? 0 : Math.ceil(left.length / slots)
  return { total: list.length, ready: ready.length, left, today: left.slice(0, todayN), dday, missing: (exam.word_ids || []).length - list.length }
}

// 이름(닉네임)은 한 달에 한 번: 마지막으로 바꾼 날 + 1달(같은 날짜, 그달에 없으면 말일) — 서버 트리거와 같은 규칙
export function nameNextChange(changedAt) {
  if (!changedAt) return null
  // 서버(UTC)의 '+ 1 month'와 같은 계산: 다음 달 같은 날짜, 그 달에 없으면 말일
  const d = new Date(changedAt)
  const y = d.getUTCFullYear(), mo = d.getUTCMonth() + 1
  const last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, mo, Math.min(d.getUTCDate(), last), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()))
}
export function nameLocked(changedAt, now = new Date()) {
  const n = nameNextChange(changedAt)
  return n && now < n ? n : null
}
