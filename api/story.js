// 나만의 예문: 별명과 좋아하는 것(사용자가 직접 켠 경우만)으로 예문을 다시 만듦
import { guard, send, readBody, textLLM, parseJson, canParse } from './_lib.js'

const clean = (s, n) => String(s || '').replace(/[<>{}"\\`]/g, '').replace(/\s+/g, ' ').trim().slice(0, n)

export function storyPrompt(nick, likes, kid) {
  return '너는 한국 학생용 영어 단어 예문을 만든다. 각 단어로 예문 1개씩.\n' +
    `- 주인공은 "${nick}"(별명). 문장 주어나 등장인물로 자연스럽게 넣는다.\n` +
    (likes.length ? `- 가능하면 좋아하는 것(${likes.join(', ')}) 중 하나와 엮는다. 억지스러우면 빼도 된다.\n` : '') +
    `- ${kid ? '초등학생이 이해할 수 있는 짧은(10단어 이하)' : '일상에서 자주 쓰는 자연스러운(15단어 이하)'} 문장. 단어는 주어진 뜻으로 쓴다.\n` +
    '- 정치·폭력·선정적 내용, 실제 주소·학교 이름 금지.\n' +
    'JSON 배열만 출력: [{"word":"library","example":{"en":"...","ko":"자연스러운 한글 해석","scene":"이모지 3~4개"}}]'
}

export default async function handler(req, res) {
  if (!(await guard(req, res))) return
  try {
    const { words, nick, likes, level } = await readBody(req)
    const list = (Array.isArray(words) ? words : [])
      .filter((w) => w && typeof w === 'object')
      .map((w) => ({ word: clean(w.word, 60), meaning: clean(w.meaning, 120) }))
      .filter((w) => w.word)
      .slice(0, 10)
    const n = clean(nick, 10)
    if (!list.length || !n) return send(res, 400, { error: '단어와 별명이 필요해요' })
    const ls = (Array.isArray(likes) ? likes : []).map((x) => clean(x, 12)).filter(Boolean).slice(0, 3)
    const kid = ['e1', 'e3', 'e5', 'L1', 'L2', 'L3'].includes(level)
    const { text } = await textLLM({ req, check: canParse, maxTokens: 2500, system: storyPrompt(n, ls, kid), text: JSON.stringify(list) })
    const arr = parseJson(text)
    const items = (Array.isArray(arr) ? arr : [])
      .filter((x) => x && x.word && x.example && x.example.en)
      .map((x) => ({ word: String(x.word), example: { en: String(x.example.en).slice(0, 200), ko: String(x.example.ko || '').slice(0, 200), scene: String(x.example.scene || '').slice(0, 20), mine: true } }))
    send(res, 200, { items })
  } catch (e) {
    send(res, e.code === 'LIMIT' ? 429 : 500, { error: e.code === 'LIMIT' ? e.message : '예문을 만들지 못했어요: ' + e.message, code: e.code })
  }
}
