// 사진(영어+한글 해석) → 단어 목록
import { guard, send, readBody, claude, parseJson, MODEL_VISION } from './_lib.js'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (!(await guard(req, res, { needVision: true }))) return
  try {
    const { image, mediaType } = await readBody(req)
    if (!image || typeof image !== 'string') return send(res, 400, { error: '사진이 없어요' })
    if (image.length > 6_000_000) return send(res, 413, { error: '사진이 너무 커요' })
    const type = ['image/jpeg', 'image/png', 'image/webp'].includes(mediaType) ? mediaType : 'image/jpeg'
    const text = await claude({
      model: MODEL_VISION,
      maxTokens: 4000,
      system:
        '너는 영어 단어장 사진을 읽어 단어 목록으로 옮기는 도우미다. 사진에는 영어 단어와 한글 뜻이 함께 있다. ' +
        '보이는 영어 단어와 그 옆/아래의 한글 뜻을 짝지어 순서대로 적는다. 뜻이 여러 개면 쉼표로 이어 쓴다. ' +
        '예문·발음기호·번호·품사 표시는 뺀다. 한글 뜻이 안 보이는 단어는 meaning을 빈 문자열로 둔다. ' +
        '반드시 JSON 배열만 출력: [{"word":"apple","meaning":"사과"}]',
      content: [
        { type: 'image', source: { type: 'base64', media_type: type, data: image } },
        { type: 'text', text: '이 사진의 영어 단어와 한글 뜻을 JSON 배열로만 출력해.' },
      ],
    })
    const arr = parseJson(text)
    const words = (Array.isArray(arr) ? arr : [])
      .map((x) => ({ word: String(x.word || '').trim().slice(0, 60), meaning: String(x.meaning || '').trim().slice(0, 120) }))
      .filter((x) => /^[A-Za-z]/.test(x.word))
      .slice(0, 150)
    send(res, 200, { words })
  } catch (e) {
    send(res, 500, { error: '사진을 읽지 못했어요: ' + e.message })
  }
}
