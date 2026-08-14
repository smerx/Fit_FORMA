import type { TutorLesson, TutorStudent } from './types'
import { isRegularOn, lessonOn, timeOn } from './money'
import { shiftIso, todayIso } from '../lib/dates'

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
  days = 2,
): UpcomingLesson[] {
  const start = todayIso()
  const out: UpcomingLesson[] = []
  for (let i = 0; i < days; i++) {
    const iso = shiftIso(start, i)
    for (const s of students.filter((x) => x.active)) {
      const rec = lessonOn(lessons, s.id, iso)
      if (rec?.status === 'cancelled' || rec?.status === 'skipped') continue
      if (!rec && !isRegularOn(s, iso)) continue
      out.push({
        key: `${s.id}-${iso}`,
        studentId: s.id,
        name: s.name,
        date: iso,
        timeHm: timeOn(s, iso),
        at: atLocal(iso, timeOn(s, iso)),
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

export function syncLessonReminders(
  students: TutorStudent[],
  lessons: TutorLesson[],
  on: boolean,
) {
  clearTimers()
  if (!on || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const now = Date.now()
  for (const item of upcomingLessons(students, lessons, 2)) {
    const fireAt = item.at.getTime() - 15 * 60 * 1000
    const wait = fireAt - now
    if (wait < 500 || wait > 48 * 60 * 60 * 1000) continue
    const id = window.setTimeout(() => {
      void fire(item)
    }, wait)
    timers.set(item.key, id)
  }
}
