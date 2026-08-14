import { ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../lib/store'
import { formatDayTitle, shiftIso, todayIso } from '../lib/dates'
import {
  dailyCalorieTarget,
  remainingCalories,
  sumActivity,
  sumFood,
} from '../lib/nutrition'
import { pickHealthTip } from '../lib/tips'
import { MEALS } from '../lib/labels'
import { CalorieRing, MacroBar } from '../components/CalorieRing'
import { FoodThumb } from '../components/ui'
import { TipCard, TipSheet, useDismissedTips } from '../components/TipCard'
import { entryUnit } from '../lib/portions'
import type { FoodItem } from '../types'

export function TodayScreen() {
  const { snapshot, date, setDate, setOverlay, setTab, addWater, removeWater, toggleVitamin, updateProfile } =
    useStore()
  const profile = snapshot.profile
  const dismissed = useDismissedTips(date)
  const [tipOpen, setTipOpen] = useState(false)
  if (!profile) return null

  const foods = snapshot.foodEntries.filter((e) => e.date === date)
  const acts = snapshot.activityEntries.filter((e) => e.date === date)
  const waters = snapshot.waterEntries.filter((e) => e.date === date)
  const vitamins = snapshot.vitaminEntries.filter((e) => e.date === date)
  const waterMl = waters.reduce((s, w) => s + w.ml, 0)
  const eaten = sumFood(foods)
  const burned = sumActivity(acts)
  const target = dailyCalorieTarget(profile)
  const left = remainingCalories(profile, foods, acts)
  const lastWeight = [...snapshot.weightLogs].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  const tip = pickHealthTip({
    profile,
    date,
    foods,
    activities: acts,
    waterMl,
    vitamins,
    dismissed: dismissed.ids,
  })
  const waterPct = Math.min(100, Math.round((waterMl / Math.max(profile.waterGoalMl, 1)) * 100))

  return (
    <div className="space-y-4 pb-6">
      <header className="flex items-center justify-between pt-1">
        <div>
          <p className="text-sm text-white/45">Привет, {profile.name}</p>
          <div className="mt-1 flex items-center gap-1">
            <button
              className="flex h-11 w-11 items-center justify-center"
              onClick={() => setDate(shiftIso(date, -1))}
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-xl font-extrabold">{formatDayTitle(date)}</h1>
            <button
              className="flex h-11 w-11 items-center justify-center disabled:opacity-30"
              disabled={date >= todayIso()}
              onClick={() => setDate(shiftIso(date, 1))}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        <button
          onClick={() => setOverlay({ type: 'profile' })}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/8"
        >
          <Settings size={18} />
        </button>
      </header>

      <section className="relative overflow-hidden rounded-[28px] bg-card px-3 py-4">
        <div className="flex justify-center">
          <div className="relative">
            <CalorieRing eaten={eaten.kcal} target={target} size={148} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[34px] font-extrabold leading-none tabular-nums">{left}</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                осталось
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1">
          <Stat k="Цель" v={String(target)} />
          <Stat k="Съедено" v={String(eaten.kcal)} />
          <Stat k="Активность" v={`+${burned}`} accent />
        </div>
        <div className="mt-4 flex gap-3">
          <MacroBar label="Белки" value={eaten.protein} color="#6ea8ff" />
          <MacroBar label="Жиры" value={eaten.fat} color="#ffb86b" />
          <MacroBar label="Углеводы" value={eaten.carbs} color="#ff7a9c" />
        </div>
      </section>

      {tip && (
        <TipCard tip={tip} onOpen={() => setTipOpen(true)} onDismiss={() => dismissed.dismiss(tip.id)} />
      )}

      <section className="rounded-3xl bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-white/40">Вода</div>
            <div className="text-xl font-extrabold tabular-nums">
              {waterMl} <span className="text-sm font-semibold text-white/40">/ {profile.waterGoalMl} мл</span>
            </div>
          </div>
          {waters.length > 0 && (
            <button onClick={() => removeWater(waters.at(-1)!.id)} className="text-xs text-white/35">
              − последний
            </button>
          )}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div className="h-full rounded-full bg-protein" style={{ width: `${waterPct}%` }} />
        </div>
        <div className="mt-3 flex gap-2">
          {[250, 350, 500].map((ml) => (
            <button
              key={ml}
              onClick={() => addWater(ml)}
              className="h-11 flex-1 rounded-2xl bg-white/8 text-sm font-semibold"
            >
              +{ml} мл
            </button>
          ))}
        </div>
      </section>

      {profile.tracksVitamins && (
        <button
          onClick={() => toggleVitamin()}
          className="flex w-full items-center justify-between rounded-3xl bg-card px-4 py-4 text-left"
        >
          <div>
            <div className="font-semibold">{profile.vitaminName}</div>
            <div className="text-sm text-white/40">
              {vitamins.length ? 'Сегодня отмечен' : 'Нажми, если принял'}
            </div>
          </div>
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              vitamins.length ? 'bg-mint text-bg' : 'bg-white/8 text-white/40'
            }`}
          >
            {vitamins.length ? '✓' : ''}
          </span>
        </button>
      )}

      <button
        onClick={() => setOverlay({ type: 'weight' })}
        className="flex w-full items-center justify-between rounded-3xl bg-card px-4 py-4"
      >
        <div>
          <div className="text-xs text-white/40">Вес</div>
          <div className="text-2xl font-extrabold">{(lastWeight?.weight ?? profile.weightKg).toFixed(1)} кг</div>
        </div>
        <div className="text-right text-sm text-white/50">
          Цель {profile.goalWeightKg} кг
          <div className="text-mint">Записать</div>
        </div>
      </button>

      <section className="space-y-2">
        {MEALS.map((meal) => {
          const items = foods.filter((e) => e.meal === meal.id)
          const kcal = items.reduce((s, e) => s + e.kcal, 0)
          return (
            <button
              key={meal.id}
              onClick={() => setOverlay({ type: 'search', meal: meal.id })}
              className="w-full rounded-3xl bg-card px-4 py-3 text-left"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {meal.emoji} {meal.label}
                </span>
                <span className="text-sm text-white/45">{kcal} ккал</span>
              </div>
              {items.length === 0 ? (
                <p className="mt-1 text-sm text-white/35">Нажми, чтобы добавить</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {items.slice(0, 3).map((e) => (
                    <div key={e.id} className="flex items-center gap-2 text-sm">
                      <FoodThumb
                        food={
                          {
                            name: e.name,
                            emoji: e.emoji ?? '🍽️',
                            image: e.image,
                            category: 'Блюда',
                          } satisfies Pick<FoodItem, 'name' | 'emoji' | 'image' | 'category'>
                        }
                        size={32}
                      />
                      <span className="min-w-0 flex-1 truncate">{e.name}</span>
                      <span className="text-white/40">
                        {e.grams} {entryUnit(e.foodId)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </section>

      <button
        onClick={() => setTab('activity')}
        className="w-full rounded-3xl bg-card px-4 py-4 text-left"
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold">Активность</span>
          <span className="text-mint">{burned} ккал</span>
        </div>
        <p className="mt-1 text-sm text-white/40">
          {acts.length ? acts.map((a) => `${a.name} ${a.minutes} мин`).join(' · ') : 'Покос, эллипсоид, работа...'}
        </p>
      </button>
      {tipOpen && tip && (
        <TipSheet
          tip={tip}
          onClose={() => setTipOpen(false)}
          onDisable={() => {
            void updateProfile({ tipsEnabled: false })
            setTipOpen(false)
          }}
        />
      )}
    </div>
  )
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/4 px-1 py-2 text-center">
      <div className="text-[11px] text-white/45">{k}</div>
      <div
        className={`mt-0.5 text-lg font-extrabold leading-none tabular-nums ${accent ? 'text-mint' : 'text-white'}`}
      >
        {v}
      </div>
      <div className="mt-0.5 text-[10px] text-white/35">ккал</div>
    </div>
  )
}
