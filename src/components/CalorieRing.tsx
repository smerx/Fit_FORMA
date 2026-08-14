type Props = {
  eaten: number
  target: number
  size?: number
}

export function CalorieRing({ eaten, target, size = 168 }: Props) {
  const r = 70
  const c = 2 * Math.PI * r
  const ratio = target > 0 ? Math.min(eaten / target, 1) : 0
  const offset = c * (1 - ratio)
  const over = eaten > target

  return (
    <svg width={size} height={size} viewBox="0 0 180 180" className="block">
      <circle cx="90" cy="90" r={r} fill="none" stroke="#1c2030" strokeWidth="14" />
      <circle
        cx="90"
        cy="90"
        r={r}
        fill="none"
        stroke={over ? '#ff7a9c' : '#3ddc97'}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 90 90)"
      />
    </svg>
  )
}

export function MacroBar({
  label,
  value,
  color,
  unit = 'г',
}: {
  label: string
  value: number
  color: string
  unit?: string
}) {
  return (
    <div className="flex-1">
      <div className="mb-1 flex items-baseline justify-between text-xs text-white/50">
        <span>{label}</span>
        <span className="font-semibold text-white">
          {Math.round(value)} {unit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full" style={{ width: '100%', background: color, opacity: 0.9 }} />
      </div>
    </div>
  )
}
