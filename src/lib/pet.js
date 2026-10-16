// 캐릭터 키우기: 퀴즈를 하나 통과할 때마다 캐릭터가 단어를 '먹고' 자람(갉아먹기 장면의 반대)
export const PET_STAGES = [
  { at: 0, name: '아기', unlock: null },
  { at: 15, name: '꼬마', unlock: 'ribbon' },
  { at: 45, name: '어린이', unlock: 'glasses' },
  { at: 90, name: '청소년', unlock: 'cap' },
  { at: 180, name: '어른', unlock: 'scarf' },
  { at: 300, name: '전설', unlock: 'crown' },
]
export const WEAR_LABEL = { ribbon: '리본', glasses: '안경', cap: '모자', scarf: '목도리', crown: '왕관' }

// 지금까지 먹은 단어 수 = 통과한 퀴즈 수(한→영·영→한·발음, 단어당 최대 3)
export function petFood(words) {
  let n = 0
  for (const w of words || []) n += (w.ko_ok ? 1 : 0) + (w.en_ok ? 1 : 0) + (w.sp_ok ? 1 : 0)
  return n
}
export function petState(words) {
  const food = petFood(words)
  let i = 0
  for (let k = 0; k < PET_STAGES.length; k++) if (food >= PET_STAGES[k].at) i = k
  const cur = PET_STAGES[i], next = PET_STAGES[i + 1] || null
  const unlocked = PET_STAGES.slice(1, i + 1).map((s) => s.unlock)
  return { food, stage: i, name: cur.name, next, toNext: next ? next.at - food : 0, pct: next ? Math.round(((food - cur.at) / (next.at - cur.at)) * 100) : 100, unlocked }
}
// 착용: 저장한 것이 있으면 그중 풀린 것만, 없으면 풀린 것 전부
export function wearing(pet, unlocked) {
  const want = Array.isArray(pet?.wear) ? pet.wear : unlocked
  return want.filter((x) => unlocked.includes(x))
}
