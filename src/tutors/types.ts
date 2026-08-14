export type PayKind = 'pack4' | 'pack8' | 'hourly'
export type LessonStatus = 'held' | 'skipped' | 'cancelled' | 'extra'

export type TutorSettings = {
  enabled: boolean
  remindersOn: boolean
  payDetails: string
}

export type TutorStudent = {
  id: string
  name: string
  payKind: PayKind
  priceRub: number
  durationMin: number
  weekdays: number[]
  timeHm: string
  active: boolean
  packStartedOn: string | null
  note: string
  createdAt: string
}

export type TutorLesson = {
  id: string
  studentId: string
  date: string
  status: LessonStatus
  createdAt: string
}

export const defaultTutorSettings = (): TutorSettings => ({
  enabled: true,
  remindersOn: true,
  payDetails: '89041237534 Сбербанк, Дмитрий Андреевич.',
})

export const PAY_KIND_LABEL: Record<PayKind, string> = {
  pack4: 'Абонемент 4',
  pack8: 'Абонемент 8',
  hourly: 'Почасовая',
}

export const WEEKDAYS: { n: number; s: string }[] = [
  { n: 1, s: 'пн' },
  { n: 2, s: 'вт' },
  { n: 3, s: 'ср' },
  { n: 4, s: 'чт' },
  { n: 5, s: 'пт' },
  { n: 6, s: 'сб' },
  { n: 7, s: 'вс' },
]
