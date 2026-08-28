import { Activity, BookOpen, Plus, TrendingUp, Utensils } from 'lucide-react'
import type { TabId } from '../types'
import { useStore } from '../lib/store'
import { todayIso } from '../lib/dates'

const items: { id: TabId | 'add'; label: string; icon: typeof Utensils }[] = [
  { id: 'today', label: 'Сегодня', icon: Utensils },
  { id: 'diary', label: 'Дневник', icon: BookOpen },
  { id: 'add', label: 'Добавить', icon: Plus },
  { id: 'activity', label: 'Движение', icon: Activity },
  { id: 'progress', label: 'Прогресс', icon: TrendingUp },
]

export function BottomNav() {
  const { tab, setTab, setOverlay } = useStore()

  return (
    <nav className="grid grid-cols-5 border-t border-white/8 bg-[#0c0e14]/95 px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl">
      {items.map((item) => {
        const active = item.id === tab
        const Icon = item.icon
        if (item.id === 'add') {
          return (
            <button
              key={item.id}
              onClick={() => setOverlay({ type: 'add', date: todayIso(), followToday: true })}
              className="-mt-5 flex flex-col items-center gap-1"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mint text-bg shadow-[0_8px_24px_rgba(61,220,151,0.35)]">
                <Icon size={26} strokeWidth={2.4} />
              </span>
              <span className="text-[10px] font-semibold text-white/70">{item.label}</span>
            </button>
          )
        }
        return (
          <button
            key={item.id}
            onClick={() => setTab(item.id as TabId)}
            className="flex min-h-14 flex-col items-center justify-center gap-0.5"
          >
            <Icon
              size={22}
              strokeWidth={active ? 2.4 : 1.8}
              className={active ? 'text-mint' : 'text-white/40'}
            />
            <span className={`text-[10px] font-semibold ${active ? 'text-mint' : 'text-white/40'}`}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
