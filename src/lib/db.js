import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL || 'https://gilpvbwpbioihvjbldpm.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_kMgYoZQrs5LRk-zrUshxOA_wZz1keiW'
const TOKEN_KEY = 'foldy.session'
const MEMBER_KEY = 'foldy.member'

function store(k, v) {
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)) } catch { /* 저장 불가 환경 */ }
}
function load(k) {
  try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null }
}

let session = load(TOKEN_KEY) // { token, family_id, name, login_id }
let client = make()

function make() {
  return createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: session?.token ? { 'x-foldy-token': session.token } : {} },
  })
}

export const getSession = () => session
export const sb = () => client
export const savedMemberId = () => load(MEMBER_KEY)
export const saveMemberId = (id) => store(MEMBER_KEY, id)

const ERR = {
  LOGIN_TAKEN: '이미 쓰고 있는 아이디예요',
  LOGIN_FAILED: '아이디 또는 비밀번호가 맞지 않아요',
  PASSWORD_SHORT: '비밀번호는 4자 이상이에요',
}
function friendly(error) {
  const m = error?.message || String(error)
  for (const k of Object.keys(ERR)) if (m.includes(k)) return ERR[k]
  if (m.includes('login_id')) return '아이디는 영어 소문자·숫자·_ 로 3~30자예요'
  if (m.includes('Failed to fetch')) return '인터넷 연결을 확인해 주세요'
  return '문제가 생겼어요: ' + m
}

function setSession(s) {
  session = s
  store(TOKEN_KEY, s)
  client = make()
}

export async function signup(login, password, name) {
  const { data, error } = await client.rpc('foldy_signup', { p_login: login, p_password: password, p_name: name })
  if (error) throw new Error(friendly(error))
  setSession({ ...data, login_id: login.trim().toLowerCase() })
  return data
}
export async function login(loginId, password) {
  const { data, error } = await client.rpc('foldy_login', { p_login: loginId, p_password: password })
  if (error) throw new Error(friendly(error))
  setSession({ ...data, login_id: loginId.trim().toLowerCase() })
  return data
}
export async function logout() {
  try { await client.rpc('foldy_logout') } catch { /* 무시 */ }
  setSession(null)
  store(MEMBER_KEY, null)
}

async function q(promise) {
  const { data, error } = await promise
  if (error) throw new Error(friendly(error))
  return data
}

// 구성원
export const listMembers = () => q(client.from('foldy_members').select('*').order('created_at'))
export const addMember = (m) => q(client.from('foldy_members').insert({ ...m, family_id: session.family_id }).select().single())
export const updateMember = (id, patch) => q(client.from('foldy_members').update(patch).eq('id', id).select().single())
export const deleteMember = (id) => q(client.from('foldy_members').delete().eq('id', id))

// 단어
export const listWords = (memberId) =>
  q(client.from('foldy_words').select('*').eq('member_id', memberId).order('seq').limit(5000))
export async function addWords(memberId, entries, source = 'manual') {
  // 이미 있는 단어(대소문자 무시)는 건너뜀
  const existing = new Set((await q(client.from('foldy_words').select('word').eq('member_id', memberId))).map((w) => w.word.toLowerCase()))
  const fresh = []
  const seen = new Set()
  for (const e of entries) {
    const k = e.word.toLowerCase()
    if (existing.has(k) || seen.has(k)) continue
    seen.add(k)
    fresh.push({ member_id: memberId, word: e.word, meaning: e.meaning, source })
  }
  const added = []
  // 번호가 순서대로 매겨지도록 하나씩 넣음(트리거가 seq 부여)
  for (const row of fresh) added.push(await q(client.from('foldy_words').insert(row).select().single()))
  return { added, skipped: entries.length - fresh.length }
}
export const updateWord = (id, patch) => q(client.from('foldy_words').update(patch).eq('id', id).select().single())
export const deleteWord = (id) => q(client.from('foldy_words').delete().eq('id', id))

// 하루 기록
export async function getDaily(memberId, day) {
  const rows = await q(client.from('foldy_daily').select('*').eq('member_id', memberId).eq('day', day))
  return rows[0] || null
}
export const upsertDaily = (row) => q(client.from('foldy_daily').upsert(row).select().single())

// 공유 AI 캐시(같은 단어는 한 번만 AI 호출)
export async function getCache(words) {
  if (!words.length) return {}
  const rows = await q(client.from('foldy_cache').select('word,data').in('word', words.map((w) => w.toLowerCase())))
  return Object.fromEntries(rows.map((r) => [r.word, r.data]))
}
export async function putCache(items) {
  if (!items.length) return
  await client.from('foldy_cache').upsert(items.map((it) => ({ word: it.word.toLowerCase(), data: it })))
}

// 서버 AI 호출
export async function ai(path, body) {
  const r = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-foldy-token': session?.token || '' },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const err = new Error(data.error || `오류 ${r.status}`)
    err.code = data.code || r.status
    throw err
  }
  return data
}
