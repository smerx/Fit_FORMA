import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, GraduationCap } from 'lucide-react'
import { ToolsBoundary } from '../tools/error-boundary'
import { TutorsApp } from './TutorsApp'
import { useTutorsOptional } from './store'
import { todayIso } from '../lib/dates'
import { rosterIds } from './money'
import { requestReminderPermission } from './remind'

export function TutorsDock() {
  const tutors = useTutorsOptional()
  if (!tutors?.settings.enabled) return null
  const todayCount = rosterIds(tutors.students, tutors.lessons, todayIso()).length
  const root = typeof document !== 'undefined' ? document.getElementById('phone-root') : null
  const overlay = tutors.open && (
    <ToolsBoundary name="tutors" fallback={<Crash onClose={() => tutors.setOpen(false)} />}>
      <div className="absolute inset-0 z-30 flex flex-col bg-bg">
        <header className="flex items-center gap-1 px-2 pt-[max(10px,env(safe-area-inset-top))]">
          <button onClick={() => tutors.setOpen(false)} className="flex h-12 w-12 items-center justify-center">
            <ChevronLeft />
          </button>
          <h1 className="text-lg font-bold">Ученики</h1>
        </header>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pt-2">
          <TutorsApp />
        </div>
      </div>
    </ToolsBoundary>
  )

  return (
    <>
      <button
        onClick={() => {
          tutors.setOpen(true)
          if (tutors.settings.remindersOn) void requestReminderPermission()
        }}
        className="flex w-full items-center gap-3 rounded-3xl bg-white/[0.04] px-4 py-3 text-left"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/8 text-white/60">
          <GraduationCap size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-white/80">Ученики</span>
          <span className="block text-[11px] text-white/35">
            {todayCount ? `сегодня ${todayCount}` : 'расписание, оплаты, прогноз'}
          </span>
        </span>
      </button>
      {overlay && root ? createPortal(overlay, root) : overlay}
    </>
  )
}

function Crash({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-bg px-5 pt-16">
      <p className="text-white/70">Ученики упали. Движение и еда на месте.</p>
      <button onClick={onClose} className="mt-4 h-12 rounded-2xl bg-white/8">
        Закрыть
      </button>
    </div>
  )
}

export function TutorsSettings() {
  const tutors = useTutorsOptional()
  const [details, setDetails] = useState(tutors?.settings.payDetails ?? '')

  useEffect(() => {
    setDetails(tutors?.settings.payDetails ?? '')
  }, [tutors?.settings.payDetails])

  if (!tutors) return null
  const s = tutors.settings
  return (
    <div className="space-y-3 rounded-3xl bg-white/5 p-3">
      <div className="text-sm font-semibold">Ученики</div>
      <p className="text-[11px] text-white/40">
        Отдельное приложение на вкладке «Движение». Можно выключить — калории и остальные инструменты не заденет.
      </p>
      <label className="flex items-center justify-between py-1 text-sm">
        <span>Показывать учеников</span>
        <input
          type="checkbox"
          checked={s.enabled}
          onChange={(e) => void tutors.saveSettings({ enabled: e.target.checked })}
        />
      </label>
      <label className="flex items-center justify-between py-1 text-sm">
        <span>Пуш за 15 минут до занятия</span>
        <input
          type="checkbox"
          checked={s.remindersOn}
          onChange={(e) => {
            const on = e.target.checked
            if (on) {
              void requestReminderPermission().then((ok) => {
                void tutors.saveSettings({ remindersOn: ok })
              })
            } else {
              void tutors.saveSettings({ remindersOn: false })
            }
          }}
        />
      </label>
      <p className="text-[11px] text-white/35">
        Разреши уведомления для Chrome / Формы. Надёжнее, если приложение стоит на экране и его не выкидывают из памяти.
      </p>
      <label className="block">
        <span className="mb-1 block text-xs text-white/45">Реквизиты в тексте оплаты</span>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          onBlur={() => void tutors.saveSettings({ payDetails: details.trim() })}
          className="min-h-16 w-full rounded-2xl bg-white/8 p-3 text-sm outline-none"
        />
      </label>
    </div>
  )
}
