import { ChevronLeft, ChevronRight, Copy, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { formatDayTitle, formatWeekday, shiftIso, todayIso } from '../lib/dates'
import { MEALS, formLabel } from '../lib/labels'
import { sumFood } from '../lib/nutrition'
import { FoodThumb } from '../components/ui'
import type { FoodItem } from '../types'

export function DiaryScreen() {
  const { snapshot, date, setDate, setOverlay, removeFood, copyYesterday } = useStore()
  const foods = snapshot.foodEntries.filter((e) => e.date === date)
  const total = sumFood(foods)

  return (
    <div className="space-y-4 pb-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center">
          <button className="flex h-11 w-11 items-center justify-center" onClick={() => setDate(shiftIso(date, -1))}>
            <ChevronLeft />
          </button>
          <div>
            <h1 className="text-xl font-extrabold">{formatDayTitle(date)}</h1>
            <p className="text-xs capitalize text-white/40">{formatWeekday(date)}</p>
          </div>
          <button
            className="flex h-11 w-11 items-center justify-center disabled:opacity-30"
            disabled={date >= todayIso()}
            onClick={() => setDate(shiftIso(date, 1))}
          >
            <ChevronRight />
          </button>
        </div>
        <button
          onClick={() => copyYesterday()}
          className="flex h-11 items-center gap-1 rounded-full bg-white/8 px-3 text-sm"
        >
          <Copy size={14} /> Вчера
        </button>
      </header>

      <div className="rounded-3xl bg-card px-4 py-3 text-sm text-white/60">
        Итого {total.kcal} ккал · Б {Math.round(total.protein)} · Ж {Math.round(total.fat)} · У{' '}
        {Math.round(total.carbs)}
      </div>

      {MEALS.map((meal) => {
        const items = foods.filter((e) => e.meal === meal.id)
        const kcal = items.reduce((s, e) => s + e.kcal, 0)
        return (
          <section key={meal.id} className="rounded-3xl bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-bold">
                {meal.emoji} {meal.label}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-white/40">{kcal} ккал</span>
                <button
                  onClick={() => setOverlay({ type: 'search', meal: meal.id })}
                  className="flex h-9 items-center rounded-full bg-mint/15 px-3 text-sm font-semibold text-mint"
                >
                  +
                </button>
              </div>
            </div>
            {items.length === 0 && <p className="text-sm text-white/35">Пусто</p>}
            <div className="space-y-2">
              {items.map((e) => (
                <div key={e.id} className="flex items-center gap-3">
                  <FoodThumb
                    food={
                      {
                        name: e.name,
                        emoji: e.emoji ?? '🍽️',
                        image: e.image,
                        category: 'Блюда',
                      } satisfies Pick<FoodItem, 'name' | 'emoji' | 'image' | 'category'>
                    }
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.name}</div>
                    <div className="text-xs text-white/40">
                      {e.grams} г · {e.kcal} ккал
                      {e.form ? ` · ${formLabel(e.form)}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFood(e.id)}
                    className="flex h-11 w-11 items-center justify-center text-white/30"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
