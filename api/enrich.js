// 단어마다: 허용 답안(비슷한 뜻들) · 유의어 · 반의어 · 예문 · 장면 이모지
import { guard, send, readBody, textLLM, parseJson, canParse } from './_lib.js'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (!(await guard(req, res))) return
  try {
    const { words, level } = await readBody(req)
    const list = (Array.isArray(words) ? words : [])
      .map((w) => ({ word: String(w.word || '').slice(0, 60), meaning: String(w.meaning || '').slice(0, 120) }))
      .filter((w) => w.word)
      .slice(0, 15)
    if (!list.length) return send(res, 400, { error: '단어가 없어요' })
    const kid = ['e1', 'e3', 'e5', 'L1', 'L2', 'L3'].includes(level)
    const { text } = await textLLM({ req,
      check: canParse,
      maxTokens: 6000,
      system:
        '너는 한국 학생용 영어 단어 학습 데이터를 만든다. 각 단어에 대해 아래 JSON을 만든다.\n' +
        '- meaning: 주어진 뜻이 비었으면 가장 흔한 한글 뜻(짧게), 있으면 그대로\n' +
        '- accepted: 학생이 써도 정답으로 인정할 한글 뜻 표현 3~8개(유사어·다른 어미 포함, 주어진 뜻과 같은 의미 범위만)\n' +
        '- syn: 쉬운 유의어 1개 {"word","meaning"} (없으면 null)\n' +
        '- ant: 반의어 1개 {"word","meaning"} (자연스러운 반의어가 없으면 null)\n' +
        `- example: {"en": 그 단어가 쓰이는 ${kid ? '초등학생이 이해할 수 있는 짧은(10단어 이하)' : '일상에서 자주 쓰는 자연스러운'} 영어 문장, "ko": 자연스러운 한글 해석, "scene": 문장 장면을 보여주는 이모지 3~4개}\n` +
        '정치·폭력·선정적 내용 금지. 반드시 JSON 배열만 출력: [{"word":"happy","meaning":"행복한","accepted":[...],"syn":{...},"ant":{...},"example":{...}}]',
      text: JSON.stringify(list),
    })
    const arr = parseJson(text)
    const out = (Array.isArray(arr) ? arr : []).map((x) => ({
      word: String(x.word || ''),
      meaning: String(x.meaning || '').slice(0, 120),
      accepted: (Array.isArray(x.accepted) ? x.accepted : []).map(String).slice(0, 10),
      syn: x.syn && x.syn.word ? { word: String(x.syn.word), meaning: String(x.syn.meaning || '') } : null,
      ant: x.ant && x.ant.word ? { word: String(x.ant.word), meaning: String(x.ant.meaning || '') } : null,
      example: x.example && x.example.en ? { en: String(x.example.en), ko: String(x.example.ko || ''), scene: String(x.example.scene || '') } : null,
    }))
    send(res, 200, { items: out })
  } catch (e) {
    send(res, e.code === 'LIMIT' ? 429 : 500, { error: e.code === 'LIMIT' ? e.message : 'AI 정보를 만들지 못했어요: ' + e.message, code: e.code })
  }
}
