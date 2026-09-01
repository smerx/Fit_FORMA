import { format, parseISO } from 'date-fns'
import { PAY_KIND_LABEL, type TutorEvent, type TutorLesson, type TutorStudent } from './types'
import { scheduleLabel } from './money'

const STATUS_LABEL: Record<TutorLesson['status'], string> = {
  held: 'пришёл',
  skipped: 'пропуск оплачивается',
  cancelled: 'отмена',
  extra: 'дополнительное занятие',
}

function dateLabel(date: string): string {
  return format(parseISO(date), 'dd.MM.yyyy')
}

export function buildTutorsAiText(
  students: TutorStudent[],
  lessons: TutorLesson[],
  events: TutorEvent[],
): string {
  const byId = new Map(students.map((student) => [student.id, student]))
  const lines = ['Ученики']

  for (const student of students
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru'))) {
    const payment =
      student.payKind === 'hourly'
        ? `${student.priceRub} ₽/час`
        : `${PAY_KIND_LABEL[student.payKind]} · ${student.priceRub} ₽ · ${student.paid ? 'оплачен' : 'не оплачен'}`
    lines.push(
      `${student.name} | ${payment} | ${student.durationMin} мин | ${scheduleLabel(student) || 'без расписания'} | ${student.active ? 'активен' : 'неактивен'}`,
    )
    if (student.note.trim()) lines.push(`Заметка: ${student.note.trim()}`)
  }

  lines.push('', 'Даты с посещениями')
  for (const lesson of lessons
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.timeHm.localeCompare(b.timeHm))) {
    const student = byId.get(lesson.studentId)
    lines.push(
      `${dateLabel(lesson.date)} | ${lesson.timeHm || student?.timeHm || '—'} | ${student?.name ?? 'Удалённый ученик'} | ${STATUS_LABEL[lesson.status]}`,
    )
  }

  if (events.length) {
    lines.push('', 'Оплаты, пробные и заметки')
    for (const event of events
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || (a.timeHm ?? '').localeCompare(b.timeHm ?? ''))) {
      const student = event.studentId ? byId.get(event.studentId) : undefined
      if (event.kind === 'payment') {
        lines.push(
          `${dateLabel(event.date)} | ${student?.name ?? 'Без ученика'} | оплата ${event.amountRub} ₽`,
        )
      } else {
        lines.push(
          `${dateLabel(event.date)} | ${event.timeHm ?? '—'} | ${event.kind === 'trial' ? 'пробное' : 'заметка'} | ${event.title || student?.name || 'без названия'}`,
        )
      }
    }
  }

  return lines.join('\n')
}
