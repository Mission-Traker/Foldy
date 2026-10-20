// 이번 주 성장 이미지 카드(1080×1350) — 카톡·인스타에 바로 올릴 수 있게
const C = { cream: '#F4ECDF', paper: '#FFFBF4', deep: '#3E5486', tang: '#E9954B', sage: '#8DAE78', ink: '#3A3A4A', soft: '#8C8577', line: '#E7DCC9' }
const DOW = ['월', '화', '수', '목', '금', '토', '일']

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h) }

export async function weekCardBlob({ name, start, sum, o, streak }) {
  try { await document.fonts?.load?.('60px Jua'); await document.fonts?.load?.('60px Fredoka') } catch { /* 글꼴 없으면 기본 글꼴 */ }
  const W = 1080, H = 1350
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')
  ctx.fillStyle = C.cream; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(141,174,120,.25)'; ctx.beginPath(); ctx.arc(120, 180, 120, 0, 7); ctx.fill()
  ctx.fillStyle = 'rgba(227,178,60,.25)'; ctx.beginPath(); ctx.arc(980, 90, 80, 0, 7); ctx.fill()
  const F = (s) => `${s}px Jua, "Apple SD Gothic Neo", sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = C.deep; ctx.font = `700 64px Fredoka, Jua, sans-serif`; ctx.fillText('Foldy', W / 2, 110)
  ctx.fillStyle = C.ink; ctx.font = F(58); ctx.fillText(`${name}의 이번 주 성장`, W / 2, 210)
  ctx.fillStyle = C.soft; ctx.font = F(36); ctx.fillText(`${start.slice(5).replace('-', '/')}부터 이번 주`, W / 2, 275)
  // 요일 판
  rr(ctx, 70, 330, W - 140, 330, 48); ctx.fillStyle = C.deep; ctx.fill()
  ctx.fillStyle = '#fff'; ctx.font = F(62); ctx.fillText(`공부한 날 ${sum.studied}/7일`, W / 2, 415)
  const gap = (W - 140 - 80) / 7
  sum.days.forEach((d, k) => {
    const cx = 110 + gap * k + gap / 2, cy = 535
    ctx.beginPath(); ctx.arc(cx, cy, 46, 0, 7)
    ctx.fillStyle = d.done > 0 ? C.tang : 'rgba(255,255,255,.12)'; ctx.fill()
    if (d.done > 0) { ctx.fillStyle = '#fff'; ctx.font = F(48); ctx.fillText('✓', cx, cy + 2) }
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = F(32); ctx.fillText(DOW[k], cx, cy + 82)
  })
  // 숫자 4칸
  const stats = [['맞힌 문제', `${sum.answers}개`], ['복습 기억률', sum.review != null ? `${sum.review}%` : '–'], ['○ 단어', `${o}개`], ['연속 학습', `🔥 ${streak}일`]]
  stats.forEach(([label, v], k) => {
    const x = 70 + (k % 2) * ((W - 140) / 2 + 10), y = 700 + Math.floor(k / 2) * 230, w = (W - 140) / 2 - 10
    rr(ctx, x, y, w, 210, 36); ctx.fillStyle = C.paper; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 4; ctx.stroke()
    ctx.fillStyle = C.soft; ctx.font = F(36); ctx.fillText(label, x + w / 2, y + 62)
    ctx.fillStyle = C.deep; ctx.font = F(70); ctx.fillText(v, x + w / 2, y + 140)
  })
  ctx.fillStyle = C.ink; ctx.font = F(40); ctx.fillText('가족이 함께 쓰는 접어서 외우는 영어 단어장', W / 2, 1230)
  ctx.fillStyle = C.soft; ctx.font = F(32); ctx.fillText('foldy-lake.vercel.app', W / 2, 1290)
  return new Promise((res) => cv.toBlob((b) => res(b), 'image/png'))
}
