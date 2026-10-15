// 채점 로직 — 의존성 없음(단위 테스트 대상)

export function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

// 한글 뜻 정규화: 괄호 설명·기호·공백 제거, 흔한 어미/조사 떼기
const KO_ENDINGS = ['하는것', '하기', '하다', '하는', '하게', '해요', '합니다', '되다', '스러운', '스럽다', '적인', '적으로', '로운', '롭다', '한', '의', '을', '를', '이다', '다', '요', '것']
export function normalizeKo(s) {
  let t = String(s || '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/[~.,!?'"`·…\-\s]/g, '')
    .trim()
  for (let k = 0; k < 2; k++) {
    for (const e of KO_ENDINGS) {
      const keep = e.length === 1 ? 2 : 1
      if (t.length - e.length >= keep && t.endsWith(e)) { t = t.slice(0, -e.length); break }
    }
  }
  return t
}

export function splitMeanings(meaning) {
  return String(meaning || '')
    .split(/[,;/、·]|\s또는\s/)
    .map((x) => x.trim())
    .filter(Boolean)
}

// 영어 → 한글 뜻 입력 채점(맥락상 맞으면 정답)
// 반환: { ok: boolean, close: boolean }  close = 아깝다(AI 재채점 권유)
export function gradeMeaning(input, meaning, accepted = []) {
  const ans = normalizeKo(input)
  if (!ans) return { ok: false, close: false }
  const cands = [...new Set([...splitMeanings(meaning), ...(accepted || [])])]
    .map(normalizeKo)
    .filter(Boolean)
  for (const c of cands) {
    if (c === ans) return { ok: true, close: false }
    if (Math.min(c.length, ans.length) >= 2 && (c.includes(ans) || ans.includes(c))) return { ok: true, close: false }
    if (Math.min(c.length, ans.length) >= 3 && levenshtein(c, ans) <= 1) return { ok: true, close: false }
  }
  const close = cands.some((c) => levenshtein(c, ans) <= Math.max(2, Math.floor(c.length / 2)))
  return { ok: false, close }
}

export function normalizeEn(s) {
  return String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' -]/g, '').replace(/\s+/g, ' ').trim()
}

// 한글 → 영어 입력 채점(철자는 정확해야 함, 대소문자·앞뒤 공백 무시)
export function gradeSpelling(input, word) {
  const a = normalizeEn(input)
  const w = normalizeEn(word)
  if (!a) return { ok: false, close: false }
  if (a === w) return { ok: true, close: false }
  // 'the apple' 처럼 관사를 붙인 경우 허용
  if (a.replace(/^(a|an|the|to) /, '') === w.replace(/^(a|an|the|to) /, '')) return { ok: true, close: false }
  return { ok: false, close: levenshtein(a, w) <= 1 }
}

// 발음 채점(엄격) — 음성 인식이 "가장 확신하는 결과"가 그 단어일 때만 통과
// 예외: 1순위 확신도가 낮을 때(0.6 미만)만 2·3순위까지 인정 — 인식기 자체가 헷갈린 경우
// alternatives: [{ t: '인식 문장', c: 확신도(0~1) | null }] 또는 문자열 배열
function matchesWord(alt, w) {
  const a = normalizeEn(alt)
  if (!a) return false
  if (a === w) return true
  const toks = a.split(' ')
  if (toks.length <= 3 && toks.includes(w)) return true // "an apple", "the apple"
  if (w.includes(' ') && a === w) return true
  return false
}
export function gradeSpeech(alternatives, word) {
  const w = normalizeEn(word)
  const alts = (alternatives || []).map((x) => (typeof x === 'string' ? { t: x, c: null } : x)).filter((x) => x && x.t)
  if (!alts.length) return false
  if (matchesWord(alts[0].t, w)) return true
  const unsure = alts[0].c != null && alts[0].c < 0.6
  if (unsure) return alts.slice(1, 3).some((x) => matchesWord(x.t, w))
  return false
}
