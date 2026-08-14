import { useEffect, useMemo, useState } from 'react'
import type { HealthTip } from '../types'
import { Sheet } from './ui'

const TONE: Record<HealthTip['tone'], string> = {
  warn: 'border-carbs/30 bg-carbs/10',
  info: 'border-protein/30 bg-protein/10',
  good: 'border-mint/30 bg-mint/10',
}

export function TipCard({
  tip,
  onOpen,
  onDismiss,
}: {
  tip: HealthTip
  onOpen: () => void
  onDismiss: () => void
}) {
  return (
    <div className={`rounded-3xl border px-4 py-3 ${TONE[tip.tone]}`}>
      <button onClick={onOpen} className="w-full text-left">
        <div className="text-xs text-white/45">Совет</div>
        <div className="font-bold">{tip.title}</div>
        <p className="mt-1 line-clamp-2 text-sm text-white/70">{tip.why}</p>
      </button>
      <button onClick={onDismiss} className="mt-2 text-xs text-white/40">
        Скрыть сегодня
      </button>
    </div>
  )
}

export function TipSheet({
  tip,
  onClose,
  onDisable,
}: {
  tip: HealthTip
  onClose: () => void
  onDisable: () => void
}) {
  return (
    <Sheet title={tip.title} onClose={onClose}>
      <p className="text-sm leading-relaxed text-white/80">{tip.why}</p>
      <div className="mt-4 rounded-2xl bg-white/5 p-3 text-sm leading-relaxed text-white/70">
        {tip.fact}
      </div>
      <p className="mt-3 text-[11px] text-white/35">
        Это общие факты про питание, не диагноз и не замена врачу.
      </p>
      <button onClick={onClose} className="mt-4 h-12 w-full rounded-2xl bg-mint font-bold text-bg">
        Понятно
      </button>
      <button onClick={onDisable} className="mt-2 h-11 w-full text-sm text-white/45">
        Выключить советы в настройках
      </button>
    </Sheet>
  )
}

export function useDismissedTips(date: string) {
  const key = `forma-tips-${date}`
  const [ids, setIds] = useState<string[]>([])

  useEffect(() => {
    try {
      setIds(JSON.parse(sessionStorage.getItem(key) || '[]') as string[])
    } catch {
      setIds([])
    }
  }, [key])
  return useMemo(
    () => ({
      ids,
      dismiss: (id: string) => {
        const next = [...ids, id]
        setIds(next)
        sessionStorage.setItem(key, JSON.stringify(next))
      },
    }),
    [ids, key],
  )
}