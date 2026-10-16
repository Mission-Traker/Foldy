// 알림(웹 푸시) 켜기·끄기 — 서비스워커는 main.jsx에서 등록
import { sb } from './db.js'

export const VAPID_PUBLIC = 'BNHHCGODwfQEhLmXdKs178ZcP3p1fvhoVx3IbbWySQt5-l_t3mEdabf2Vcu96uj2zKdy0L7qxHEvmvVOJ3a-1cQ'
const b64 = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)) }

export function pushSupport() {
  if (typeof window === 'undefined') return 'no'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'no'
  return 'yes'
}
async function reg() { return navigator.serviceWorker.ready }
export async function currentSub() {
  if (pushSupport() !== 'yes') return null
  try { return await (await reg()).pushManager.getSubscription() } catch { return null }
}
export async function enablePush(memberId) {
  if (pushSupport() !== 'yes') throw new Error('이 브라우저는 알림을 지원하지 않아요')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('알림이 허용되지 않았어요. 기기 설정에서 폴디 알림을 켜 주세요')
  const r = await reg()
  const sub = (await r.pushManager.getSubscription()) || (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID_PUBLIC) }))
  const j = sub.toJSON()
  const { data, error } = await sb().rpc('foldy_push_subscribe', { p_member: memberId || null, p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth })
  if (error || data?.error) throw new Error('알림 등록에 실패했어요')
  try { localStorage.setItem('foldy.pushMember', memberId || '') } catch { /* */ }
  return sub
}
export async function disablePush() {
  const sub = await currentSub()
  if (!sub) return
  try { await sb().rpc('foldy_push_unsubscribe', { p_endpoint: sub.endpoint }) } catch { /* */ }
  await sub.unsubscribe().catch(() => {})
  try { localStorage.removeItem('foldy.pushMember') } catch { /* */ }
}
export const pushMember = () => { try { return localStorage.getItem('foldy.pushMember') } catch { return null } }
// 이 기기에서 알림이 잘 보이는지 바로 띄워 보기
export async function testNotice() {
  const r = await reg()
  await r.showNotification('폴디', { body: '알림이 잘 와요! 🔔', icon: '/icon-192.png', tag: 'foldy-test' })
}
