import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { useStore } from '../lib/store'
import { macrosForGrams } from '../lib/nutrition'
import { formHint } from '../lib/labels'
import { formatDayTitle } from '../lib/dates'
import { defaultPortionGrams, portionPresets, portionUnit } from '../lib/portions'
import { FoodThumb, FormBadge, NumericInput, Sheet } from './ui'

export function GramSheet() {
  const { overlay, setOverlay, addFood, snapshot, toggleFavorite } = useStore()
  const food = overlay.type === 'grams' ? overlay.food : null
  const meal = overlay.type === 'grams' ? overlay.meal : 'lunch'
  const date = overlay.type === 'grams' ? overlay.date : ''
  const followToday = overlay.type === 'grams' ? overlay.followToday : false
  const unit = food ? portionUnit(food) : 'г'
  const presets = food ? portionPresets(food) : []
  const [grams, setGrams] = useState(100)
  const macros = food ? macrosForGrams(food, grams) : null
  const fav = food ? snapshot.favorites.includes(food.id) : false

  useEffect(() => {
    if (food) setGrams(defaultPortionGrams(food))
  }, [food])

  if (overlay.type !== 'grams' || !food || !macros) return null

  return (
    <Sheet
      title={`${unit === 'мл' ? 'Объём' : 'Граммовка'} · ${formatDayTitle(date)}`}
      onClose={() => setOverlay({ type: 'search', meal, date, followToday })}
    >
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
          <NumericInput
            value={grams}
            min={1}
            max={1500}
            onChange={setGrams}
            className="w-28 bg-transparent text-5xl font-extrabold outline-none"
          />
          <span className="pb-2 text-lg text-white/50">{unit}</span>
        </div>
        <input
          type="range"
          min={unit === 'мл' ? 50 : 10}
          max={unit === 'мл' ? 700 : 500}
          step={5}
          value={Math.min(grams, unit === 'мл' ? 700 : 500)}
          onChange={(e) => setGrams(Number(e.target.value))}
          className="mt-3 w-full"
        />
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {presets.map((n) => (
            <button
              key={n.label}
              onClick={() => setGrams(n.grams)}
              className={`h-10 shrink-0 rounded-full px-3 text-sm font-semibold ${
                grams === n.grams ? 'bg-mint text-bg' : 'bg-white/8'
              }`}
            >
              {n.label}
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
        onClick={() => addFood(food, grams, meal, date)}
        className="h-14 w-full rounded-2xl bg-mint text-base font-bold text-bg"
      >
        Добавить за {formatDayTitle(date).toLowerCase()}
      </button>
    </Sheet>
  )
}
