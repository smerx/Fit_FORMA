import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { formatDayTitle, formatWeekday, shiftIso, todayIso } from '../lib/dates'
import {
  expectedInDays,
  isRegularOn,
  lessonOn,
  packEntriesForPayment,
  payHint,
  paymentText,
  remainingInPack,
  rosterIds,
  rub,
  scheduleLabel,
  timeOn,
} from './money'
import { defaultStudentDraft, useTutors } from './store'
import type { TutorStudent } from './types'
import { PAY_KIND_LABEL, WEEKDAYS } from './types'

type Tab = 'day' | 'list' | 'money'
type Edit = { mode: 'new' } | { mode: 'edit'; id: string } | null

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
      {tab === 'day' && <DayPane onAdd={() => setEdit({ mode: 'new' })} />}
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

function DayPane({ onAdd }: { onAdd: () => void }) {
  const { students, lessons, setLesson } = useTutors()
  const [date, setDate] = useState(todayIso)
  const [pick, setPick] = useState(false)
  const today = todayIso()
  const ids = rosterIds(students, lessons, date)
  const rows = ids
    .map((id) => students.find((s) => s.id === id))
    .filter((s): s is TutorStudent => Boolean(s))
    .sort((a, b) => timeOn(a, date).localeCompare(timeOn(b, date)) || a.name.localeCompare(b.name, 'ru'))
  const extras = students.filter((s) => s.active && !ids.includes(s.id))

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
        Пропуск — занятие оплачивают, в шаблоне будет (п.б.ув.пр). Отмена — нет. Перенос: «на этот день».
      </p>
      {rows.length === 0 && <p className="text-sm text-white/30">На этот день никого. Можно добавить перенос.</p>}
      <div className="space-y-2">
        {rows.map((s) => {
          const rec = lessonOn(lessons, s.id, date)
          const regular = isRegularOn(s, date)
          return (
            <div key={s.id} className="rounded-3xl bg-card px-3 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-[11px] text-white/40">
                    {timeOn(s, date)} · {PAY_KIND_LABEL[s.payKind]}
                    {regular ? '' : ' · перенос'}
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                <Mark
                  on={rec?.status === 'held' || rec?.status === 'extra'}
                  label="Пришёл"
                  onClick={() =>
                    void setLesson(
                      s.id,
                      date,
                      rec?.status === 'held' || rec?.status === 'extra' ? null : regular ? 'held' : 'extra',
                    )
                  }
                />
                <Mark
                  on={rec?.status === 'skipped'}
                  label="Пропуск"
                  onClick={() => void setLesson(s.id, date, rec?.status === 'skipped' ? null : 'skipped')}
                />
                <Mark
                  on={rec?.status === 'cancelled'}
                  label="Отмена"
                  onClick={() => void setLesson(s.id, date, rec?.status === 'cancelled' ? null : 'cancelled')}
                />
              </div>
              {!regular && (
                <button
                  onClick={() => void setLesson(s.id, date, null)}
                  className="mt-2 text-xs text-white/35"
                >
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
        <button onClick={onAdd} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-bg">
          <Plus size={20} />
        </button>
      </div>
      {pick && (
        <div className="space-y-2">
          {extras.length === 0 && <p className="text-sm text-white/30">Больше некого добавить</p>}
          {extras.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                void setLesson(s.id, date, 'extra')
                setPick(false)
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

function ListPane({ onNew, onOpen }: { onNew: () => void; onOpen: (id: string) => void }) {
  const { students, lessons } = useTutors()
  const today = todayIso()
  const list = students.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  return (
    <div className="space-y-3">
      <button onClick={onNew} className="h-12 w-full rounded-2xl bg-mint font-bold text-bg">
        Новый ученик
      </button>
      {list.length === 0 && <p className="text-sm text-white/30">Пока никого</p>}
      {list.map((s) => {
        const left = remainingInPack(s, lessons)
        return (
          <button
            key={s.id}
            onClick={() => onOpen(s.id)}
            className="w-full rounded-3xl bg-card px-4 py-3 text-left"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className={`font-semibold ${s.active ? '' : 'text-white/35'}`}>{s.name}</span>
              <span className="text-[11px] text-white/40">{scheduleLabel(s) || s.timeHm}</span>
            </div>
            <div className="mt-1 text-xs text-white/45">
              {PAY_KIND_LABEL[s.payKind]}
              {left != null ? ` · осталось ${left}` : ''}
            </div>
            <div className="mt-1 text-sm text-mint">{payHint(s, lessons, today)}</div>
          </button>
        )
      })}
    </div>
  )
}

function MoneyPane() {
  const { students, lessons } = useTutors()
  const today = todayIso()
  const w = expectedInDays(students, lessons, today, 7)
  const t = expectedInDays(students, lessons, today, 14)
  const m = expectedInDays(students, lessons, today, 30)
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
  const { students, lessons, saveStudent, removeStudent, settings } = useTutors()
  const today = todayIso()
  const existing = edit.mode === 'edit' ? students.find((s) => s.id === edit.id) : undefined
  const [draft, setDraft] = useState(() => existing ?? defaultStudentDraft(today))
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
      <div className="text-xs text-white/45">Дни и время — у каждого дня своё</div>
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
      {draft.slots.length < 7 && (
        <button
          onClick={() => {
            const used = new Set(draft.slots.map((x) => x.weekday))
            const next = WEEKDAYS.find((w) => !used.has(w.n))?.n ?? 1
            setDraft({
              ...draft,
              slots: [...draft.slots, { weekday: next, timeHm: draft.slots.at(-1)?.timeHm ?? '16:00' }],
            })
          }}
          className="h-11 w-full rounded-2xl bg-white/8 text-sm font-semibold"
        >
          Ещё день
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
