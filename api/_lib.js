// 서버 전용 도우미 — 무료 AI(Gemini) 키는 여기(서버)에서만 사용합니다. 유료 AI는 쓰지 않아요.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gilpvbwpbioihvjbldpm.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_kMgYoZQrs5LRk-zrUshxOA_wZz1keiW'

export function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

// 로그인한 가족만 AI 기능을 쓸 수 있게 토큰 확인
export async function requireFamily(req) {
  const token = req.headers['x-foldy-token']
  if (!token || typeof token !== 'string' || token.length > 100) return null
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/foldy_family`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', 'x-foldy-token': token },
    body: '{}',
  })
  if (!r.ok) return null
  const id = await r.json()
  return typeof id === 'string' ? id : null
}

// 무료 LLM(OpenAI 호환 주소). GEMINI_API_KEY 하나만 넣으면 구글 Gemini 무료 등급을 씀(글자·사진 모두)
// 직접 지정: FREE_LLM_BASE_URL + FREE_LLM_API_KEY (+ FREE_LLM_MODEL, 사진도 되면 FREE_LLM_VISION=1)
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai'
function freeConf() {
  if (process.env.FREE_LLM_BASE_URL && process.env.FREE_LLM_API_KEY) {
    return { base: process.env.FREE_LLM_BASE_URL, key: process.env.FREE_LLM_API_KEY, model: process.env.FREE_LLM_MODEL || 'auto', vision: process.env.FREE_LLM_VISION === '1' }
  }
  if (process.env.GEMINI_API_KEY) return { base: GEMINI_BASE, key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-flash-latest', vision: true }
  return null
}
export function hasFree() { return !!freeConf() }
export function hasFreeVision() { return !!freeConf()?.vision }

// 무료 등급은 붐비면 503·429가 잦음 → 잠깐 쉬었다가 같은 모델로 한 번, 그래도 안 되면 가벼운 모델(Gemini)로 한 번 더
const GEMINI_BACKUP = process.env.GEMINI_BACKUP_MODEL || 'gemini-flash-lite-latest'
// 함수가 Vercel 제한 시간에 잘리기 전에 끝내도록: 남은 시간 안에서만 기다리고, 모자라면 다시 시도하지 않음
const MAX_DURATION = { extract: 60, enrich: 60, story: 60, judge: 30, pron: 30, ipa: 30, lookup: 20 }
function remaining(req) { return req?.foldyDeadline ? req.foldyDeadline - Date.now() : 40000 }
async function freeChat(opts) {
  const c = freeConf()
  let models = [c.model, c.model]
  if (c.base === GEMINI_BASE && GEMINI_BACKUP !== c.model) models.push(GEMINI_BACKUP)
  // 짧은 판단(채점)은 가볍고 빠른 모델 먼저 — 붐빌 때 오래 기다리지 않게
  if (opts.fast && c.base === GEMINI_BASE && GEMINI_BACKUP !== c.model) models = [GEMINI_BACKUP, c.model, GEMINI_BACKUP]
  let last
  for (let i = 0; i < models.length; i++) {
    const left = remaining(opts.req)
    if (i > 0 && left < 6000) break
    try { return await freeChatOnce(c, models[i], { ...opts, timeout: Math.max(3000, Math.min(opts.image ? 55000 : opts.fast ? 9000 : 40000, left - 1500)) }) } catch (e) {
      last = e
      if (!e.busy) throw e
      if (i < models.length - 1) await new Promise((r) => setTimeout(r, i === 0 ? 700 : 200))
    }
  }
  throw new Error('무료 AI가 지금 붐벼요. 조금 뒤 다시 해 주세요')
}
async function freeChatOnce(c, model, { system, text, maxTokens, image, mediaType, timeout }) {
  const base = c.base.replace(/\/+$/, '')
  const user = image
    ? [{ type: 'image_url', image_url: { url: `data:${mediaType || 'image/jpeg'};base64,${image}` } }, { type: 'text', text }]
    : text
  let r
  try { r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(timeout || (image ? 55000 : 40000)),
  }) } catch (e) {
    // 시간 초과·연결 끊김은 '붐빔'으로 보고 다음 모델로
    const err = new Error('무료 AI가 지금 붐벼요. 조금 뒤 다시 해 주세요')
    err.busy = true
    console.error('[free-llm]', model, e?.name || '', e?.message || '')
    throw err
  }
  const raw = await r.text().catch(() => '')
  let data = {}
  try { data = JSON.parse(raw) } catch { /* 본문이 JSON이 아님 */ }
  if (Array.isArray(data)) data = data[0] || {}
  if (!r.ok) {
    // 자세한 내용은 서버 기록에만(사용자 화면에는 짧게)
    console.error('[free-llm]', r.status, model, raw.slice(0, 300))
    const e = new Error(`무료 AI 응답 오류(${r.status})`)
    e.busy = r.status === 429 || r.status === 503 || r.status === 500
    throw e
  }
  const out = data?.choices?.[0]?.message?.content
  if (!out) throw new Error('무료 LLM 응답이 비었어요')
  return out
}

// 하루 한도: 무료 AI는 모든 가족이 같은 무료 한도를 나눠 쓰므로, 한 가족이 다 써 버리지 않게 가족당 하루 한도를 둠
// (기본 어휘 3,000개는 앱에 넣어 둔 데이터를 쓰므로 AI를 부르는 일은 그 밖의 단어뿐)
export const LIMITS = {
  free_text: Number(process.env.FOLDY_FREE_TEXT || 200), free_vision: Number(process.env.FOLDY_FREE_VISION || 15),
}
export class FreeOnlyError extends Error { constructor() { super('AI 기능을 준비하고 있어요. 조금만 기다려 주세요'); this.code = 'NO_KEY' } }
export class LimitError extends Error { constructor() { super('오늘 AI 사용량을 다 썼어요. 내일 다시 쓸 수 있어요'); this.code = 'LIMIT' } }
async function takeQuota(req, kind) {
  const token = req?.headers?.['x-foldy-token']
  if (!token) return true
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/foldy_ai_take`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', 'x-foldy-token': token },
      body: JSON.stringify({ p_kind: kind, p_limit: LIMITS[kind] }),
    })
    // 한도 확인이 안 되면 막지 않음(무료라서)
    if (!r.ok) return true
    return (await r.json()) !== false
  } catch { return true }
}

