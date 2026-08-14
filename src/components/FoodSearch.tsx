import { useEffect, useMemo, useState } from 'react'
import { Search, Star, PencilLine, ScanLine } from 'lucide-react'
import { searchLocal } from '../lib/search'
import { searchOpenFoodFacts } from '../lib/off'
import { useStore } from '../lib/store'
import type { FoodItem, MealType } from '../types'
import { MEALS } from '../lib/labels'
import { portionUnit } from '../lib/portions'
import { FoodThumb, FormBadge, Sheet } from './ui'

function ResultRow({
  food,
  favorite,
  onPick,
  onFav,
}: {
  food: FoodItem
  favorite: boolean
  onPick: () => void
  onFav: () => void
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <button onClick={onPick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <FoodThumb food={food} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{food.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-white/50">
            <FormBadge form={food.form} />
            <span>
              {Math.round(food.kcal)} ккал / 100 {portionUnit(food)}
            </span>
          </div>
        </div>
      </button>
      <button
        onClick={onFav}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        aria-label="Избранное"
      >
        <Star size={18} className={favorite ? 'fill-mint text-mint' : 'text-white/30'} />
      </button>
    </div>
  )
}

export function FoodSearch() {
  const { overlay, setOverlay, snapshot, toggleFavorite } = useStore()
  const [q, setQ] = useState('')
  const [meal, setMeal] = useState<MealType>(overlay.type === 'search' ? overlay.meal : 'lunch')
  const [off, setOff] = useState<FoodItem[]>([])
  const [offLoading, setOffLoading] = useState(false)

  const local = useMemo(() => searchLocal(q), [q])
  const recents = snapshot.recentFoods
  const favs = snapshot.favoriteItems

  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) {
      setOff([])
      return
    }
    let cancelled = false
    setOffLoading(true)
    const t = window.setTimeout(() => {
      searchOpenFoodFacts(query)
        .then((rows) => {
          if (!cancelled) setOff(rows)
        })
        .finally(() => {
          if (!cancelled) setOffLoading(false)
        })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [q])

  const pick = (food: FoodItem) => setOverlay({ type: 'grams', food, meal })

  return (
    <Sheet title="Продукт" onClose={() => setOverlay({ type: 'none' })}>
      <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar">
        {MEALS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMeal(m.id)}
            className={`h-10 shrink-0 rounded-full px-3 text-sm font-semibold ${
              meal === m.id ? 'bg-mint text-bg' : 'bg-white/8 text-white/70'
            }`}
          >
            {m.emoji} {m.label}
          </button>
        ))}
      </div>
      <label className="mb-3 flex h-12 items-center gap-2 rounded-2xl bg-white/8 px-3">
        <Search size={18} className="text-white/40" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Крупа, грудка, яблоко..."
          className="h-full w-full bg-transparent text-base outline-none placeholder:text-white/30"
        />
        <button
          type="button"
          onClick={() => setOverlay({ type: 'barcode', meal })}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/8"
          aria-label="Штрихкод"
        >
          <ScanLine size={18} />
        </button>
      </label>

      {!q && (favs.length > 0 || recents.length > 0) && (
        <div className="space-y-4">
          {favs.length > 0 && (
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/40">
                Избранное
              </h3>
              {favs.map((food) => (
                <ResultRow
                  key={food.id}
                  food={food}
                  favorite
                  onPick={() => pick(food)}
                  onFav={() => toggleFavorite(food)}
                />
              ))}
            </section>
          )}
          {recents.length > 0 && (
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/40">
                Недавние
              </h3>
              {recents.map((food) => (
                <ResultRow
                  key={food.id}
                  food={food}
                  favorite={snapshot.favorites.includes(food.id)}
                  onPick={() => pick(food)}
                  onFav={() => toggleFavorite(food)}
                />
              ))}
            </section>
          )}
        </div>
      )}

      {q && (
        <div className="space-y-4">
          <section>
            {local.map((food) => (
              <ResultRow
                key={food.id}
                food={food}
                favorite={snapshot.favorites.includes(food.id)}
                onPick={() => pick(food)}
                onFav={() => toggleFavorite(food)}
              />
            ))}
            {local.length === 0 && (
              <p className="py-4 text-sm text-white/40">В локальном каталоге ничего не нашлось</p>
            )}
          </section>
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/40">
              В магазинах
            </h3>
            {offLoading && <p className="py-2 text-sm text-white/40">Ищу упаковки...</p>}
            {off.map((food) => (
              <ResultRow
                key={food.id}
                food={food}
                favorite={snapshot.favorites.includes(food.id)}
                onPick={() => pick(food)}
                onFav={() => toggleFavorite(food)}
              />
            ))}
          </section>
        </div>
      )}

      <button
        onClick={() => setOverlay({ type: 'custom-food', meal })}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/8 font-semibold"
      >
        <PencilLine size={18} /> Свой продукт
      </button>
      <p className="mt-2 text-center text-[11px] text-white/35">
        Сухой и варёный — разные ккал. Смотри бейдж на карточке.
      </p>
    </Sheet>
  )
}
