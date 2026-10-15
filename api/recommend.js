// 내 단어와 연관된 오늘의 추천 단어 5개
import { guard, send, readBody, claude, parseJson, MODEL_TEXT } from './_lib.js'

const LEVEL_DESC = { e1: '초등 1~2학년', e3: '초등 3~4학년', e5: '초등 5~6학년', m: '중학생', h: '고등학생', a: '성인(토익·실무 수준)' }

export default async function handler(req, res) {
  if (!(await guard(req, res))) return
  try {
    const { recent, owned, level } = await readBody(req)
    const recentList = (Array.isArray(recent) ? recent : []).map(String).slice(0, 30)
    const ownedList = (Array.isArray(owned) ? owned : []).map((x) => String(x).toLowerCase()).slice(0, 2000)
    const text = await claude({
      model: MODEL_TEXT,
      maxTokens: 800,
      system:
        `너는 ${LEVEL_DESC[level] || '학생'} 수준의 영어 단어를 추천한다. 학생이 최근 외운 단어들과 주제·상황이 연결되는 새 단어 5개를 고른다. ` +
        '학생이 이미 가진 단어는 제외. 너무 어렵거나 드문 단어 금지. ' +
        'JSON 배열만 출력: [{"word":"orchard","meaning":"과수원","why":"apple과 연결"}]',
      content: [{ type: 'text', text: JSON.stringify({ 최근단어: recentList, 이미가진단어: ownedList.slice(0, 400) }) }],
    })
    const ownedSet = new Set(ownedList)
    const arr = parseJson(text)
    const items = (Array.isArray(arr) ? arr : [])
      .map((x) => ({ word: String(x.word || '').trim(), meaning: String(x.meaning || '').trim(), why: String(x.why || '') }))
      .filter((x) => /^[A-Za-z][A-Za-z '\-]*$/.test(x.word) && !ownedSet.has(x.word.toLowerCase()))
      .slice(0, 5)
    send(res, 200, { items })
  } catch (e) {
    send(res, 500, { error: '추천을 만들지 못했어요: ' + e.message })
  }
}
