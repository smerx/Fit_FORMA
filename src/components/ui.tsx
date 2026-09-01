import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CATEGORY_COLOR } from '../data/foods'
import type { FoodForm, FoodItem } from '../types'
import { formLabel } from '../lib/labels'

export function NumericInput({
  value,
  onChange,
  min,
  max,
  className = '',
  ariaLabel,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  className?: string
  ariaLabel?: string
}) {
  const [text, setText] = useState(String(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(String(value))
  }, [value])

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      aria-label={ariaLabel}
      onFocus={() => {
        focused.current = true
      }}
      onChange={(event) => {
        const raw = event.target.value
          .replace(',', '.')
          .replace(/[^\d.]/g, '')
          .replace(/(\..*)\./g, '$1')
        setText(raw)
        if (raw === '' || raw === '.') return
        const parsed = Number(raw)
        if (Number.isFinite(parsed)) onChange(parsed)
      }}
      onBlur={() => {
        focused.current = false
        if (text === '' || text === '.') {
          setText(String(value))
          return
        }
        const parsed = Number(text)
        const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed))
        onChange(clamped)
        setText(String(clamped))
      }}
      className={className}
    />
  )
}

export function FoodThumb({
  food,
  size = 48,
}: {
  food: Pick<FoodItem, 'emoji' | 'image' | 'category' | 'name'>
  size?: number
}) {
  const color = CATEGORY_COLOR[food.category] ?? '#3ddc97'
  if (food.image) {
    return (
      <img
        src={food.image}
        alt={food.name}
        width={size}
        height={size}
        className="rounded-2xl object-cover bg-white/5"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="flex items-center justify-center rounded-2xl text-xl"
      style={{
        width: size,
        height: size,
        background: `${color}22`,
        boxShadow: `inset 0 0 0 1px ${color}55`,
      }}
    >
      {food.emoji}
    </div>
  )
}

export function FormBadge({ form }: { form: FoodForm }) {
  const styles =
    form === 'dry'
      ? 'bg-amber-400/15 text-amber-300'
      : form === 'cooked'
        ? 'bg-mint/15 text-mint'
        : 'bg-white/8 text-white/60'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles}`}>
      {formLabel(form)}
    </span>
  )
}

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/60">
      <button className="min-h-16 flex-1" onClick={onClose} aria-label="Закрыть" />
      <div className="max-h-[88%] overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-[#12141a] px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/8 text-white/70"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
