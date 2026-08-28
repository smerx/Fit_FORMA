import { Trash2 } from 'lucide-react'
import { ACTIVITIES } from '../data/activities'
import { useStore } from '../lib/store'

export function ActivityScreen() {
  const { snapshot, date, removeActivity, setOverlay } = useStore()
  const today = snapshot.activityEntries.filter((e) => e.date === date)
  const burned = today.reduce((s, e) => s + e.kcal, 0)

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

      <div className="grid grid-cols-1 gap-2">
        {ACTIVITIES.map((a) => (
          <button
            key={a.id}
            onClick={() => setOverlay({ type: 'activity', activityId: a.id, date, followToday: true })}
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
                {e.note ? <p className="mt-1 text-sm text-white/60">{e.note}</p> : null}
              </div>
              <button onClick={() => removeActivity(e.id)} className="flex h-11 w-11 items-center justify-center text-white/30">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
