const DB = 'forma-tutor-remind'
const STORE = 'kv'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function put(key, value) {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put(value, key)
  await new Promise((res, rej) => {
    tx.oncomplete = res
    tx.onerror = () => rej(tx.error)
  })
}

async function get(key) {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const req = tx.objectStore(STORE).get(key)
  return new Promise((res) => {
    req.onsuccess = () => res(req.result)
    req.onerror = () => res(undefined)
  })
}

async function fireDue() {
  const items = (await get('items')) || []
  const fired = (await get('fired')) || {}
  const now = Date.now()
  let changed = false
  for (const item of items) {
    const wait = item.fireAt - now
    if (wait > 60 * 1000) continue
    if (wait < -25 * 60 * 1000) continue
    if (fired[item.key]) continue
    await self.registration.showNotification(item.title || 'Занятие через 15 минут', {
      body: item.body || '',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: 'tutor-' + item.key,
      data: { url: '/' },
    })
    fired[item.key] = true
    changed = true
  }
  if (changed) await put('fired', fired)
}

self.addEventListener('message', (event) => {
  const data = event.data
  if (data?.type !== 'tutor-reminders') return
  event.waitUntil(put('items', data.items || []).then(() => fireDue()))
})

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'tutor-remind') event.waitUntil(fireDue())
})

self.addEventListener('push', (event) => {
  let payload = { title: 'Занятие через 15 минут', body: '', tag: 'tutor' }
  try {
    payload = { ...payload, ...event.data.json() }
  } catch {
    try {
      payload.body = event.data.text()
    } catch {
      /* пустой пуш */
    }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: payload.tag || 'tutor',
      data: { url: '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})
