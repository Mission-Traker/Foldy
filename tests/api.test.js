import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseJson } from '../api/_lib.js'

function mockRes() {
  const res = { statusCode: 0, headers: {}, body: '' }
  res.setHeader = (k, v) => { res.headers[k] = v }
  res.end = (b) => { res.body = b }
  return res
}
// 가족 확인 응답(예전 '유료 AI 가족' 표시가 켜져 있어도 무시돼야 함)
const fam = (url, paid = false) => ({ ok: true, json: async () => (String(url).includes('foldy_ai_paid') ? paid : 'family-uuid') })
const req = (body, token = 'tok', method = 'POST') => ({ method, headers: token ? { 'x-foldy-token': token } : {}, body })

describe('AI 서버 경로 보호', () => {
  beforeEach(() => { vi.restoreAllMocks(); for (const k of ['ANTHROPIC_API_KEY', 'FREE_LLM_BASE_URL', 'FREE_LLM_API_KEY', 'GEMINI_API_KEY']) delete process.env[k] })

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
  it('무료 AI 응답을 정리해서 돌려줌(enrich)', async () => {
    process.env.GEMINI_API_KEY = 'g'
    const t = '```json\n[{"word":"happy","meaning":"행복한","accepted":["기쁜","즐거운"],"syn":{"word":"glad","meaning":"기쁜"},"ant":{"word":"sad","meaning":"슬픈"},"example":{"en":"I am happy.","ko":"나는 행복해.","scene":"😊🎈"}}]\n```'
    vi.stubGlobal('fetch', vi.fn(async (url) => url.includes('generativelanguage') ? { ok: true, json: async () => ({}), text: async () => JSON.stringify({ choices: [{ message: { content: t } }] }) } : fam(url)))
    const { default: h } = await import('../api/enrich.js')
    const res = mockRes(); await h(req({ words: [{ word: 'happy', meaning: '행복한' }], level: 'e1' }), res)
    expect(res.statusCode).toBe(200)
    const it0 = JSON.parse(res.body).items[0]
    expect(it0.syn.word).toBe('glad')
    expect(it0.ant.word).toBe('sad')
    expect(it0.example.scene).toBe('😊🎈')
  })
  it('사진 읽기: 알파벳으로 시작하지 않는 줄은 버림', async () => {
    process.env.GEMINI_API_KEY = 'g'
    vi.stubGlobal('fetch', vi.fn(async (url) => url.includes('generativelanguage') ? { ok: true, json: async () => ({}), text: async () => JSON.stringify({ choices: [{ message: { content: '[{"word":"apple","meaning":"사과"},{"word":"12","meaning":"x"}]' } }] }) } : fam(url)))
    const { default: h } = await import('../api/extract.js')
    const res = mockRes(); await h(req({ image: 'AAAA', mediaType: 'image/jpeg' }), res)
    expect(JSON.parse(res.body).words).toEqual([{ word: 'apple', meaning: '사과' }])
  })
  it('사진이 없으면 400', async () => {
    process.env.GEMINI_API_KEY = 'g'
    vi.stubGlobal('fetch', vi.fn(async (url) => fam(url)))
    const { default: h } = await import('../api/extract.js')
    const res = mockRes(); await h(req({}), res)
    expect(res.statusCode).toBe(400)
  })
  it('무료 LLM만 있어도 판정은 동작(무료 응답 사용)', async () => {
    process.env.FREE_LLM_BASE_URL = 'https://free.example/v1'
    process.env.FREE_LLM_API_KEY = 'f'
    const calls = []
    vi.stubGlobal('fetch', vi.fn(async (url) => { calls.push(url); return url.includes('free.example') ? { ok: true, json: async () => ({}), text: async () => JSON.stringify({ choices: [{ message: { content: '{"ok":true,"reason":"같은 뜻"}' } }] }) } : fam(url) }))
    const { default: h } = await import('../api/judge.js')
    const res = mockRes(); await h(req({ word: 'happy', meaning: '행복한', answer: '기분 좋은' }), res)
    expect(JSON.parse(res.body).ok).toBe(true)
  })
  it('유료 AI(Claude) 키가 있어도 절대 부르지 않음 — 무료 응답이 깨지면 503(바쁨 안내)', async () => {
    process.env.FREE_LLM_BASE_URL = 'https://free.example/v1'
    process.env.FREE_LLM_API_KEY = 'f'
    process.env.ANTHROPIC_API_KEY = 'test'
    const calls = []
    vi.stubGlobal('fetch', vi.fn(async (url) => { calls.push(url); return url.includes('free.example') ? { ok: true, json: async () => ({}), text: async () => JSON.stringify({ choices: [{ message: { content: '죄송해요 모르겠어요' } }] }) } : fam(url, true) }))
    const { default: h } = await import('../api/judge.js')
    const res = mockRes(); await h(req({ word: 'happy', meaning: '행복한', answer: '자동차' }), res)
    expect(res.statusCode).toBe(503)
    expect(calls.some((u) => u.includes('anthropic') || u.includes('foldy_ai_paid'))).toBe(false)
  })
  it('무료 AI가 없으면 503(Claude 키만 있어도)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test'
    const calls = []
    vi.stubGlobal('fetch', vi.fn(async (url) => { calls.push(url); return fam(url, true) }))
    const { default: h } = await import('../api/judge.js')
    const res = mockRes(); await h(req({ word: 'happy', meaning: '행복한', answer: '기쁜' }), res)
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body).code).toBe('NO_KEY')
    expect(calls.some((u) => u.includes('anthropic'))).toBe(false)
  })
  it('사진 읽기는 사진이 안 되는 무료 LLM만으로는 안 됨(503)', async () => {
    process.env.FREE_LLM_BASE_URL = 'https://free.example/v1'
    process.env.FREE_LLM_API_KEY = 'f'
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => 'family-uuid' })))
    const { default: h } = await import('../api/extract.js')
    const res = mockRes(); await h(req({ image: 'AAAA' }), res)
    expect(res.statusCode).toBe(503)
  })
  it('형식이 깨진 무료 응답은 한 번 다시 요청', async () => {
    process.env.GEMINI_API_KEY = 'g'
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async (url) => url.includes('generativelanguage')
      ? { ok: true, json: async () => ({}), text: async () => JSON.stringify({ choices: [{ message: { content: ++n === 1 ? '{"ok":tru' : '{"ok":true,"reason":"맞음"}' } }] }) }
      : fam(url)))
    const { default: h } = await import('../api/judge.js')
    const res = mockRes(); await h(req({ word: 'happy', meaning: '행복한', answer: '기쁜' }), res)
    expect(JSON.parse(res.body).ok).toBe(true)
    expect(n).toBe(2)
  })
  it('발음 안내 줄 형식 해석', async () => {
    const { parsePron } = await import('../api/pron.js')
    const r = parsePron('IPA: /ˈhæp.i/\nSYLLABLES: HAP|py\nSTRESS: 0\nKO: 해-피\nTIP: 입을 옆으로\nMISTAKE: ')
    expect(r).toMatchObject({ ipa: '/ˈhæp.i/', syllables: ['HAP', 'py'], stress: 0, tips: ['입을 옆으로'] })
  })
  it('AI 단어 찾기 결과 해석', async () => {
    const { parseLookup } = await import('../api/lookup.js')
    expect(parseLookup('1. snowman | 눈사람\n- igloo: 이글루\nfoo bar\nsnowman | 눈사람')).toEqual([
      { word: 'snowman', meaning: '눈사람' }, { word: 'igloo', meaning: '이글루' }])
  })
  it('JSON 꺼내기', () => {
    expect(parseJson('설명입니다 {"ok":true} 끝')).toEqual({ ok: true })
  })
})