// 글자만 다루는 작업: 무료 AI만(가족당 하루 한도 안에서). 형식이 깨지면 한 번 더
export async function textLLM({ system, text, maxTokens = 2000, check = () => true, req, fast = false }) {
  if (!hasFree()) throw new FreeOnlyError()
  if (!(await takeQuota(req, 'free_text'))) throw new LimitError()
  for (let i = 0; i < 2; i++) {
    if (i > 0 && remaining(req) < 6000) break
    const out = await freeChat({ req, fast, system: i ? system + '\n\n반드시 요청한 형식만 정확히 출력하라.' : system, text, maxTokens })
    if (check(out)) return { text: out, via: 'free' }
  }
  throw new Error('AI 응답 형식이 맞지 않아요. 다시 해 주세요')
}

// 사진 읽기: 사진도 되는 무료 AI(Gemini)로. 안 되면 화면에서 기기 안 글자 인식(Tesseract)으로 대신함
export async function visionLLM({ system, text, image, mediaType, maxTokens = 8000, check = () => true, req }) {
  if (!hasFreeVision()) throw new FreeOnlyError()
  if (!(await takeQuota(req, 'free_vision'))) throw new LimitError()
  const out = await freeChat({ req, system, text, maxTokens, image, mediaType })
  if (!check(out)) throw new Error('무료 AI가 사진을 읽지 못했어요. 다시 해 주세요')
  return { text: out, via: 'free' }
}

export function canParse(t) {
  try { parseJson(t); return true } catch { return false }
}

// 응답에서 JSON만 꺼내기
export function parseJson(text) {
  const m = String(text).match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = (m ? m[1] : text).trim()
  const start = raw.search(/[[{]/)
  const end = Math.max(raw.lastIndexOf(']'), raw.lastIndexOf('}'))
  return JSON.parse(raw.slice(start, end + 1))
}

// 공통 진입: 메서드·로그인·키 확인
// needVision: 사진 읽기 — 사진이 되는 무료 AI가 있어야 함
export async function guard(req, res, { needVision = false } = {}) {
  if (req.method !== 'POST') { send(res, 405, { error: 'POST만 가능해요' }); return false }
  const name = String(req.url || '').split('?')[0].split('/').pop()
  req.foldyDeadline = Date.now() + ((MAX_DURATION[name] || 30) - 3) * 1000
  const fam = await requireFamily(req)
  if (!fam) { send(res, 401, { error: '로그인이 필요해요' }); return false }
  const ok = needVision ? hasFreeVision() : hasFree()
  if (!ok) { send(res, 503, { error: 'AI 기능을 준비하고 있어요', code: 'NO_KEY' }); return false }
  return true
}
