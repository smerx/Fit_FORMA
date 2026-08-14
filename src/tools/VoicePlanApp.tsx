import { useState } from 'react'
import { Recorder } from './Recorder'
import { transcribeAudio, transcriptToPlan } from './groq'
import { useTools } from './store'
import { todayIso } from '../lib/dates'

type Draft = { title: string; notes: string; dueOn: string | null }

export function VoicePlanApp() {
  const { settings, addTranscript, addTasks, setOpen } = useTools()
  const [text, setText] = useState('')
  const [lastDur, setLastDur] = useState(0)
  const [drafts, setDrafts] = useState<(Draft & { keep: boolean })[]>([])
  const [busy, setBusy] = useState<'off' | 'stt' | 'plan'>('off')
  const [err, setErr] = useState<string | null>(null)

  async function fromBlob(blob: Blob, durationSec: number) {
    if (!settings.groqKey) {
      setErr('Сначала вставь Groq-ключ в настройках.')
      return
    }
    setBusy('stt')
    setErr(null)
    setDrafts([])
    try {
      const out = await transcribeAudio(blob, settings.groqKey)
      setText(out)
      setLastDur(durationSec)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка расшифровки')
    } finally {
      setBusy('off')
    }
  }

  async function makePlan() {
    if (!settings.groqKey || !text.trim()) return
    setBusy('plan')
    setErr(null)
    try {
      const plan = await transcriptToPlan(text, settings.groqKey, todayIso())
      setDrafts(plan.tasks.map((t) => ({ ...t, keep: true })))
      if (!plan.tasks.length) setErr('Дел в тексте не нашёл — можно поправить расшифровку и снова нажать «План».')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не собрал план')
    } finally {
      setBusy('off')
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <p className="text-sm text-white/50">
        Наговорил день вслух → сначала текст, потом отдельно можно вытащить чеклист. Ничего само в дела не падает.
      </p>
      <Recorder disabled={busy !== 'off' || !settings.groqKey} onReady={(blob, sec) => void fromBlob(blob, sec)} />
      {!settings.groqKey && (
        <p className="text-sm text-amber-200/80">Нужен ключ Groq в настройках профиля.</p>
      )}
      {busy === 'stt' && <p className="text-sm text-mint">Расшифровываю речь...</p>}
      {busy === 'plan' && <p className="text-sm text-mint">Собираю дела из текста...</p>}
      {err && <p className="text-sm text-carbs">{err}</p>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Расшифровка..."
        className="min-h-36 w-full rounded-3xl bg-white/5 p-4 text-sm leading-relaxed outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={!text.trim()}
          onClick={() => void addTranscript({ text, durationSec: lastDur })}
          className="h-12 rounded-2xl bg-white/8 font-semibold disabled:opacity-40"
        >
          Только текст
        </button>
        <button
          disabled={!text.trim() || busy !== 'off'}
          onClick={() => void makePlan()}
          className="h-12 rounded-2xl bg-mint font-bold text-bg disabled:opacity-40"
        >
          Составить план
        </button>
      </div>
      {drafts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-white/50">Черновик плана — сними лишнее</h2>
          {drafts.map((d, i) => (
            <label key={`${d.title}-${i}`} className="flex items-start gap-3 rounded-2xl bg-card px-3 py-3">
              <input
                type="checkbox"
                checked={d.keep}
                onChange={(e) => {
                  const on = e.target.checked
                  setDrafts((xs) => xs.map((x, j) => (j === i ? { ...x, keep: on } : x)))
                }}
              />
              <div>
                <div className="font-medium">{d.title}</div>
                {(d.dueOn || d.notes) && (
                  <div className="text-xs text-white/40">
                    {d.dueOn ?? ''} {d.notes}
                  </div>
                )}
              </div>
            </label>
          ))}
          <button
            onClick={async () => {
              await addTasks(
                drafts.filter((d) => d.keep).map(({ title, notes, dueOn }) => ({ title, notes, dueOn })),
                'voice',
              )
              setDrafts([])
              setOpen('planner')
            }}
            className="h-12 w-full rounded-2xl bg-mint font-bold text-bg"
          >
            В планирование
          </button>
        </section>
      )}
    </div>
  )
}
