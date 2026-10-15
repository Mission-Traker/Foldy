import LEVEL_WORDS from '../data/levels.json'
import { seeded, shuffle } from './study.js'

// 2022 개정 영어과 교육과정 [별표 3] 기본 어휘 3,000개 기준
// e1·e3·e5: 초등 권장(*) 800개를 쉬운 순서로 3등분 / m: 중·공통(**) / h: 나머지 / a: 목록 밖(AI 추천)
export const LEVELS = [
  { id: 'e1', label: '초등 1~2학년', short: '초1-2', desc: '그림으로 떠오르는 첫 단어' },
  { id: 'e3', label: '초등 3~4학년', short: '초3-4', desc: '교과서에 나오는 기본 단어' },
  { id: 'e5', label: '초등 5~6학년', short: '초5-6', desc: '초등 권장 800단어 마무리' },
  { id: 'm', label: '중학생', short: '중등', desc: '중·고 공통 1,200단어' },
  { id: 'h', label: '고등학생', short: '고등', desc: '기본 어휘 3,000단어 완성' },
  { id: 'a', label: '성인', short: '성인', desc: '기본 어휘 밖 실전 단어(AI 추천)' },
]
export const levelLabel = (id) => LEVELS.find((l) => l.id === id)?.label || id

export function wordsOfLevel(id) {
  if (id === 'a') return LEVEL_WORDS.h
  return LEVEL_WORDS[id] || LEVEL_WORDS.e1
}

// 레벨 목록에서 오늘의 추천 n개(이미 가진 단어 제외, 날짜·사람별로 고정)
export function dailyPick(levelId, ownedLower, seedStr, n = 5) {
  const pool = wordsOfLevel(levelId).filter((w) => !ownedLower.has(w.toLowerCase()))
  return shuffle(pool, seeded(seedStr)).slice(0, n)
}

// 레벨 진단용 샘플(레벨마다 5개)
export function levelTestSet(seedStr) {
  const rand = seeded(seedStr)
  return LEVELS.filter((l) => l.id !== 'a').map((l) => ({
    level: l.id,
    words: shuffle(LEVEL_WORDS[l.id], rand).slice(0, 5),
  }))
}

// 레벨마다 5개 중 4개 이상 알면 통과 → 처음으로 통과 못 한 레벨을 추천
export function recommendLevel(results) {
  for (const r of results) {
    if ((r.known || 0) < 4) return r.level
  }
  return 'a'
}
