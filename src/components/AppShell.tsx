import type { ReactNode } from 'react'
import { BottomNav } from './BottomNav'
import { useStore } from '../lib/store'

export function AppShell({ children }: { children: ReactNode }) {
  const { syncHint } = useStore()
  return (
    <div className="min-h-dvh bg-black md:flex md:items-center md:justify-center md:py-4">
      <div className="relative mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-bg md:h-[min(900px,100dvh)] md:rounded-[32px] md:border md:border-white/10 md:shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        {syncHint && (
          <div className="bg-amber-500/15 px-3 py-2 text-center text-xs text-amber-200">
            {syncHint}
          </div>
        )}
        <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pt-[max(14px,env(safe-area-inset-top))]">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
