import type { TutorEvent, TutorLesson, TutorStudent } from './types'
import { dayRows } from './money'
import { nid, shiftIso, todayIso } from '../lib/dates'
import { replaceReminderQueue, upsertPushSub } from './cloud'

export type UpcomingLesson = {
  key: string
  studentId: string
  name: string
  date: string
  timeHm: string
  at: Date
}

function atLocal(iso: string, timeHm: string): Date {
  const [y, mo, d] = iso.split('-').map(Number)
  const [h, mi] = timeHm.split(':').map(Number)
  return new Date(y ?? 0, (mo ?? 1) - 1, d ?? 1, h ?? 16, mi ?? 0, 0, 0)
}

export function upcomingLessons(
  students: TutorStudent[],
  lessons: TutorLesson[],
  events: TutorEvent[] = [],
  days = 2,
): UpcomingLesson[] {
  const start = todayIso()
  const out: UpcomingLesson[] = []
  for (let i = 0; i < days; i++) {
    const iso = shiftIso(start, i)
    for (const row of dayRows(students, lessons, iso)) {
      if (row.rec?.status === 'cancelled' || row.rec?.status === 'skipped') continue
      out.push({
        key: row.key,
        studentId: row.student.id,
        name: row.student.name,
        date: iso,
        timeHm: row.timeHm,
        at: atLocal(iso, row.timeHm),
      })
    }
    for (const e of events.filter((x) => x.kind === 'trial' && x.date === iso && x.timeHm)) {
      out.push({
        key: `trial-${e.id}`,
        studentId: e.studentId ?? '',
        name: e.title || 'Пробное',
        date: iso,
        timeHm: e.timeHm!,
        at: atLocal(iso, e.timeHm!),
      })
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime())
}

const timers = new Map<string, number>()

function clearTimers() {
  for (const id of timers.values()) window.clearTimeout(id)
  timers.clear()
}

async function fire(item: UpcomingLesson) {
  const title = 'Занятие через 15 минут'
  const body = `${item.name} · ${item.timeHm}`
  try {
    const reg = await navigator.serviceWorker?.ready
    if (reg?.showNotification) {
      await reg.showNotification(title, {
        body,
        icon: '/pwa-192.png',
        badge: '/pwa-192.png',
        tag: `tutor-${item.key}`,
        data: { url: '/' },
      })
      return
    }
  } catch {
    /* fallback ниже */
  }
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/pwa-192.png', tag: `tutor-${item.key}` })
  }
}

export async function requestReminderPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const res = await Notification.requestPermission()
  return res === 'granted'
}

function vapidPublic(): string | null {
  const fromEnv = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  const v = fromEnv?.trim()
  if (!v) return null
  return v
}

function urlBase64ToUint8Array(base64: string): Uint8Array | null {
  try {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4)
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
    const out = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

async function pushToWorker(items: UpcomingLesson[]) {
  const payload = items.map((item) => ({
    key: item.key,
    fireAt: item.at.getTime() - 15 * 60 * 1000,
    title: 'Занятие через 15 минут',
    body: `${item.name} · ${item.timeHm}`,
  }))
  try {
    const reg = await navigator.serviceWorker?.ready
    reg?.active?.postMessage({ type: 'tutor-reminders', items: payload })
    const sync = (reg as ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> }
    })?.periodicSync
    if (sync) {
      await sync.register('tutor-remind', { minInterval: 15 * 60 * 1000 }).catch(() => undefined)
    }
  } catch {
    /* воркер мог ещё не встать */
  }
}

async function subscribePush(userId: string | null) {
  if (!userId || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const key = vapidPublic()
  const bytes = key ? urlBase64ToUint8Array(key) : null
  if (!bytes || bytes.length < 20) return
  try {
    const reg = await navigator.serviceWorker.ready
    if (!reg.pushManager) return
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes as BufferSource,
      })
    }
    const json = sub.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return
    await upsertPushSub(userId, {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    })
  } catch {
    /* без VAPID на сервере подписка может не встать — таймер и воркер остаются */
  }
}

async function queueCloud(userId: string | null, items: UpcomingLesson[]) {
  if (!userId) return
  const now = Date.now()
  const rows = items
    .map((item) => {
      const fireAt = item.at.getTime() - 15 * 60 * 1000
      return {
        id: nid(),
        fireAt: new Date(fireAt).toISOString(),
        title: 'Занятие через 15 минут',
        body: `${item.name} · ${item.timeHm}`,
        tag: item.key,
        wait: fireAt - now,
      }
    })
    .filter((x) => x.wait > -10 * 60 * 1000 && x.wait < 48 * 60 * 60 * 1000)
    .map(({ wait: _w, ...row }) => row)
  try {
    await replaceReminderQueue(userId, rows)
  } catch {
    /* таблица после migrate-v8 */
  }
}

export function syncLessonReminders(
  students: TutorStudent[],
  lessons: TutorLesson[],
  on: boolean,
  events: TutorEvent[] = [],
  userId: string | null = null,
) {
  clearTimers()
  if (!on || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const items = upcomingLessons(students, lessons, events, 2)
  const now = Date.now()
  for (const item of items) {
    const fireAt = item.at.getTime() - 15 * 60 * 1000
    const wait = fireAt - now
    if (wait < 500 || wait > 48 * 60 * 60 * 1000) continue
    const id = window.setTimeout(() => {
      void fire(item)
    }, wait)
    timers.set(item.key, id)
  }
  void pushToWorker(items)
  void subscribePush(userId)
  void queueCloud(userId, items)
}
