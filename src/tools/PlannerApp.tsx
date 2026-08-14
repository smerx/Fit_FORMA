import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { todayIso } from '../lib/dates'
import { parseQuickTask, suggestTasks } from './suggest'
import { useTools } from './store'

export function PlannerApp() {
  const { tasks, addTask, toggleTask, removeTask } = useTools()
  const [q, setQ] = useState('')
  const hints = useMemo(() => suggestTasks(q, tasks), [q, tasks])
  const today = todayIso()
  const inbox = tasks.filter((t) => !t.done && !t.dueOn)
  const day = tasks.filter((t) => !t.done && t.dueOn === today)
  const later = tasks.filter((t) => !t.done && t.dueOn && t.dueOn !== today)
  const done = tasks.filter((t) => t.done).slice(0, 12)

  function push(raw: string) {
    const fromInput = parseQuickTask(q)
    const parsed = parseQuickTask(raw)
    const title = parsed.title
    if (!title) return
    void addTask(title, fromInput.dueOn ?? parsed.dueOn)
    setQ('')
  }

  return (
    <div className="space-y-4 pb-8">
      <p className="text-sm text-white/50">
        Пиши коротко. «завтра покос» само станет делом на завтра. Подсказки из твоих старых задач, не из интернета.
      </p>
      <div className="rounded-3xl bg-white/5 p-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') push(q)
          }}
          placeholder="Добавить дело..."
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
      <div className="flex gap-2 text-xs">
        {['сегодня ', 'завтра ', 'купить ', 'позвонить '].map((chip) => (
          <button
            key={chip}
            onClick={() => setQ(chip)}
            className="h-9 rounded-full bg-white/8 px-3 font-semibold"
          >
            {chip.trim()}
          </button>
        ))}
      </div>
      <Group title="Сегодня" items={day} empty="На сегодня пусто" onToggle={toggleTask} onRemove={removeTask} />
      <Group title="Без даты" items={inbox} empty="Инбокс пуст" onToggle={toggleTask} onRemove={removeTask} />
      {later.length > 0 && (
        <Group title="Потом" items={later} empty="" onToggle={toggleTask} onRemove={removeTask} />
      )}
      {done.length > 0 && (
        <Group title="Сделано" items={done} empty="" onToggle={toggleTask} onRemove={removeTask} dim />
      )}
    </div>
  )
}

function Group({
  title,
  items,
  empty,
  onToggle,
  onRemove,
  dim,
}: {
  title: string
  items: { id: string; title: string; dueOn: string | null; notes: string; done: boolean }[]
  empty: string
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  dim?: boolean
}) {
  return (
    <section className={dim ? 'opacity-50' : ''}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">{title}</h2>
      {items.length === 0 && empty && <p className="text-sm text-white/30">{empty}</p>}
      <div className="space-y-2">
        {items.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-2xl bg-card px-3 py-2">
            <button
              onClick={() => onToggle(t.id)}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                t.done ? 'bg-mint text-bg' : 'bg-white/8'
              }`}
            >
              {t.done ? '✓' : ''}
            </button>
            <div className="min-w-0 flex-1">
              <div className={`truncate ${t.done ? 'line-through' : ''}`}>{t.title}</div>
              {t.dueOn && <div className="text-[11px] text-white/35">{t.dueOn}</div>}
            </div>
            <button onClick={() => onRemove(t.id)} className="flex h-11 w-11 items-center justify-center text-white/25">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
