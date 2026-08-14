import { addDays, differenceInCalendarDays, format, getISODay, parseISO } from 'date-fns'
import { shiftIso } from '../lib/dates'
import type { DayRow, PayKind, TutorEvent, TutorLesson, TutorSlot, TutorStudent } from './types'
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

export function hydrateLesson(raw: Partial<TutorLesson>): TutorLesson {
  return {
    id: raw.id ?? '',
    studentId: raw.studentId ?? '',
    date: raw.date ?? '',
    timeHm: raw.timeHm ?? '',
    status: raw.status ?? 'held',
    createdAt: raw.createdAt ?? '',
  }
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

export function hydrateStudent(raw: Partial<TutorStudent> & { slots?: TutorSlot[] }): TutorStudent {
  const slots =
    raw.slots && raw.slots.length > 0
      ? raw.slots.map((x) => ({ weekday: x.weekday, timeHm: x.timeHm || raw.timeHm || '16:00' }))
      : (raw.weekdays ?? []).map((weekday) => ({ weekday, timeHm: raw.timeHm || '16:00' }))
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    payKind: raw.payKind ?? 'pack8',
    priceRub: raw.priceRub ?? 0,
    durationMin: raw.durationMin ?? 60,
    slots,
    weekdays: slots.map((x) => x.weekday),
    timeHm: slots[0]?.timeHm ?? raw.timeHm ?? '16:00',
    active: raw.active ?? true,
    packStartedOn: raw.packStartedOn ?? null,
    note: raw.note ?? '',
    sortOrder: raw.sortOrder ?? 0,
    createdAt: raw.createdAt ?? '',
  }
}

export function timeOn(s: TutorStudent, iso: string): string {
  const wd = getISODay(parseISO(iso))
  return s.slots.find((x) => x.weekday === wd)?.timeHm ?? s.timeHm
}

export function scheduleLabel(s: TutorStudent): string {
  return s.slots
    .slice()
    .sort((a, b) => a.weekday - b.weekday || a.timeHm.localeCompare(b.timeHm))
    .map((x) => `${WEEKDAYS.find((w) => w.n === x.weekday)?.s ?? ''} ${x.timeHm}`)
    .join(' · ')
}

export function isRegularOn(s: TutorStudent, iso: string): boolean {
  const wd = getISODay(parseISO(iso))
  return s.active && s.slots.some((x) => x.weekday === wd)
}

export function matchLesson(
  lessons: TutorLesson[],
  studentId: string,
  iso: string,
  timeHm: string,
): TutorLesson | undefined {
  const same = lessons.filter((l) => l.studentId === studentId && l.date === iso)
  const exact = same.find((l) => l.timeHm === timeHm)
  if (exact) return exact
  if (same.length === 1 && !same[0]!.timeHm) return same[0]
  return undefined
}

export function lessonOn(lessons: TutorLesson[], studentId: string, iso: string): TutorLesson | undefined {
  return lessons.find((l) => l.studentId === studentId && l.date === iso)
}

export function dayRows(students: TutorStudent[], lessons: TutorLesson[], iso: string): DayRow[] {
  const wd = getISODay(parseISO(iso))
  const used = new Set<string>()
  const rows: DayRow[] = []
  for (const s of students) {
    if (!s.active) continue
    for (const slot of s.slots.filter((x) => x.weekday === wd)) {
      const rec = matchLesson(lessons, s.id, iso, slot.timeHm)
      if (rec) used.add(rec.id)
      rows.push({
        key: rec?.id ?? `reg-${s.id}-${slot.timeHm}`,
        student: s,
        timeHm: slot.timeHm,
        rec,
        kind: rec?.status === 'extra' ? 'extra' : 'regular',
      })
    }
  }
  for (const l of lessons) {
    if (l.date !== iso || used.has(l.id)) continue
    const s = students.find((x) => x.id === l.studentId)
    if (!s) continue
    rows.push({
      key: l.id,
      student: s,
      timeHm: l.timeHm || s.timeHm,
      rec: l,
      kind: 'extra',
    })
  }
  return rows.sort(
    (a, b) => a.timeHm.localeCompare(b.timeHm) || a.student.name.localeCompare(b.student.name, 'ru'),
  )
}

export function rosterIds(students: TutorStudent[], lessons: TutorLesson[], iso: string): string[] {
  return [...new Set(dayRows(students, lessons, iso).map((r) => r.student.id))]
}

function slotCancelled(lessons: TutorLesson[], studentId: string, iso: string, timeHm: string): boolean {
  return matchLesson(lessons, studentId, iso, timeHm)?.status === 'cancelled'
}

export function nextRegularDates(
  s: TutorStudent,
  fromIso: string,
  count: number,
  lessons: TutorLesson[],
): string[] {
  return nextRegularSlots(s, fromIso, count, lessons).map((x) => x.date)
}

