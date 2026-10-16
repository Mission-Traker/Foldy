// 사진(영어+한글 해석) → 단어 목록
import { guard, send, readBody, visionLLM, parseJson, canParse } from './_lib.js'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (!(await guard(req, res, { needVision: true }))) return
  try {
    const { image, mediaType } = await readBody(req)
    if (!image || typeof image !== 'string') return send(res, 400, { error: '사진이 없어요' })
    if (image.length > 6_000_000) return send(res, 413, { error: '사진이 너무 커요' })
    const type = ['image/jpeg', 'image/png', 'image/webp'].includes(mediaType) ? mediaType : 'image/jpeg'
    const { text } = await visionLLM({
      req, image, mediaType: type, maxTokens: 8000,
      check: (t) => canParse(t) || /"word"\s*:/.test(t),
      text: '이 사진의 영어 단어와 한글 뜻을 JSON 배열로만 출력해.',
      system:
        '너는 영어 단어장 사진을 읽어 단어 목록으로 옮기는 도우미다. 사진에는 영어 단어와 한글 뜻이 함께 있다. ' +
        '보이는 영어 단어와 그 옆/아래의 한글 뜻을 짝지어 순서대로 적는다. 뜻이 여러 개면 쉼표로 이어 쓴다. ' +
        '예문·발음기호·번호·품사 표시는 뺀다. 한글 뜻이 안 보이는 단어는 meaning을 빈 문자열로 둔다. ' +
        '반드시 JSON 배열만 출력: [{"word":"apple","meaning":"사과"}]',
    })
    let arr
    try { arr = parseJson(text) } catch {
      // 단어가 아주 많아 응답이 중간에 끊긴 경우: 완성된 항목만 건짐
      arr = [...String(text).matchAll(/\{\s*"word"\s*:\s*"([^"]*)"\s*,\s*"meaning"\s*:\s*"([^"]*)"\s*\}/g)].map((m) => ({ word: m[1], meaning: m[2] }))
    }
    const words = (Array.isArray(arr) ? arr : [])
      .map((x) => ({ word: String(x.word || '').trim().slice(0, 60), meaning: String(x.meaning || '').trim().slice(0, 120) }))
      .filter((x) => /^[A-Za-z]/.test(x.word))
      .slice(0, 200)
    send(res, 200, { words })
  } catch (e) {
    send(res, e.code === 'LIMIT' ? 429 : 500, { error: e.code === 'LIMIT' ? e.message : '사진을 읽지 못했어요: ' + e.message, code: e.code })
  }
}
