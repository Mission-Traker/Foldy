// 서버 전용 도우미 — Claude API 키는 여기(서버)에서만 사용합니다.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gilpvbwpbioihvjbldpm.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_kMgYoZQrs5LRk-zrUshxOA_wZz1keiW'

export const MODEL_VISION = process.env.FOLDY_MODEL_VISION || 'claude-sonnet-5-5'
export const MODEL_TEXT = process.env.FOLDY_MODEL_TEXT || 'claude-haiku-5-5'

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

export function hasKey() {
  return !!process.env.ANTHROPIC_API_KEY
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
async function freeChat(opts) {
  const c = freeConf()
  const models = [c.model, c.model]
  if (c.base === GEMINI_BASE && GEMINI_BACKUP !== c.model) models.push(GEMINI_BACKUP)
  let last
  for (let i = 0; i < models.length; i++) {
    try { return await freeChatOnce(c, models[i], opts) } catch (e) {
      last = e
      if (!e.busy) throw e
      if (i < models.length - 1) await new Promise((r) => setTimeout(r, i === 0 ? 700 : 200))
    }
  }
  throw new Error('무료 AI가 지금 붐벼요. 조금 뒤 다시 해 주세요')
}
async function freeChatOnce(c, model, { system, text, maxTokens, image, mediaType }) {
  const base = c.base.replace(/\/+$/, '')
  const user = image
    ? [{ type: 'image_url', image_url: { url: `data:${mediaType || 'image/jpeg'};base64,${image}` } }, { type: 'text', text }]
    : text
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(image ? 55000 : 40000),
  })
  const raw = await r.text().catch(() => '')
  let data = {}
  try { data = JSON.parse(raw) } catch { /* 본문이 JSON이 아님 */ }
  if (Array.isArray(data)) data = data[0] || {}
  if (!r.ok) {
    const e = new Error(data?.error?.message || `무료 LLM ${r.status}${raw ? ': ' + raw.slice(0, 160) : ''}`)
    e.busy = r.status === 429 || r.status === 503 || r.status === 500
    throw e
  }
  const out = data?.choices?.[0]?.message?.content
  if (!out) throw new Error('무료 LLM 응답이 비었어요')
  return out
}

