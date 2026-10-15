// 더 정확한 발음 안내: 발음기호·음절 강세·한국어 화자를 위한 요령
import { guard, send, readBody, textLLM, parseJson, canParse } from './_lib.js'

export default async function handler(req, res) {
  if (!(await guard(req, res))) return
  try {
    const { word, heard } = await readBody(req)
    const w = String(word || '').trim().slice(0, 60)
    if (!/^[A-Za-z][A-Za-z '\-]*$/.test(w)) return send(res, 400, { error: '영어 단어가 아니에요' })
    const { text } = await textLLM({
      check: canParse,
      maxTokens: 700,
      system:
        '너는 한국 학생에게 미국식 표준 발음을 가르치는 발음 코치다. 주어진 영어 단어의 정확한 발음을 안내한다. ' +
        'JSON만 출력: {"ipa":"/ˈhæp.i/","syllables":["HAP","py"],"stress":0,"ko":"해-피 (앞을 세게)","tips":["a는 입을 옆으로 크게 벌린 \'애\' 소리","끝 y는 짧은 \'이\'"],"mistake":"학생 발음에 대한 한 줄 조언 또는 빈 문자열"} ' +
        'syllables는 강세 음절을 대문자로, ko는 한글로 소리를 흉내 내되 강세 위치를 괄호로, tips는 2~3개의 짧고 쉬운 요령(입 모양·혀 위치·한국어와 다른 소리 r/l, f/v, th, 모음 길이 등).',
      text: JSON.stringify({ 단어: w, 학생이_말한_것: String(heard || '').slice(0, 80) }),
    })
    const r = parseJson(text)
    send(res, 200, {
      ipa: String(r.ipa || ''),
      syllables: (Array.isArray(r.syllables) ? r.syllables : []).map(String).slice(0, 8),
      stress: Number.isInteger(r.stress) ? r.stress : 0,
      ko: String(r.ko || ''),
      tips: (Array.isArray(r.tips) ? r.tips : []).map(String).slice(0, 4),
      mistake: String(r.mistake || ''),
    })
  } catch (e) {
    send(res, 500, { error: '발음 안내를 만들지 못했어요: ' + e.message })
  }
}
