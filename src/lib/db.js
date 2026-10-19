import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL || 'https://gilpvbwpbioihvjbldpm.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_kMgYoZQrs5LRk-zrUshxOA_wZz1keiW'
const TOKEN_KEY = 'foldy.session'
const MEMBER_KEY = 'foldy.member'
const MTOK_KEY = 'foldy.memberTokens' // 구성원별 잠금 해제 토큰
const MEMBER_COLS = 'id,family_id,name,avatar,level,daily_goal,streak,best_streak,last_study,created_at,has_pin,story,pet,name_changed_at,level_base'

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
  // 인터넷이 끊겨 있으면 기다리며 다시 시도하지 않고 바로 실패(오프라인 화면으로 곧장)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.reject(new DOMException('offline', 'AbortError'))
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
  not_admin: '관리자만 할 수 있어요',
  SIGNUP_BUSY: '지금 가입이 많아요. 잠시 뒤 다시 해 주세요',
  LOGIN_TAKEN: '이미 쓰고 있는 아이디예요',
  LOGIN_FAILED: '아이디 또는 비밀번호가 맞지 않아요',
  PASSWORD_SHORT: '비밀번호는 8자 이상이에요',
  PIN_WRONG: '비밀번호가 맞지 않아요',
  PIN_FORMAT: '비밀번호는 숫자 4~6자리예요',
  FORBIDDEN: '이 프로필은 비밀번호로 잠겨 있어요',
  LOGIN_LOCKED: '여러 번 틀려서 15분 동안 잠겼어요. 잠시 뒤 다시 해 주세요',
  RECOVERY_WRONG: '가족 아이디나 복구 코드가 맞지 않아요',
  PASSWORD_WRONG: '가족 비밀번호가 맞지 않아요',
  HANDOFF_EXPIRED: '연결 시간이 지났어요. 앱에서 다시 눌러 주세요',
  NO_SESSION: '다시 로그인해 주세요',
}
function friendly(error) {
  const m = error?.message || String(error)
  for (const k of Object.keys(ERR)) if (m.includes(k)) return ERR[k]
  const cool = m.match(/name_cooldown:(\d{4})-(\d{2})-(\d{2})/)
  if (cool) return `이름은 한 달에 한 번 바꿀 수 있어요. ${+cool[2]}월 ${+cool[3]}일부터 다시 바꿀 수 있어요`
  if (m.includes('login_id')) return '아이디는 영어 소문자·숫자·_ 로 3~30자예요'
  if (m.includes('Failed to fetch') || m.includes('offline')) return '인터넷 연결을 확인해 주세요'
  // 기술적인 원문은 화면에 보이지 않게(개발자 도구에만 남김)
  try { console.error('[foldy]', m) } catch { /* */ }
  return '잠깐 문제가 생겼어요. 잠시 뒤 다시 해 주세요'
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

// 여러 단어 한꺼번에 지우기(100개씩) → 지운 개수
export async function deleteWords(ids) {
  let n = 0
  for (let i = 0; i < ids.length; i += 100) {
    const rows = await q(client.from('foldy_words').delete().in('id', ids.slice(i, i + 100)).select('id'))
    n += rows.length
  }
  return n
}

// 하루 기록
export async function getDaily(memberId, day) {
  const rows = await q(client.from('foldy_daily').select('*').eq('member_id', memberId).eq('day', day))
  return rows[0] || null
}
// 오늘 전 가장 최근 날의 오늘의 단어(새 날엔 이 단어들을 뒤로 미룸)
export async function getPrevSetIds(memberId, day) {
  // 공부를 안 한 날은 오늘의 단어가 비어 있으므로, 비어 있지 않은 가장 최근 날을 찾음
  const rows = await q(client.from('foldy_daily').select('day,set_ids').eq('member_id', memberId).lt('day', day).order('day', { ascending: false }).limit(14))
  const r = rows.find((x) => Array.isArray(x.set_ids) && x.set_ids.length)
  return (r && r.set_ids) || []
}
export const upsertDaily = (row) => q(client.from('foldy_daily').upsert(row).select().single())

// 공유 AI 캐시(같은 단어는 한 번만 AI 호출)
export async function getCache(words) {
  if (!words.length) return {}
  const rows = await q(client.from('foldy_cache').select('word,data,family_id').in('word', words.map((w) => w.toLowerCase())))
  // 같은 단어가 여러 줄이면 우리 가족이 만든 것을 먼저
  const mine = session?.family_id
  rows.sort((a, b) => (a.family_id === mine) - (b.family_id === mine))
  return Object.fromEntries(rows.map((r) => [r.word, r.data]))
}
export async function putCache(items) {
  if (!items.length) return
  if (!session?.family_id) return
  await client.from('foldy_cache').upsert(items.map((it) => ({ word: it.word.toLowerCase().slice(0, 60), family_id: session.family_id, data: it })), { onConflict: 'word,family_id' })
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
// 관리자 페이지(관리자 구성원만, 서버에서 다시 확인)
export async function adminOk() {
  const { data, error } = await client.rpc('foldy_admin_ok')
  return !error && !!data
}
async function rpcOrThrow(fn, args) {
  const { data, error } = await client.rpc(fn, args)
  if (error) throw new Error(friendly(error))
  return data
}
export const adminOverview = () => rpcOrThrow('foldy_admin_overview')
export const adminFamilies = (tests = false) => rpcOrThrow('foldy_admin_families', { p_tests: tests })
export const adminCleanupTests = () => rpcOrThrow('foldy_admin_cleanup_tests')
// 관리자 본인(가족 중 관리자로 정한 한 사람)인지 — 수정요청 알림·수정요청함 링크는 이 사람에게만
export async function isAdminMember(memberId) {
  if (!memberId) return false
  const { data, error } = await client.rpc('foldy_admin_member')
  return !error && data === memberId
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

// 가족 계정: 복구 코드·비밀번호·탈퇴
async function rpcJson(name, args) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error(friendly(error))
  if (data?.error) throw new Error(friendly({ message: data.error }))
  return data
}
export const recoveryNew = () => rpcJson('foldy_recovery_new').then((d) => d.code)
export const recoveryStatus = () => rpcJson('foldy_recovery_status')
export const resetPassword = (login, code, pw) => rpcJson('foldy_reset_password', { p_login: login.trim().toLowerCase(), p_code: code, p_new: pw })
export const changePassword = (oldPw, newPw) => rpcJson('foldy_change_password', { p_old: oldPw, p_new: newPw })
export const resetMemberPin = (memberId, familyPw) => rpcJson('foldy_reset_member_pin', { p_member: memberId, p_password: familyPw })
export async function deleteFamily(pw) {
  await rpcJson('foldy_delete_family', { p_password: pw })
  setSession(null)
  store(MEMBER_KEY, null)
  store(MTOK_KEY, null)
  activeMember = null
}
// 이 기기의 가족 로그인이 아직 살아 있는지(true/false). 인터넷 문제 등으로 알 수 없으면 null
export async function sessionAlive() {
  if (!session) return false
  try {
    const { data, error } = await client.rpc('foldy_family')
    if (error) return null
    return !!data
  } catch { return null }
}
export const aiToday = () => rpcJson('foldy_ai_today').catch(() => ({}))

// 다른 브라우저(사파리)로 로그인 이어받기
export const handoffCreate = (memberId) => rpcJson('foldy_handoff_create', { p_member: memberId || null }).then((d) => d.code)
export async function handoffRedeem(code) {
  const d = await rpcJson('foldy_handoff_redeem', { p_code: code })
  setSession({ token: d.token, family_id: d.family_id, name: d.name, login_id: d.login_id })
  if (d.member_id) {
    if (d.member_token) saveMemberToken(d.member_id, d.member_token)
    saveMemberId(d.member_id)
  }
  return d
}

// 가족끼리 단어 내기
export const sendChallenge = (fromId, toId, words, note) =>
  q(client.from('foldy_challenges').insert({ family_id: session.family_id, from_member: fromId, to_member: toId, words, note: note || null }).select().single())
export const challengesFor = (memberId) =>
  q(client.from('foldy_challenges').select('*').or(`to_member.eq.${memberId},from_member.eq.${memberId}`).order('created_at', { ascending: false }).limit(40))
export async function finishChallenge(id, score, total, results) {
  const rows = await q(client.from('foldy_challenges').update({ done_at: new Date().toISOString(), score, total, results }).eq('id', id).select())
  if (!rows.length) throw new Error(friendly({ message: 'FORBIDDEN' }))
  return rows[0]
}
export const deleteChallenge = (id) => q(client.from('foldy_challenges').delete().eq('id', id).select('id'))
// 이번 주 가족 기록(월요일부터)
export const familyWeek = (fromDay) => q(client.from('foldy_daily').select('member_id,day,done').gte('day', fromDay))
export const memberWords = (memberId) => q(client.from('foldy_words').select('id,word,meaning,en_ok,ko_ok,sp_ok').eq('member_id', memberId).order('seq').limit(5000))

// 시험 대비
export const listExams = (memberId) => q(client.from('foldy_exams').select('*').eq('member_id', memberId).order('exam_date'))
export const addExam = (row) => q(client.from('foldy_exams').insert(row).select().single())
export async function updateExam(id, patch) {
  const rows = await q(client.from('foldy_exams').update(patch).eq('id', id).select())
  if (!rows.length) throw new Error(friendly({ message: 'FORBIDDEN' }))
  return rows[0]
}
export const deleteExam = (id) => q(client.from('foldy_exams').delete().eq('id', id).select('id'))
