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

// 무료 LLM(OpenAI 호환 주소: FreeLLMAPI·OpenRouter·Groq·Gemini 등)
export function hasFree() {
  return !!(process.env.FREE_LLM_BASE_URL && process.env.FREE_LLM_API_KEY)
}

async function freeChat({ system, text, maxTokens }) {
  const base = process.env.FREE_LLM_BASE_URL.replace(/\/+$/, '')
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.FREE_LLM_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.FREE_LLM_MODEL || 'auto',
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, { role: 'user', content: text }],
    }),
    signal: AbortSignal.timeout(40000),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data?.error?.message || `무료 LLM ${r.status}`)
  const out = data?.choices?.[0]?.message?.content
  if (!out) throw new Error('무료 LLM 응답이 비었어요')
  return out
}

// 글자만 다루는 작업: 무료 LLM을 먼저 쓰고, 실패하면 Claude로 대신함
// check(text)가 false면(형식이 깨진 응답) 역시 Claude로 다시 시도
export async function textLLM({ system, text, maxTokens = 2000, check = () => true }) {
  if (hasFree()) {
    try {
      const out = await freeChat({ system, text, maxTokens })
      if (check(out)) return { text: out, via: 'free' }
    } catch (e) {
      if (!hasKey()) throw e
    }
  }
  let out = await claude({ model: MODEL_TEXT, system, content: [{ type: 'text', text }], maxTokens })
  if (!check(out)) {
    // 형식이 깨졌으면 한 번 더(형식을 강조해서)
    out = await claude({ model: MODEL_TEXT, system: system + '\n\n반드시 요청한 형식만 정확히 출력하라. 문자열 안의 큰따옴표는 쓰지 말고 작은따옴표를 써라.', content: [{ type: 'text', text }], maxTokens })
  }
  return { text: out, via: 'claude' }
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
// needVision: 사진 읽기처럼 Claude만 가능한 작업
export async function guard(req, res, { needVision = false } = {}) {
  if (req.method !== 'POST') { send(res, 405, { error: 'POST만 가능해요' }); return false }
  const fam = await requireFamily(req)
  if (!fam) { send(res, 401, { error: '로그인이 필요해요' }); return false }
  const ok = needVision ? hasKey() : hasKey() || hasFree()
  if (!ok) { send(res, 503, { error: 'AI 키가 아직 설정되지 않았어요', code: 'NO_KEY' }); return false }
  return true
}
