// 가족 펫 규칙(화면 표시용) — 실제 계산·저장은 서버(foldy_pet_*)가 함
export const PET_ACTIONS = [
  { key: 'feed', icon: '🍖', label: '밥 주기', meter: 'hunger', meterLabel: '배부름', how: '문제 10개 맞힐 때마다 1개(하루 3개까지)' },
  { key: 'walk', icon: '🦮', label: '산책하기', meter: 'fun', meterLabel: '신남', how: '오늘의 한 판을 끝내면 1개' },
  { key: 'bath', icon: '🛁', label: '목욕하기', meter: 'clean', meterLabel: '깨끗함', how: '복습 3문제 또는 이틀 연속 공부하면 1개' },
]
export const PET_STAGES = [
  { at: 0, name: '아기' }, { at: 50, name: '꼬마' }, { at: 200, name: '어린이' }, { at: 500, name: '청소년' }, { at: 1200, name: '어른' },
]
export function petStage(xp = 0) {
  let i = 0
  for (let k = 0; k < PET_STAGES.length; k++) if (xp >= PET_STAGES[k].at) i = k
  const next = PET_STAGES[i + 1] || null
  const cur = PET_STAGES[i]
  return { i, name: cur.name, next, pct: next ? Math.round(((xp - cur.at) / (next.at - cur.at)) * 100) : 100 }
}
// 기분: 아프거나 죽지 않음 — 오래 못 돌보면 졸려 할 뿐
export function petMood(p) {
  if (!p) return 'ok'
  const avg = ((p.hunger || 0) + (p.fun || 0) + (p.clean || 0)) / 3
  return avg >= 70 ? 'happy' : avg >= 40 ? 'ok' : avg >= 15 ? 'bored' : 'sleepy'
}
export const MOOD_TEXT = { happy: '기분 최고예요!', ok: '기분 좋아요', bored: '조금 심심해요', sleepy: '졸려요… 공부하고 깨워 주세요' }
export const ticketTotal = (t) => (t ? (t.feed || 0) + (t.walk || 0) + (t.bath || 0) : 0)
// 다음 돌봄권까지 남은 것(안내 문구)
export function ticketHint(key, t) {
  if (!t) return ''
  if (key === 'feed') { const left = 10 - ((t.done || 0) % 10); return Math.floor((t.done || 0) / 10) >= 3 ? '오늘 밥은 다 모았어요' : `문제 ${left}개 더 맞히면 1개` }
  if (key === 'walk') return t.run_done ? '오늘 산책권은 썼어요' : '오늘의 한 판을 끝내면 1개'
  return '복습 3문제 또는 이틀 연속 공부하면 1개'
}
