import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ACTIVITIES } from '../data/activities'
import { useStore } from '../lib/store'
import { activityCalories } from '../lib/nutrition'
import { Sheet } from '../components/ui'
import { ToolsBoundary } from '../tools/error-boundary'
import { TutorsDock } from '../tutors/TutorsDock'
import type { ActivityTemplate } from '../types'

export function ActivityScreen() {
  const { snapshot, date, addActivityEntry, removeActivity, overlay, setOverlay } = useStore()
  const [picked, setPicked] = useState<ActivityTemplate | null>(null)
  const [minutes, setMinutes] = useState(30)
  const [customName, setCustomName] = useState('')
  const [customMet, setCustomMet] = useState(4)
  const today = snapshot.activityEntries.filter((e) => e.date === date)
  const burned = today.reduce((s, e) => s + e.kcal, 0)
  const weight = snapshot.profile?.weightKg ?? 80

  const open = (a: ActivityTemplate) => {
    setPicked(a)
    setMinutes(a.id.includes('elliptical') ? 30 : 60)
    setOverlay({ type: 'activity' })
  }

  const save = () => {
    if (!picked) return
    addActivityEntry({
      activityId: picked.id,
      name: picked.custom ? customName.trim() || 'Своя активность' : picked.name,
      minutes,
      met: picked.custom ? customMet : picked.met,
    })
    setPicked(null)
  }

  return (
    <div className="space-y-4 pb-6">
      <header>
        <h1 className="text-2xl font-extrabold">Движение</h1>
        <p className="text-sm text-white/45">Минуты → калории по MET и твоему весу</p>
      </header>

      <div className="rounded-3xl bg-card p-4">
        <div className="text-xs text-white/40">Сожжено сегодня</div>
        <div className="text-4xl font-extrabold text-mint">{burned}</div>
        <div className="text-sm text-white/40">ккал</div>
      </div>

      <ToolsBoundary name="tutors-dock">
        <TutorsDock />
      </ToolsBoundary>

      <div className="grid grid-cols-1 gap-2">
        {ACTIVITIES.map((a) => (
          <button
            key={a.id}
            onClick={() => open(a)}
            className="flex items-center gap-3 rounded-3xl bg-card px-4 py-3 text-left"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/8 text-2xl">
              {a.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{a.name}</div>
              <div className="text-xs text-white/40">
                {a.hint} · MET {a.met}
              </div>
            </div>
            <div className="text-sm text-mint">+</div>
          </button>
        ))}
      </div>

      {today.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-white/50">Сегодня</h2>
          {today.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-3xl bg-card px-4 py-3">
              <div className="flex-1">
                <div className="font-medium">{e.name}</div>
                <div className="text-xs text-white/40">
                  {e.minutes} мин · {e.kcal} ккал
                </div>
              </div>
              <button onClick={() => removeActivity(e.id)} className="flex h-11 w-11 items-center justify-center text-white/30">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </section>
      )}

      {overlay.type === 'activity' && picked && (
        <Sheet title={picked.name} onClose={() => setOverlay({ type: 'none' })}>
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
                <input
                  type="number"
                  step="0.1"
                  value={customMet}
                  onChange={(e) => setCustomMet(Number(e.target.value) || 1)}
                  className="h-12 w-full rounded-2xl bg-white/8 px-3 outline-none"
                />
              </label>
            </div>
          )}
          <div className="mb-2 text-sm text-white/45">Минуты</div>
          <div className="flex items-end gap-2">
            <input
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
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
      )}
    </div>
  )
}
