import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { useStore } from '../lib/store'
import { macrosForGrams } from '../lib/nutrition'
import { formHint } from '../lib/labels'
import { FoodThumb, FormBadge, Sheet } from './ui'

const PRESETS = [50, 100, 150, 200, 250]

export function GramSheet() {
  const { overlay, setOverlay, addFood, snapshot, toggleFavorite } = useStore()
  const [grams, setGrams] = useState(100)
  const food = overlay.type === 'grams' ? overlay.food : null
  const meal = overlay.type === 'grams' ? overlay.meal : 'lunch'
  const macros = food ? macrosForGrams(food, grams) : null
  const fav = food ? snapshot.favorites.includes(food.id) : false

  useEffect(() => {
    setGrams(100)
  }, [food?.id])

  if (overlay.type !== 'grams' || !food || !macros) return null

  return (
    <Sheet title="Граммовка" onClose={() => setOverlay({ type: 'search', meal })}>
      <div className="mb-4 flex items-center gap-3">
        <FoodThumb food={food} size={64} />
        <div className="min-w-0 flex-1">
          <div className="font-bold leading-tight">{food.name}</div>
          <div className="mt-1 flex items-center gap-2">
            <FormBadge form={food.form} />
            <span className="text-xs text-white/45">{food.category}</span>
          </div>
          <p className="mt-1 text-xs text-white/40">{formHint(food.form)}</p>
        </div>
        <button
          onClick={() => toggleFavorite(food)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/8"
        >
          <Star size={18} className={fav ? 'fill-mint text-mint' : 'text-white/40'} />
        </button>
      </div>

      <div className="mb-4 rounded-3xl bg-white/5 p-4">
        <div className="flex items-end justify-between">
          <input
            type="number"
            value={grams}
            min={1}
            max={1500}
            onChange={(e) => setGrams(Math.max(1, Number(e.target.value) || 1))}
            className="w-28 bg-transparent text-5xl font-extrabold outline-none"
          />
          <span className="pb-2 text-lg text-white/50">г</span>
        </div>
        <input
          type="range"
          min={10}
          max={500}
          step={5}
          value={Math.min(grams, 500)}
          onChange={(e) => setGrams(Number(e.target.value))}
          className="mt-3 w-full"
        />
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {PRESETS.map((n) => (
            <button
              key={n}
              onClick={() => setGrams(n)}
              className={`h-10 shrink-0 rounded-full px-3 text-sm font-semibold ${
                grams === n ? 'bg-mint text-bg' : 'bg-white/8'
              }`}
            >
              {n} г
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2 text-center">
        {[
          ['Ккал', macros.kcal, 'text-mint'],
          ['Б', macros.protein, 'text-protein'],
          ['Ж', macros.fat, 'text-fat'],
          ['У', macros.carbs, 'text-carbs'],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-2xl bg-white/5 py-3">
            <div className={`text-lg font-bold ${color}`}>{value}</div>
            <div className="text-[11px] text-white/40">{label}</div>
          </div>
        ))}
      </div>

      <button
        onClick={() => addFood(food, grams, meal)}
        className="h-14 w-full rounded-2xl bg-mint text-base font-bold text-bg"
      >
        Добавить в дневник
      </button>
    </Sheet>
  )
}
