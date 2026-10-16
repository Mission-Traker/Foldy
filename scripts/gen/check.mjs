// 내장 어휘 데이터 검사: node scripts/gen/check.mjs 05
import { readFileSync } from 'fs'
const n = process.argv[2]
const input = JSON.parse(readFileSync(new URL(`./in-${n}.json`, import.meta.url)))
let out
try { out = JSON.parse(readFileSync(new URL(`./out-${n}.json`, import.meta.url))) } catch (e) { console.log('JSON 읽기 실패:', e.message); process.exit(1) }
const errs = []
const HAN = /[가-힣]/
const EN = /^[A-Za-z][A-Za-z' -]*$/
for (const [word, , lv] of input) {
  const x = out[word]
  if (!x) { errs.push(`${word}: 없음`); continue }
  const kid = ['L1', 'L2', 'L3'].includes(lv)
  if (!Array.isArray(x.acc) || x.acc.some((a) => typeof a !== 'string' || !HAN.test(a))) errs.push(`${word}: acc`)
  for (const k of ['syn', 'ant']) {
    const v = x[k]
    if (v === null) continue
    if (!Array.isArray(v) || v.length !== 2 || !EN.test(v[0]) || !HAN.test(v[1]) || v[0].toLowerCase() === word.toLowerCase()) errs.push(`${word}: ${k}`)
  }
  const ex = x.ex
  if (!Array.isArray(ex) || ex.length !== 3 || typeof ex[0] !== 'string' || !HAN.test(ex[1] || '') || !ex[2]) errs.push(`${word}: ex 형식`)
  else {
    const words = ex[0].trim().split(/\s+/).length
    if (words > (kid ? 10 : 14)) errs.push(`${word}: ex 너무 김(${words})`)
    if (!new RegExp(word.slice(0, Math.max(3, word.length - 3)).replace(/[^a-z]/gi, '.'), 'i').test(ex[0])) errs.push(`${word}: ex에 단어 없음`)
    if (/[A-Za-z]/.test(ex[2])) errs.push(`${word}: ex 장면에 글자`)
  }
  if (typeof x.ko !== 'string' || !HAN.test(x.ko)) errs.push(`${word}: ko`)
  if (typeof x.syl !== 'string' || x.syl.replace(/\|/g, '').toLowerCase() !== word.toLowerCase().replace(/[ '-]/g, '') || !/[A-Z]/.test(x.syl) && word.length > 1) errs.push(`${word}: syl(${x.syl})`)
  if (typeof x.tip !== 'string' || !HAN.test(x.tip) || x.tip.length > 60) errs.push(`${word}: tip`)
}
const extra = Object.keys(out).filter((k) => !input.some(([w]) => w === k))
if (extra.length) errs.push('입력에 없는 단어: ' + extra.slice(0, 10).join(', '))
console.log(errs.length ? errs.slice(0, 80).join('\n') + `\n문제 ${errs.length}개` : `통과 ${input.length}개`)
process.exit(errs.length ? 1 : 0)
