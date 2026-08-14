import Fuse from 'fuse.js'
import { shiftIso, todayIso } from '../lib/dates'
import type { PlanTask } from './types'

const TEMPLATES = [
  'Покос травы',
  'Дрова / работа с древесиной',
  'Эллипсоид',
  'Репетиторство',
  'Написать ученику',
  'Подготовить занятие',
  'Купить продукты',
  'Аптека',
  'Бензин / масло',
  'Позвонить',
  'Оплатить',
  'Разобрать сарай',
  'Вынести мусор',
  'Забрать посылку',
  'Сходить в магазин',
]

export type SuggestHit = { title: string; hint: string }

export function parseQuickTask(raw: string): { title: string; dueOn: string | null } {
  let text = raw.trim()
  let dueOn: string | null = null
  const today = todayIso()
  if (/^сегодня\b/i.test(text)) {
    dueOn = today
    text = text.replace(/^сегодня\s*/i, '')
  } else if (/^завтра\b/i.test(text)) {
    dueOn = shiftIso(today, 1)
    text = text.replace(/^завтра\s*/i, '')
  } else if (/^послезавтра\b/i.test(text)) {
    dueOn = shiftIso(today, 2)
    text = text.replace(/^послезавтра\s*/i, '')
  }
  return { title: text.trim() || raw.trim(), dueOn }
}

export function suggestTasks(query: string, existing: PlanTask[]): SuggestHit[] {
  const q = query.trim()
  if (q.length < 1) return []
  const pool = [
    ...TEMPLATES.map((title) => ({ title, hint: 'шаблон' })),
    ...existing
      .filter((t) => !t.done)
      .slice(-40)
      .map((t) => ({ title: t.title, hint: 'из твоих дел' })),
  ]
  const fuse = new Fuse(pool, {
    keys: ['title'],
    threshold: 0.34,
    ignoreLocation: true,
  })
  const seen = new Set<string>()
  const out: SuggestHit[] = []
  const starts = pool.filter((p) => p.title.toLowerCase().startsWith(q.toLowerCase()))
  for (const hit of [...starts, ...fuse.search(q).map((r) => r.item)]) {
    const key = hit.title.toLowerCase()
    if (seen.has(key) || key === q.toLowerCase()) continue
    seen.add(key)
    out.push(hit)
    if (out.length >= 6) break
  }
  return out
}
