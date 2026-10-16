import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL || 'https://gilpvbwpbioihvjbldpm.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_kMgYoZQrs5LRk-zrUshxOA_wZz1keiW'
const TOKEN_KEY = 'foldy.session'
const MEMBER_KEY = 'foldy.member'
const MTOK_KEY = 'foldy.memberTokens' // 구성원별 잠금 해제 토큰
const MEMBER_COLS = 'id,family_id,name,avatar,level,daily_goal,streak,best_streak,last_study,created_at,has_pin'

function store(k, v) {
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)) } catch { /* 저장 불가 환경 */ }
}
function load(k) {
  try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null }
}

let session = load(TOKEN_KEY) // { token, family_id, name, login_id }
let activeMember = load(MEMBER_KEY)
let client = make()

// 저장(POST·PATCH·DELETE)은 keepalive로 — 앱을 바로 닫거나 새로고침해도 요청이 끝까지 감(64KB 이하)
function keepFetch(input, init = {}) {
  const m = (init.method || 'GET').toUpperCase()
  const small = !init.body || (typeof init.body === 'string' && init.body.length < 60000)
  return fetch(input, m !== 'GET' && m !== 'HEAD' && small ? { ...init, keepalive: true } : init)
}
function memberTokens() { return load(MTOK_KEY) || {} }
function make() {
  const headers = {}
  if (session?.token) headers['x-foldy-token'] = session.token
  const mt = activeMember && memberTokens()[activeMember]
  if (mt) headers['x-foldy-member'] = mt
  return createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers, fetch: keepFetch } })
}
export const hasMemberToken = (id) => !!memberTokens()[id]
function saveMemberToken(id, token) {
  const all = memberTokens()
  if (token) all[id] = token; else delete all[id]
  store(MTOK_KEY, all)
}

export const getSession = () => session
export const sb = () => client
export const savedMemberId = () => load(MEMBER_KEY)
export const saveMemberId = (id) => { store(MEMBER_KEY, id); activeMember = id; client = make() }

const ERR = {
  LOGIN_TAKEN: '이미 쓰고 있는 아이디예요',
  LOGIN_FAILED: '아이디 또는 비밀번호가 맞지 않아요',
  PASSWORD_SHORT: '비밀번호는 4자 이상이에요',
  PIN_WRONG: '비밀번호가 맞지 않아요',
  PIN_FORMAT: '비밀번호는 숫자 4~6자리예요',
  FORBIDDEN: '이 프로필은 비밀번호로 잠겨 있어요',
  LOGIN_LOCKED: '여러 번 틀려서 15분 동안 잠겼어요. 잠시 뒤 다시 해 주세요',
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
  if (data?.error) throw new Error(friendly({ message: data.error }))
  setSession({ ...data, login_id: loginId.trim().toLowerCase() })
  return data
}
export async function logout() {
  try { await client.rpc('foldy_logout') } catch { /* 무시 */ }
  setSession(null)
  store(MEMBER_KEY, null)
  store(MTOK_KEY, null)
  activeMember = null
}

async function q(promise) {
  const { data, error } = await promise
  if (error) throw new Error(friendly(error))
  return data
}

// 구성원
export const listMembers = () => q(client.from('foldy_members').select(MEMBER_COLS).order('created_at'))
export const addMember = (m) => q(client.from('foldy_members').insert({ ...m, family_id: session.family_id }).select(MEMBER_COLS).single())
export async function updateMember(id, patch) {
  const rows = await q(client.from('foldy_members').update(patch).eq('id', id).select(MEMBER_COLS))
  if (!rows.length) throw new Error(friendly({ message: 'FORBIDDEN' }))
  return rows[0]
}

// 구성원 비밀번호
export async function unlockMember(id, pin) {
  const data = await q(client.rpc('foldy_member_unlock', { p_member: id, p_pin: pin }))
  if (data?.error) throw new Error(friendly({ message: data.error }))
  saveMemberToken(id, data.token)
  if (activeMember === id) client = make()
  return true
}
export async function setPin(id, pin) {
  const data = await q(client.rpc('foldy_set_pin', { p_member: id, p_pin: pin || '' }))
  if (data?.error) throw new Error(friendly({ message: data.error }))
  saveMemberToken(id, data.token || null)
  client = make()
  return true
}
export const forgetMemberToken = (id) => { saveMemberToken(id, null); client = make() }

// 가족 학습현황(보기 전용)
export async function familyProgress() {
  const words = await q(client.from('foldy_words').select('member_id,en_ok,ko_ok,sp_ok,attempted,created_at').limit(20000))
  const today = new Date()
  const z = (n) => String(n).padStart(2, '0')
  const day = `${today.getFullYear()}-${z(today.getMonth() + 1)}-${z(today.getDate())}`
  const daily = await q(client.from('foldy_daily').select('member_id,done').eq('day', day))
  return { words, daily }
}
export async function deleteMember(id) {
  const rows = await q(client.from('foldy_members').delete().eq('id', id).select('id'))
  if (!rows.length) throw new Error('비밀번호로 잠긴 프로필은 본인만 지울 수 있어요')
}

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
export async function updateWord(id, patch) {
  const rows = await q(client.from('foldy_words').update(patch).eq('id', id).select())
  if (!rows.length) throw new Error(friendly({ message: 'FORBIDDEN' }))
  return rows[0]
}
export async function deleteWord(id) {
  const rows = await q(client.from('foldy_words').delete().eq('id', id).select('id'))
  if (!rows.length) throw new Error(friendly({ message: 'FORBIDDEN' }))
}

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

// 앱 수정요청 (멘토링대학교 수정요청함 구조)
export const FEEDBACK_STATUSES = ['신규', '확인완료', '의견보류', '수정진행', '수정완료']
export async function isAdmin() {
  const { data, error } = await client.rpc('foldy_is_admin')
  return !error && !!data
}
export const addFeedback = (row) => q(client.from('foldy_feedback').insert(row).select().single())
export const listFeedback = () => q(client.from('foldy_feedback').select('*').order('created_at', { ascending: false }))
export async function myFeedback() {
  return q(client.from('foldy_feedback').select('*').eq('family_id', session?.family_id).order('created_at', { ascending: false }))
}
export async function updateFeedback(id, patch) {
  const rows = await q(client.from('foldy_feedback').update(patch).eq('id', id).select())
  if (!rows.length) throw new Error('관리자만 할 수 있어요')
  return rows[0]
}
export async function deleteFeedback(id) {
  const rows = await q(client.from('foldy_feedback').delete().eq('id', id).select('id'))
  if (!rows.length) throw new Error('관리자만 할 수 있어요')
}
export const markFeedbackSeen = () => client.rpc('foldy_feedback_seen').then(() => {}, () => {})
export const feedbackUnseen = (f) => !!f.status_changed_at && (!f.user_seen_at || new Date(f.user_seen_at) < new Date(f.status_changed_at))
