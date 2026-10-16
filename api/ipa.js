// 발음기호 목록에 없는 단어(신조어·영국식 철자·구 등)의 발음기호를 한 번에 받아 옴
import { guard, send, readBody, textLLM, parseJson, canParse } from './_lib.js'

export default async function handler(req, res) {
  if (!(await guard(req, res))) return
  try {
    const { words } = await readBody(req)
    const list = [...new Set((Array.isArray(words) ? words : []).map((w) => String(w || '').trim().slice(0, 60)).filter(Boolean))].slice(0, 30)
    if (!list.length) return send(res, 400, { error: '단어가 없어요' })
    const { text } = await textLLM({ req,
      check: canParse,
      maxTokens: 900,
      system:
        '각 영어 단어(또는 짧은 구)의 미국식 IPA 발음기호를 단다. 강세 표시(ˈ ˌ) 포함, 앞뒤에 / 를 붙인다. r은 r, l은 l 로 쓴다. ' +
        '모르는 것은 빈 문자열. JSON 객체만 출력: {"webcam":"/ˈwɛbˌkæm/"}',
      text: JSON.stringify(list),
    })
    let r = parseJson(text) || {}
    if (typeof r !== 'object' || Array.isArray(r)) r = {}
    const out = {}
    for (const w of list) {
      const v = String(r[w] ?? r[w.toLowerCase()] ?? '').trim().slice(0, 60)
      out[w.toLowerCase()] = /^\/[^/]+\/$/.test(v) ? v : ''
    }
    send(res, 200, { ipa: out })
  } catch (e) {
    send(res, e.code === 'LIMIT' ? 429 : 500, { error: e.code === 'LIMIT' ? e.message : '발음기호를 받지 못했어요: ' + e.message, code: e.code })
  }
}
