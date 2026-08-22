import type { ReactNode } from 'react'
import { Droplets, Dumbbell, Utensils } from 'lucide-react'
import { useStore } from '../lib/store'
import { Sheet } from './ui'

export function AddSheet() {
  const { overlay, setOverlay } = useStore()
  if (overlay.type !== 'add') return null

  return (
    <Sheet title="Добавить" onClose={() => setOverlay({ type: 'none' })}>
      <div className="space-y-2">
        <Choice
          icon={<Utensils size={20} />}
          title="Еда"
          sub="Поиск, граммовка, своё блюдо"
          onClick={() => setOverlay({ type: 'search', meal: 'lunch' })}
        />
        <Choice
          icon={<Droplets size={20} />}
          title="Вода"
          sub="250, 350, 500 мл или своё"
          onClick={() => setOverlay({ type: 'water' })}
        />
        <Choice
          icon={<Dumbbell size={20} />}
          title="Активность"
          sub="Минуты, ккал, заметка к тренировке"
          onClick={() => setOverlay({ type: 'activity' })}
        />
      </div>
    </Sheet>
  )
}

function Choice({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: ReactNode
  title: string
  sub: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-3xl bg-white/5 px-4 py-3 text-left"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint/15 text-mint">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-white/40">{sub}</span>
      </span>
    </button>
  )
}
