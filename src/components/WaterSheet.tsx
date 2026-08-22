import { useState } from 'react'
import { useStore } from '../lib/store'
import { Sheet } from './ui'

const PRESETS = [250, 350, 500, 750]

export function WaterSheet() {
  const { overlay, setOverlay, addWater } = useStore()
  const [ml, setMl] = useState(250)
  if (overlay.type !== 'water') return null

  return (
    <Sheet title="Вода" onClose={() => setOverlay({ type: 'none' })}>
      <div className="flex items-end gap-2">
        <input
          type="number"
          min={1}
          value={ml}
          onChange={(e) => setMl(Math.max(1, Number(e.target.value) || 1))}
          className="w-36 bg-transparent text-5xl font-extrabold outline-none"
        />
        <span className="pb-2 text-white/40">мл</span>
      </div>
      <div className="mt-4 flex gap-2">
        {PRESETS.map((n) => (
          <button
            key={n}
            onClick={() => setMl(n)}
            className={`h-11 flex-1 rounded-2xl text-sm font-semibold ${
              ml === n ? 'bg-mint text-bg' : 'bg-white/8'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <button
        onClick={() => void addWater(ml)}
        className="mt-6 h-14 w-full rounded-2xl bg-mint font-bold text-bg"
      >
        Записать
      </button>
    </Sheet>
  )
}
