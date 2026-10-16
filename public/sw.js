/* 폴디 서비스워커 — 오프라인으로 열기 + 알림(웹 푸시) */
const VERSION = 'foldy-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/silence.mp3']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k.startsWith('foldy-')).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

const isAsset = (u) => u.origin === self.location.origin && (u.pathname.startsWith('/assets/') || u.pathname.startsWith('/audio/') || /\.(png|svg|mp3|woff2?|json|webmanifest)$/.test(u.pathname))
const isFont = (u) => /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const u = new URL(req.url)
  if (u.pathname.startsWith('/api/') || /supabase\.co$/.test(u.hostname)) return // 데이터는 앱이 직접 처리
  // 화면(index.html): 인터넷 먼저, 안 되면 저장해 둔 것
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(VERSION).then((c) => c.put('/index.html', cp)); return r })
      .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))))
    return
  }
  // 코드·그림·발음 파일·글꼴: 저장해 둔 것 먼저(파일 이름에 해시가 있어 안전), 없으면 받아서 저장
  if (isAsset(u) || isFont(u)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)) }
      return r
    })))
  }
})

self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { body: e.data && e.data.text() } }
  e.waitUntil(self.registration.showNotification(d.title || '폴디', {
    body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: d.tag || 'foldy', data: { url: d.url || '/' },
  }))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus() }
    return self.clients.openWindow(url)
  }))
})
