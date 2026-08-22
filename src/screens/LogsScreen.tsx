import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ScrollText } from 'lucide-react'
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

function LogsApp() {
  const { snapshot } = useStore()
  const [period, setPeriod] = useState<Period>(7)
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

  return (
    <div className="space-y-4 pb-8">
      <p className="text-sm text-white/45">
        Время — когда добавил запись. Период можно сузить.
      </p>
      <div className="flex gap-1 overflow-x-auto no-scrollbar">
        {([1, 7, 14, 30, 0] as const).map((n) => (
          <button
            key={n}
            onClick={() => setPeriod(n)}
            className={`h-10 shrink-0 rounded-full px-3 text-sm font-semibold ${
              period === n ? 'bg-mint text-bg' : 'bg-white/8 text-white/60'
            }`}
          >
            {n === 0 ? 'Всё' : n === 1 ? 'Сегодня' : `${n} дн.`}
          </button>
        ))}
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
