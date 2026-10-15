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
export async function guard(req, res) {
  if (req.method !== 'POST') { send(res, 405, { error: 'POST만 가능해요' }); return false }
  const fam = await requireFamily(req)
  if (!fam) { send(res, 401, { error: '로그인이 필요해요' }); return false }
  if (!hasKey()) { send(res, 503, { error: 'AI 키가 아직 설정되지 않았어요(ANTHROPIC_API_KEY)', code: 'NO_KEY' }); return false }
  return true
}
