import { addDays, differenceInCalendarDays, format, getISODay, parseISO } from 'date-fns'
import { shiftIso } from '../lib/dates'
import type { PayKind, TutorLesson, TutorStudent } from './types'
import { WEEKDAYS } from './types'
import { instrumentalName } from './names'

export function packSize(kind: PayKind): number | null {
  if (kind === 'pack4') return 4
  if (kind === 'pack8') return 8
  return null
}

export function countsForPack(status: TutorLesson['status']): boolean {
  return status === 'held' || status === 'skipped' || status === 'extra'
}

export function lessonValue(s: TutorStudent): number {
  const size = packSize(s.payKind)
  if (size) return Math.round(s.priceRub / size)
  return Math.round(s.priceRub * (s.durationMin / 60))
}

export function usedInPack(s: TutorStudent, lessons: TutorLesson[]): number {
  const size = packSize(s.payKind)
  if (!size || !s.packStartedOn) return 0
  return lessons.filter(
    (l) => l.studentId === s.id && l.date >= s.packStartedOn! && countsForPack(l.status),
  ).length
}

export function remainingInPack(s: TutorStudent, lessons: TutorLesson[]): number | null {
  const size = packSize(s.payKind)
  if (!size) return null
  return Math.max(0, size - usedInPack(s, lessons))
}

export function weekdayNames(days: number[]): string {
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((n) => WEEKDAYS.find((w) => w.n === n)?.s ?? '')
    .filter(Boolean)
    .join(', ')
}

export function isRegularOn(s: TutorStudent, iso: string): boolean {
  return s.active && s.weekdays.includes(getISODay(parseISO(iso)))
}

export function lessonOn(lessons: TutorLesson[], studentId: string, iso: string): TutorLesson | undefined {
  return lessons.find((l) => l.studentId === studentId && l.date === iso)
}

export function rosterIds(students: TutorStudent[], lessons: TutorLesson[], iso: string): string[] {
  const ids = new Set<string>()
  for (const s of students) {
    if (isRegularOn(s, iso)) ids.add(s.id)
  }
  for (const l of lessons) {
    if (l.date === iso) ids.add(l.studentId)
  }
  return [...ids]
}

function cancelledOn(lessons: TutorLesson[], studentId: string, iso: string): boolean {
  return lessonOn(lessons, studentId, iso)?.status === 'cancelled'
}

export function nextRegularDates(
  s: TutorStudent,
  fromIso: string,
  count: number,
  lessons: TutorLesson[],
): string[] {
  if (!s.weekdays.length || count <= 0) return []
  const out: string[] = []
  let iso = fromIso
  for (let i = 0; i < 420 && out.length < count; i++) {
    if (isRegularOn(s, iso) && !cancelledOn(lessons, s.id, iso)) out.push(iso)
    iso = shiftIso(iso, 1)
  }
  return out
}

export function packDatesForPayment(s: TutorStudent, lessons: TutorLesson[], today: string): string[] {
  const size = packSize(s.payKind) ?? 1
  const start = s.packStartedOn ?? today
  const used = lessons
    .filter((l) => l.studentId === s.id && l.date >= start && countsForPack(l.status))
    .map((l) => l.date)
    .sort()
  if (s.payKind === 'hourly') {
    const last = used.slice(-8)
    if (last.length) return last
    return nextRegularDates(s, today, 4, lessons)
  }
  if (used.length >= size) return used.slice(-size)
  const need = size - used.length
  const from = used.length ? shiftIso(used[used.length - 1]!, 1) : start < today ? today : start
  return [...used, ...nextRegularDates(s, from, need, lessons)].slice(0, size)
}

export function paymentText(s: TutorStudent, dates: string[], payDetails: string): string {
  const lines = dates.map((d, i) => `${i + 1}) ${format(parseISO(d), 'dd.MM')}`)
  const named = instrumentalName(s.name)
  const sum = rub(s.priceRub)
  const intro =
    s.payKind === 'hourly'
      ? `Здравствуйте! Пора оплатить занятия с ${named}.`
      : `Здравствуйте! У нас закончился абонемент с ${named}.`
  const payLine =
    s.payKind === 'hourly'
      ? `Сейчас нужно оплатить ${sum}.`
      : `Сейчас нужно оплатить за новый абонемент ${sum}.`
  return [
    intro,
    'Даты занятия:',
    ...lines,
    '',
    payLine,
    '',
    'Мои реквизиты для оплаты:',
    payDetails.trim() || '89041237534 Сбербанк, Дмитрий Андреевич.',
  ].join('\n')
}

export function daysUntil(iso: string, today: string): number {
  return Math.max(0, differenceInCalendarDays(parseISO(iso), parseISO(today)))
}

export function payHint(s: TutorStudent, lessons: TutorLesson[], today: string): string {
  const amount = `${(s.priceRub / 1000).toFixed(s.priceRub % 1000 === 0 ? 0 : 1)} тыс`
  if (s.payKind === 'hourly') {
    const next = nextRegularDates(s, today, 1, lessons)[0]
    if (!next) return `ставка ${s.priceRub} ₽/ч`
    const d = daysUntil(next, today)
    return `${s.priceRub} ₽/ч · ближайшее ${d === 0 ? 'сегодня' : `через ${d} дн.`}`
  }
  const left = remainingInPack(s, lessons) ?? 0
  if (left === 0) return `оплата ${amount} · пора брать`
  const last = nextRegularDates(s, today, left, lessons).at(-1)
  if (!last) return `оплата ${amount} · осталось ${left}`
  const d = daysUntil(last, today)
  return `оплата ${amount} через ${d} дн. · ещё ${left}`
}

export function expectedInDays(
  students: TutorStudent[],
  lessons: TutorLesson[],
  today: string,
  days: number,
): { expected: number; cautious: number } {
  const end = format(addDays(parseISO(today), days - 1), 'yyyy-MM-dd')
  let sum = 0
  for (const s of students.filter((x) => x.active)) {
    const unit = lessonValue(s)
    const seen = new Set<string>()
    for (let iso = today; iso <= end; iso = shiftIso(iso, 1)) {
      const rec = lessonOn(lessons, s.id, iso)
      if (rec?.status === 'cancelled') continue
      const happens = rec ? countsForPack(rec.status) : isRegularOn(s, iso)
      if (!happens || seen.has(iso)) continue
      seen.add(iso)
      sum += unit
    }
  }
  return { expected: sum, cautious: Math.round(sum * 0.88) }
}

export function rub(n: number): string {
  return `${n.toLocaleString('ru-RU')} ₽`
}
