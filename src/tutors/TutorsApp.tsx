import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { getISODay, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Copy, GripVertical, Plus, Trash2 } from 'lucide-react'
import { formatDayTitle, formatWeekday, shiftIso, todayIso } from '../lib/dates'
import {
  dayRows,
  expectedInDays,
  packEntriesForPayment,
  payHint,
  paymentText,
  remainingInPack,
  rub,
  scheduleLabel,
} from './money'
import { defaultStudentDraft, useTutors } from './store'
import type { LessonStatus, TutorEvent, TutorEventKind, TutorStudent } from './types'
import { EVENT_KIND_LABEL, PAY_KIND_LABEL, WEEKDAYS } from './types'

type Tab = 'day' | 'list' | 'money'
type Edit = { mode: 'new' } | { mode: 'edit'; id: string } | { mode: 'from-trial'; eventId: string } | null

export function TutorsApp() {
  const [tab, setTab] = useState<Tab>('day')
  const [edit, setEdit] = useState<Edit>(null)
  if (edit) return <StudentForm edit={edit} onClose={() => setEdit(null)} />
  return (
    <div className="space-y-4 pb-8">
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/5 p-1">
        <TabBtn on={tab === 'day'} onClick={() => setTab('day')}>
          День
        </TabBtn>
        <TabBtn on={tab === 'list'} onClick={() => setTab('list')}>
          Ученики
        </TabBtn>
        <TabBtn on={tab === 'money'} onClick={() => setTab('money')}>
          Прогноз
        </TabBtn>
      </div>
      {tab === 'day' && (
        <DayPane onConvertTrial={(eventId) => setEdit({ mode: 'from-trial', eventId })} />
      )}
      {tab === 'list' && <ListPane onNew={() => setEdit({ mode: 'new' })} onOpen={(id) => setEdit({ mode: 'edit', id })} />}
      {tab === 'money' && <MoneyPane />}
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

function DayPane({ onConvertTrial }: { onConvertTrial: (eventId: string) => void }) {
  const { students, lessons, events, setLesson, removeEvent } = useTutors()
  const [date, setDate] = useState(todayIso)
  const [pick, setPick] = useState(false)
  const [pickTime, setPickTime] = useState('16:00')
  const [eventEdit, setEventEdit] = useState<null | { id?: string }>(null)
  const today = todayIso()
  const rows = dayRows(students, lessons, date)
  const dayEvents = events.filter((e) => e.date === date)
  if (eventEdit) {
    return (
      <EventSheet
        date={date}
        existing={eventEdit.id ? events.find((e) => e.id === eventEdit.id) : undefined}
        onClose={() => setEventEdit(null)}
      />
    )
  }

  function mark(row: (typeof rows)[number], status: LessonStatus | null) {
    void setLesson({
      id: row.rec?.id,
      studentId: row.student.id,
      date,
      timeHm: row.timeHm,
      status,
    })
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center">
          <button className="flex h-11 w-11 items-center justify-center" onClick={() => setDate(shiftIso(date, -1))}>
            <ChevronLeft />
          </button>
          <div>
            <h2 className="text-xl font-extrabold">{formatDayTitle(date)}</h2>
            <p className="text-xs capitalize text-white/40">{formatWeekday(date)}</p>
          </div>
          <button className="flex h-11 w-11 items-center justify-center" onClick={() => setDate(shiftIso(date, 1))}>
            <ChevronRight />
          </button>
        </div>
        {date !== today && (
          <button onClick={() => setDate(today)} className="h-10 rounded-full bg-white/8 px-3 text-sm">
            Сегодня
          </button>
        )}
      </header>
      <p className="text-sm text-white/45">
        Пропуск — занятие оплачивают, в шаблоне будет (п.б.ув.пр). Отмена — нет. Перенос: «на этот день», можно несколько
        раз одного и того же.
      </p>
      {dayEvents.length > 0 && (
        <div className="space-y-2">
          {dayEvents.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              students={students}
              onRemove={() => void removeEvent(e.id)}
              onOpen={() => {
                if (e.kind === 'trial') onConvertTrial(e.id)
                else if (e.kind === 'note') setEventEdit({ id: e.id })
              }}
            />
          ))}
        </div>
      )}
      {rows.length === 0 && dayEvents.length === 0 && (
        <p className="text-sm text-white/30">На этот день никого. Можно добавить перенос или пробное.</p>
      )}
      <div className="space-y-2">
        {rows.map((row) => {
          const rec = row.rec
          const held = rec?.status === 'held' || rec?.status === 'extra'
          return (
            <div key={row.key} className="rounded-3xl bg-card px-3 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{row.student.name}</div>
                  <div className="text-[11px] text-white/40">
                    {row.timeHm} · {PAY_KIND_LABEL[row.student.payKind]}
                    {row.kind === 'extra' ? ' · перенос' : ''}
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                <Mark
                  on={held}
                  label="Пришёл"
                  onClick={() => mark(row, held ? null : row.kind === 'extra' ? 'extra' : 'held')}
                />
                <Mark
                  on={rec?.status === 'skipped'}
                  label="Пропуск"
                  onClick={() => mark(row, rec?.status === 'skipped' ? null : 'skipped')}
                />
                <Mark
                  on={rec?.status === 'cancelled'}
                  label="Отмена"
                  onClick={() => mark(row, rec?.status === 'cancelled' ? null : 'cancelled')}
                />
              </div>
              {row.kind === 'extra' && (
                <button onClick={() => mark(row, null)} className="mt-2 text-xs text-white/35">
                  убрать с этого дня
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setPick((v) => !v)}
          className="h-12 flex-1 rounded-2xl bg-white/8 font-semibold"
        >
          На этот день
        </button>
        <button
          onClick={() => setEventEdit({})}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-bg"
        >
          <Plus size={20} />
        </button>
      </div>
      {pick && (
        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-xs text-white/45">Время переноса</span>
            <input
              type="time"
              value={pickTime}
              onChange={(e) => setPickTime(e.target.value)}
              className="h-12 w-full rounded-2xl bg-white/8 px-3 outline-none"
            />
          </label>
          {students.filter((s) => s.active).length === 0 && (
            <p className="text-sm text-white/30">Сначала добавь ученика</p>
          )}
          {students
            .filter((s) => s.active)
            .map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  void setLesson({
                    studentId: s.id,
                    date,
                    timeHm: pickTime,
                    status: 'extra',
                  })
                }}
                className="flex h-12 w-full items-center rounded-2xl bg-card px-4 text-left font-medium"
              >
                {s.name}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

function EventCard({
  event,
  students,
  onRemove,
  onOpen,
}: {
  event: TutorEvent
  students: TutorStudent[]
  onRemove: () => void
  onOpen: () => void
}) {
  const s = event.studentId ? students.find((x) => x.id === event.studentId) : undefined
  const clickable = event.kind === 'trial' || event.kind === 'note'
  const sub =
    event.kind === 'payment'
      ? `${s?.name ?? 'ученик'} · ${rub(event.amountRub)}`
      : event.kind === 'trial'
        ? `${event.title || 'без имени'} · ${event.timeHm ?? ''}`
        : event.title || 'без текста'
  return (
    <div className="flex items-center justify-between gap-2 rounded-3xl bg-mint/15 px-4 py-3">
      <button
        onClick={clickable ? onOpen : undefined}
        className={`min-w-0 flex-1 text-left ${clickable ? '' : 'cursor-default'}`}
      >
        <div className="text-sm font-semibold">{EVENT_KIND_LABEL[event.kind]}</div>
        <div className="text-xs text-white/50">{sub}</div>
        {event.kind === 'trial' && <div className="mt-1 text-[11px] text-mint">нажми — сделать учеником</div>}
      </button>
      <button onClick={onRemove} className="text-xs text-white/35">
        убрать
      </button>
    </div>
  )
}

function Mark({ on, label, onClick }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`h-10 rounded-xl text-xs font-semibold ${on ? 'bg-mint text-bg' : 'bg-white/8 text-white/70'}`}
    >
      {label}
    </button>
  )
}

function EventSheet({
  date,
  existing,
  onClose,
}: {
  date: string
  existing?: TutorEvent
  onClose: () => void
}) {
  const { students, saveEvent } = useTutors()
  const active = students
    .filter((s) => s.active)
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'ru'))
  const [kind, setKind] = useState<TutorEventKind>(existing?.kind ?? 'payment')
  const [studentId, setStudentId] = useState(existing?.studentId ?? active[0]?.id ?? '')
  const selected = students.find((s) => s.id === studentId)
  const [amount, setAmount] = useState(existing?.amountRub || selected?.priceRub || 0)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [timeHm, setTimeHm] = useState(existing?.timeHm ?? '16:00')

  const canSave =
    kind === 'payment' ? Boolean(studentId) : kind === 'trial' ? Boolean(title.trim() && timeHm) : Boolean(title.trim())

  return (
    <div className="space-y-3 pb-8">
      <button onClick={onClose} className="text-sm text-mint">
        ← назад
      </button>
      <h2 className="text-xl font-extrabold">Событие</h2>
      <div className="grid grid-cols-3 gap-1">
        {(['payment', 'trial', 'note'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`h-11 rounded-xl px-1 text-[11px] font-semibold ${
              kind === k ? 'bg-mint text-bg' : 'bg-white/8'
            }`}
          >
            {EVENT_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      {kind === 'payment' && (
        <>
          <div className="text-xs text-white/45">За кого</div>
          {active.length === 0 && (
            <p className="text-sm text-white/30">Сначала добавь ученика во вкладке «Ученики»</p>
          )}
          <div className="space-y-2">
            {active.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setStudentId(s.id)
                  setAmount(s.priceRub)
                }}
                className={`flex h-12 w-full items-center rounded-2xl px-4 text-left font-medium ${
                  studentId === s.id ? 'bg-mint text-bg' : 'bg-card'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
          <Num label="Сумма, ₽" value={amount} onChange={setAmount} />
          <p className="text-[11px] text-white/35">
            Это только факт оплаты. Абонемент считается по занятиям.
          </p>
        </>
      )}
      {kind === 'trial' && (
        <>
          <Field label="Имя" value={title} onChange={setTitle} />
          <label className="block">
            <span className="mb-1 block text-xs text-white/45">Время</span>
            <input
              type="time"
              value={timeHm}
              onChange={(e) => setTimeHm(e.target.value)}
              className="h-12 w-full rounded-2xl bg-white/8 px-3 outline-none"
            />
          </label>
          <p className="text-[11px] text-white/35">
            Один раз в расписании. Потом нажми на карточку — откроется форма ученика с этими полями.
          </p>
        </>
      )}
      {kind === 'note' && (
        <label className="block">
          <span className="mb-1 block text-xs text-white/45">Текст</span>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-h-24 w-full rounded-2xl bg-white/8 p-3 text-sm outline-none"
          />
        </label>
      )}
      <button
        disabled={!canSave}
        onClick={async () => {
          await saveEvent({
            id: existing?.id,
            date,
            kind,
            studentId: kind === 'payment' ? studentId : null,
            amountRub: kind === 'payment' ? amount : 0,
            title: kind === 'payment' ? '' : title.trim(),
            timeHm: kind === 'trial' ? timeHm : null,
          })
          onClose()
        }}
        className="h-14 w-full rounded-2xl bg-mint font-bold text-bg disabled:opacity-40"
      >
        Сохранить
      </button>
    </div>
  )
}

function ListPane({ onNew, onOpen }: { onNew: () => void; onOpen: (id: string) => void }) {
  const { students, lessons, reorderStudents } = useTutors()
  const today = todayIso()
  const bySort = useMemo(
    () =>
      students.slice().sort((a, b) => {
        const d = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        if (d !== 0) return d
        return a.name.localeCompare(b.name, 'ru')
      }),
    [students],
  )
  const [order, setOrder] = useState(() => bySort.map((s) => s.id))
  const [dragId, setDragId] = useState<string | null>(null)
  const holdRef = useRef<number | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const skipClickRef = useRef(false)
  const startRef = useRef({ x: 0, y: 0 })
  const orderRef = useRef(order)
  orderRef.current = order

  useEffect(() => {
    if (dragIdRef.current) return
    setOrder(bySort.map((s) => s.id))
  }, [bySort])

  function clearHold() {
    if (holdRef.current != null) {
      window.clearTimeout(holdRef.current)
      holdRef.current = null
    }
  }

  function indexAtY(y: number, current: string[]): number {
    for (let i = 0; i < current.length; i++) {
      const el = document.getElementById(`tutor-stu-${current[i]}`)
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (y < r.top + r.height / 2) return i
    }
    return Math.max(0, current.length - 1)
  }

  function onPointerDown(id: string, e: ReactPointerEvent<HTMLButtonElement>) {
    startRef.current = { x: e.clientX, y: e.clientY }
    skipClickRef.current = false
    clearHold()
    const target = e.currentTarget
    const pointerId = e.pointerId
    holdRef.current = window.setTimeout(() => {
      dragIdRef.current = id
      skipClickRef.current = true
      setDragId(id)
      try {
        target.setPointerCapture(pointerId)
      } catch {
        /* android */
      }
    }, 380)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const current = dragIdRef.current
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (!current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      clearHold()
      return
    }
    if (!current) return
    e.preventDefault()
    const from = orderRef.current.indexOf(current)
    const to = indexAtY(e.clientY, orderRef.current)
    if (from < 0 || from === to) return
    const next = orderRef.current.slice()
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item!)
    orderRef.current = next
    setOrder(next)
  }

  async function onPointerUp() {
    clearHold()
    if (dragIdRef.current) {
      dragIdRef.current = null
      setDragId(null)
      await reorderStudents(orderRef.current)
    }
  }

  const list = order
    .map((id) => students.find((s) => s.id === id))
    .filter((s): s is TutorStudent => Boolean(s))

  return (
    <div className="space-y-3">
      <button onClick={onNew} className="h-12 w-full rounded-2xl bg-mint font-bold text-bg">
        Новый ученик
      </button>
      <p className="text-xs text-white/40">Удержи палец на ученике и перетащи, чтобы поменять местами.</p>
      {list.length === 0 && <p className="text-sm text-white/30">Пока никого</p>}
      {list.map((s) => {
        const left = remainingInPack(s, lessons)
        return (
          <button
            key={s.id}
            id={`tutor-stu-${s.id}`}
            onClick={() => {
              if (skipClickRef.current) {
                skipClickRef.current = false
                return
              }
              onOpen(s.id)
            }}
            onPointerDown={(e) => onPointerDown(s.id, e)}
            onPointerMove={onPointerMove}
            onPointerUp={() => void onPointerUp()}
            onPointerCancel={() => {
              clearHold()
              dragIdRef.current = null
              setDragId(null)
            }}
            style={{ touchAction: dragId ? 'none' : 'pan-y', userSelect: 'none' }}
            className={`flex w-full items-center gap-2 rounded-3xl px-3 py-3 text-left ${
              dragId === s.id ? 'bg-mint/20' : 'bg-card'
            }`}
          >
            <GripVertical size={16} className="shrink-0 text-white/25" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className={`font-semibold ${s.active ? '' : 'text-white/35'}`}>{s.name}</span>
                <span className="text-[11px] text-white/40">{scheduleLabel(s) || s.timeHm}</span>
              </div>
              <div className="mt-1 text-xs text-white/45">
                {PAY_KIND_LABEL[s.payKind]}
                {left != null ? ` · осталось ${left}` : ''}
              </div>
              <div className="mt-1 text-sm text-mint">{payHint(s, lessons, today)}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function MoneyPane() {
  const { students, lessons, events } = useTutors()
  const today = todayIso()
  const w = expectedInDays(students, lessons, today, 7, events)
  const t = expectedInDays(students, lessons, today, 14, events)
  const m = expectedInDays(students, lessons, today, 30, events)
  return (
    <div className="space-y-3">
      <p className="text-sm text-white/45">
        Считаем живые оплаты: когда кончается абонемент и приходят деньги. Если следующая оплата через 2 недели — на этой неделе 0. «Осторожно» минус ~12%.
      </p>
      <Forecast title="Неделя" main={w.expected} cautious={w.cautious} />
      <Forecast title="Две недели" main={t.expected} cautious={t.cautious} />
      <Forecast title="Месяц" main={m.expected} cautious={m.cautious} />
    </div>
  )
}

function Forecast({ title, main, cautious }: { title: string; main: number; cautious: number }) {
  return (
    <div className="rounded-3xl bg-card p-4">
      <div className="text-xs text-white/40">{title}</div>
      <div className="text-3xl font-extrabold text-mint">{rub(main)}</div>
      <div className="text-xs text-white/40">осторожно {rub(cautious)}</div>
    </div>
  )
}

function StudentForm({ edit, onClose }: { edit: Exclude<Edit, null>; onClose: () => void }) {
  const { students, lessons, events, saveStudent, removeStudent, removeEvent, settings } = useTutors()
  const today = todayIso()
  const existing = edit.mode === 'edit' ? students.find((s) => s.id === edit.id) : undefined
  const trial = edit.mode === 'from-trial' ? events.find((e) => e.id === edit.eventId) : undefined
  const [draft, setDraft] = useState(() => {
    if (existing) return existing
    if (trial) {
      const weekday = getISODay(parseISO(trial.date))
      return defaultStudentDraft(today, {
        name: trial.title,
        timeHm: trial.timeHm ?? '16:00',
        slots: [{ weekday, timeHm: trial.timeHm ?? '16:00' }],
      })
    }
    return defaultStudentDraft(today)
  })
  const [copied, setCopied] = useState(false)
  const dates = useMemo(
    () => (existing ? packEntriesForPayment(existing, lessons, today) : []),
    [existing, lessons, today],
  )
  const text = existing
    ? paymentText(
        { ...existing, name: draft.name, priceRub: draft.priceRub, payKind: draft.payKind },
        dates,
        settings.payDetails,
      )
    : ''

  async function copyPay() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-3 pb-8">
      <button onClick={onClose} className="text-sm text-mint">
        ← назад
      </button>
      <Field label="Имя" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
      <div className="text-xs text-white/45">Оплата</div>
      <div className="grid grid-cols-3 gap-1">
        {(['pack4', 'pack8', 'hourly'] as const).map((k) => (
          <button
            key={k}
            onClick={() =>
              setDraft({
                ...draft,
                payKind: k,
                packStartedOn: k === 'hourly' ? null : draft.packStartedOn ?? today,
              })
            }
            className={`h-11 rounded-xl text-[11px] font-semibold ${
              draft.payKind === k ? 'bg-mint text-bg' : 'bg-white/8'
            }`}
          >
            {PAY_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Num
          label={draft.payKind === 'hourly' ? 'Ставка, ₽/час' : 'Цена абонемента, ₽'}
          value={draft.priceRub}
          onChange={(priceRub) => setDraft({ ...draft, priceRub })}
        />
        <Num label="Минуты" value={draft.durationMin} onChange={(durationMin) => setDraft({ ...draft, durationMin })} />
      </div>
      <div className="text-xs text-white/45">Дни и время — можно два слота в один день</div>
      <p className="text-[11px] text-white/35">
        Смена расписания не трогает уже отмеченные занятия. Они остаются в абонементе.
      </p>
      <div className="space-y-2">
        {draft.slots.map((slot, i) => (
          <div key={`${slot.weekday}-${i}`} className="flex items-center gap-2">
            <select
              value={slot.weekday}
              onChange={(e) => {
                const weekday = Number(e.target.value)
                setDraft({
                  ...draft,
                  slots: draft.slots.map((x, j) => (j === i ? { ...x, weekday } : x)),
                })
              }}
              className="h-12 flex-1 rounded-2xl bg-white/8 px-3 text-sm outline-none"
            >
              {WEEKDAYS.map((w) => (
                <option key={w.n} value={w.n}>
                  {w.s}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={slot.timeHm}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  slots: draft.slots.map((x, j) => (j === i ? { ...x, timeHm: e.target.value } : x)),
                })
              }
              className="h-12 w-32 rounded-2xl bg-white/8 px-3 outline-none"
            />
            <button
              onClick={() => setDraft({ ...draft, slots: draft.slots.filter((_, j) => j !== i) })}
              className="flex h-12 w-12 items-center justify-center text-white/30"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      {draft.slots.length < 14 && (
        <button
          onClick={() => {
            setDraft({
              ...draft,
              slots: [
                ...draft.slots,
                {
                  weekday: draft.slots.at(-1)?.weekday ?? 1,
                  timeHm: draft.slots.at(-1)?.timeHm ?? '16:00',
                },
              ],
            })
          }}
          className="h-11 w-full rounded-2xl bg-white/8 text-sm font-semibold"
        >
          Ещё слот
        </button>
      )}
      {draft.payKind !== 'hourly' && (
        <label className="block">
          <span className="mb-1 block text-xs text-white/45">Текущий абонемент с</span>
          <input
            type="date"
            value={draft.packStartedOn ?? today}
            onChange={(e) => setDraft({ ...draft, packStartedOn: e.target.value })}
            className="h-12 w-full rounded-2xl bg-white/8 px-3 outline-none"
          />
          <p className="mt-1 text-[11px] text-white/35">
            С этой даты считаются «пришёл» и «пропуск». Отмена не считается. Когда занятия в абонементе кончились,
            следующее отмеченное — начало нового. Дату можно поставить руками, если надо пересчитать.
          </p>
        </label>
      )}
      <label className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-3">
        <span className="text-sm">Активен</span>
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
        />
      </label>
      <button
        disabled={!draft.name.trim() || !draft.slots.length}
        onClick={async () => {
          await saveStudent(edit.mode === 'edit' ? { ...draft, id: edit.id } : draft)
          if (edit.mode === 'from-trial') await removeEvent(edit.eventId)
          onClose()
        }}
        className="h-14 w-full rounded-2xl bg-mint font-bold text-bg disabled:opacity-40"
      >
        Сохранить
      </button>
      {existing && (
        <>
          <div className="rounded-3xl bg-white/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">Текст оплаты</div>
              <button onClick={() => void copyPay()} className="flex h-10 items-center gap-1 text-sm text-mint">
                <Copy size={14} /> {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-white/70">{text}</pre>
            <p className="mt-2 text-[11px] text-white/35">{payHint(existing, lessons, today)}</p>
          </div>
          <button
            onClick={async () => {
              await removeStudent(existing.id)
              onClose()
            }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/8 text-sm text-white/50"
          >
            <Trash2 size={14} /> Удалить ученика
          </button>
        </>
      )}
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-white/45">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-2xl bg-white/8 px-3 outline-none"
      />
    </label>
  )
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(value ? String(value) : '')
  useEffect(() => {
    setText(value ? String(value) : '')
  }, [value])
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-white/45">{label}</span>
      <input
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, '')
          setText(raw)
          if (raw !== '') onChange(Number(raw))
        }}
        onBlur={() => {
          if (text === '') onChange(0)
        }}
        className="h-12 w-full rounded-2xl bg-white/8 px-3 outline-none"
      />
    </label>
  )
}
