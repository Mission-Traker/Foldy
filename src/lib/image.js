// 어떤 사진이든 AI가 읽을 수 있는 JPEG로 바꾸기
// - 아이폰 HEIC/HEIF, PNG, WEBP, GIF, BMP, 확장자·형식 정보가 없는 파일까지
// - 2400만 화소 같은 큰 사진은 긴 변 2000px로 줄이고, 서버 한도(4MB) 아래로 압축

export const MAX_SIDE = 2000
const MAX_B64 = 3_800_000

export function isHeic(file) {
  const t = (file.type || '').toLowerCase()
  const n = (file.name || '').toLowerCase()
  return t.includes('heic') || t.includes('heif') || /\.(heic|heif)$/.test(n)
}

export function looksLikeImage(file) {
  const t = (file.type || '').toLowerCase()
  if (t.startsWith('image/')) return true
  if (isHeic(file)) return true
  // 형식 정보가 비어 있는 경우(일부 안드로이드·카톡 저장 사진) 확장자로 판단
  if (!t && /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|heic|heif)$/i.test(file.name || '')) return true
  return !t // 정말 모르면 일단 열어 봄
}

export class PhotoError extends Error {
  constructor(code, message) { super(message); this.code = code }
}

async function decode(blob) {
  // 1순위: createImageBitmap(큰 사진도 빠르고, 사진 방향 정보 반영)
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }) } catch { /* 아래로 */ }
  }
  // 2순위: <img>
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')) }
    img.src = url
  })
}

async function heicToJpeg(file) {
  const { default: heic2any } = await import('heic2any')
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
  return Array.isArray(out) ? out[0] : out
}

export async function toJpegBase64(file) {
  if (!file || file.size === 0) {
    throw new PhotoError('EMPTY', '사진 파일이 비어 있어요. 아이폰이라면 사진이 iCloud에서 아직 내려받아지지 않았을 수 있어요(사진 앱에서 한 번 열어 본 뒤 다시 올려 주세요)')
  }
  if (file.size > 60 * 1024 * 1024) throw new PhotoError('TOO_BIG', '60MB가 넘는 사진은 올릴 수 없어요')

  let src = null
  if (isHeic(file)) {
    try { src = await decode(file) } catch { /* 사파리 외에는 HEIC를 못 열어서 변환 */ }
    if (!src) {
      try { src = await decode(await heicToJpeg(file)) } catch { throw new PhotoError('HEIC', 'HEIC 사진을 변환하지 못했어요. 아이폰 설정 → 카메라 → 포맷 → "높은 호환성"으로 찍으면 확실해요') }
    }
  } else {
    try { src = await decode(file) } catch {
      // 확장자는 jpg인데 실제 내용은 HEIC인 경우
      try { src = await decode(await heicToJpeg(file)) } catch { throw new PhotoError('DECODE', '이 사진은 열 수 없는 형식이에요') }
    }
  }

  const w = src.width, h = src.height
  if (!w || !h) throw new PhotoError('DECODE', '사진 크기를 알 수 없어요')
  let side = MAX_SIDE
  let quality = 0.85
  for (let attempt = 0; attempt < 5; attempt++) {
    const s = Math.min(1, side / Math.max(w, h))
    const c = document.createElement('canvas')
    c.width = Math.round(w * s)
    c.height = Math.round(h * s)
    const g = c.getContext('2d')
    g.fillStyle = '#fff' // 투명 PNG도 흰 바탕으로
    g.fillRect(0, 0, c.width, c.height)
    g.drawImage(src, 0, 0, c.width, c.height)
    const b64 = c.toDataURL('image/jpeg', quality).split(',')[1]
    if (b64.length <= MAX_B64) {
      if (src.close) src.close()
      return { base64: b64, width: c.width, height: c.height, canvas: c }
    }
    side = Math.round(side * 0.8)
    quality = Math.max(0.6, quality - 0.08)
  }
  throw new PhotoError('TOO_BIG', '사진을 충분히 줄이지 못했어요')
}
