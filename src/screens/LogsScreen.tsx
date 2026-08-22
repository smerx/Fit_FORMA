import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronLeft, Copy, ScrollText } from 'lucide-react'
import { useStore } from '../lib/store'
import { formatClock, formatLongDate, shiftIso, todayIso } from '../lib/dates'
import { mealLabel } from '../lib/labels'
import { entryUnit } from '../lib/portions'
import type { ActivityEntry, FoodEntry, WaterEntry, WeightLog } from '../types'

type Period = 1 | 7 | 14 | 30 | 0

type LogItem =
  | { kind: 'food'; at: string; date: string; entry: FoodEntry }
  | { kind: 'water'; at: string; date: string; entry: WaterEntry }
  | { kind: 'activity'; at: string; date: string; entry: ActivityEntry }
  | { kind: 'weight'; at: string; date: string; entry: WeightLog }

export function LogsDock() {
  const [open, setOpen] = useState(false)
  const root = typeof document !== 'undefined' ? document.getElementById('phone-root') : null
  const overlay = open && (
    <div className="absolute inset-0 z-30 flex flex-col bg-bg">
      <header className="flex items-center gap-1 px-2 pt-[max(10px,env(safe-area-inset-top))]">
        <button onClick={() => setOpen(false)} className="flex h-12 w-12 items-center justify-center">
          <ChevronLeft />
        </button>
        <h1 className="text-lg font-bold">Логирование</h1>
      </header>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pt-2">
        <LogsApp />
      </div>
    </div>
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-3xl bg-white/[0.04] px-4 py-3 text-left"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/8 text-white/60">
          <ScrollText size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-white/80">Логирование</span>
          <span className="block text-[11px] text-white/35">когда что съел, вода, тренировки</span>
        </span>
      </button>
      {overlay && root ? createPortal(overlay, root) : overlay}
    </>
  )
}

function periodLabel(n: Period): string {
  if (n === 0) return 'всё время'
  if (n === 1) return 'сегодня'
  return `${n} дней`
}

function itemLine(item: LogItem): string {
  const time = formatClock(item.at) || '—'
  if (item.kind === 'food') {
    const e = item.entry
    return `${time} еда · ${mealLabel(e.meal)} · ${e.name} · ${e.grams} ${entryUnit(e.foodId)} · ${e.kcal} ккал · Б${Math.round(e.protein)} Ж${Math.round(e.fat)} У${Math.round(e.carbs)}`
  }
  if (item.kind === 'water') return `${time} вода · ${item.entry.ml} мл`
  if (item.kind === 'activity') {
    const e = item.entry
    const note = e.note ? ` · заметка: ${e.note}` : ''
    return `${time} тренировка · ${e.name} · ${e.minutes} мин · ${e.kcal} ккал${note}`
  }
  return `${time} вес · ${item.entry.weight.toFixed(1)} кг`
}

function buildAiText(groups: [string, LogItem[]][], period: Period): string {
  const lines = [
    `Дневник Форма — период: ${periodLabel(period)}`,
    'Формат: время · тип · детали (удобно для разбора рациона и тренировок).',
    '',
  ]
  for (const [date, rows] of groups) {
    lines.push(formatLongDate(date))
    for (const row of rows) lines.push(itemLine(row))
    lines.push('')
  }
  return lines.join('\n').trim()
}

