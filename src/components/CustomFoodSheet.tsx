import { useState } from 'react'
import { useStore } from '../lib/store'
import { Sheet } from './ui'

export function CustomFoodSheet() {
  const { overlay, setOverlay, addCustomFood } = useStore()
  const [name, setName] = useState('')
  const [grams, setGrams] = useState(100)
  const [kcal, setKcal] = useState(100)
  const [protein, setProtein] = useState(0)
  const [fat, setFat] = useState(0)
  const [carbs, setCarbs] = useState(0)

  if (overlay.type !== 'custom-food') return null
  const meal = overlay.meal

  return (
    <Sheet title="Свой продукт" onClose={() => setOverlay({ type: 'search', meal })}>
      <div className="space-y-3">
        <Field label="Название" value={name} onChange={setName} placeholder="Например, салат мамы" />
        <div className="grid grid-cols-2 gap-3">
          <Num label="Граммы" value={grams} onChange={setGrams} />
          <Num label="Ккал / 100 г" value={kcal} onChange={setKcal} />
          <Num label="Белки / 100 г" value={protein} onChange={setProtein} />
          <Num label="Жиры / 100 г" value={fat} onChange={setFat} />
          <Num label="Углеводы / 100 г" value={carbs} onChange={setCarbs} />
        </div>
        <button
          disabled={!name.trim()}
          onClick={() =>
            addCustomFood(name.trim(), grams, { kcal, protein, fat, carbs }, meal)
          }
          className="h-14 w-full rounded-2xl bg-mint font-bold text-bg disabled:opacity-40"
        >
          Добавить
        </button>
      </div>
    </Sheet>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-white/45">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl bg-white/8 px-3 outline-none"
      />
    </label>
  )
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-white/45">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-12 w-full rounded-2xl bg-white/8 px-3 outline-none"
      />
    </label>
  )
}
