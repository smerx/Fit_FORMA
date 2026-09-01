import { useEffect, useState } from 'react'
import { ACTIVITIES } from '../data/activities'
import { useStore } from '../lib/store'
import { activityCalories } from '../lib/nutrition'
import { formatDayTitle } from '../lib/dates'
import { NumericInput, Sheet } from './ui'
import type { ActivityTemplate } from '../types'

export function ActivitySheet() {
  const { overlay, setOverlay, snapshot, addActivityEntry } = useStore()
  const [picked, setPicked] = useState<ActivityTemplate | null>(null)
  const [minutes, setMinutes] = useState(30)
  const [customName, setCustomName] = useState('')
  const [customMet, setCustomMet] = useState(4)
  const [note, setNote] = useState('')
  const weight = snapshot.profile?.weightKg ?? 80

  useEffect(() => {
    if (overlay.type !== 'activity') {
      setPicked(null)
      setNote('')
      return
    }
    const pre = overlay.activityId ? ACTIVITIES.find((a) => a.id === overlay.activityId) : null
    setPicked(pre ?? null)
    setMinutes(pre?.id.includes('elliptical') ? 30 : 60)
    setCustomName('')
    setCustomMet(4)
    setNote('')
  }, [overlay])

  if (overlay.type !== 'activity') return null
  const date = overlay.date

  const save = () => {
    if (!picked) return
    void addActivityEntry({
      activityId: picked.id,
      name: picked.custom ? customName.trim() || 'Своя активность' : picked.name,
      minutes,
      met: picked.custom ? customMet : picked.met,
      note,
      date,
    })
  }

  if (!picked) {
    return (
      <Sheet title={`Активность · ${formatDayTitle(date)}`} onClose={() => setOverlay({ type: 'none' })}>
        <div className="space-y-2">
          {ACTIVITIES.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                setPicked(a)
                setMinutes(a.id.includes('elliptical') ? 30 : 60)
              }}
              className="flex w-full items-center gap-3 rounded-3xl bg-white/5 px-4 py-3 text-left"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/8 text-2xl">
                {a.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{a.name}</span>
                <span className="block text-xs text-white/40">
                  {a.hint} · MET {a.met}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={`${picked.name} · ${formatDayTitle(date)}`} onClose={() => setOverlay({ type: 'none' })}>
      {picked.custom && (
        <div className="mb-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-white/45">Название</span>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="h-12 w-full rounded-2xl bg-white/8 px-3 outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-white/45">MET</span>
            <NumericInput
              value={customMet}
              min={1}
              onChange={setCustomMet}
              className="h-12 w-full rounded-2xl bg-white/8 px-3 outline-none"
            />
          </label>
        </div>
      )}
      <div className="mb-2 text-sm text-white/45">Минуты</div>
      <div className="flex items-end gap-2">
        <NumericInput
          value={minutes}
          min={1}
          onChange={setMinutes}
          className="w-28 bg-transparent text-5xl font-extrabold outline-none"
        />
        <span className="pb-2 text-white/40">мин</span>
      </div>
      <input
        type="range"
        min={5}
        max={180}
        step={5}
        value={minutes}
        onChange={(e) => setMinutes(Number(e.target.value))}
        className="mt-3 w-full"
      />
      <div className="mt-4 flex gap-2">
        {[15, 30, 45, 60, 90].map((n) => (
          <button
            key={n}
            onClick={() => setMinutes(n)}
            className={`h-10 flex-1 rounded-full text-sm font-semibold ${
              minutes === n ? 'bg-mint text-bg' : 'bg-white/8'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <label className="mt-4 block">
        <span className="mb-1 block text-xs text-white/45">Заметка к тренировке</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Темп, самочувствие, что получилось"
          className="min-h-20 w-full rounded-2xl bg-white/8 p-3 text-sm outline-none"
        />
      </label>
      <div className="mt-5 rounded-2xl bg-white/5 p-4">
        <div className="text-xs text-white/40">Примерно сгорит</div>
        <div className="text-3xl font-extrabold text-mint">
          {activityCalories(picked.custom ? customMet : picked.met, weight, minutes)} ккал
        </div>
        {picked.met <= 2 && (
          <p className="mt-2 text-xs text-white/40">
            Сидячая работа почти не тратит калории — это честная оценка, не баг.
          </p>
        )}
      </div>
      <button onClick={save} className="mt-4 h-14 w-full rounded-2xl bg-mint font-bold text-bg">
        Записать
      </button>
    </Sheet>
  )
}
