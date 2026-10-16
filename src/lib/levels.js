import LEVEL_WORDS from '../data/levels.json'
import { seeded, shuffle } from './study.js'

// 2022 개정 영어과 교육과정 [별표 3] 기본 어휘 3,000개를 자주 쓰는 순서로 10단계로 나눔
// Lv.01~03: 초등 권장 800 / Lv.04~06: 중·고 공통 1,200 / Lv.07~09: 나머지 / Lv.10: 목록 밖(AI 추천)
export const LEVELS = [
  { id: 'L1', desc: '가장 쉬운 첫 단어 211개' },
  { id: 'L2', desc: '생활 속 기본 단어 256개' },
  { id: 'L3', desc: '기본 800단어 마무리' },
  { id: 'L4', desc: '필수 1,200단어 · 1단계' },
  { id: 'L5', desc: '필수 1,200단어 · 2단계' },
  { id: 'L6', desc: '필수 1,200단어 완성' },
  { id: 'L7', desc: '기본 3,000단어 · 1단계' },
  { id: 'L8', desc: '기본 3,000단어 · 2단계' },
  { id: 'L9', desc: '기본 3,000단어 완성' },
  { id: 'L10', desc: '기본 어휘 밖 실전 단어(AI 추천)' },
].map((l, i) => ({ ...l, label: `Lv.${String(i + 1).padStart(2, '0')}`, short: `Lv.${String(i + 1).padStart(2, '0')}` }))

// 예전 레벨 값(e1·e3·e5·m·h·a)도 새 단계로 읽음
const LEGACY = { e1: 'L1', e3: 'L2', e5: 'L3', m: 'L4', h: 'L7', a: 'L10' }
export const normLevel = (id) => LEGACY[id] || (LEVELS.some((l) => l.id === id) ? id : 'L1')
export const levelLabel = (id) => LEVELS.find((l) => l.id === normLevel(id))?.label || ''
export const levelDesc = (id) => LEVELS.find((l) => l.id === normLevel(id))?.desc || ''

export function wordsOfLevel(id) {
  const k = normLevel(id)
  if (k === 'L10') return LEVEL_WORDS.L9
  return LEVEL_WORDS[k] || LEVEL_WORDS.L1
}

// 레벨 목록에서 오늘의 추천 n개(이미 가진 단어 제외, 날짜·사람별로 고정)
export function dailyPick(levelId, ownedLower, seedStr, n = 5) {
  const pool = wordsOfLevel(levelId).filter((w) => !ownedLower.has(w.toLowerCase()))
  return shuffle(pool, seeded(seedStr)).slice(0, n)
}

// 레벨 진단용 샘플(레벨마다 5개)
export function levelTestSet(seedStr) {
  const rand = seeded(seedStr)
  return LEVELS.filter((l) => l.id !== 'L10').map((l) => ({
    level: l.id,
    words: shuffle(LEVEL_WORDS[l.id], rand).slice(0, 5),
  }))
}

// 레벨마다 5개 중 4개 이상 알면 통과 → 처음으로 통과 못 한 레벨을 추천
export function recommendLevel(results) {
  for (const r of results) {
    if ((r.known || 0) < 4) return r.level
  }
  return 'L10'
}

// 레벨업 게이지: 지금 레벨보다 쉬운 단계의 단어는 빼고, 퀴즈를 하나 통과할 때마다 1점(한→영·영→한·발음 = 단어당 최대 3점)
// 다음 레벨까지 필요한 점수 = 단어 N개를 ○로 만든 만큼(Lv.01~03은 30개, 그 위는 40개)
const LOWER = {}
function lowerSet(id) {
  if (LOWER[id]) return LOWER[id]
  const idx = LEVELS.findIndex((l) => l.id === id)
  const s = new Set()
  for (const l of LEVELS.slice(0, Math.max(0, idx))) for (const w of LEVEL_WORDS[l.id] || []) s.add(w.toLowerCase())
  return (LOWER[id] = s)
}
export const levelUpWords = (id) => (['L1', 'L2', 'L3'].includes(normLevel(id)) ? 30 : 40)
export function levelProgress(words, levelId) {
  const id = normLevel(levelId)
  const idx = LEVELS.findIndex((l) => l.id === id)
  const next = LEVELS[idx + 1] || null
  const low = lowerSet(id)
  let xp = 0
  for (const w of words || []) {
    if (low.has(String(w.word || '').toLowerCase())) continue
    xp += (w.ko_ok ? 1 : 0) + (w.en_ok ? 1 : 0) + (w.sp_ok ? 1 : 0)
  }
  const need = levelUpWords(id) * 3
  return { id, label: levelLabel(id), next: next?.id || null, nextLabel: next?.label || null, xp: Math.min(xp, need), need, full: !!next && xp >= need, total: xp }
}
