// 뜻 입력이 맥락상 맞는지 AI 재채점(자동 채점이 오답일 때 학생이 요청)
import { guard, send, readBody, textLLM, parseJson, canParse } from './_lib.js'

export default async function handler(req, res) {
  if (!(await guard(req, res))) return
  try {
    const { word, meaning, answer } = await readBody(req)
    if (!word || !answer) return send(res, 400, { error: '입력이 없어요' })
    const { text } = await textLLM({
      check: canParse,
      maxTokens: 200,
      system:
        '너는 영어 단어 시험 채점자다. 학생이 영어 단어의 한글 뜻을 썼다. 표현이 달라도 그 단어의 뜻으로 통하면 정답이다. ' +
        '전혀 다른 뜻이거나 반대 뜻이면 오답. JSON만 출력: {"ok":true|false,"reason":"한 문장"}',
      text: JSON.stringify({ word: String(word).slice(0, 60), 교재뜻: String(meaning || '').slice(0, 120), 학생답: String(answer).slice(0, 60) }),
    })
    const r = parseJson(text)
    send(res, 200, { ok: !!r.ok, reason: String(r.reason || '') })
  } catch (e) {
    send(res, 500, { error: 'AI 채점을 하지 못했어요: ' + e.message })
  }
}
