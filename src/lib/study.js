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

// 퀴즈 출제 순서: 해당 모드를 아직 못 맞힌 단어(×, △) 먼저, 그다음 나머지
export function pickQuiz(words, mode, limit = 10) {
  const field = MODE_FIELD[mode]
  const todo = words.filter((w) => !w[field])
  const rest = words.filter((w) => w[field])
  return [...shuffle(todo), ...shuffle(rest)].slice(0, limit)
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
  const next = prev.catch(() => {}).then(job)
  queues.set(id, next)
  next.finally(() => { if (queues.get(id) === next) queues.delete(id) })
  return next
}
