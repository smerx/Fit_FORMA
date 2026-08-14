import { addDays, format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function shiftIso(iso: string, days: number): string {
  return format(addDays(parseISO(iso), days), 'yyyy-MM-dd')
}

export function formatDayTitle(iso: string): string {
  if (iso === todayIso()) return 'Сегодня'
  if (iso === shiftIso(todayIso(), -1)) return 'Вчера'
  return format(parseISO(iso), 'd MMMM', { locale: ru })
}

export function formatLongDate(iso: string): string {
  return format(parseISO(iso), 'd MMMM yyyy', { locale: ru })
}

export function formatWeekday(iso: string): string {
  return format(parseISO(iso), 'EEEE', { locale: ru })
}

export function nid(): string {
  return crypto.randomUUID()
}