function nextRegularSlots(
  s: TutorStudent,
  fromIso: string,
  count: number,
  lessons: TutorLesson[],
): { date: string; timeHm: string }[] {
  if (!s.slots.length || count <= 0) return []
  const out: { date: string; timeHm: string }[] = []
  let iso = fromIso
  for (let i = 0; i < 420 && out.length < count; i++) {
    const wd = getISODay(parseISO(iso))
    const slots = s.slots
      .filter((x) => x.weekday === wd)
      .slice()
      .sort((a, b) => a.timeHm.localeCompare(b.timeHm))
    for (const slot of slots) {
      if (out.length >= count) break
      if (s.active && !slotCancelled(lessons, s.id, iso, slot.timeHm)) {
        out.push({ date: iso, timeHm: slot.timeHm })
      }
    }
    iso = shiftIso(iso, 1)
  }
  return out
}

export type PayLine = { date: string; skipped: boolean; timeHm?: string }

export function packEntriesForPayment(s: TutorStudent, lessons: TutorLesson[], today: string): PayLine[] {
  const size = packSize(s.payKind) ?? 1
  const start = s.packStartedOn ?? today
  const used = lessons
    .filter((l) => l.studentId === s.id && l.date >= start && countsForPack(l.status))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.timeHm.localeCompare(b.timeHm))
  const usedLines: PayLine[] = used.map((l) => ({
    date: l.date,
    skipped: l.status === 'skipped',
    timeHm: l.timeHm || undefined,
  }))
  if (s.payKind === 'hourly') {
    const last = usedLines.slice(-8)
    if (last.length) return last
    return nextRegularSlots(s, today, 4, lessons).map((x) => ({
      date: x.date,
      skipped: false,
      timeHm: x.timeHm,
    }))
  }
  if (usedLines.length >= size) return usedLines.slice(-size)
  const need = size - usedLines.length
  const from = usedLines.length
    ? shiftIso(usedLines[usedLines.length - 1]!.date, 1)
    : start < today
      ? today
      : start
  const extra = nextRegularSlots(s, from, need, lessons).map((x) => ({
    date: x.date,
    skipped: false,
    timeHm: x.timeHm,
  }))
  return [...usedLines, ...extra].slice(0, size)
}

export function paymentText(s: TutorStudent, lines: PayLine[], payDetails: string): string {
  const multi = lines.some((d, i, arr) => arr.filter((x) => x.date === d.date).length > 1)
  const rows = lines.map((d, i) => {
    const time = multi && d.timeHm ? ` ${d.timeHm}` : ''
    return `${i + 1}) ${format(parseISO(d.date), 'dd.MM')}${time}${d.skipped ? ' (п.б.ув.пр)' : ''}`
  })
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
    ...rows,
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
  events: TutorEvent[] = [],
): { expected: number; cautious: number } {
  const end = format(addDays(parseISO(today), days - 1), 'yyyy-MM-dd')
  const byId = new Map(students.map((s) => [s.id, s]))
  let sum = 0
  for (const s of students.filter((x) => x.active)) {
    sum += cashInWindow(s, lessons, events, today, end)
  }
  for (const e of events) {
    if (e.kind !== 'payment' || e.date < today || e.date > end) continue
    const s = e.studentId ? byId.get(e.studentId) : undefined
    if (s?.payKind === 'hourly') continue
    sum += e.amountRub
  }
  return { expected: sum, cautious: Math.round(sum * 0.88) }
}

export function lessonCountOn(s: TutorStudent, lessons: TutorLesson[], iso: string): number {
  return dayRows([s], lessons, iso).filter((r) => {
    if (r.rec?.status === 'cancelled') return false
    if (r.rec) return countsForPack(r.rec.status)
    return true
  }).length
}

function cashInWindow(
  s: TutorStudent,
  lessons: TutorLesson[],
  events: TutorEvent[],
  today: string,
  end: string,
): number {
  if (s.payKind === 'hourly') {
    let sum = 0
    for (let iso = today; iso <= end; iso = shiftIso(iso, 1)) {
      sum += lessonCountOn(s, lessons, iso) * lessonValue(s)
    }
    return sum
  }
  const size = packSize(s.payKind)
  if (!size) return 0
  let left = remainingInPack(s, lessons) ?? size
  let sum = 0
  if (left === 0) {
    const alreadyPaid = events.some(
      (e) =>
        e.kind === 'payment' &&
        e.studentId === s.id &&
        e.date >= (s.packStartedOn ?? today),
    )
    if (!alreadyPaid && today <= end) sum += s.priceRub
    left = size
  }
  for (let iso = today; iso <= end; iso = shiftIso(iso, 1)) {
    const n = lessonCountOn(s, lessons, iso)
    for (let i = 0; i < n; i++) {
      left -= 1
      if (left === 0) {
        sum += s.priceRub
        left = size
      }
    }
  }
  return sum
}

export function rub(n: number): string {
  return `${n.toLocaleString('ru-RU')} ₽`
}
