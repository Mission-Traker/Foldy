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

// 발음 채점(유연) — 정석 발음 대비 70% 이상이면 통과
// 음성 인식이 알아들은 말을 철자 유사도와 "소리 유사도"로 비교해 가장 높은 점수를 씀
export function soundKey(s) {
  let t = normalizeEn(s).replace(/[^a-z]/g, '')
  if (!t) return ''
  t = t
    .replace(/^kn|^gn|^pn/, 'n').replace(/^wr/, 'r').replace(/^wh/, 'w').replace(/^x/, 's')
    .replace(/mb$/, 'm').replace(/tch/g, 'ch').replace(/dge|dg/g, 'j').replace(/ph/g, 'f').replace(/gh(?=[^aeiou]|$)/g, '')
    .replace(/ck/g, 'k').replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/q/g, 'k').replace(/x/g, 'ks')
    .replace(/z/g, 's').replace(/th/g, 't').replace(/sh/g, 'S').replace(/ch/g, 'C')
    .replace(/v/g, 'f').replace(/l/g, 'r') // 한국어 화자가 헷갈리는 v/f, l/r 은 같은 소리로
    .replace(/(.)\1+/g, '$1') // 겹자음
    .replace(/e$/, '') // 끝 e 묵음
    .replace(/[aeiouy]+/g, 'a') // 모음은 하나로
  return t
}
function sim(a, b) {
  if (!a || !b) return 0
  const m = Math.max(a.length, b.length)
  return 1 - levenshtein(a, b) / m
}
// 0~1 점수
export function speechScore(alternatives, word) {
  const w = normalizeEn(word)
  const wk = soundKey(word)
  let best = 0
  for (const x of alternatives || []) {
    const t = typeof x === 'string' ? x : x?.t
    if (!t) continue
    const a = normalizeEn(t)
    // 문장으로 들렸으면 그 안에서 가장 비슷한 낱말(또는 두 낱말)과 비교
    const toks = a.split(' ').filter(Boolean)
    const cands = new Set([a, ...toks, ...toks.slice(1).map((tk, i) => toks[i] + ' ' + tk)])
    for (const c of cands) {
      const sc = Math.max(sim(c, w), sim(soundKey(c), wk))
      if (sc > best) best = sc
    }
  }
  return Math.round(best * 100) / 100
}
export const SPEECH_PASS = 0.7
export function gradeSpeech(alternatives, word) {
  return speechScore(alternatives, word) >= SPEECH_PASS
}