// 유료 AI(Claude)는 관리자가 정한 가족(foldy_families.ai_paid)만 — 다른 가족은 무료 AI만 씀
async function isPaidFamily(req) {
  const token = req?.headers?.['x-foldy-token']
  if (!token) return false
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/foldy_ai_paid`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', 'x-foldy-token': token },
      body: '{}',
    })
    return r.ok && (await r.json()) === true
  } catch { return false }
}
const usesClaude = (req) => !!req?.foldyPaid && hasKey()

// 유료 가족의 하루 Claude 사용 한도
export const LIMITS = {
  text: Number(process.env.FOLDY_DAILY_TEXT || 150), vision: Number(process.env.FOLDY_DAILY_VISION || 20),
  // 무료 AI는 모든 가족이 같은 무료 한도를 나눠 쓰므로, 한 가족이 다 써 버리지 않게 하루 한도를 둠
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
    if (!r.ok) return true // 한도 확인이 안 되면 막지 않음
    return (await r.json()) !== false
  } catch { return true }
}
async function paidClaude(req, kind, opts) {
  if (!(await takeQuota(req, kind))) throw new LimitError()
  return claude(opts)
}

// 글자만 다루는 작업: 무료 LLM을 먼저 쓰고, 실패하면 Claude로 대신함
// check(text)가 false면(형식이 깨진 응답) 역시 Claude로 다시 시도
export async function textLLM({ system, text, maxTokens = 2000, check = () => true, req }) {
  if (usesClaude(req)) {
    // 유료 가족: Claude 먼저(품질), 한도·오류면 무료 AI로
    try {
      let out = await paidClaude(req, 'text', { model: MODEL_TEXT, system, content: [{ type: 'text', text }], maxTokens })
      if (!check(out)) out = await paidClaude(req, 'text', { model: MODEL_TEXT, system: system + '\n\n반드시 요청한 형식만 정확히 출력하라. 문자열 안의 큰따옴표는 쓰지 말고 작은따옴표를 써라.', content: [{ type: 'text', text }], maxTokens })
      if (check(out)) return { text: out, via: 'claude' }
    } catch (e) {
      if (!hasFree()) throw e
      var claudeErr = e
    }
    let out
    try { out = await freeChat({ system, text, maxTokens }) } catch (e) { throw claudeErr || e }
    if (!check(out)) throw new Error('AI 응답 형식이 맞지 않아요. 다시 해 주세요')
    return { text: out, via: 'free' }
  }
  // 그 밖의 가족: 무료 AI만(가족당 하루 한도 안에서)
  if (!hasFree()) throw new FreeOnlyError()
  if (!(await takeQuota(req, 'free_text'))) throw new LimitError()
  for (let i = 0; i < 2; i++) {
    const out = await freeChat({ system: i ? system + '\n\n반드시 요청한 형식만 정확히 출력하라.' : system, text, maxTokens })
    if (check(out)) return { text: out, via: 'free' }
  }
  throw new Error('AI 응답 형식이 맞지 않아요. 다시 해 주세요')
}

// 사진 읽기: 사진도 되는 무료 AI(Gemini 등)를 먼저, 안 되면 Claude
export async function visionLLM({ system, text, image, mediaType, maxTokens = 8000, check = () => true, req }) {
  const claudeVision = () => paidClaude(req, 'vision', {
    model: MODEL_VISION, maxTokens, system,
    content: [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: image } }, { type: 'text', text }],
  })
  if (usesClaude(req)) {
    try {
      const out = await claudeVision()
      if (check(out)) return { text: out, via: 'claude' }
    } catch (e) {
      if (!hasFreeVision()) throw e
      var claudeErr = e
    }
    let out
    try { out = await freeChat({ system, text, maxTokens, image, mediaType }) } catch (e) { throw claudeErr || e }
    if (!check(out)) throw new Error('사진을 읽지 못했어요. 다시 해 주세요')
    return { text: out, via: 'free' }
  }
  if (!hasFreeVision()) throw new FreeOnlyError()
  if (!(await takeQuota(req, 'free_vision'))) throw new LimitError()
  const out = await freeChat({ system, text, maxTokens, image, mediaType })
  if (!check(out)) throw new Error('무료 AI가 사진을 읽지 못했어요. 다시 해 주세요')
  return { text: out, via: 'free' }
}

export function canParse(t) {
  try { parseJson(t); return true } catch { return false }
}

export async function claude({ model, system, content, maxTokens = 2000 }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = data?.error?.message || `Claude API ${r.status}`
    if (/credit balance/i.test(msg)) throw new Error('Claude API 크레딧이 부족해요 (Claude Console → Billing에서 충전)')
    if (r.status === 401) throw new Error('Claude API 키가 맞지 않아요 (Vercel 환경변수 확인)')
    if (r.status === 429 || r.status === 529) throw new Error('AI가 잠시 바빠요. 조금 뒤 다시 해 주세요')
    throw new Error(msg)
  }
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('')
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
// needVision: 사진 읽기 — Claude나 사진이 되는 무료 AI가 있어야 함
export async function guard(req, res, { needVision = false } = {}) {
  if (req.method !== 'POST') { send(res, 405, { error: 'POST만 가능해요' }); return false }
  const fam = await requireFamily(req)
  if (!fam) { send(res, 401, { error: '로그인이 필요해요' }); return false }
  req.foldyPaid = await isPaidFamily(req)
  const free = needVision ? hasFreeVision() : hasFree()
  const ok = free || (req.foldyPaid && hasKey())
  if (!ok) { send(res, 503, { error: 'AI 기능을 준비하고 있어요', code: 'NO_KEY' }); return false }
  return true
}
