// 더 정확한 발음 안내: 발음기호·음절 강세·한국어 화자를 위한 요령
import { guard, send, readBody, textLLM } from './_lib.js'

// 줄 단위 형식(JSON보다 깨질 일이 적음)
export function parsePron(text) {
  const out = { ipa: '', syllables: [], stress: 0, ko: '', tips: [], mistake: '' }
  let last = null
  for (const raw of String(text).split(/\n/)) {
    const m = raw.match(/^\s*[-*]?\s*(IPA|SYLLABLES|STRESS|KO|TIP|MISTAKE)\s*[:：]\s*(.*)$/i)
    if (!m) {
      // 줄바꿈으로 이어진 내용은 앞 항목에 붙임
      const t = raw.trim()
      if (t && last === 'MISTAKE') out.mistake += ' ' + t
      else if (t && last === 'TIP' && out.tips.length) out.tips[out.tips.length - 1] += ' ' + t
      continue
    }
    last = m[1].toUpperCase()
    const k = m[1].toUpperCase(); const v = m[2].trim()
    if (k === 'IPA') out.ipa = v
    else if (k === 'SYLLABLES') out.syllables = v.split(/[|·\-\s]+/).filter(Boolean).slice(0, 8)
    else if (k === 'STRESS') out.stress = Math.max(0, parseInt(v, 10) || 0)
    else if (k === 'KO') out.ko = v
    else if (k === 'TIP' && v) out.tips.push(v)
    else if (k === 'MISTAKE') out.mistake = v
  }
  out.tips = out.tips.slice(0, 4)
  if (out.stress >= out.syllables.length) out.stress = 0
  return out
}

export default async function handler(req, res) {
  if (!(await guard(req, res))) return
  try {
    const { word, heard } = await readBody(req)
    const w = String(word || '').trim().slice(0, 60)
    if (!/^[A-Za-z][A-Za-z '\-]*$/.test(w)) return send(res, 400, { error: '영어 단어가 아니에요' })
    const { text } = await textLLM({ req,
      check: (t) => /IPA\s*[:：]/i.test(t) && /SYLLABLES\s*[:：]/i.test(t),
      maxTokens: 600,
      system:
        '너는 한국 학생에게 미국식 표준 발음을 가르치는 발음 코치다. 주어진 영어 단어의 정확한 발음을 아래 형식 그대로, 한 줄에 하나씩만 출력한다. 다른 말은 쓰지 않는다.\n' +
        'IPA: /ˈlaɪ.brer.i/\n' +
        'SYLLABLES: LI|brar|y   (음절을 | 로 나누고 강세 음절만 대문자)\n' +
        'STRESS: 0   (강세 음절 번호, 0부터)\n' +
        'KO: 라이-브레리 (앞을 세게)   (한글로 소리 흉내 + 강세 위치)\n' +
        'TIP: 입 모양·혀 위치를 쉬운 말로 (한국어와 다른 소리 r/l, f/v, th, 모음 길이 등)\n' +
        'TIP: 두 번째 요령\n' +
        'MISTAKE: 학생이 말한 것과 비교한 한 줄 조언(없으면 비움)',
      text: `단어: ${w}\n학생이 말한 것: ${String(heard || '').slice(0, 80)}`,
    })
    const r = parsePron(text)
    if (!r.ipa && !r.syllables.length) throw new Error('형식이 맞지 않는 응답')
    send(res, 200, r)
  } catch (e) {
    send(res, e.code === 'LIMIT' ? 429 : 500, { error: e.code === 'LIMIT' ? e.message : '발음 안내를 만들지 못했어요: ' + e.message, code: e.code })
  }
}