function LogsApp() {
  const { snapshot } = useStore()
  const [period, setPeriod] = useState<Period>(7)
  const [copied, setCopied] = useState(false)
  const today = todayIso()
  const from = period === 0 ? '0000-01-01' : shiftIso(today, -(period - 1))

  const items = useMemo(() => {
    const out: LogItem[] = []
    for (const e of snapshot.foodEntries) {
      if (e.date < from || e.date > today) continue
      out.push({ kind: 'food', at: e.createdAt || e.date, date: e.date, entry: e })
    }
    for (const e of snapshot.waterEntries) {
      if (e.date < from || e.date > today) continue
      out.push({ kind: 'water', at: e.createdAt || e.date, date: e.date, entry: e })
    }
    for (const e of snapshot.activityEntries) {
      if (e.date < from || e.date > today) continue
      out.push({ kind: 'activity', at: e.createdAt || e.date, date: e.date, entry: e })
    }
    for (const e of snapshot.weightLogs) {
      if (e.date < from || e.date > today) continue
      out.push({ kind: 'weight', at: e.createdAt || e.date, date: e.date, entry: e })
    }
    return out.sort((a, b) => b.at.localeCompare(a.at) || b.date.localeCompare(a.date))
  }, [snapshot, from, today])

  const groups = useMemo(() => {
    const map = new Map<string, LogItem[]>()
    for (const item of items) {
      const list = map.get(item.date) ?? []
      list.push(item)
      map.set(item.date, list)
    }
    return [...map.entries()]
  }, [items])

  async function copyAi() {
    const text = buildAiText(groups, period)
    try {
      await navigator.clipboard.writeText(text || 'Записей за период нет.')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto no-scrollbar">
          {([1, 7, 14, 30, 0] as const).map((n) => (
            <button
              key={n}
              onClick={() => setPeriod(n)}
              className={`h-9 shrink-0 rounded-full px-3 text-sm font-semibold ${
                period === n ? 'bg-mint text-bg' : 'bg-white/8 text-white/60'
              }`}
            >
              {n === 0 ? 'Всё' : n === 1 ? 'Сегодня' : `${n} дн.`}
            </button>
          ))}
        </div>
        <button
          onClick={() => void copyAi()}
          className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-white/8 px-3 text-xs font-semibold text-mint"
          title="Скопировать для ИИ"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Ок' : 'ИИ'}
        </button>
      </div>
      {groups.length === 0 && <p className="text-sm text-white/30">За этот период записей нет</p>}
      {groups.map(([date, rows]) => (
        <section key={date} className="space-y-2">
          <h2 className="text-sm font-semibold text-white/50">{formatLongDate(date)}</h2>
          {rows.map((row) => (
            <LogRow key={`${row.kind}-${row.entry.id}`} item={row} />
          ))}
        </section>
      ))}
    </div>
  )
}

function LogRow({ item }: { item: LogItem }) {
  const time = formatClock(item.at) || format(parseISO(`${item.date}T12:00:00`), 'HH:mm', { locale: ru })
  if (item.kind === 'food') {
    const e = item.entry
    return (
      <article className="rounded-3xl bg-card px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-semibold">{e.name}</div>
          <div className="text-[11px] text-white/35">{time}</div>
        </div>
        <div className="mt-1 text-xs text-white/45">
          {mealLabel(e.meal)} · {e.grams} {entryUnit(e.foodId)} · {e.kcal} ккал
        </div>
        <div className="mt-1 text-sm text-mint">
          Б {Math.round(e.protein)} · Ж {Math.round(e.fat)} · У {Math.round(e.carbs)}
        </div>
      </article>
    )
  }
  if (item.kind === 'water') {
    return (
      <article className="rounded-3xl bg-card px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-semibold">Вода</div>
          <div className="text-[11px] text-white/35">{time}</div>
        </div>
        <div className="mt-1 text-sm text-mint">{item.entry.ml} мл</div>
      </article>
    )
  }
  if (item.kind === 'activity') {
    const e = item.entry
    return (
      <article className="rounded-3xl bg-card px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-semibold">{e.name}</div>
          <div className="text-[11px] text-white/35">{time}</div>
        </div>
        <div className="mt-1 text-xs text-white/45">
          {e.minutes} мин · {e.kcal} ккал
        </div>
        {e.note ? <p className="mt-2 text-sm text-white/70">{e.note}</p> : null}
      </article>
    )
  }
  return (
    <article className="rounded-3xl bg-card px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-semibold">Вес</div>
        <div className="text-[11px] text-white/35">{time}</div>
      </div>
      <div className="mt-1 text-sm text-mint">{item.entry.weight.toFixed(1)} кг</div>
    </article>
  )
}
