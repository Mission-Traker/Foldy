import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseJson } from '../api/_lib.js'

function mockRes() {
  const res = { statusCode: 0, headers: {}, body: '' }
  res.setHeader = (k, v) => { res.headers[k] = v }
  res.end = (b) => { res.body = b }
  return res
}
const req = (body, token = 'tok', method = 'POST') => ({ method, headers: token ? { 'x-foldy-token': token } : {}, body })

describe('AI 서버 경로 보호', () => {
  beforeEach(() => { vi.restoreAllMocks(); delete process.env.ANTHROPIC_API_KEY })

  it('GET은 405', async () => {
    const { default: h } = await import('../api/judge.js')
    const res = mockRes(); await h(req({}, 'tok', 'GET'), res)
    expect(res.statusCode).toBe(405)
  })
  it('토큰 없으면 401', async () => {
    const { default: h } = await import('../api/judge.js')
    const res = mockRes(); await h(req({ word: 'a', answer: 'b' }, null), res)
    expect(res.statusCode).toBe(401)
  })
  it('유효한 토큰 + 키 없음 → 503 NO_KEY', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => 'family-uuid' })))
    const { default: h } = await import('../api/enrich.js')
    const res = mockRes(); await h(req({ words: [{ word: 'apple', meaning: '사과' }] }), res)
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body).code).toBe('NO_KEY')
  })
  it('키가 있으면 Claude 응답을 정리해서 돌려줌(enrich)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test'
    const claudeText = '```json\n[{"word":"happy","meaning":"행복한","accepted":["기쁜","즐거운"],"syn":{"word":"glad","meaning":"기쁜"},"ant":{"word":"sad","meaning":"슬픈"},"example":{"en":"I am happy.","ko":"나는 행복해.","scene":"😊🎈"}}]\n```'
    vi.stubGlobal('fetch', vi.fn(async (url) => url.includes('anthropic')
      ? { ok: true, json: async () => ({ content: [{ type: 'text', text: claudeText }] }) }
      : { ok: true, json: async () => 'family-uuid' }))
    const { default: h } = await import('../api/enrich.js')
    const res = mockRes(); await h(req({ words: [{ word: 'happy', meaning: '행복한' }], level: 'e1' }), res)
    expect(res.statusCode).toBe(200)
    const it0 = JSON.parse(res.body).items[0]
    expect(it0.syn.word).toBe('glad')
    expect(it0.ant.word).toBe('sad')
    expect(it0.example.scene).toBe('😊🎈')
  })
  it('사진 읽기: 알파벳으로 시작하지 않는 줄은 버림', async () => {
    process.env.ANTHROPIC_API_KEY = 'test'
    vi.stubGlobal('fetch', vi.fn(async (url) => url.includes('anthropic')
      ? { ok: true, json: async () => ({ content: [{ type: 'text', text: '[{"word":"apple","meaning":"사과"},{"word":"12","meaning":"x"}]' }] }) }
      : { ok: true, json: async () => 'family-uuid' }))
    const { default: h } = await import('../api/extract.js')
    const res = mockRes(); await h(req({ image: 'AAAA', mediaType: 'image/jpeg' }), res)
    expect(JSON.parse(res.body).words).toEqual([{ word: 'apple', meaning: '사과' }])
  })
  it('사진이 없으면 400', async () => {
    process.env.ANTHROPIC_API_KEY = 'test'
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => 'family-uuid' })))
    const { default: h } = await import('../api/extract.js')
    const res = mockRes(); await h(req({}), res)
    expect(res.statusCode).toBe(400)
  })
  it('JSON 꺼내기', () => {
    expect(parseJson('설명입니다 {"ok":true} 끝')).toEqual({ ok: true })
  })
})
