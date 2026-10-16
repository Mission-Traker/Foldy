// 학습 상태·복습 일정·정렬 — 의존성 없음(단위 테스트 대상)

export const MODES = ['ko', 'en', 'sp'] // ko: 영어 보고 뜻 쓰기, en: 뜻 보고 영어 쓰기, sp: 발음
export const MODE_LABEL = { ko: '영어 → 뜻', en: '뜻 → 영어', sp: '발음' }
export const MODE_FIELD = { ko: 'ko_ok', en: 'en_ok', sp: 'sp_ok' }

// ○ 완료 / △ 학습 중 / × 미학습
export function statusOf(w) {
  if (w.en_ok && w.ko_ok && w.sp_ok) return 'o'
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
    patch.next_review = addDays(today, REVIEW_GAPS[0])
  }
  if (wasO && !isO) {
    patch.review_step = 0
    patch.next_review = null
  }
  if (ok && (w.wrong_modes || []).includes(mode)) {
    patch.wrong_modes = w.wrong_modes.filter((m) => m !== mode)
  }
  return patch
}

// 복습 결과(○ 단어 재출제)
export function applyReview(w, mode, ok, today = ymd()) {
  if (!ok) return { ...applyAnswer(w, mode, false, today) }
  const step = Math.min((w.review_step || 1) + 1, REVIEW_GAPS.length)
  return { review_step: step, next_review: addDays(today, REVIEW_GAPS[step - 1]) }
}

export function isDue(w, today = ymd()) {
  return statusOf(w) === 'o' && !!w.next_review && w.next_review <= today
}

export function sendToWrongNote(w, mode) {
  const set = new Set(w.wrong_modes || [])
  set.add(mode)
  return { wrong_modes: [...set] }
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
export function nextStreak(member, today = ymd()) {
  if (member.last_study === today) return null
  const streak = member.last_study === addDays(today, -1) ? (member.streak || 0) + 1 : 1
  return { streak, best_streak: Math.max(streak, member.best_streak || 0), last_study: today }
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
  next.finally(() => { if (queues.get(id) === next) queues.delete(id) })
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
export function nextCandidates(words, exclude = []) {
  const ex = new Set(exclude)
  const rank = (w) => (statusOf(w) === 'x' ? 1 : 0)
  return words
    .filter((w) => statusOf(w) !== 'o' && !ex.has(w.id))
    .sort((a, b) => rank(a) - rank(b) || (a.seq || 0) - (b.seq || 0))
}
// 저장된 오늘 세트를 지키되, 지워진 단어는 빼고 목표 개수에 모자라면 채움(○가 된 단어는 세트에 그대로 남아 반복 학습)
export function resolveTodaySet(words, savedIds = [], goal = 5) {
  const have = new Set(words.map((w) => w.id))
  const kept = (savedIds || []).filter((id) => have.has(id))
  if (kept.length >= goal) return kept
  return [...kept, ...nextCandidates(words, kept).slice(0, goal - kept.length).map((w) => w.id)]
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
  return member.last_study === today || member.last_study === addDays(today, -1) ? member.streak || 0 : 0
}
