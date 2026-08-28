import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { rememberLocalBarcode } from '../data/barcodes-local'
import { formatDayTitle } from '../lib/dates'
import { Sheet } from './ui'

export function CustomFoodSheet() {
  const { overlay, setOverlay, addCustomFood } = useStore()
  const draft = overlay.type === 'custom-food' ? overlay.draftName ?? '' : ''
  const barcode = overlay.type === 'custom-food' ? overlay.barcode ?? '' : ''
  const date = overlay.type === 'custom-food' ? overlay.date : ''
  const followToday = overlay.type === 'custom-food' ? overlay.followToday : false
  const [name, setName] = useState(draft)
  const [grams, setGrams] = useState(100)
  const [kcal, setKcal] = useState(100)
  const [protein, setProtein] = useState(0)
  const [fat, setFat] = useState(0)
  const [carbs, setCarbs] = useState(0)

  useEffect(() => {
    if (overlay.type === 'custom-food') setName(overlay.draftName ?? '')
  }, [overlay])

  if (overlay.type !== 'custom-food') return null
  const meal = overlay.meal
  const code = (barcode || name.match(/Код\s+(\d{8,14})/i)?.[1] || '').replace(/\D/g, '')

  return (
    <Sheet
      title={`Свой продукт · ${formatDayTitle(date)}`}
      onClose={() => setOverlay({ type: 'search', meal, date, followToday })}
    >
      <div className="space-y-3">
        {code ? (
          <p className="rounded-2xl bg-white/5 px-3 py-2 text-xs text-white/45">
            Штрихкод <span className="font-mono text-white/70">{code}</span> запомнится после сохранения
          </p>
        ) : null}
        <Field label="Название" value={name} onChange={setName} placeholder="Например, молоко Ангара 2,5%" />
        <div className="grid grid-cols-2 gap-3">
          <Num label="Граммы" value={grams} onChange={setGrams} />
          <Num label="Ккал / 100 г" value={kcal} onChange={setKcal} />
          <Num label="Белки / 100 г" value={protein} onChange={setProtein} />
          <Num label="Жиры / 100 г" value={fat} onChange={setFat} />
          <Num label="Углеводы / 100 г" value={carbs} onChange={setCarbs} />
        </div>
        <button
          disabled={!name.trim()}
          onClick={() => {
            const cleanName = name.trim()
            if (code.length >= 8) {
              rememberLocalBarcode(code, {
                name: cleanName,
                kcal,
                protein,
                fat,
                carbs,
              })
            }
            void addCustomFood(cleanName, grams, { kcal, protein, fat, carbs }, meal, date)
          }}
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