describe('무료 AI(Gemini)·하루 한도', () => {
  beforeEach(() => { vi.restoreAllMocks(); for (const k of ['ANTHROPIC_API_KEY', 'FREE_LLM_BASE_URL', 'FREE_LLM_API_KEY', 'GEMINI_API_KEY']) delete process.env[k] })
  it('GEMINI_API_KEY로 사진 읽기(유료 AI 안 부름)', async () => {
    process.env.GEMINI_API_KEY = 'g'
    const calls = []
    vi.stubGlobal('fetch', vi.fn(async (url, opt) => { calls.push({ url, body: opt?.body }); return url.includes('generativelanguage')
      ? { ok: true, json: async () => ({ choices: [{ message: { content: '[{"word":"apple","meaning":"사과"}]' } }] }), text: async () => JSON.stringify(({ choices: [{ message: { content: '[{"word":"apple","meaning":"사과"}]' } }] })) }
      : { ok: true, json: async () => 'family-uuid' } }))
    const { default: h } = await import('../api/extract.js')
    const res = mockRes(); await h(req({ image: 'AAAA', mediaType: 'image/png' }), res)
    expect(JSON.parse(res.body).words).toEqual([{ word: 'apple', meaning: '사과' }])
    expect(calls.some((c) => c.url.includes('anthropic'))).toBe(false)
    const g = calls.find((c) => c.url.includes('generativelanguage'))
    expect(g.body).toContain('data:image/png;base64,AAAA')
  })
  it('가족당 하루 한도를 넘으면 429(무료 AI도 부르지 않음)', async () => {
    process.env.GEMINI_API_KEY = 'g'
    const calls = []
    vi.stubGlobal('fetch', vi.fn(async (url) => { calls.push(url); return url.includes('foldy_ai_take') ? { ok: true, json: async () => false } : fam(url) }))
    const { default: h } = await import('../api/judge.js')
    const res = mockRes(); await h(req({ word: 'happy', meaning: '행복한', answer: '기분 좋은' }), res)
    expect(res.statusCode).toBe(429)
    expect(JSON.parse(res.body).code).toBe('LIMIT')
    expect(calls.some((u) => u.includes('generativelanguage'))).toBe(false)
  })
  it('나만의 예문: 별명이 없으면 400, 있으면 예문(mine) 돌려줌·위험 글자 제거', async () => {
    process.env.GEMINI_API_KEY = 'g'
    const bodies = []
    vi.stubGlobal('fetch', vi.fn(async (url, opt) => { if (url.includes('generativelanguage')) bodies.push(opt.body); return url.includes('generativelanguage')
      ? { ok: true, json: async () => ({}), text: async () => JSON.stringify({ choices: [{ message: { content: '[{"word":"library","example":{"en":"Kong reads in the library.","ko":"콩이는 도서관에서 읽어요.","scene":"📚"}}]' } }] }) }
      : fam(url, false) }))
    const { default: h } = await import('../api/story.js')
    let res = mockRes(); await h(req({ words: [{ word: 'library', meaning: '도서관' }], nick: '' }), res)
    expect(res.statusCode).toBe(400)
    res = mockRes(); await h(req({ words: [{ word: 'library', meaning: '도서관' }], nick: '콩이"}<x>', likes: ['축구', '고양이', '피아노', '넷째'] }), res)
    const b = JSON.parse(res.body)
    expect(b.items[0].example.mine).toBe(true)
    const sys = JSON.parse(bodies[0]).messages[0].content
    expect(sys).toContain('"콩이x"'); expect(sys).not.toContain('넷째')
  })
})
