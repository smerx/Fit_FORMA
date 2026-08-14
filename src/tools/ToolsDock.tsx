import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ListTodo, Mic, AudioLines } from 'lucide-react'
import { ToolsBoundary } from './error-boundary'
import { PlannerApp } from './PlannerApp'
import { TranscriptApp } from './TranscriptApp'
import { VoicePlanApp } from './VoicePlanApp'
import { useToolsOptional } from './store'
import type { ToolId } from './types'

const ITEMS: { id: ToolId; title: string; sub: string; icon: typeof Mic; flag: 'transcriptOn' | 'voicePlanOn' | 'plannerOn' }[] =
  [
    { id: 'transcript', title: 'Расшифровка ГС', sub: 'Голос → текст', icon: Mic, flag: 'transcriptOn' },
    {
      id: 'voiceplan',
      title: 'Расшифровка ГС в планирование',
      sub: 'Голос → текст → в календарь',
      icon: AudioLines,
      flag: 'voicePlanOn',
    },
    { id: 'planner', title: 'Планирование', sub: 'Календарь и журнал дел', icon: ListTodo, flag: 'plannerOn' },
  ]

export function ToolsDock() {
  const tools = useToolsOptional()
  if (!tools) return null
  const { settings, open, setOpen } = tools
  const visible = ITEMS.filter((i) => settings[i.flag])
  if (!visible.length && !open) return null

  const overlay =
    open &&
    (
      <ToolsBoundary name={open} fallback={<ToolCrash onClose={() => setOpen(null)} />}>
        <ToolFrame title={ITEMS.find((i) => i.id === open)?.title ?? ''} onClose={() => setOpen(null)}>
          {open === 'transcript' && <TranscriptApp />}
          {open === 'voiceplan' && <VoicePlanApp />}
          {open === 'planner' && <PlannerApp />}
        </ToolFrame>
      </ToolsBoundary>
    )

  const root = typeof document !== 'undefined' ? document.getElementById('phone-root') : null

  return (
    <>
      {visible.length > 0 && (
        <section className="mt-6 space-y-2 pb-4">
          <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/25">
            Инструменты
          </h2>
          {visible.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setOpen(item.id)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.03] px-3 py-3 text-left"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/50">
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-white/70">{item.title}</span>
                  <span className="block text-[11px] text-white/30">{item.sub}</span>
                </span>
              </button>
            )
          })}
        </section>
      )}
      {overlay && root ? createPortal(overlay, root) : overlay}
    </>
  )
}

function ToolFrame({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-bg">
      <header className="flex items-center gap-1 px-2 pt-[max(10px,env(safe-area-inset-top))]">
        <button onClick={onClose} className="flex h-12 w-12 items-center justify-center">
          <ChevronLeft />
        </button>
        <h1 className="text-lg font-bold">{title}</h1>
      </header>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pt-2">{children}</div>
    </div>
  )
}

function ToolCrash({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-bg px-5 pt-16">
      <p className="text-white/70">Этот инструмент упал. Еда и вес на месте.</p>
      <button onClick={onClose} className="mt-4 h-12 rounded-2xl bg-white/8">
        Закрыть
      </button>
    </div>
  )
}

export function ToolsSettings() {
  const tools = useToolsOptional()
  const [keyDraft, setKeyDraft] = useState(tools?.settings.groqKey ?? '')

  useEffect(() => {
    setKeyDraft(tools?.settings.groqKey ?? '')
  }, [tools?.settings.groqKey])

  if (!tools) return null
  const s = tools.settings
  return (
    <div className="space-y-3 rounded-3xl bg-white/5 p-3">
      <div className="text-sm font-semibold">Инструменты</div>
      <p className="text-[11px] text-white/40">
        Три отдельных приложения внизу вкладки «Прогресс». Можно выключить по одному. Ключ Groq — только для голоса.
      </p>
      <label className="block">
        <span className="mb-1 block text-xs text-white/45">Groq API key</span>
        <input
          type="password"
          autoComplete="off"
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          onBlur={() => void tools.saveSettings({ groqKey: keyDraft.trim() })}
          placeholder="gsk_..."
          className="h-11 w-full rounded-2xl bg-white/8 px-3 text-sm outline-none"
        />
      </label>
      <a
        href="https://console.groq.com/keys"
        target="_blank"
        rel="noreferrer"
        className="block text-xs text-mint"
      >
        Взять бесплатный ключ →
      </a>
      <Toggle label="Расшифровка ГС" on={s.transcriptOn} onChange={(transcriptOn) => void tools.saveSettings({ transcriptOn })} />
      <Toggle
        label="ГС → планирование"
        on={s.voicePlanOn}
        onChange={(voicePlanOn) => void tools.saveSettings({ voicePlanOn })}
      />
      <Toggle label="Планирование" on={s.plannerOn} onChange={(plannerOn) => void tools.saveSettings({ plannerOn })} />
    </div>
  )
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-1 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
