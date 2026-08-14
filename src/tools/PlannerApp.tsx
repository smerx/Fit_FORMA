import { useMemo, useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, parseISO, startOfMonth } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { todayIso } from '../lib/dates'
import { parseQuickTask, suggestTasks } from './suggest'
import { useTools } from './store'
import type { PlanTask } from './types'

const WEEK = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

export function PlannerApp() {
  const [tab, setTab] = useState<'cal' | 'log'>('cal')
  return (
    <div className="space-y-4 pb-8">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/5 p-1">
        <TabBtn on={tab === 'cal'} onClick={() => setTab('cal')}>
          Календарь
        </TabBtn>
        <TabBtn on={tab === 'log'} onClick={() => setTab('log')}>
          Журнал
        </TabBtn>
      </div>
      {tab === 'cal' ? <CalendarPane /> : <JournalPane />}
    </div>
  )
}

function TabBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      onClick={onClick}
      className={`h-10 rounded-xl text-sm font-semibold ${on ? 'bg-mint text-bg' : 'text-white/50'}`}
    >
      {children}
    </button>
  )
}

function CalendarPane() {
  const { tasks, addTask, toggleTask, removeTask, patchTask } = useTools()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(todayIso)
  const [q, setQ] = useState('')
  const hints = useMemo(() => suggestTasks(q, tasks), [q, tasks])
  const today = todayIso()
  const cells = useMemo(() => monthCells(month), [month])
  const counts = useMemo(() => {
    const map = new Map<string, { open: number; done: number }>()
    for (const t of tasks) {
      if (!t.dueOn) continue
      const cur = map.get(t.dueOn) ?? { open: 0, done: 0 }
      if (t.done) cur.done += 1
      else cur.open += 1
      map.set(t.dueOn, cur)
    }
    return map
  }, [tasks])
  const dayTasks = useMemo(() => sortAgenda(tasks.filter((t) => t.dueOn === selected)), [tasks, selected])
  const inbox = tasks.filter((t) => !t.dueOn && !t.done)

  function push(raw: string) {
    const fromInput = parseQuickTask(q)
    const parsed = parseQuickTask(raw)
    const title = parsed.title
    if (!title) return
    void addTask(title, fromInput.dueOn ?? parsed.dueOn ?? selected, fromInput.dueTime ?? parsed.dueTime)
    setQ('')
  }

  const selectedLabel = format(parseISO(selected), 'EEEE, d MMMM', { locale: ru })

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">
        Как календарь: тапни день и поставь дело. «14:00 покос» попадёт на выбранный день в это время.
      </p>
      <section className="rounded-3xl bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <button onClick={() => setMonth((m) => addMonths(m, -1))} className="flex h-11 w-11 items-center justify-center">
            <ChevronLeft size={20} />
          </button>
          <div className="text-sm font-bold capitalize">{format(month, 'LLLL yyyy', { locale: ru })}</div>
          <button onClick={() => setMonth((m) => addMonths(m, 1))} className="flex h-11 w-11 items-center justify-center">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[10px] uppercase tracking-wide text-white/35">
          {WEEK.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((iso, i) => {
            if (!iso) return <div key={`e-${i}`} />
            const mark = counts.get(iso)
            const isSel = iso === selected
            const isToday = iso === today
            return (
              <button
                key={iso}
                onClick={() => setSelected(iso)}
                className={`flex h-11 flex-col items-center justify-center rounded-xl text-sm ${
                  isSel ? 'bg-mint font-bold text-bg' : isToday ? 'bg-white/10 font-semibold' : ''
                }`}
              >
                {Number(iso.slice(8))}
                <span className="flex h-1.5 gap-0.5">
                  {mark?.open ? <span className={`h-1 w-1 rounded-full ${isSel ? 'bg-bg' : 'bg-mint'}`} /> : null}
                  {mark?.done && !mark.open ? (
                    <span className={`h-1 w-1 rounded-full ${isSel ? 'bg-bg/50' : 'bg-white/30'}`} />
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <div>
        <h2 className="mb-2 capitalize text-sm font-semibold text-white/55">{selectedLabel}</h2>
        <div className="rounded-3xl bg-white/5 p-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') push(q)
            }}
            placeholder="Дело на этот день. Можно 09:30 …"
            className="h-12 w-full bg-transparent px-3 text-base outline-none"
          />
          {hints.length > 0 && (
            <div className="border-t border-white/8 pb-1">
              {hints.map((h) => (
                <button
                  key={h.title}
                  onClick={() => push(h.title)}
                  className="flex h-11 w-full items-center justify-between px-3 text-left text-sm"
                >
                  <span>{h.title}</span>
                  <span className="text-[11px] text-white/30">{h.hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {dayTasks.length === 0 && <p className="text-sm text-white/30">На этот день пусто</p>}
          {dayTasks.map((t) => (
            <AgendaRow key={t.id} task={t} onToggle={toggleTask} onRemove={removeTask} />
          ))}
        </div>
      </div>

      {inbox.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Без дня</h2>
          <div className="space-y-2">
            {inbox.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-2xl bg-card px-3 py-2">
                <div className="min-w-0 flex-1 truncate">{t.title}</div>
                <button
                  onClick={() => void patchTask(t.id, { dueOn: selected })}
                  className="h-9 shrink-0 rounded-full bg-white/8 px-3 text-xs font-semibold"
                >
                  сюда
                </button>
                <button onClick={() => removeTask(t.id)} className="flex h-11 w-11 items-center justify-center text-white/25">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function JournalPane() {
  const { notes, addNote, removeNote } = useTools()
  const [text, setText] = useState('')

  function save() {
    if (!text.trim()) return
    void addNote(text)
    setText('')
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">
        Не календарь, а список фиксаций: сделал — записал. Можно копить сколько угодно.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Что сделал…"
        className="min-h-24 w-full rounded-3xl bg-white/5 p-4 text-sm leading-relaxed outline-none"
      />
      <button
        disabled={!text.trim()}
        onClick={save}
        className="h-12 w-full rounded-2xl bg-mint font-bold text-bg disabled:opacity-40"
      >
        Зафиксировать
      </button>
      <div className="space-y-2">
        {notes.length === 0 && <p className="text-sm text-white/30">Пока пусто</p>}
        {notes.map((n) => (
          <div key={n.id} className="rounded-2xl bg-card px-4 py-3">
            <div className="text-[11px] text-white/35">{format(parseISO(n.createdAt), 'd MMMM, HH:mm', { locale: ru })}</div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{n.body}</p>
            <button onClick={() => removeNote(n.id)} className="mt-2 flex items-center gap-1 text-xs text-white/30">
              <Trash2 size={12} /> удалить
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function AgendaRow({
  task,
  onToggle,
  onRemove,
}: {
  task: PlanTask
  onToggle: (id: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className={`flex items-center gap-2 rounded-2xl bg-card px-3 py-2 ${task.done ? 'opacity-45' : ''}`}>
      <div className="w-12 shrink-0 text-center font-mono text-[11px] text-mint">
        {task.dueTime ?? 'день'}
      </div>
      <button
        onClick={() => onToggle(task.id)}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
          task.done ? 'bg-mint text-bg' : 'bg-white/8'
        }`}
      >
        {task.done ? '✓' : ''}
      </button>
      <div className={`min-w-0 flex-1 truncate ${task.done ? 'line-through' : ''}`}>{task.title}</div>
      <button onClick={() => onRemove(task.id)} className="flex h-11 w-11 items-center justify-center text-white/25">
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function monthCells(month: Date): (string | null)[] {
  const start = startOfMonth(month)
  const pad = (getDay(start) + 6) % 7
  const days = eachDayOfInterval({ start, end: endOfMonth(month) })
  return [...Array.from({ length: pad }, () => null), ...days.map((d) => format(d, 'yyyy-MM-dd'))]
}

function sortAgenda(items: PlanTask[]): PlanTask[] {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (!a.dueTime && b.dueTime) return -1
    if (a.dueTime && !b.dueTime) return 1
    return (a.dueTime ?? '').localeCompare(b.dueTime ?? '') || a.createdAt.localeCompare(b.createdAt)
  })
}
